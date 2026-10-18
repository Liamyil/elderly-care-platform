package com.elderly.care.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * 服务留痕记录表 service_traces
 * 互助员履约留痕：开工打卡（到岗定位+现场照）/ 完工打卡（离场定位+完成照）
 * 对应《整体实现方案》"上门定位打卡 + 现场拍照留痕"
 */
@Entity
@Table(name = "service_traces")
public class ServiceTrace {

    @Id
    @Column(length = 50)
    private String id;

    @Column(name = "order_id", nullable = false, length = 50)
    private String orderId;

    @Column(name = "helper_id", nullable = false)
    private Long helperId;

    /** start=开工打卡 / end=完工打卡 */
    @Column(nullable = false, length = 10)
    private String kind;

    /** 现场照片文件名 JSON 数组（照片存 uploads 目录，输出时补全完整地址） */
    @Column(columnDefinition = "text")
    private String photos;

    @Column(name = "longitude")
    private Double longitude;

    @Column(name = "latitude")
    private Double latitude;

    /** 位置说明（互助员人工确认的服务地点文字） */
    @Column(name = "location_text", length = 200)
    private String locationText;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getOrderId() {
        return orderId;
    }

    public void setOrderId(String orderId) {
        this.orderId = orderId;
    }

    public Long getHelperId() {
        return helperId;
    }

    public void setHelperId(Long helperId) {
        this.helperId = helperId;
    }

    public String getKind() {
        return kind;
    }

    public void setKind(String kind) {
        this.kind = kind;
    }

    public String getPhotos() {
        return photos;
    }

    public void setPhotos(String photos) {
        this.photos = photos;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public String getLocationText() {
        return locationText;
    }

    public void setLocationText(String locationText) {
        this.locationText = locationText;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
