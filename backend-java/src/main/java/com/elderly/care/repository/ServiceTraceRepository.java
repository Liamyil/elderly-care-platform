package com.elderly.care.repository;

import com.elderly.care.entity.ServiceTrace;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

/**
 * 服务留痕记录数据访问
 */
public interface ServiceTraceRepository extends JpaRepository<ServiceTrace, String> {

    /** 某订单的全部留痕（按时间正序：开工在前、完工在后） */
    List<ServiceTrace> findByOrderIdOrderByCreatedAtAsc(String orderId);

    /** 批量取多个订单的留痕（订单列表页展示打卡状态用） */
    List<ServiceTrace> findByOrderIdIn(Collection<String> orderIds);
}
