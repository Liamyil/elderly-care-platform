package com.elderly.care.repository;

import com.elderly.care.entity.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

/**
 * 时间银行流水表数据访问
 */
public interface TransactionRepository extends JpaRepository<Transaction, String> {

    List<Transaction> findByUserIdOrderByCreatedAtDesc(Long userId);

    @Query("select coalesce(sum(t.amount), 0) from Transaction t where t.userId = :uid and t.type = :type")
    Long sumAmountByUserIdAndType(@Param("uid") Long uid, @Param("type") String type);

    /** 全平台流水合计（统计看板用） */
    @Query("select coalesce(sum(t.amount), 0) from Transaction t where t.type = :type")
    Long sumAllByType(@Param("type") String type);
}
