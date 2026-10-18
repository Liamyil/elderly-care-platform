package com.elderly.care.config;

import org.bouncycastle.crypto.generators.SCrypt;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;

/**
 * 密码加密工具：scrypt 哈希 + 随机盐，存储格式 s2$<盐hex>$<哈希hex>
 * 与 Node 版 crypto.scryptSync(password, saltHex, 32) 完全兼容（N=16384, r=8, p=1，盐为 hex 字符串的字节）
 */
@Component
public class PasswordHasher {

    private static final SecureRandom RANDOM = new SecureRandom();

    /** 生成哈希（注册时使用） */
    public String hash(String password) {
        byte[] saltBytes = new byte[16];
        RANDOM.nextBytes(saltBytes);
        String saltHex = toHex(saltBytes);
        byte[] dk = SCrypt.generate(
                password.getBytes(StandardCharsets.UTF_8),
                saltHex.getBytes(StandardCharsets.US_ASCII),
                16384, 8, 1, 32);
        return "s2$" + saltHex + "$" + toHex(dk);
    }

    /** 校验密码：兼容历史明文密码（登录成功后由业务层升级为哈希） */
    public boolean verify(String password, String stored) {
        if (stored == null) {
            return false;
        }
        if (!stored.startsWith("s2$")) {
            return stored.equals(password);
        }
        String[] parts = stored.split("\\$");
        if (parts.length != 3) {
            return false;
        }
        byte[] dk = SCrypt.generate(
                password.getBytes(StandardCharsets.UTF_8),
                parts[1].getBytes(StandardCharsets.US_ASCII),
                16384, 8, 1, 32);
        return MessageDigest.isEqual(dk, fromHex(parts[2]));
    }

    private static String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    private static byte[] fromHex(String hex) {
        byte[] out = new byte[hex.length() / 2];
        for (int i = 0; i < out.length; i++) {
            out[i] = (byte) Integer.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        }
        return out;
    }
}
