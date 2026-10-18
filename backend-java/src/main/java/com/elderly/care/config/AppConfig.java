package com.elderly.care.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.File;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Enumeration;

/**
 * 平台配置：JWT 密钥 / 图片访问基础地址 / 上传目录 / 服务端口
 */
@Component
public class AppConfig {

    @Value("${app.jwt-secret}")
    private String jwtSecret;

    @Value("${app.base-url:}")
    private String baseUrl;

    @Value("${app.upload-dir}")
    private String uploadDir;

    @Value("${server.port:8080}")
    private int port;

    /**
     * 图片访问基础地址：优先用配置的 baseUrl（云端部署时设置），
     * 否则自动检测本机局域网 IP（对应原 Node 版 IMAGE_BASE_URL 逻辑）
     */
    public String imageBaseUrl() {
        if (baseUrl != null && !baseUrl.isBlank()) {
            return baseUrl;
        }
        return "http://" + detectLanIp() + ":" + port;
    }

    /** 上传目录绝对路径（统一斜杠、带结尾 /） */
    public String uploadDirAbsolute() {
        String path = new File(uploadDir).getAbsolutePath().replace(File.separatorChar, '/');
        return path.endsWith("/") ? path : path + "/";
    }

    /** 检测本机局域网 IPv4 地址 */
    private String detectLanIp() {
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface ni = interfaces.nextElement();
                if (!ni.isUp() || ni.isLoopback()) continue;
                Enumeration<InetAddress> addresses = ni.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress addr = addresses.nextElement();
                    if (addr instanceof Inet4Address && !addr.isLoopbackAddress()) {
                        return addr.getHostAddress();
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return "localhost";
    }

    public String getJwtSecret() {
        return jwtSecret;
    }
}
