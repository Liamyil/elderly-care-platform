package com.elderly.care.repository;

import com.elderly.care.entity.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

/**
 * 时间银行流水表数据访问
 */
public interface TransactionRepository extends JpaRepository<Transaction, String> {

    List<Transaction> findByUserIdOrderByCreatedAtDesc(Long userId);

    /** 订单结算后把下单人的「下单冻结」流水改名为「服务消费」（流水落定，账单从冻结态转为扣除态） */
    @Modifying
    @Query("update Transaction t set t.name = :newName where t.orderId = :orderId and t.userId = :uid and t.name = :oldName")
    int renameFreezeToSettled(@Param("orderId") String orderId, @Param("uid") Long uid,
                              @Param("oldName") String oldName, @Param("newName") String newName);

    @Query("select coalesce(sum(t.amount), 0) from Transaction t where t.userId = :uid and t.type = :type")
    Long sumAmountByUserIdAndType(@Param("uid") Long uid, @Param("type") String type);

    /** 全平台流水合计（统计看板用） */
    @Query("select coalesce(sum(t.amount), 0) from Transaction t where t.type = :type")
    Long sumAllByType(@Param("type") String type);
}
