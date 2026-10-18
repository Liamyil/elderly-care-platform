package com.elderly.care.service;

import com.elderly.care.common.Result;
import com.elderly.care.entity.Order;
import com.elderly.care.entity.SystemConfig;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * 微信支付服务（一期：模拟支付）：
 * system_configs.pay_mock=1 时支付即成功（试玩阶段跑通全流程，无真实扣款，见 OrderService.pay）；
 * 接入真实微信支付 V3 时：在 createPayParams 中读取商户号/证书等配置（不硬编码任何商户信息），
 * 生成 JSAPI 支付参数返回小程序 wx.requestPayment 拉起支付，并在支付回调接口验签后置 pay_status=paid。
 */
@Service
public class WechatPayService {

    private final SystemConfigService systemConfigService;

    public WechatPayService(SystemConfigService systemConfigService) {
        this.systemConfigService = systemConfigService;
    }

    /** 是否模拟支付模式（pay_mock=1；未配置时默认模拟，保证试玩流程可跑通） */
    public boolean isMockMode() {
        return systemConfigService.getIntValue(SystemConfig.KEY_PAY_MOCK, 1) == 1;
    }

    /** 真实微信支付下单（预留接口，未接入商户号时一律拒绝） */
    public Result<Map<String, Object>> createPayParams(Order order, String openid) {
        return Result.error(400, "微信支付尚未接入，当前仅支持模拟支付");
    }
}
