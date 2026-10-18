package com.elderly.care.repository;

import com.elderly.care.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

/**
 * 站内消息表数据访问
 */
public interface MessageRepository extends JpaRepository<Message, String> {

    List<Message> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<Message> findByUserIdAndTypeOrderByCreatedAtDesc(Long userId, String type);

    long countByUserIdAndIsRead(Long userId, Integer isRead);

    /** 标记单条已读 */
    @Modifying
    @Query("update Message m set m.isRead = 1 where m.id = :id and m.userId = :uid")
    int markRead(@Param("id") String id, @Param("uid") Long uid);

    /** 标记全部已读 */
    @Modifying
    @Query("update Message m set m.isRead = 1 where m.userId = :uid")
    int markAllRead(@Param("uid") Long uid);

    /** 删除自己的消息 */
    long deleteByIdAndUserId(String id, Long userId);
}
