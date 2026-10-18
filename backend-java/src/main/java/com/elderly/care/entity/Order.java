package com.elderly.care.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 互助订单表 orders
 * 状态机：pending(待接单) → serving(服务中) → pending_confirm(待确认) → completed(已完成)
 * pending/serving 可流转 cancelled(已取消)；completed 后可 evaluated(已评价)
 */
@Entity
@Table(name = "orders")
public class Order {

    /** 订单号，格式 DD + 时间戳（如 DD6606735536） */
    @Id
    @Column(length = 50)
    private String id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 服务类型：助餐服务 / 陪诊服务 / 代买代办 等 */
    @Column(nullable = false, length = 100)
    private String type;

    /** 服务子类型（陪诊：上门接送/2小时陪诊等；评价按子类型精准展示用） */
    @Column(name = "sub_type", length = 50)
    private String subType;

    /** 就诊人关系：本人/家人 */
    @Column(name = "patient_relation", length = 10)
    private String patientRelation;

    /** 就诊人姓名 */
    @Column(name = "patient_name", length = 50)
    private String patientName;

    /** 就诊人年龄 */
    @Column(name = "patient_age", length = 10)
    private String patientAge;

    /** 帮办事项 JSON 数组（挂号/缴费等，结构化统计用） */
    @Column(columnDefinition = "text")
    private String tasks;

    /** 健康评估结果 JSON（risk/score/summaryText） */
    @Column(columnDefinition = "text")
    private String assessment;

    /** 人民币价格文本（陪诊服务以人民币结算展示用，如 50元一次） */
    @Column(name = "price_text", length = 50)
    private String priceText;

    /** 结算币种：time_coin 时间币 / rmb 人民币（null 为双轨制上线前的历史订单） */
    @Column(name = "asset_type", length = 20)
    private String assetType;

    /** 人民币订单金额（陪诊类，单位元） */
    @Column(name = "rmb_amount")
    private BigDecimal rmbAmount;

    /** 支付状态（人民币订单）：unpaid 待支付 / paid 已支付 / refunded 已退款 */
    @Column(name = "pay_status", length = 20)
    private String payStatus;

    /** 下单冻结的时间币（互助类发单即扣，取消退回，完成结算给互助员） */
    @Column(name = "frozen_coins")
    private Integer frozenCoins;

    /** 是否已结算打款给互助员 0/1（防重复结算） */
    private Integer settled;

    /** 是否已退款给下单人 0/1（防重复退款） */
    private Integer refunded;

    /** 服务时长（小时）：互助类 1小时=1时间币，后端按时长自动算币 */
    private Integer hours;

    @Column(nullable = false, length = 500)
    private String address;

    /** 预约时间（字符串，如 2026-07-10 10:30） */
    @Column(name = "service_time", nullable = false, length = 50)
    private String serviceTime;

    /** 当前总奖励（含追加） */
    @Column(nullable = false)
    private Integer reward;

    /** 发布时的原始奖励（用于计算追加部分） */
    @Column(name = "original_reward")
    private Integer originalReward;

    /** 状态中文名：待接单 / 服务中 / 待确认 / 已完成 / 已取消 */
    @Column(length = 20)
    private String status;

    /** 状态英文键：pending / serving / pending_confirm / completed / cancelled */
    @Column(name = "status_key", length = 20)
    private String statusKey;

    /** 接单互助员姓名 */
    @Column(length = 50)
    private String helper;

    /** 接单互助员用户ID（老数据可能为空） */
    @Column(name = "helper_id")
    private Long helperId;

    @Column(length = 20)
    private String distance;

    @Column(columnDefinition = "text")
    private String remark;

    /** 现场图片 JSON 数组字符串 */
    @Column(columnDefinition = "text")
    private String images;

    @Column(name = "cancel_reason", length = 500)
    private String cancelReason;

    @Column(name = "cancel_time")
    private LocalDateTime cancelTime;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    /** 是否已评价 0/1 */
    @Column(name = "evaluated")
    private Integer evaluated;

    @Column(name = "rating")
    private Integer rating;

    @Column(columnDefinition = "text")
    private String comment;

    /** 软删除标记 0/1 */
    @Column(name = "is_deleted")
    private Integer isDeleted;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    /** 由数据库 ON UPDATE CURRENT_TIMESTAMP 自动维护 */
    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    @Column(name = "accepted_at")
    private LocalDateTime acceptedAt;

