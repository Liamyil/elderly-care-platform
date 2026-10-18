package com.elderly.care.service;

import com.elderly.care.entity.User;
import com.elderly.care.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * 通知服务（订阅消息 + 短信兜底）：
 * - 订阅消息（免费，主力）：assign 指派 / timeout 超时 / settle 结算到账
 * - 短信（按量，兜底）：仅 assign / timeout 两个关键节点
 * 微信/短信未配置时全部静默跳过（打日志），不影响业务主流程
 */
@Service
public class NotifyService {

    @Value("${app.wechat.template-assign:}")
    private String tplAssign;

    @Value("${app.wechat.template-timeout:}")
    private String tplTimeout;

    @Value("${app.wechat.template-settle:}")
    private String tplSettle;

    private final WechatService wechatService;
    private final SmsService smsService;
    private final UserRepository userRepository;

    public NotifyService(WechatService wechatService, SmsService smsService, UserRepository userRepository) {
        this.wechatService = wechatService;
        this.smsService = smsService;
        this.userRepository = userRepository;
    }

    /** 发给指定用户的订阅消息（用户未绑定 openid 时跳过） */
    public void notifySubscribe(Long userId, String kind, Map<String, String> data, String page) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null || user.getOpenid() == null || user.getOpenid().isBlank()) {
            System.out.println("[notify] 订阅消息跳过（未绑定 openid）: userId=" + userId + " kind=" + kind);
            return;
        }
        wechatService.sendSubscribe(user.getOpenid(), templateOf(kind), page, data);
    }

    /** 发给指定用户的短信（关键节点兜底） */
    public void notifySms(Long userId, String kind, String templateParamJson) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return;
        smsService.send(user.getPhone(), kind, templateParamJson);
    }

    private String templateOf(String kind) {
        if ("assign".equals(kind)) return tplAssign;
        if ("timeout".equals(kind)) return tplTimeout;
        if ("settle".equals(kind)) return tplSettle;
        return "";
    }
}
