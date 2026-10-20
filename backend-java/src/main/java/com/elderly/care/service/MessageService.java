package com.elderly.care.service;

import com.elderly.care.common.Result;
import com.elderly.care.entity.Message;
import com.elderly.care.repository.MessageRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 消息服务：站内通知列表 / 未读数 / 已读 / 删除
 */
@Service
public class MessageService {

    /** 对应原版 new Date(...).toLocaleString('zh-CN') 的显示格式 */
    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("yyyy/M/d HH:mm:ss");

    private final MessageRepository messageRepository;

    public MessageService(MessageRepository messageRepository) {
        this.messageRepository = messageRepository;
    }

    /** 消息列表，可按类型过滤 */
    public Result<List<Map<String, Object>>> list(Long userId, String type) {
        List<Message> messages = (type == null || type.isBlank())
                ? messageRepository.findByUserIdOrderByCreatedAtDesc(userId)
                : messageRepository.findByUserIdAndTypeOrderByCreatedAtDesc(userId, type);

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Message m : messages) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", m.getId());
            row.put("type", m.getType());
            row.put("title", m.getTitle());
            row.put("content", m.getContent());
            row.put("orderId", m.getOrderId());
            row.put("isRead", Integer.valueOf(1).equals(m.getIsRead()));
            row.put("time", m.getCreatedAt() == null ? "" : m.getCreatedAt().format(TIME_FORMAT));
            rows.add(row);
        }
        return Result.ok(rows);
    }

    /** 最新未读消息（全局悬浮横幅轮询用，最多 3 条，轻量不拉全量） */
    public Result<List<Map<String, Object>>> latestUnread(Long userId) {
        List<Message> messages = messageRepository.findTop3ByUserIdAndIsReadOrderByCreatedAtDesc(userId, 0);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Message m : messages) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", m.getId());
            row.put("type", m.getType());
            row.put("title", m.getTitle());
            row.put("content", m.getContent());
            row.put("orderId", m.getOrderId());
            row.put("time", m.getCreatedAt() == null ? "" : m.getCreatedAt().format(TIME_FORMAT));
            // 毫秒时间戳：前端据此只弹"本次会话内新产生"的消息，历史未读不连弹横幅
            row.put("ts", m.getCreatedAt() == null ? 0L
                    : m.getCreatedAt().atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli());
            rows.add(row);
        }
        return Result.ok(rows);
    }

    /** 未读消息数 */
    public Result<Map<String, Object>> unreadCount(Long userId) {
        long count = messageRepository.countByUserIdAndIsRead(userId, 0);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("count", count);
        return Result.ok(data);
    }

    /** 标记已读：messageId 为空则全部已读 */
    @Transactional
    public Result<Void> markRead(Long userId, String messageId) {
        if (messageId == null || messageId.isBlank()) {
            messageRepository.markAllRead(userId);
        } else {
            messageRepository.markRead(messageId, userId);
        }
        return Result.ok("标记成功", null);
    }

    /** 删除自己的消息（delete 操作需要事务） */
    @Transactional
    public Result<Void> delete(Long userId, String messageId) {
        messageRepository.deleteByIdAndUserId(messageId, userId);
        return Result.ok("删除成功", null);
    }
}
