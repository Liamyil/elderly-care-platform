package com.elderly.care.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 用户表 users：老人 / 家属 / 互助员 / 管理员等角色共用
 */
@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 手机号（唯一主账号；微信直接登录自动建号时可为空，后续在账号与安全页补绑） */
    @Column(unique = true, length = 20)
    private String phone;

    @Column(nullable = false, length = 100)
    private String password;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(length = 20)
    private String role;

    /** 互助员标识：1 = 曾经审核通过（双重身份共存：互助员接单 + 普通用户发单权限并行，置 1 后永久不回退） */
    @Column(name = "is_helper")
    private Integer isHelper;

    /** 账号状态：1 正常 / 0 禁用（null 视为正常；社区管理员启停普通用户与互助员、超管启停管理员账号） */
    private Integer status;

    @Column(name = "time_coins")
    private Integer timeCoins;

    /** 人民币余额（陪诊服务收入，单位元；可申请提现，与时间币彻底隔离） */
    @Column(name = "rmb_balance")
    private BigDecimal rmbBalance;

    @Column(name = "service_count")
    private Integer serviceCount;

    @Column(length = 255)
    private String avatar;

    /** 微信 openid（订阅消息推送用，小程序 wx.login 绑定；一个手机号只绑一个，一个 openid 只绑一个账号） */
    @Column(length = 64, unique = true)
    private String openid;

    /** 由数据库 DEFAULT CURRENT_TIMESTAMP 自动生成 */
    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public Integer getIsHelper() {
        return isHelper;
    }

    public void setIsHelper(Integer isHelper) {
        this.isHelper = isHelper;
    }

    public Integer getStatus() {
        return status;
    }

    public void setStatus(Integer status) {
        this.status = status;
    }

    public Integer getTimeCoins() {
        return timeCoins;
    }

    public void setTimeCoins(Integer timeCoins) {
        this.timeCoins = timeCoins;
    }

    public BigDecimal getRmbBalance() {
        return rmbBalance;
    }

    public void setRmbBalance(BigDecimal rmbBalance) {
        this.rmbBalance = rmbBalance;
    }

    public Integer getServiceCount() {
        return serviceCount;
    }

    public void setServiceCount(Integer serviceCount) {
        this.serviceCount = serviceCount;
    }

    public String getAvatar() {
        return avatar;
    }

    public void setAvatar(String avatar) {
        this.avatar = avatar;
    }

    public String getOpenid() {
        return openid;
    }

    public void setOpenid(String openid) {
        this.openid = openid;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
