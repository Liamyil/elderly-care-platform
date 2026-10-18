package com.elderly.care.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * JWT 登录令牌工具：签发 7 天有效期的令牌，载荷为 {userId, phone}
 */
@Component
public class JwtUtil {

    private final SecretKey key;

    public JwtUtil(AppConfig appConfig) {
        this.key = Keys.hmacShaKeyFor(appConfig.getJwtSecret().getBytes(StandardCharsets.UTF_8));
    }

    /** 签发令牌 */
    public String sign(Long userId, String phone) {
        return Jwts.builder()
                .claim("userId", userId)
                .claim("phone", phone)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 7L * 24 * 3600 * 1000))
                .signWith(key)
                .compact();
    }

    /** 解析令牌取出 userId，失败抛异常 */
    public Long parseUserId(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
        return ((Number) claims.get("userId")).longValue();
    }
}
