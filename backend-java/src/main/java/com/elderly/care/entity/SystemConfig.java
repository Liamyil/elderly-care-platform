package com.elderly.care.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * 系统配置表 system_configs：社区管理员可修改的基础业务参数（键值对），
 * 每次修改由 SystemConfigService 写入操作日志（修改前后内容）。
 * 建表语句见 SuperAdminInitializer。
 */
@Entity
@Table(name = "system_configs")
public class SystemConfig {

    /** 配置键 */
    public static final String KEY_GRAB_RADIUS_KM = "helper_grab_radius_km";
    public static final String KEY_MAX_CONCURRENT_ORDERS = "helper_max_concurrent_orders";
    /** 微信支付模拟开关：1=模拟支付（支付即成功，试玩阶段），0=走真实微信支付（需商户号配置） */
    public static final String KEY_PAY_MOCK = "pay_mock";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 配置键（唯一） */
    @Column(name = "config_key", unique = true, length = 50)
    private String configKey;

    /** 配置值（字符串存储，使用方自行解析） */
    @Column(name = "config_value", length = 100)
    private String configValue;

    /** 最后修改人（管理员用户 id） */
    @Column(name = "updated_by")
    private Long updatedBy;

    /** 最后修改时间 */
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getConfigKey() {
        return configKey;
    }

    public void setConfigKey(String configKey) {
        this.configKey = configKey;
    }

    public String getConfigValue() {
        return configValue;
    }

    public void setConfigValue(String configValue) {
        this.configValue = configValue;
    }

    public Long getUpdatedBy() {
        return updatedBy;
    }

    public void setUpdatedBy(Long updatedBy) {
        this.updatedBy = updatedBy;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
