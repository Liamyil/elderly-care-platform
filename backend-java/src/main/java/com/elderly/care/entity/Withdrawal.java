package com.elderly.care.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 人民币提现申请表 withdrawals（双轨制·人民币体系）
 * 状态机：pending(待审核) → approved(审核通过，待线下打款) → paid(已打款)
 *         pending → rejected(已驳回，余额退回)
 * 建表语句见 SuperAdminInitializer（幂等 CREATE TABLE IF NOT EXISTS）。
 */
@Entity
@Table(name = "withdrawals")
public class Withdrawal {

    @Id
    @Column(length = 50)
    private String id;

    /** 申请人（互助员） */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 提现金额（单位元） */
    @Column(nullable = false)
    private BigDecimal amount;

    /** 状态：pending / approved / rejected / paid */
    @Column(nullable = false, length = 20)
    private String status;

    /** 驳回原因（驳回时必填） */
    @Column(name = "reject_reason", length = 255)
    private String rejectReason;

    /** 审核人（管理员用户 id） */
    @Column(name = "reviewer_id")
    private Long reviewerId;

    /** 审核时间 */
    @Column(name = "review_time")
    private LocalDateTime reviewTime;

    /** 线下打款完成时间（管理员标记） */
    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    /** 备注（打款备注等） */
    @Column(length = 255)
    private String remark;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getRejectReason() {
        return rejectReason;
    }

    public void setRejectReason(String rejectReason) {
        this.rejectReason = rejectReason;
    }

    public Long getReviewerId() {
        return reviewerId;
    }

    public void setReviewerId(Long reviewerId) {
        this.reviewerId = reviewerId;
    }

    public LocalDateTime getReviewTime() {
        return reviewTime;
    }

    public void setReviewTime(LocalDateTime reviewTime) {
        this.reviewTime = reviewTime;
    }

    public LocalDateTime getPaidAt() {
        return paidAt;
    }

    public void setPaidAt(LocalDateTime paidAt) {
        this.paidAt = paidAt;
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
