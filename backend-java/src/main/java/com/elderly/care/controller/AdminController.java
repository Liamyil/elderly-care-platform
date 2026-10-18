package com.elderly.care.controller;

import com.elderly.care.common.Result;
import com.elderly.care.entity.SystemConfig;
import com.elderly.care.service.AdminService;
import com.elderly.care.service.HelperApplicationService;
import com.elderly.care.service.SystemConfigService;
import com.elderly.care.service.WithdrawalService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 管理员接口（H5 后台使用）：三个管理角色可访问（JwtAuthFilter 校验）
 * - 管理员（社区）：全部业务操作
 * - 民政管理员：只读监管（订单/统计/用户查看，手机号脱敏）+ 紧急干预（强制取消/强制指派，原因必填并留痕）
 * - 超级管理员：全部业务操作 + 账号管理
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService adminService;
    private final HelperApplicationService helperApplicationService;
    private final SystemConfigService systemConfigService;
    private final WithdrawalService withdrawalService;

    public AdminController(AdminService adminService, HelperApplicationService helperApplicationService,
                           SystemConfigService systemConfigService, WithdrawalService withdrawalService) {
        this.adminService = adminService;
        this.helperApplicationService = helperApplicationService;
        this.systemConfigService = systemConfigService;
        this.withdrawalService = withdrawalService;
    }

    /** 民政管理员为只读账号：拦截业务写操作 */
    private Result<Void> checkWrite(HttpServletRequest request) {
        String role = (String) request.getAttribute("role");
        if ("民政管理员".equals(role)) {
            return Result.error(403, "民政管理员为只读监管账号，无操作权限");
        }
        return null;
    }

    /** 账号管理仅超级管理员可操作 */
    private Result<Void> checkSuper(HttpServletRequest request) {
        String role = (String) request.getAttribute("role");
        if (!"超级管理员".equals(role)) {
            return Result.error(403, "仅超级管理员可操作");
        }
        return null;
    }

    /** 互助员注册审核：社区管理员专属 */
    private Result<Void> checkCommunity(HttpServletRequest request) {
        String role = (String) request.getAttribute("role");
        if (!"管理员".equals(role)) {
            return Result.error(403, "仅社区管理员可操作");
        }
        return null;
    }

    /** 系统配置修改 / 启停普通用户：社区管理员 + 超级管理员 */
    private Result<Void> checkCommunityOrSuper(HttpServletRequest request) {
        String role = (String) request.getAttribute("role");
        if (!"管理员".equals(role) && !"超级管理员".equals(role)) {
            return Result.error(403, "仅社区管理员或超级管理员可操作");
        }
        return null;
    }

    /** 订单分页列表：状态筛选 + 关键词搜索 */
    /** 订单留痕列表（管理端查看服务留痕时间轴） */
    @GetMapping("/orders/{orderId}/traces")
    public Result<List<Map<String, Object>>> orderTraces(@PathVariable String orderId) {
        return adminService.traces(orderId);
    }

    /** 通知联调测试：向当前管理员绑定的 openid 发送测试订阅消息 */
    @GetMapping("/notify/test")
    public Result<String> notifyTest(HttpServletRequest request) {
        return adminService.notifyTest((Long) request.getAttribute("userId"));
    }

    @GetMapping("/orders")
    public Result<Map<String, Object>> listOrders(@RequestParam(required = false) String status,
                                                  @RequestParam(required = false) String type,
                                                  @RequestParam(required = false) String keyword,
                                                  @RequestParam(defaultValue = "1") int page,
                                                  @RequestParam(defaultValue = "10") int size) {
        return adminService.listOrders(status, type, keyword, page, size);
    }

    /** 订单统计看板 */
    @GetMapping("/orders/stats")
    public Result<Map<String, Object>> stats() {
        return adminService.stats();
    }

    /** 综合统计看板（H5 数据统计页）：KPI 汇总 */
    @GetMapping("/stats/dashboard")
    public Result<Map<String, Object>> dashboard() {
        return adminService.dashboard();
    }

    /** 订单趋势：近 N 天发布/完成数量 */
    @GetMapping("/stats/trend")
    public Result<Map<String, Object>> trend(@RequestParam(defaultValue = "14") int days,
                                             @RequestParam(required = false) String type) {
        return adminService.trend(days, type);
    }

    /** 按服务类型统计（下拉切换：全部订单默认看板，选择类型后看该类型） */
    @GetMapping("/stats/type")
    public Result<Map<String, Object>> typeStats(@RequestParam String type) {
        return adminService.typeStats(type);
    }

    /** 需求审核：approve=true 通过公开抢单 / false 驳回 */
    @PostMapping("/orders/{orderId}/review")
    public Result<Void> review(HttpServletRequest request, @PathVariable String orderId, @RequestBody Map<String, Object> body) {
        Result<Void> denied = checkWrite(request);
        if (denied != null) return denied;
        boolean approve = body != null && Boolean.TRUE.equals(body.get("approve"));
        String reason = body == null ? null : String.valueOf(body.get("reason"));
        return adminService.review(orderId, approve, reason);
    }

    /** 手动指派互助员 */
    @PostMapping("/orders/{orderId}/assign")
    public Result<Void> assign(HttpServletRequest request, @PathVariable String orderId, @RequestBody Map<String, Object> body) {
        Result<Void> denied = checkWrite(request);
        if (denied != null) return denied;
        Long helperId = null;
        try {
            helperId = Long.parseLong(String.valueOf(body.get("helperId")));
        } catch (Exception ignored) {
        }
        return adminService.assign(orderId, helperId);
    }

    /** 管理员取消订单 */
    @PostMapping("/orders/{orderId}/cancel")
    public Result<Void> cancel(HttpServletRequest request, @PathVariable String orderId, @RequestBody(required = false) Map<String, Object> body) {
        Result<Void> denied = checkWrite(request);
        if (denied != null) return denied;
        String reason = body == null ? null : String.valueOf(body.get("reason"));
        return adminService.cancel(orderId, reason);
    }

    /** 互助员列表（指派下拉框）；民政管理员查看时手机号脱敏 */
    @GetMapping("/helpers")
    public Result<List<Map<String, Object>>> helpers(HttpServletRequest request) {
        return adminService.helpers("民政管理员".equals(request.getAttribute("role")));
    }

    /** 用户列表（用户管理）；民政管理员查看时手机号脱敏 */
    @GetMapping("/users")
    public Result<List<Map<String, Object>>> users(HttpServletRequest request, @RequestParam(required = false) String keyword) {
        return adminService.users(keyword, "民政管理员".equals(request.getAttribute("role")));
    }

    /** 启停普通用户 / 互助员账号（社区管理员 + 超级管理员） */
    @PutMapping("/users/{userId}/status")
    public Result<Void> updateUserStatus(HttpServletRequest request, @PathVariable Long userId, @RequestBody(required = false) Map<String, Object> body) {
        Result<Void> denied = checkCommunityOrSuper(request);
        if (denied != null) return denied;
        Integer status = null;
        if (body != null) {
            try {
                status = Integer.valueOf(String.valueOf(body.get("status")));
            } catch (Exception ignored) {
            }
        }
        return adminService.updateUserStatus(userId, status);
    }

    /** 新建账号（超级管理员） */
    @PostMapping("/users")
    public Result<Map<String, Object>> createUser(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        Result<Void> denied = checkSuper(request);
        if (denied != null) return Result.error(denied.getCode(), denied.getMessage());
        return adminService.createUser(body);
    }

    /** 修改用户角色（超级管理员） */
    @PutMapping("/users/{userId}/role")
    public Result<Void> changeRole(HttpServletRequest request, @PathVariable Long userId, @RequestBody Map<String, Object> body) {
        Result<Void> denied = checkSuper(request);
        if (denied != null) return denied;
        return adminService.changeRole(userId, body == null ? null : String.valueOf(body.get("role")));
    }

    /** 重置用户密码（超级管理员） */
    @PutMapping("/users/{userId}/password")
    public Result<Void> resetPassword(HttpServletRequest request, @PathVariable Long userId, @RequestBody Map<String, Object> body) {
        Result<Void> denied = checkSuper(request);
        if (denied != null) return denied;
        return adminService.resetPassword(userId, body == null ? null : String.valueOf(body.get("password")));
    }

    // ==================== 角色管理精细化 ====================

    /** 新建管理员账号（仅超级管理员：社区管理员 / 民政管理员） */
    @PostMapping("/accounts")
    public Result<Map<String, Object>> createAdminAccount(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        Result<Void> denied = checkSuper(request);
        if (denied != null) return Result.error(denied.getCode(), denied.getMessage());
        return adminService.createUser(body);
    }

    /** 启停管理员账号（仅超级管理员） */
    @PutMapping("/accounts/{userId}/status")
    public Result<Void> updateAdminStatus(HttpServletRequest request, @PathVariable Long userId, @RequestBody(required = false) Map<String, Object> body) {
        Result<Void> denied = checkSuper(request);
        if (denied != null) return denied;
        Integer status = null;
        if (body != null) {
            try {
                status = Integer.valueOf(String.valueOf(body.get("status")));
            } catch (Exception ignored) {
            }
        }
        return adminService.updateAdminStatus(userId, status);
    }

    /** 互助员注册申请列表（社区管理员；status 为空查全部） */
    @GetMapping("/helper-applications")
    public Result<List<Map<String, Object>>> helperApplications(HttpServletRequest request,
                                                                @RequestParam(required = false) String status) {
        Result<Void> denied = checkCommunity(request);
        if (denied != null) return Result.error(denied.getCode(), denied.getMessage());
        return helperApplicationService.list(status);
    }

    /** 互助员注册申请审核通过（社区管理员）：角色置为互助员，重新登录生效 */
    @PostMapping("/helper-applications/{id}/approve")
    public Result<Map<String, Object>> approveHelperApplication(HttpServletRequest request, @PathVariable Long id) {
        Result<Void> denied = checkCommunity(request);
        if (denied != null) return Result.error(denied.getCode(), denied.getMessage());
        return helperApplicationService.approve(id, (Long) request.getAttribute("userId"));
    }

    /** 互助员注册申请驳回（社区管理员）：原因必填 */
    @PostMapping("/helper-applications/{id}/reject")
    public Result<Map<String, Object>> rejectHelperApplication(HttpServletRequest request, @PathVariable Long id,
                                                               @RequestBody(required = false) Map<String, Object> body) {
        Result<Void> denied = checkCommunity(request);
        if (denied != null) return Result.error(denied.getCode(), denied.getMessage());
        return helperApplicationService.reject(id, (Long) request.getAttribute("userId"),
                body == null ? null : String.valueOf(body.get("reason")));
    }

    /** 系统配置查看（三个管理角色均可看） */
    @GetMapping("/configs")
    public Result<List<SystemConfig>> configs() {
        return Result.ok(systemConfigService.listAll());
    }

    /** 系统配置修改（社区管理员 + 超级管理员）：每次修改强制写操作日志 */
    @PutMapping("/configs")
    public Result<SystemConfig> updateConfig(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        Result<Void> denied = checkCommunityOrSuper(request);
        if (denied != null) return Result.error(denied.getCode(), denied.getMessage());
        return systemConfigService.update((Long) request.getAttribute("userId"),
                body == null ? null : String.valueOf(body.get("key")),
                body == null ? null : String.valueOf(body.get("value")));
    }

    /** 强制取消订单（民政管理员紧急干预，高危动作：原因必填 + 操作日志留痕） */
    @PostMapping("/orders/{orderId}/force-cancel")
    public Result<Void> forceCancel(HttpServletRequest request, @PathVariable String orderId, @RequestBody(required = false) Map<String, Object> body) {
        return adminService.forceCancel((Long) request.getAttribute("userId"), orderId,
                body == null ? null : String.valueOf(body.get("reason")));
    }

    /** 强制指派互助员（民政管理员紧急干预，高危动作：原因必填 + 操作日志留痕） */
    @PostMapping("/orders/{orderId}/force-assign")
    public Result<Void> forceAssign(HttpServletRequest request, @PathVariable String orderId, @RequestBody(required = false) Map<String, Object> body) {
        Long helperId = null;
        if (body != null) {
            try {
                helperId = Long.parseLong(String.valueOf(body.get("helperId")));
            } catch (Exception ignored) {
            }
        }
        return adminService.forceAssign((Long) request.getAttribute("userId"), orderId, helperId,
                body == null ? null : String.valueOf(body.get("reason")));
    }

    /** 操作日志查询（三个管理角色；append-only 仅查询，无修改删除入口） */
    @GetMapping("/operation-logs")
    public Result<Map<String, Object>> operationLogs(@RequestParam(required = false) String operateType,
                                                     @RequestParam(defaultValue = "1") int page,
                                                     @RequestParam(defaultValue = "10") int size) {
        return adminService.operationLogs(operateType, page, size);
    }

    // ==================== 资金双轨制：人工退款 / 提现审核 ====================

    /** 人工退款（管理员裁决：服务中取消等冻结资金场景，原因必填 + 操作日志留痕） */
    @PostMapping("/orders/{orderId}/refund")
    public Result<Void> refundOrder(HttpServletRequest request, @PathVariable String orderId,
                                    @RequestBody(required = false) Map<String, Object> body) {
        Result<Void> denied = checkWrite(request);
        if (denied != null) return denied;
        return adminService.manualRefund((Long) request.getAttribute("userId"), orderId,
                body == null ? null : String.valueOf(body.get("reason")));
    }

    /** 提现申请列表（三个管理角色均可查看；民政管理员只读） */
    @GetMapping("/withdrawals")
    public Result<List<Map<String, Object>>> withdrawals() {
        return withdrawalService.adminList();
    }

    /** 提现审核通过（进入待线下打款；打款完成后标记已打款） */
    @PostMapping("/withdrawals/{id}/approve")
    public Result<Void> approveWithdrawal(HttpServletRequest request, @PathVariable String id) {
        Result<Void> denied = checkWrite(request);
        if (denied != null) return denied;
        return withdrawalService.approve((Long) request.getAttribute("userId"), id);
    }

    /** 提现审核驳回（原因必填，余额退回 + 操作日志留痕） */
    @PostMapping("/withdrawals/{id}/reject")
    public Result<Void> rejectWithdrawal(HttpServletRequest request, @PathVariable String id,
                                         @RequestBody(required = false) Map<String, Object> body) {
        Result<Void> denied = checkWrite(request);
        if (denied != null) return denied;
        return withdrawalService.reject((Long) request.getAttribute("userId"), id,
                body == null ? null : String.valueOf(body.get("reason")));
    }

    /** 确认已线下打款（审核通过 → 已打款） */
    @PostMapping("/withdrawals/{id}/paid")
    public Result<Void> paidWithdrawal(HttpServletRequest request, @PathVariable String id) {
        Result<Void> denied = checkWrite(request);
        if (denied != null) return denied;
        return withdrawalService.confirmPaid((Long) request.getAttribute("userId"), id);
    }
}
