package com.elderly.care.common;

/**
 * 手机号脱敏工具：中间四位打码，如 13812348888 → 138****8888。
 * 街道民政管理员查看老人基础信息时使用；超管与社区管理员看完整号码。
 */
public class PhoneMaskUtil {

    private PhoneMaskUtil() {
    }

    public static String mask(String phone) {
        if (phone == null || phone.length() < 7) {
            return phone;
        }
        return phone.substring(0, 3) + "****" + phone.substring(7);
    }
}
