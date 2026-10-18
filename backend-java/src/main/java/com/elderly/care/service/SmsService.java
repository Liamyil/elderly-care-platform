package com.elderly.care.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * 短信服务（阿里云短信）：关键节点兜底通知（指派/超时）
 * 未配置 AccessKey 时静默跳过并打日志，不影响业务主流程
 */
@Service
public class SmsService {

    @Value("${app.sms.access-key-id:}")
    private String accessKeyId;

    @Value("${app.sms.access-key-secret:}")
    private String accessKeySecret;

    @Value("${app.sms.sign-name:}")
    private String signName;

    @Value("${app.sms.template-assign:}")
    private String templateAssign;

    @Value("${app.sms.template-timeout:}")
    private String templateTimeout;

    public boolean isEnabled() {
        return accessKeyId != null && !accessKeyId.isBlank()
                && accessKeySecret != null && !accessKeySecret.isBlank();
    }

    /** 发送短信：kind = assign（指派）/ timeout（超时） */
    public void send(String phone, String kind, String templateParamJson) {
        if (phone == null || phone.isBlank()) return;
        if (!isEnabled()) {
            System.out.println("[sms] 跳过（未配置 AccessKey）: phone=" + phone + " kind=" + kind);
            return;
        }
        String templateCode = "assign".equals(kind) ? templateAssign : templateTimeout;
        if (templateCode == null || templateCode.isBlank()) {
            System.out.println("[sms] 跳过（未配置模板）: kind=" + kind);
            return;
        }
        try {
            com.aliyun.teaopenapi.models.Config config = new com.aliyun.teaopenapi.models.Config()
                    .setAccessKeyId(accessKeyId)
                    .setAccessKeySecret(accessKeySecret);
            config.endpoint = "dysmsapi.aliyuncs.com";
            com.aliyun.dysmsapi20170525.Client client = new com.aliyun.dysmsapi20170525.Client(config);
            com.aliyun.dysmsapi20170525.models.SendSmsRequest req = new com.aliyun.dysmsapi20170525.models.SendSmsRequest()
                    .setPhoneNumbers(phone)
                    .setSignName(signName)
                    .setTemplateCode(templateCode)
                    .setTemplateParam(templateParamJson);
            com.aliyun.dysmsapi20170525.models.SendSmsResponse resp = client.sendSms(req);
            System.out.println("[sms] 发送结果: phone=" + phone + " code=" + resp.getBody().getCode());
        } catch (Exception e) {
            System.out.println("[sms] 发送异常: " + e.getMessage());
        }
    }
}
