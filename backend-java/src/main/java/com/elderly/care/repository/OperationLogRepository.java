package com.elderly.care.repository;

import com.elderly.care.entity.OperationLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 操作日志表数据访问（append-only：业务上只有插入与查询，无修改/删除）
 */
public interface OperationLogRepository extends JpaRepository<OperationLog, Long> {

    Page<OperationLog> findAllByOrderByIdDesc(Pageable pageable);

    Page<OperationLog> findByOperateTypeOrderByIdDesc(String operateType, Pageable pageable);
}
