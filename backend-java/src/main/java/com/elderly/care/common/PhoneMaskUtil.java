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

    /** 姓名脱敏：保留首字，其余打码，如 张三 → 张**。抢单大厅未接单订单的发布人展示用。 */
    public static String maskName(String name) {
        if (name == null || name.isBlank()) {
            return name;
        }
        return name.trim().charAt(0) + "**";
    }
}
