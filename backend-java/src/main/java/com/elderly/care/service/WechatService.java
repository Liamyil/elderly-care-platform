package com.elderly.care.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 微信平台服务：登录码换 openid（code2session）+ 订阅消息发送
 * 未配置 appid/secret 或模板ID 时全部静默跳过并打日志，不影响业务主流程
 */
@Service
public class WechatService {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    @Value("${app.wechat.appid:}")
    private String appid;

    @Value("${app.wechat.secret:}")
    private String secret;

    @Value("${app.wechat.miniprogram-state:trial}")
    private String miniprogramState;

    /** access_token 缓存（提前 5 分钟过期） */
    private volatile String cachedToken;
    private volatile long tokenExpireAt = 0;

    public boolean isEnabled() {
        return appid != null && !appid.isBlank() && secret != null && !secret.isBlank();
    }

    /** 小程序登录码换 openid（wx.login 的 code 只能用一次） */
    public String code2session(String code) {
        if (!isEnabled() || code == null || code.isBlank()) {
            System.out.println("[wechat] code2session 跳过（未配置 appid/secret 或缺 code）");
            return null;
        }
        try {
            String url = "https://api.weixin.qq.com/sns/jscode2session?appid=" + appid
                    + "&secret=" + secret + "&js_code=" + code + "&grant_type=authorization_code";
            JsonNode node = getJson(url);
            if (node != null && node.has("openid")) {
                return node.get("openid").asText();
            }
            System.out.println("[wechat] code2session 失败: " + (node == null ? "无响应" : node));
        } catch (Exception e) {
            System.out.println("[wechat] code2session 异常: " + e.getMessage());
        }
        return null;
    }

    /** 获取 access_token（带缓存） */
    private String accessToken() {
        if (!isEnabled()) return null;
        long now = System.currentTimeMillis();
        if (cachedToken != null && now < tokenExpireAt) return cachedToken;
        try {
            String url = "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=" + appid + "&secret=" + secret;
            JsonNode node = getJson(url);
            if (node != null && node.has("access_token")) {
                cachedToken = node.get("access_token").asText();
                long expiresIn = node.has("expires_in") ? node.get("expires_in").asLong() : 7200;
                tokenExpireAt = now + (expiresIn - 300) * 1000;
                return cachedToken;
            }
            System.out.println("[wechat] 获取 access_token 失败: " + (node == null ? "无响应" : node));
        } catch (Exception e) {
            System.out.println("[wechat] 获取 access_token 异常: " + e.getMessage());
        }
        return null;
    }

    /**
     * 发送订阅消息
     * data 的 key 必须与公众平台申请的模板字段一致（如 thing1/time2/amount3）
     */
    public void sendSubscribe(String openid, String templateId, String page, Map<String, String> data) {
        if (openid == null || openid.isBlank() || templateId == null || templateId.isBlank()) {
            System.out.println("[wechat] 订阅消息跳过（openid 或模板ID 未配置）: openid=" + openid + " tpl=" + templateId);
            return;
        }
        String token = accessToken();
        if (token == null) {
            System.out.println("[wechat] 订阅消息跳过（access_token 不可用）: tpl=" + templateId);
            return;
        }
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("touser", openid);
            body.put("template_id", templateId);
            if (page != null && !page.isBlank()) body.put("page", page);
            body.put("miniprogram_state", miniprogramState);
            Map<String, Object> payload = new LinkedHashMap<>();
            for (Map.Entry<String, String> e : data.entrySet()) {
                Map<String, String> item = new LinkedHashMap<>();
                item.put("value", e.getValue());
                payload.put(e.getKey(), item);
            }
            body.put("data", payload);

            String url = "https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=" + token;
            JsonNode node = postJson(url, objectMapper.writeValueAsString(body));
            if (node != null && node.has("errcode") && node.get("errcode").asInt() != 0) {
                System.out.println("[wechat] 订阅消息发送失败: " + node);
            } else {
                System.out.println("[wechat] 订阅消息已发送: tpl=" + templateId + " openid=" + openid);
            }
        } catch (Exception e) {
            System.out.println("[wechat] 订阅消息发送异常: " + e.getMessage());
        }
    }

    private JsonNode getJson(String url) throws Exception {
        HttpRequest req = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(8)).GET().build();
        HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
        return objectMapper.readTree(res.body());
    }

    private JsonNode postJson(String url, String json) throws Exception {
        HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(8))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();
        HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
        return objectMapper.readTree(res.body());
    }
}
