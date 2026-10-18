package com.elderly.care.repository;

import com.elderly.care.entity.Withdrawal;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * 人民币提现申请表数据访问
 */
public interface WithdrawalRepository extends JpaRepository<Withdrawal, String> {

    /** 我的提现记录（时间倒序） */
    List<Withdrawal> findByUserIdOrderByCreatedAtDesc(Long userId);

    /** 全部提现申请（管理端，时间倒序） */
    List<Withdrawal> findAllByOrderByCreatedAtDesc();
}