    /** 服务超时提醒是否已发送 0/1 */
    @Column(name = "timeout_notified")
    private Integer timeoutNotified;

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

    public String getSubType() {
        return subType;
    }

    public void setSubType(String subType) {
        this.subType = subType;
    }

    public String getPatientRelation() {
        return patientRelation;
    }

    public void setPatientRelation(String patientRelation) {
        this.patientRelation = patientRelation;
    }

    public String getPatientName() {
        return patientName;
    }

    public void setPatientName(String patientName) {
        this.patientName = patientName;
    }

    public String getPatientAge() {
        return patientAge;
    }

    public void setPatientAge(String patientAge) {
        this.patientAge = patientAge;
    }

    public String getTasks() {
        return tasks;
    }

    public void setTasks(String tasks) {
        this.tasks = tasks;
    }

    public String getAssessment() {
        return assessment;
    }

    public void setAssessment(String assessment) {
        this.assessment = assessment;
    }

    public String getPriceText() {
        return priceText;
    }

    public void setPriceText(String priceText) {
        this.priceText = priceText;
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

    public String getPayStatus() {
        return payStatus;
    }

    public void setPayStatus(String payStatus) {
        this.payStatus = payStatus;
    }

    public Integer getFrozenCoins() {
        return frozenCoins;
    }

    public void setFrozenCoins(Integer frozenCoins) {
        this.frozenCoins = frozenCoins;
    }

    public Integer getSettled() {
        return settled;
    }

    public void setSettled(Integer settled) {
        this.settled = settled;
    }

    public Integer getRefunded() {
        return refunded;
    }

    public void setRefunded(Integer refunded) {
        this.refunded = refunded;
    }

    public Integer getHours() {
        return hours;
    }

    public void setHours(Integer hours) {
        this.hours = hours;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getServiceTime() {
        return serviceTime;
    }

    public void setServiceTime(String serviceTime) {
        this.serviceTime = serviceTime;
    }

    public Integer getReward() {
        return reward;
    }

    public void setReward(Integer reward) {
        this.reward = reward;
    }

    public Integer getOriginalReward() {
        return originalReward;
    }

    public void setOriginalReward(Integer originalReward) {
        this.originalReward = originalReward;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getStatusKey() {
        return statusKey;
    }

    public void setStatusKey(String statusKey) {
        this.statusKey = statusKey;
    }

    public String getHelper() {
        return helper;
    }

    public void setHelper(String helper) {
        this.helper = helper;
    }

    public Long getHelperId() {
        return helperId;
    }

    public void setHelperId(Long helperId) {
        this.helperId = helperId;
    }

    public String getDistance() {
        return distance;
    }

    public void setDistance(String distance) {
        this.distance = distance;
    }

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
    }

    public String getImages() {
        return images;
    }

    public void setImages(String images) {
        this.images = images;
    }

    public String getCancelReason() {
        return cancelReason;
    }

    public void setCancelReason(String cancelReason) {
        this.cancelReason = cancelReason;
    }

    public LocalDateTime getCancelTime() {
        return cancelTime;
    }

    public void setCancelTime(LocalDateTime cancelTime) {
        this.cancelTime = cancelTime;
    }

    public LocalDateTime getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(LocalDateTime completedAt) {
        this.completedAt = completedAt;
    }

    public Integer getEvaluated() {
        return evaluated;
    }

    public void setEvaluated(Integer evaluated) {
        this.evaluated = evaluated;
    }

    public Integer getRating() {
        return rating;
    }

    public void setRating(Integer rating) {
        this.rating = rating;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public Integer getIsDeleted() {
        return isDeleted;
    }

    public void setIsDeleted(Integer isDeleted) {
        this.isDeleted = isDeleted;
    }

    public LocalDateTime getDeletedAt() {
        return deletedAt;
    }

    public void setDeletedAt(LocalDateTime deletedAt) {
        this.deletedAt = deletedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public LocalDateTime getAcceptedAt() {
        return acceptedAt;
    }

    public void setAcceptedAt(LocalDateTime acceptedAt) {
        this.acceptedAt = acceptedAt;
    }

    public Integer getTimeoutNotified() {
        return timeoutNotified;
    }

    public void setTimeoutNotified(Integer timeoutNotified) {
        this.timeoutNotified = timeoutNotified;
    }
}
