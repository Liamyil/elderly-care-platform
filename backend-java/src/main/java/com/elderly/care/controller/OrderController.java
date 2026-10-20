package com.elderly.care.controller;

import com.elderly.care.common.Result;
import com.elderly.care.service.OrderService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 订单接口：发单 / 接单 / 履约 / 结算 / 评价
 * 路径与原 Node 版完全一致
 */
@RestController
@RequestMapping("/api")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    /** 首页数据（需登录） */
    @GetMapping("/home")
    public Result<Map<String, Object>> home(HttpServletRequest request) {
        return orderService.home(uid(request));
    }

    /** 公开订单列表（无需登录） */
    @GetMapping("/orders/public")
    public Result<Map<String, Object>> publicOrders(@RequestParam(required = false) String status) {
        return orderService.publicOrders(status);
    }

    /** 类型销量统计（公开）：已完成订单按子类型计数，展示真实销量 */
    @GetMapping("/orders/type-stats")
    public Result<Map<String, Object>> typeStats(@RequestParam String type) {
        return orderService.typeStats(type);
    }

    /** 公开评价列表（无需登录，可选按服务类型/子类型过滤） */
    @GetMapping("/orders/evaluations")
    public Result<List<Map<String, Object>>> evaluations(@RequestParam(required = false) String type,
                                                         @RequestParam(required = false) String subType) {
        return orderService.evaluations(type, subType);
    }

    /** 附近待接单订单（需登录） */
    @GetMapping("/orders/nearby")
    public Result<List<Map<String, Object>>> nearby(HttpServletRequest request) {
        return orderService.nearby(uid(request));
    }

    /** 我的订单（需登录），可选状态过滤 */
    @GetMapping("/orders")
    public Result<List<Map<String, Object>>> mine(HttpServletRequest request,
                                                  @RequestParam(required = false) String status) {
        return orderService.mine(uid(request), status);
    }

    /** 订单详情（需登录）：按查看人身份下发时间轴与联系方式（未接单脱敏） */
    @GetMapping("/orders/{orderId}")
    public Result<Map<String, Object>> detail(HttpServletRequest request, @PathVariable String orderId) {
        return orderService.detail(uid(request), orderId);
    }

    /** 发布订单（需登录） */
    @PostMapping("/orders")
    public Result<Map<String, Object>> create(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        return orderService.create(uid(request), body);
    }

    /** 陪诊订单支付（需登录；一期模拟支付 pay_mock=1 支付即成功） */
    @PostMapping("/orders/{orderId}/pay")
    public Result<Map<String, Object>> pay(HttpServletRequest request, @PathVariable String orderId) {
        return orderService.pay(uid(request), orderId);
    }

    /** 接单（需登录） */
    @PostMapping("/orders/{orderId}/accept")
    public Result<Void> accept(HttpServletRequest request, @PathVariable String orderId) {
        return orderService.accept(uid(request), orderId);
    }

    /** 抢单（需登录，兼容保留） */
    @PostMapping("/orders/{orderId}/grab")
    public Result<Void> grab(HttpServletRequest request, @PathVariable String orderId) {
        return orderService.grab(uid(request), orderId);
    }

    /** 取消订单（需登录） */
    @PostMapping("/orders/{orderId}/cancel")
    public Result<Void> cancel(HttpServletRequest request, @PathVariable String orderId,
                               @RequestBody Map<String, Object> body) {
        return orderService.cancel(uid(request), orderId, body == null ? null : String.valueOf(body.get("cancelReason")));
    }

    /** 删除订单（软删除，需登录） */
    @DeleteMapping("/orders/{orderId}")
    public Result<Void> delete(HttpServletRequest request, @PathVariable String orderId) {
        return orderService.softDelete(uid(request), orderId);
    }

    /** 互助员完成服务（需登录） */
    @PostMapping("/orders/{orderId}/complete-service")
    public Result<Void> completeService(HttpServletRequest request, @PathVariable String orderId) {
        return orderService.completeService(uid(request), orderId);
    }

    /** 追加时间币（需登录） */
    @PostMapping("/orders/{orderId}/add-reward")
    public Result<Map<String, Object>> addReward(HttpServletRequest request, @PathVariable String orderId,
                                                 @RequestBody Map<String, Object> body) {
        Object extra = body == null ? null : body.get("extra_reward");
        int amount = 0;
        try {
            amount = Integer.parseInt(String.valueOf(extra));
        } catch (Exception ignored) {
        }
        return orderService.addReward(uid(request), orderId, amount);
    }

    /** 确认完成并结算（需登录） */
    @PostMapping("/orders/{orderId}/confirm-complete")
    public Result<Void> confirmComplete(HttpServletRequest request, @PathVariable String orderId) {
        return orderService.confirmComplete(uid(request), orderId);
    }

    /** 打卡留痕（需登录，仅接单互助员） */
    @PostMapping("/orders/{orderId}/trace")
    public Result<Map<String, Object>> trace(HttpServletRequest request, @PathVariable String orderId,
                                             @RequestBody Map<String, Object> body) {
        Object photos = body == null ? null : body.get("photos");
        return orderService.addTrace(uid(request), orderId,
                body == null ? null : String.valueOf(body.get("kind")),
                photos instanceof List ? (List<?>) photos : null,
                toDouble(body == null ? null : body.get("longitude")),
                toDouble(body == null ? null : body.get("latitude")),
                body == null ? null : String.valueOf(body.get("locationText")));
    }

    /** 订单留痕列表（需登录） */
    @GetMapping("/orders/{orderId}/traces")
    public Result<List<Map<String, Object>>> traces(@PathVariable String orderId) {
        return orderService.traces(orderId);
    }

    /** 服务评价（需登录） */
    @PostMapping("/orders/{orderId}/evaluate")
    public Result<Void> evaluate(HttpServletRequest request, @PathVariable String orderId,
                                 @RequestBody Map<String, Object> body) {
        return orderService.evaluate(uid(request), orderId,
                body == null ? null : body.get("rating"),
                body == null ? null : String.valueOf(body.get("comment")));
    }

    private Long uid(HttpServletRequest request) {
        return (Long) request.getAttribute("userId");
    }

    private static Double toDouble(Object o) {
        if (o == null) return null;
        try {
            return Double.parseDouble(String.valueOf(o));
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
