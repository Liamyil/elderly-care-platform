package com.elderly.care.controller;

import com.elderly.care.common.Result;
import com.elderly.care.service.MessageService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 站内消息接口：列表 / 未读数 / 已读 / 删除
 */
@RestController
@RequestMapping("/api/messages")
public class MessageController {

    private final MessageService messageService;

    public MessageController(MessageService messageService) {
        this.messageService = messageService;
    }

    /** 消息列表（需登录），可按类型过滤 */
    @GetMapping
    public Result<List<Map<String, Object>>> list(HttpServletRequest request,
                                                  @RequestParam(required = false) String type) {
        return messageService.list(uid(request), type);
    }

    /** 未读消息数（需登录） */
    @GetMapping("/unread")
    public Result<Map<String, Object>> unread(HttpServletRequest request) {
        return messageService.unreadCount(uid(request));
    }

    /** 标记已读（需登录），messageId 为空则全部已读 */
    @PutMapping("/read")
    public Result<Void> markRead(HttpServletRequest request, @RequestBody(required = false) Map<String, Object> body) {
        return messageService.markRead(uid(request),
                body == null ? null : String.valueOf(body.get("messageId")));
    }

    /** 删除消息（需登录） */
    @DeleteMapping("/{messageId}")
    public Result<Void> delete(HttpServletRequest request, @PathVariable String messageId) {
        return messageService.delete(uid(request), messageId);
    }

    private Long uid(HttpServletRequest request) {
        return (Long) request.getAttribute("userId");
    }
}
