package com.elderly.care.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 时间银行流水表 transactions（方案中的"时间银行台账"）
 * type: income(收入) / expense(支出)
 * asset_type: time_coin(时间币) / rmb(人民币)，双轨制彻底隔离（老数据为空视为 time_coin）
 */
@Entity
@Table(name = "transactions")
public class Transaction {

    /** 流水号 TX + 时间戳（转赠双方各一条，接收方带 T 后缀） */
    @Id
    @Column(length = 50)
    private String id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 20)
    private String type;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(nullable = false)
    private Integer amount;

    /** 币种：time_coin 时间币 / rmb 人民币 */
    @Column(name = "asset_type", length = 20)
    private String assetType;

    /** 人民币流水金额（asset_type=rmb 时使用，单位元；时间币流水为 null） */
    @Column(name = "rmb_amount")
    private BigDecimal rmbAmount;

    @Column(name = "created_at", insertable = false, updatable = false)
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

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer getAmount() {
        return amount;
    }

    public void setAmount(Integer amount) {
        this.amount = amount;
    }

    public String getAssetType() {
        return assetType;
    }

    public void setAssetType(String assetType) {
        this.assetType = assetType;
    }

    public BigDecimal getRmbAmount() {
        return rmbAmount;
    }

    public void setRmbAmount(BigDecimal rmbAmount) {
        this.rmbAmount = rmbAmount;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
