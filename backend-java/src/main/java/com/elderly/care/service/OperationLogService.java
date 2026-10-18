package com.elderly.care.service;

import com.elderly.care.entity.OperationLog;
import com.elderly.care.repository.OperationLogRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * 操作日志服务：配置修改 / 强制取消 / 强制指派 三类高危操作留痕。
 * append-only：只提供 record 插入与 page 查询，不提供任何修改 / 删除方法。
 */
@Service
public class OperationLogService {

    private final OperationLogRepository operationLogRepository;

    public OperationLogService(OperationLogRepository operationLogRepository) {
        this.operationLogRepository = operationLogRepository;
    }

    /** 写入一条操作日志（操作人、类型、修改前/后内容、备注原因） */
    public OperationLog record(Long operatorId, String operateType, String beforeContent, String afterContent, String remark) {
        OperationLog log = new OperationLog();
        log.setOperatorId(operatorId);
        log.setOperateType(operateType);
        log.setBeforeContent(beforeContent);
        log.setAfterContent(afterContent);
        log.setRemark(remark);
        log.setCreatedAt(LocalDateTime.now());
        return operationLogRepository.save(log);
    }

    /** 分页查询日志；operateType 为空查全部，否则按类型筛选 */
    public Page<OperationLog> page(String operateType, Pageable pageable) {
        if (operateType == null || operateType.isBlank()) {
            return operationLogRepository.findAllByOrderByIdDesc(pageable);
        }
        return operationLogRepository.findByOperateTypeOrderByIdDesc(operateType, pageable);
    }
}
