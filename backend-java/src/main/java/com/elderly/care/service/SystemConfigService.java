package com.elderly.care.service;

import com.elderly.care.common.Result;
import com.elderly.care.entity.OperationLog;
import com.elderly.care.entity.SystemConfig;
import com.elderly.care.repository.SystemConfigRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 系统配置服务：基础业务参数（接单距离上限 / 并发订单数上限）读取与修改。
 * 每次修改强制写入操作日志（记录修改前后内容），日志 append-only 不可篡改。
 */
@Service
public class SystemConfigService {

    private final SystemConfigRepository configRepository;
    private final OperationLogService operationLogService;

    public SystemConfigService(SystemConfigRepository configRepository, OperationLogService operationLogService) {
        this.configRepository = configRepository;
        this.operationLogService = operationLogService;
    }

    /** 全部配置项列表（管理端展示） */
    public List<SystemConfig> listAll() {
        return configRepository.findAll();
    }

    /** 读取字符串配置值，不存在返回默认值 */
    public String getValue(String key, String defaultValue) {
        return configRepository.findByConfigKey(key)
                .map(SystemConfig::getConfigValue)
                .orElse(defaultValue);
    }

    /** 读取整数配置值，不存在或解析失败返回默认值 */
    public int getIntValue(String key, int defaultValue) {
        try {
            String v = getValue(key, null);
            return v == null ? defaultValue : Integer.parseInt(v.trim());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    /** 读取小数配置值，不存在或解析失败返回默认值 */
    public double getDoubleValue(String key, double defaultValue) {
        try {
            String v = getValue(key, null);
            return v == null ? defaultValue : Double.parseDouble(v.trim());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    /**
     * 修改配置（仅社区管理员 / 超管可调用，接口层校验角色）：
     * 校验配置键与取值范围 → 记录修改前后内容 → 写操作日志。
     */
    public Result<SystemConfig> update(Long operatorId, String key, String value) {
        if (key == null || key.isBlank() || value == null || value.isBlank()) {
            return Result.error(400, "配置项与配置值不能为空");
        }
        boolean known = SystemConfig.KEY_GRAB_RADIUS_KM.equals(key)
                || SystemConfig.KEY_MAX_CONCURRENT_ORDERS.equals(key);
        if (!known) {
            return Result.error(400, "未知配置项：" + key);
        }
        double num;
        try {
            num = Double.parseDouble(value.trim());
        } catch (NumberFormatException e) {
            return Result.error(400, "配置值必须为数字");
        }
        if (SystemConfig.KEY_GRAB_RADIUS_KM.equals(key) && (num < 1 || num > 100)) {
            return Result.error(400, "接单距离上限范围：1 ~ 100 公里");
        }
        if (SystemConfig.KEY_MAX_CONCURRENT_ORDERS.equals(key) && (num < 1 || num > 20)) {
            return Result.error(400, "并发订单数上限范围：1 ~ 20 个");
        }

        SystemConfig config = configRepository.findByConfigKey(key).orElse(null);
        String before = config == null ? null : config.getConfigValue();
        String after = value.trim();
        if (config == null) {
            config = new SystemConfig();
            config.setConfigKey(key);
        }
        config.setConfigValue(after);
        config.setUpdatedBy(operatorId);
        config.setUpdatedAt(LocalDateTime.now());
        configRepository.save(config);

        operationLogService.record(operatorId, OperationLog.TYPE_CONFIG_CHANGE,
                contentJson(key, before), contentJson(key, after), "修改系统配置 " + key);
        return Result.ok("配置已更新", config);
    }

    /** 配置项前后内容 JSON：{"key":"...","value":"..."}（value 为 null 表示修改前不存在） */
    private String contentJson(String key, String value) {
        return "{\"key\":\"" + key + "\",\"value\":\"" + (value == null ? "" : value) + "\"}";
    }
}
