package com.elderly.care.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * 操作日志表 operation_logs：配置修改 / 强制取消 / 强制指派 三类高危操作留痕。
 * 不可篡改约定：只提供插入与查询，不提供任何修改 / 删除接口（append-only）。
 * 建表语句见 SuperAdminInitializer。
 */
@Entity
@Table(name = "operation_logs")
public class OperationLog {

    /** 操作类型 */
    public static final String TYPE_CONFIG_CHANGE = "CONFIG_CHANGE";
    public static final String TYPE_FORCE_CANCEL = "FORCE_CANCEL";
    public static final String TYPE_FORCE_ASSIGN = "FORCE_ASSIGN";
    public static final String TYPE_MANUAL_REFUND = "MANUAL_REFUND";
    public static final String TYPE_WITHDRAW_APPROVE = "WITHDRAW_APPROVE";
    public static final String TYPE_WITHDRAW_REJECT = "WITHDRAW_REJECT";
    public static final String TYPE_WITHDRAW_PAID = "WITHDRAW_PAID";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 操作人（管理员用户 id） */
    @Column(name = "operator_id")
    private Long operatorId;

    /** 操作类型：CONFIG_CHANGE / FORCE_CANCEL / FORCE_ASSIGN */
    @Column(name = "operate_type", length = 30)
    private String operateType;

    /** 修改前内容（配置项/订单状态快照，JSON 或文本） */
    @Column(name = "before_content", columnDefinition = "TEXT")
    private String beforeContent;

    /** 修改后内容 */
    @Column(name = "after_content", columnDefinition = "TEXT")
    private String afterContent;

    /** 备注 / 原因（强制取消、强制指派时必填） */
    @Column(length = 255)
    private String remark;

    /** 操作时间（应用层写入） */
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getOperatorId() {
        return operatorId;
    }

    public void setOperatorId(Long operatorId) {
        this.operatorId = operatorId;
    }

    public String getOperateType() {
        return operateType;
    }

    public void setOperateType(String operateType) {
        this.operateType = operateType;
    }

    public String getBeforeContent() {
        return beforeContent;
    }

    public void setBeforeContent(String beforeContent) {
        this.beforeContent = beforeContent;
    }

    public String getAfterContent() {
        return afterContent;
    }

    public void setAfterContent(String afterContent) {
        this.afterContent = afterContent;
    }

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
