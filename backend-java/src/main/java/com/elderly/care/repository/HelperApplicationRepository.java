package com.elderly.care.repository;

import com.elderly.care.entity.HelperApplication;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * 互助员注册申请表数据访问
 */
public interface HelperApplicationRepository extends JpaRepository<HelperApplication, Long> {

    /** 管理端列表：全部申请，最新在前 */
    List<HelperApplication> findAllByOrderByIdDesc();

    /** 管理端列表：按状态筛选 */
    List<HelperApplication> findByStatusOrderByIdDesc(String status);

    /** 查用户最新一条申请（申请状态页展示） */
    Optional<HelperApplication> findTopByUserIdOrderByIdDesc(Long userId);

    /** 是否已有待审核申请（防止重复提交） */
    boolean existsByUserIdAndStatus(Long userId, String status);
}
