package com.elderly.care.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * 互助员注册申请表 helper_applications：
 * 注册选「互助员」→ 填信息 + 签承诺书 → 提交申请，由社区管理员审核；
 * 通过后用户角色置为互助员，驳回则保持普通用户。
 * 建表语句见 SuperAdminInitializer（ddl-auto 为 none，不依赖 Hibernate 建表）。
 */
@Entity
@Table(name = "helper_applications")
public class HelperApplication {

    /** 申请状态 */
    public static final String STATUS_PENDING = "pending";
    public static final String STATUS_APPROVED = "approved";
    public static final String STATUS_REJECTED = "rejected";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 申请人（用户表 id，提交时账号已以普通用户落库） */
    @Column(name = "user_id")
    private Long userId;

    /** 真实姓名 */
    @Column(name = "real_name", length = 50)
    private String realName;

    /** 身份证号 */
    @Column(name = "id_card", length = 30)
    private String idCard;

    /** 联系电话 */
    @Column(length = 20)
    private String phone;

    /** 意向服务类型（多个逗号分隔） */
    @Column(name = "service_types", length = 255)
    private String serviceTypes;

    /** 个人简介 */
    @Column(length = 500)
    private String intro;

    /** 年龄（18~70） */
    @Column
    private Integer age;

    /** 性别：男 / 女 */
    @Column(length = 10)
    private String gender;

    /** 常住区域（区/街道，用于就近派单） */
    @Column(length = 100)
    private String area;

    /** 相关经验：无经验 / 有照顾家人经验 / 有专业护理经验 */
    @Column(length = 30)
    private String experience;

    /** 审核通过后是否已确认切换角色：0 未确认 / 1 已确认（引导弹窗点「立即切换」后置 1） */
    @Column
    private Integer confirmed;

    /** 驳回通知是否已读：0 未读 / 1 已读（小程序端驳回弹窗展示后置 1，避免重复弹窗） */
    @Column(name = "reject_read")
    private Integer rejectRead;

    /** 承诺书版本号（签署时后端返回的版本，留痕用） */
    @Column(name = "pledge_version", length = 20)
    private String pledgeVersion;

    /** 承诺书签署时间 */
    @Column(name = "pledge_agreed_at")
    private LocalDateTime pledgeAgreedAt;

    /** 审核状态：pending / approved / rejected */
    @Column(length = 20)
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

    /** 提交时间（应用层写入） */
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getRealName() {
        return realName;
    }

    public void setRealName(String realName) {
        this.realName = realName;
    }

    public String getIdCard() {
        return idCard;
    }

    public void setIdCard(String idCard) {
        this.idCard = idCard;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getServiceTypes() {
        return serviceTypes;
    }

    public void setServiceTypes(String serviceTypes) {
        this.serviceTypes = serviceTypes;
    }

    public String getIntro() {
        return intro;
    }

    public void setIntro(String intro) {
        this.intro = intro;
    }

    public Integer getAge() {
        return age;
    }

    public void setAge(Integer age) {
        this.age = age;
    }

    public String getGender() {
        return gender;
    }

    public void setGender(String gender) {
        this.gender = gender;
    }

    public String getArea() {
        return area;
    }

    public void setArea(String area) {
        this.area = area;
    }

    public String getExperience() {
        return experience;
    }

    public void setExperience(String experience) {
        this.experience = experience;
    }

    public Integer getConfirmed() {
        return confirmed;
    }

    public void setConfirmed(Integer confirmed) {
        this.confirmed = confirmed;
    }

    public Integer getRejectRead() {
        return rejectRead;
    }

    public void setRejectRead(Integer rejectRead) {
        this.rejectRead = rejectRead;
    }

    public String getPledgeVersion() {
        return pledgeVersion;
    }

    public void setPledgeVersion(String pledgeVersion) {
        this.pledgeVersion = pledgeVersion;
    }

    public LocalDateTime getPledgeAgreedAt() {
        return pledgeAgreedAt;
    }

    public void setPledgeAgreedAt(LocalDateTime pledgeAgreedAt) {
        this.pledgeAgreedAt = pledgeAgreedAt;
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

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
