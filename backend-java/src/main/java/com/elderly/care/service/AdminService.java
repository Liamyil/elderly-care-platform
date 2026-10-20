package com.elderly.care.service;

import com.elderly.care.common.PhoneMaskUtil;
import com.elderly.care.common.Result;
import com.elderly.care.config.AppConfig;
import com.elderly.care.config.PasswordHasher;
import com.elderly.care.entity.Message;
import com.elderly.care.entity.OperationLog;
import com.elderly.care.entity.Order;
import com.elderly.care.entity.ServiceTrace;
import com.elderly.care.entity.User;
import com.elderly.care.repository.MessageRepository;
import com.elderly.care.repository.OrderRepository;
import com.elderly.care.repository.ServiceTraceRepository;
import com.elderly.care.repository.TransactionRepository;
import com.elderly.care.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;

/**
 * 管理员服务（H5 后台接口）：
 * 订单全流程管理（方案5.3）：需求审核、待派单管理、手动指派、超时订单处理、统计
 */
@Service
public class AdminService {

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    /** 超时兜底阈值：待接单订单超过该时长无人接单，自动转入待派单池（方案：15-30分钟，取30分钟） */
    private static final long TIMEOUT_MINUTES = 30;

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final MessageRepository messageRepository;
    private final TransactionRepository transactionRepository;
    private final ServiceTraceRepository traceRepository;
    private final NotifyService notifyService;
    private final WechatService wechatService;
    private final PasswordHasher passwordHasher;
    private final AppConfig appConfig;
    private final OperationLogService operationLogService;
    private final OrderFundService fundService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** 指派提醒订阅消息模板ID（通知联调测试用） */
    @Value("${app.wechat.template-assign:}")
    private String tplAssign;

    public AdminService(OrderRepository orderRepository, UserRepository userRepository,
                        MessageRepository messageRepository, TransactionRepository transactionRepository,
                        ServiceTraceRepository traceRepository,
                        NotifyService notifyService, WechatService wechatService,
                        PasswordHasher passwordHasher, AppConfig appConfig,
                        OperationLogService operationLogService, OrderFundService fundService) {
        this.orderRepository = orderRepository;
        this.userRepository = userRepository;
        this.messageRepository = messageRepository;
        this.transactionRepository = transactionRepository;
        this.traceRepository = traceRepository;
        this.notifyService = notifyService;
        this.wechatService = wechatService;
        this.passwordHasher = passwordHasher;
        this.appConfig = appConfig;
        this.operationLogService = operationLogService;
        this.fundService = fundService;
    }

    // ==================== 查询 ====================

    /** 订单分页查询（状态筛选 + 关键词搜索：订单号/服务类型/地址/互助员） */
    public Result<Map<String, Object>> listOrders(String status, String type, String keyword, int page, int size) {
        String statusParam = (status == null || status.isBlank()) ? null : status;
        String typeParam = (type == null || type.isBlank()) ? null : type;
        String kw = (keyword == null || keyword.isBlank()) ? null : keyword;
        int pageNum = Math.max(page, 1);
        int pageSize = Math.min(Math.max(size, 1), 50);

        PageRequest pageable = PageRequest.of(pageNum - 1, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"));
        List<Order> orders = orderRepository.adminSearch(statusParam, typeParam, kw, pageable);
        long total = orderRepository.adminCount(statusParam, typeParam, kw);

        Map<Long, String> nameMap = new HashMap<>();
        for (Order o : orders) {
            nameMap.putIfAbsent(o.getUserId(), null);
        }
        if (!nameMap.isEmpty()) {
            for (User u : userRepository.findAllById(nameMap.keySet())) {
                nameMap.put(u.getId(), u.getName());
            }
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Order o : orders) {
            rows.add(toAdminMap(o, nameMap.get(o.getUserId())));
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("total", total);
        data.put("page", pageNum);
        data.put("size", pageSize);
        data.put("list", rows);
        return Result.ok(data);
    }

    /** 订单统计看板：各状态数量 + 今日新增 */
    public Result<Map<String, Object>> stats() {
        Map<String, Object> data = new LinkedHashMap<>();
        String[] keys = {"reviewing", "pending", "pending_pay", "dispatch_pool", "serving", "pending_confirm", "completed", "cancelled"};
        for (String key : keys) {
            data.put(key, orderRepository.countByStatusKeyAndIsDeleted(key, 0));
        }
        data.put("todayNew", orderRepository.countCreatedSince(LocalDateTime.now().withHour(0).withMinute(0).withSecond(0).withNano(0)));
        return Result.ok(data);
    }

    /** 通用类型统计：某服务类型的各状态订单数 / 完成率 / 累计时间币 */
    public Result<Map<String, Object>> typeStats(String type) {
        Map<String, Object> data = new LinkedHashMap<>();
        String[] keys = {"reviewing", "pending", "pending_pay", "dispatch_pool", "serving", "pending_confirm", "completed", "cancelled"};
        long total = 0;
        long completedCount = 0;
        for (String key : keys) {
            long count = orderRepository.countByTypeAndStatusKeyAndIsDeleted(type, key, 0);
            data.put(key, count);
            total += count;
            if ("completed".equals(key)) {
                completedCount = count;
            }
        }
        data.put("totalOrders", total);
        data.put("todayNew", orderRepository.countCreatedSinceByType(type, LocalDateTime.now().withHour(0).withMinute(0).withSecond(0).withNano(0)));
        data.put("completionRate", total > 0 ? Math.round((double) completedCount / total * 100) : 0);
        data.put("totalCoins", orderRepository.sumCompletedRewardByType(type));
        return Result.ok(data);
    }

    /** 统计看板：KPI 汇总（订单总量/完成率/时间币/角色分布） */
    public Result<Map<String, Object>> dashboard() {
        Map<String, Object> data = new LinkedHashMap<>();
        String[] keys = {"reviewing", "pending", "pending_pay", "dispatch_pool", "serving", "pending_confirm", "completed", "cancelled"};
        long total = 0;
        long completedCount = 0;
        long cancelledCount = 0;
        for (String key : keys) {
            long count = orderRepository.countByStatusKeyAndIsDeleted(key, 0);
            data.put(key, count);
            total += count;
            if ("completed".equals(key)) {
                completedCount = count;
            }
            if ("cancelled".equals(key)) {
                cancelledCount = count;
            }
        }
        data.put("totalOrders", total);
        data.put("todayNew", orderRepository.countCreatedSince(LocalDateTime.now().withHour(0).withMinute(0).withSecond(0).withNano(0)));

        // 完成率 = 已完成 / (总订单 - 已取消)，保留1位小数
        long valid = total - cancelledCount;
        double rate = valid <= 0 ? 0 : Math.round(completedCount * 1000.0 / valid) / 10.0;
        data.put("completionRate", rate);

        data.put("coinsInBank", userRepository.sumAllCoins());
        data.put("totalEarned", transactionRepository.sumAllByType("income"));
        data.put("totalRedeemed", transactionRepository.sumAllByType("expense"));

        Map<String, Long> roleCounts = new LinkedHashMap<>();
        for (User u : userRepository.findAll()) {
            String role = u.getRole() == null || u.getRole().isBlank() ? "未知" : u.getRole();
            roleCounts.merge(role, 1L, Long::sum);
        }
        data.put("roleCounts", roleCounts);
        return Result.ok(data);
    }

    /** 订单趋势：近 N 天每天发布/完成数量 */
    public Result<Map<String, Object>> trend(int days, String type) {
        int d = Math.min(Math.max(days, 7), 30);
        LocalDateTime since = LocalDate.now().minusDays(d - 1L).atStartOfDay();
        String typeParam = (type == null || type.isBlank()) ? null : type;
        List<Order> createdOrders = typeParam == null
                ? orderRepository.findByIsDeletedAndCreatedAtGreaterThanEqual(0, since)
                : orderRepository.findByIsDeletedAndTypeAndCreatedAtGreaterThanEqual(0, typeParam, since);
        List<Order> completedOrders = typeParam == null
                ? orderRepository.findByIsDeletedAndCompletedAtGreaterThanEqual(0, since)
                : orderRepository.findByIsDeletedAndTypeAndCompletedAtGreaterThanEqual(0, typeParam, since);
        DateTimeFormatter dayFmt = DateTimeFormatter.ofPattern("MM-dd");

        List<Map<String, Object>> list = new ArrayList<>();
        for (int i = d - 1; i >= 0; i--) {
            LocalDate day = LocalDate.now().minusDays(i);
            long created = createdOrders.stream()
                    .filter(o -> o.getCreatedAt() != null && o.getCreatedAt().toLocalDate().equals(day))
                    .count();
            long completed = completedOrders.stream()
                    .filter(o -> o.getCompletedAt() != null && o.getCompletedAt().toLocalDate().equals(day))
                    .count();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("date", day.format(dayFmt));
            row.put("created", created);
            row.put("completed", completed);
            list.add(row);
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("list", list);
        return Result.ok(data);
    }

    /** 互助员列表（指派下拉框用）；民政管理员查看时手机号脱敏 */
    public Result<List<Map<String, Object>>> helpers(boolean maskPhone) {
        Map<Long, Long> asUser = new HashMap<>();
        for (Object[] row : orderRepository.countCompletedGroupByUser()) {
            asUser.put((Long) row[0], (Long) row[1]);
        }
        Map<Long, Long> asHelper = new HashMap<>();
        for (Object[] row : orderRepository.countCompletedGroupByHelper()) {
            asHelper.put((Long) row[0], (Long) row[1]);
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        for (User u : userRepository.findByRoleOrderByIdAsc("互助员")) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", u.getId());
            row.put("name", u.getName());
            row.put("phone", maskPhone ? PhoneMaskUtil.mask(u.getPhone()) : u.getPhone());
            row.put("timeCoins", u.getTimeCoins());
            row.put("rmbBalance", u.getRmbBalance());
            // 实时统计该用户参与的已完成订单数（下单 + 接单，替代存量 service_count 列）
            row.put("serviceCount", (int) (asUser.getOrDefault(u.getId(), 0L) + asHelper.getOrDefault(u.getId(), 0L)));
            rows.add(row);
        }
        return Result.ok(rows);
    }

    /** 用户列表（H5 用户管理，简单关键词过滤）；民政管理员查看时手机号脱敏 */
    public Result<List<Map<String, Object>>> users(String keyword, boolean maskPhone) {
        String kw = keyword == null ? "" : keyword.trim();
        Map<Long, Long> asUser = new HashMap<>();
        for (Object[] row : orderRepository.countCompletedGroupByUser()) {
            asUser.put((Long) row[0], (Long) row[1]);
        }
        Map<Long, Long> asHelper = new HashMap<>();
        for (Object[] row : orderRepository.countCompletedGroupByHelper()) {
            asHelper.put((Long) row[0], (Long) row[1]);
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        for (User u : userRepository.findAll()) {
            if (!kw.isEmpty()
                    && !String.valueOf(u.getId()).contains(kw)
                    && !u.getName().contains(kw)
                    && !u.getPhone().contains(kw)
                    && !u.getRole().contains(kw)) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", u.getId());
            row.put("name", u.getName());
            row.put("phone", maskPhone ? PhoneMaskUtil.mask(u.getPhone()) : u.getPhone());
            row.put("role", u.getRole());
            row.put("status", u.getStatus());
            row.put("timeCoins", u.getTimeCoins());
            row.put("rmbBalance", u.getRmbBalance());
            // 实时统计该用户参与的已完成订单数（下单 + 接单，替代存量 service_count 列）
            row.put("serviceCount", (int) (asUser.getOrDefault(u.getId(), 0L) + asHelper.getOrDefault(u.getId(), 0L)));
            row.put("createdAt", u.getCreatedAt() == null ? "" : u.getCreatedAt().format(FMT));
            rows.add(row);
        }
        return Result.ok(rows);
    }

    // ==================== 操作 ====================

    /** 需求审核：通过 → 公开抢单；驳回 → 已取消（原因：审核未通过） */
    public Result<Void> review(String orderId, boolean approve, String reason) {
        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null) {
            return Result.error(404, "订单不存在");
        }
        if (!"reviewing".equals(order.getStatusKey())) {
            return Result.error(400, "订单不在审核中状态");
        }

        if (approve) {
            order.setStatus("待接单");
            order.setStatusKey("pending");
            orderRepository.save(order);
            insertMessage(order.getUserId(), "order", "订单审核通过",
                    "您的" + order.getType() + "订单已通过审核，等待互助员接单", order.getId());
            return Result.ok("审核通过", null);
        } else {
            String rejectReason = (reason == null || reason.isBlank()) ? "审核未通过" : ("审核未通过：" + reason);
            order.setStatus("已取消");
            order.setStatusKey("cancelled");
            order.setCancelReason(rejectReason);
            order.setCancelTime(LocalDateTime.now());
            orderRepository.save(order);
            insertMessage(order.getUserId(), "order", "订单未通过审核",
                    "您的" + order.getType() + "订单未通过审核，原因：" + rejectReason, order.getId());
            return Result.ok("已驳回", null);
        }
    }

    /** 手动指派互助员（待接单/待派单订单 → 服务中，指派单无需互助员确认） */
    public Result<Void> assign(String orderId, Long helperId) {
        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null) {
            return Result.error(404, "订单不存在");
        }
        if (!"pending".equals(order.getStatusKey()) && !"dispatch_pool".equals(order.getStatusKey())) {
            return Result.error(400, "只有待接单/待派单订单可以指派");
        }

        User helper = userRepository.findById(helperId).orElse(null);
        if (helper == null) {
            return Result.error(404, "互助员不存在");
        }
        if (!"互助员".equals(helper.getRole())) {
            return Result.error(400, "指派的用户不是互助员");
        }
        if (helperId.equals(order.getUserId())) {
            return Result.error(400, "不能指派给下单人自己");
        }

        order.setStatus("服务中");
        order.setStatusKey("serving");
        order.setHelper(helper.getName());
        order.setHelperId(helperId);
        order.setAcceptedAt(LocalDateTime.now());
        orderRepository.save(order);

        insertMessage(order.getUserId(), "order", "订单已指派",
                "您的" + order.getType() + "订单已由社区指派互助员" + helper.getName(), order.getId());
        insertMessage(helperId, "order", "社区指派新订单",
                "社区为您指派了" + order.getType() + "订单，请按时上门服务", order.getId());

        // 关键节点通知：订阅消息 + 短信兜底
        Map<String, String> data = new LinkedHashMap<>();
        data.put("thing1", order.getType());
        data.put("time2", order.getServiceTime());
        notifyService.notifySubscribe(helperId, "assign", data, "/pages/helper/order/order");
        notifyService.notifySms(helperId, "assign",
                "{\"type\":\"" + order.getType() + "\",\"time\":\"" + order.getServiceTime() + "\"}");
        return Result.ok("指派成功", null);
    }

    /** 管理员取消订单（兜底处理异常订单）：取消即退回冻结资金（refunded 幂等防重，人工退款接口保留作兜底） */
    @Transactional
    public Result<Void> cancel(String orderId, String reason) {
        Order order = orderRepository.findByIdForUpdate(orderId).orElse(null);
        if (order == null) {
            return Result.error(404, "订单不存在");
        }
        if ("completed".equals(order.getStatusKey()) || "cancelled".equals(order.getStatusKey())) {
            return Result.error(400, "当前状态无法取消");
        }

        String cancelReason = (reason == null || reason.isBlank()) ? "管理员取消" : ("管理员取消：" + reason);
        order.setStatus("已取消");
        order.setStatusKey("cancelled");
        order.setCancelReason(cancelReason);
        order.setCancelTime(LocalDateTime.now());
        // 取消即退回冻结资金（2026-10-19 调整：与用户取消一致，不再冻结待人工裁决）
        fundService.refundOnCancel(order);
        orderRepository.save(order);

        insertMessage(order.getUserId(), "order", "订单已取消", "您的" + order.getType() + "订单已被取消，原因：" + cancelReason, order.getId());
        if (order.getHelperId() != null) {
            insertMessage(order.getHelperId(), "order", "订单已取消", order.getType() + "订单已被取消，原因：" + cancelReason, order.getId());
        }
        return Result.ok("取消成功", null);
    }

    /**
     * 人工退款（管理员裁决 · 资金双轨制）：服务中取消等场景资金被冻结时，管理员核实后手动退回下单人。
     * 原因必填 + 操作日志留痕（append-only）。
     */
    @Transactional
    public Result<Void> manualRefund(Long operatorId, String orderId, String reason) {
        if (reason == null || reason.isBlank()) {
            return Result.error(400, "人工退款属于资金操作，请填写退款原因");
        }
        Order order = orderRepository.findByIdForUpdate(orderId).orElse(null);
        if (order == null) {
            return Result.error(404, "订单不存在");
        }
        if ("completed".equals(order.getStatusKey())) {
            return Result.error(400, "订单已完成结算，无法退款");
        }
        if (Integer.valueOf(1).equals(order.getRefunded())) {
            return Result.error(400, "该订单资金已退回，无需重复操作");
        }
        if (Integer.valueOf(1).equals(order.getSettled())) {
            return Result.error(400, "该订单已结算，资金已支付给互助员");
        }
        if (!fundService.hasFrozenFunds(order)) {
            return Result.error(400, "该订单无冻结资金，无需退款");
        }

        String before = snapshotJson(order);
        fundService.refundOnCancel(order);
        orderRepository.save(order);
        operationLogService.record(operatorId, OperationLog.TYPE_MANUAL_REFUND, before, snapshotJson(order), reason.trim());

        insertMessage(order.getUserId(), "order", "订单资金已退回",
                "您的" + order.getType() + "订单冻结资金已由管理员退回，原因：" + reason.trim(), order.getId());
        return Result.ok("已退款并留痕", null);
    }

    // ==================== 超级管理员：账号管理 ====================

    /** 允许的角色集合（方案六大角色） */
    private static final List<String> ALLOWED_ROLES = List.of("老人", "家属", "互助员", "管理员", "民政管理员", "超级管理员");

    /** 角色管理精细化：超管仅能创建社区管理员与民政管理员账号 */
    private static final List<String> ADMIN_CREATABLE_ROLES = List.of("管理员", "民政管理员");

    /** 新建账号（超级管理员，仅限管理员角色） */
    public Result<Map<String, Object>> createUser(Map<String, Object> body) {
        String phone = str(body.get("phone"));
        String password = str(body.get("password"));
        String name = str(body.get("name"));
        String role = str(body.get("role"));

        if (phone.isBlank() || password.isBlank() || name.isBlank() || role.isBlank()) {
            return Result.error(400, "请填写完整信息");
        }
        if (!ADMIN_CREATABLE_ROLES.contains(role)) {
            return Result.error(400, "超级管理员仅能创建社区管理员或民政管理员账号");
        }
        if (userRepository.existsByPhone(phone)) {
            return Result.error(400, "该手机号已注册");
        }

        User user = new User();
        user.setPhone(phone);
        user.setPassword(passwordHasher.hash(password));
        user.setName(name);
        user.setRole(role);
        user.setTimeCoins(0);
        user.setServiceCount(0);
        user.setStatus(1);
        userRepository.save(user);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", user.getId());
        data.put("name", user.getName());
        data.put("phone", user.getPhone());
        data.put("role", user.getRole());
        return Result.ok("账号创建成功", data);
    }

    /** 修改用户角色（超级管理员） */
    public Result<Void> changeRole(Long userId, String role) {
        if (role == null || !ALLOWED_ROLES.contains(role)) {
            return Result.error(400, "角色不合法");
        }
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return Result.error(404, "用户不存在");
        }
        user.setRole(role);
        userRepository.save(user);
        return Result.ok("角色已修改", null);
    }

    /** 重置用户密码（超级管理员） */
    public Result<Void> resetPassword(Long userId, String password) {
        if (password == null || password.isBlank()) {
            return Result.error(400, "请填写新密码");
        }
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return Result.error(404, "用户不存在");
        }
        user.setPassword(passwordHasher.hash(password));
        userRepository.save(user);
        return Result.ok("密码已重置", null);
    }

    // ==================== 角色管理精细化：启停 / 强制干预 / 操作日志 ====================

    /** 启停管理员账号（超级管理员）：仅限社区管理员 / 民政管理员，超级管理员不可被启停 */
    public Result<Void> updateAdminStatus(Long userId, Integer status) {
        if (status == null || (status != 1 && status != 0)) {
            return Result.error(400, "状态不合法");
        }
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return Result.error(404, "账号不存在");
        }
        if ("超级管理员".equals(user.getRole())) {
            return Result.error(400, "超级管理员账号不可启停");
        }
        if (!ADMIN_CREATABLE_ROLES.contains(user.getRole())) {
            return Result.error(400, "只能启停社区管理员或民政管理员账号");
        }
        user.setStatus(status);
        userRepository.save(user);
        return Result.ok(status == 1 ? "账号已启用" : "账号已禁用", null);
    }

    /** 启停普通用户 / 互助员账号（社区管理员） */
    public Result<Void> updateUserStatus(Long userId, Integer status) {
        if (status == null || (status != 1 && status != 0)) {
            return Result.error(400, "状态不合法");
        }
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return Result.error(404, "用户不存在");
        }
        if (!"老人".equals(user.getRole()) && !"家属".equals(user.getRole()) && !"互助员".equals(user.getRole())) {
            return Result.error(400, "只能启停普通用户与互助员账号");
        }
        user.setStatus(status);
        userRepository.save(user);
        return Result.ok(status == 1 ? "账号已启用" : "账号已禁用", null);
    }

    /** 强制取消订单（民政管理员紧急干预，高危动作）：原因必填 + 操作日志留痕；取消即退回冻结资金 */
    @Transactional
    public Result<Void> forceCancel(Long operatorId, String orderId, String reason) {
        if (reason == null || reason.isBlank()) {
            return Result.error(400, "强制取消属于高危操作，请填写干预原因");
        }
        Order order = orderRepository.findByIdForUpdate(orderId).orElse(null);
        if (order == null) {
            return Result.error(404, "订单不存在");
        }
        if ("completed".equals(order.getStatusKey()) || "cancelled".equals(order.getStatusKey())) {
            return Result.error(400, "当前状态无法取消");
        }
        String before = snapshotJson(order);
        String cancelReason = "紧急干预取消：" + reason.trim();
        order.setStatus("已取消");
        order.setStatusKey("cancelled");
        order.setCancelReason(cancelReason);
        order.setCancelTime(LocalDateTime.now());
        // 取消即退回冻结资金（2026-10-19 调整：与用户取消一致，不再冻结待人工裁决）
        fundService.refundOnCancel(order);
        orderRepository.save(order);

        operationLogService.record(operatorId, OperationLog.TYPE_FORCE_CANCEL, before, snapshotJson(order), reason.trim());
        insertMessage(order.getUserId(), "order", "订单已被紧急取消",
                "您的" + order.getType() + "订单已被紧急干预取消，原因：" + cancelReason, order.getId());
        if (order.getHelperId() != null) {
            insertMessage(order.getHelperId(), "order", "订单已被紧急取消",
                    order.getType() + "订单已被紧急干预取消，原因：" + cancelReason, order.getId());
        }
        return Result.ok("已强制取消并留痕", null);
    }

    /** 强制指派互助员（民政管理员紧急干预，高危动作）：原因必填 + 操作日志留痕，可覆盖原接单互助员 */
    public Result<Void> forceAssign(Long operatorId, String orderId, Long helperId, String reason) {
        if (reason == null || reason.isBlank()) {
            return Result.error(400, "强制指派属于高危操作，请填写干预原因");
        }
        if (helperId == null) {
            return Result.error(400, "请选择互助员");
        }
        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null) {
            return Result.error(404, "订单不存在");
        }
        if ("completed".equals(order.getStatusKey()) || "cancelled".equals(order.getStatusKey())) {
            return Result.error(400, "当前状态无法指派");
        }
        User helper = userRepository.findById(helperId).orElse(null);
        if (helper == null) {
            return Result.error(404, "互助员不存在");
        }
        if (!"互助员".equals(helper.getRole())) {
            return Result.error(400, "指派的用户不是互助员");
        }
        if (helperId.equals(order.getUserId())) {
            return Result.error(400, "不能指派给下单人自己");
        }

        String before = snapshotJson(order);
        order.setStatus("服务中");
        order.setStatusKey("serving");
        order.setHelper(helper.getName());
        order.setHelperId(helperId);
        order.setAcceptedAt(LocalDateTime.now());
        orderRepository.save(order);

        operationLogService.record(operatorId, OperationLog.TYPE_FORCE_ASSIGN, before, snapshotJson(order), reason.trim());
        insertMessage(order.getUserId(), "order", "订单已紧急指派",
                "您的" + order.getType() + "订单已由紧急干预指派互助员" + helper.getName(), order.getId());
        insertMessage(helperId, "order", "社区紧急指派新订单",
                "社区为您紧急指派了" + order.getType() + "订单，请按时上门服务", order.getId());

        // 关键节点通知：订阅消息 + 短信兜底
        Map<String, String> data = new LinkedHashMap<>();
        data.put("thing1", order.getType());
        data.put("time2", order.getServiceTime());
        notifyService.notifySubscribe(helperId, "assign", data, "/pages/helper/order/order");
        notifyService.notifySms(helperId, "assign",
                "{\"type\":\"" + order.getType() + "\",\"time\":\"" + order.getServiceTime() + "\"}");
        return Result.ok("已强制指派并留痕", null);
    }

    /** 操作日志分页查询（append-only：只提供查询，无修改删除入口） */
    public Result<Map<String, Object>> operationLogs(String operateType, int page, int size) {
        int pageNum = Math.max(page, 1);
        int pageSize = Math.min(Math.max(size, 1), 50);
        Page<OperationLog> logs = operationLogService.page(operateType, PageRequest.of(pageNum - 1, pageSize));

        Map<Long, String> nameMap = new HashMap<>();
        for (OperationLog l : logs.getContent()) {
            nameMap.putIfAbsent(l.getOperatorId(), null);
        }
        if (!nameMap.isEmpty()) {
            for (User u : userRepository.findAllById(nameMap.keySet())) {
                nameMap.put(u.getId(), u.getName());
            }
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        for (OperationLog l : logs.getContent()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", l.getId());
            row.put("operatorId", l.getOperatorId());
            row.put("operatorName", nameMap.getOrDefault(l.getOperatorId(), "未知"));
            row.put("operateType", l.getOperateType());
            row.put("beforeContent", l.getBeforeContent());
            row.put("afterContent", l.getAfterContent());
            row.put("remark", l.getRemark());
            row.put("createdAt", l.getCreatedAt() == null ? "" : l.getCreatedAt().format(FMT));
            rows.add(row);
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("total", logs.getTotalElements());
        data.put("page", pageNum);
        data.put("size", pageSize);
        data.put("list", rows);
        return Result.ok(data);
    }

    /** 订单状态快照（强制干预操作日志 before / after 内容） */
    private String snapshotJson(Order o) {
        try {
            Map<String, Object> snap = new LinkedHashMap<>();
            snap.put("orderId", o.getId());
            snap.put("statusKey", o.getStatusKey());
            snap.put("status", o.getStatus());
            snap.put("helperId", o.getHelperId());
            snap.put("helper", o.getHelper());
            snap.put("cancelReason", o.getCancelReason());
            return objectMapper.writeValueAsString(snap);
        } catch (Exception e) {
            return "{}";
        }
    }

    // ==================== 定时任务 ====================

    /**
     * 超时兜底（2026-10-16 产品调整）：原逻辑为"待接单超30分钟自动转入待派单池（方案7.1）"，
     * 现改为不转池——超时订单继续留在订单广场（互助员端置顶显示超时时长，仍可抢单），
     * 管理员端对超时订单做"建议指派"标记提醒。
     * 如需恢复转池机制，取消下方注释并恢复原实现即可。
     */
    @Scheduled(fixedDelay = 60_000)
    public void sweepTimeoutOrders() {
        // 已停用：超时订单不再自动转入待派单池（见上方说明）
        // LocalDateTime threshold = LocalDateTime.now().minusMinutes(TIMEOUT_MINUTES);
        // List<Order> timeoutOrders = orderRepository
        //         .findByStatusKeyAndIsDeletedAndCreatedAtBeforeOrderByCreatedAtAsc("pending", 0, threshold);
        // for (Order o : timeoutOrders) {
        //     o.setStatus("待派单");
        //     o.setStatusKey("dispatch_pool");
        //     orderRepository.save(o);
        //     insertMessage(o.getUserId(), "order", "订单转入待派单",
        //             "您的" + o.getType() + "订单超时无人接单，已转入待派单池，将由社区管理员指派互助员");
        // }
    }

    // ==================== 私有工具 ====================

    private Map<String, Object> toAdminMap(Order o, String userNickname) {
        int original = o.getOriginalReward() == null
                ? (o.getReward() == null ? 0 : o.getReward())
                : o.getOriginalReward();
        int reward = o.getReward() == null ? 0 : o.getReward();

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", o.getId());
        row.put("userId", o.getUserId());
        row.put("userNickname", userNickname == null || userNickname.isBlank() ? "用户" + o.getUserId() : userNickname);
        row.put("type", o.getType());
        row.put("address", o.getAddress());
        row.put("time", o.getServiceTime());
        row.put("reward", reward);
        row.put("originalReward", original);
        row.put("extraReward", reward - original);
        row.put("status", o.getStatus());
        row.put("statusKey", o.getStatusKey());
        row.put("helper", o.getHelper());
        row.put("helperId", o.getHelperId());
        row.put("distance", o.getDistance());
        row.put("remark", o.getRemark());
        row.put("images", parseImages(o.getImages()).stream().map(this::fixImageUrl).toList());
        row.put("subType", o.getSubType());
        row.put("priceText", o.getPriceText());
        row.put("assetType", o.getAssetType());
        row.put("rmbAmount", o.getRmbAmount());
        row.put("payStatus", o.getPayStatus());
        row.put("hours", o.getHours());
        row.put("frozenCoins", o.getFrozenCoins());
        // 超时标记：超过30分钟未接单 → 管理员端提示"建议指派"（2026-10-16 产品调整，不再自动转池）
        long minutes = o.getCreatedAt() == null ? 0 : ChronoUnit.MINUTES.between(o.getCreatedAt(), LocalDateTime.now());
        row.put("minutesSincePublish", Math.max(minutes, 0));
        row.put("timeout", minutes >= 30);
        row.put("patientRelation", o.getPatientRelation());
        row.put("patientName", o.getPatientName());
        row.put("patientAge", o.getPatientAge());
        row.put("tasks", parseStringList(o.getTasks()));
        row.put("assessment", parseJsonMap(o.getAssessment()));
        row.put("cancelReason", o.getCancelReason());
        row.put("evaluated", Integer.valueOf(1).equals(o.getEvaluated()));
        row.put("rating", o.getRating());
        row.put("publishTime", o.getCreatedAt() == null ? "" : o.getCreatedAt().format(FMT));
        row.put("acceptedAt", o.getAcceptedAt() == null ? "" : o.getAcceptedAt().format(FMT));
        row.put("cancelTime", o.getCancelTime() == null ? "" : o.getCancelTime().format(FMT));
        return row;
    }

    /** 消息 ID 自增序列：同一毫秒连发多条消息（如取消通知双方）时保证主键唯一 */
    private static final java.util.concurrent.atomic.AtomicLong MSG_SEQ = new java.util.concurrent.atomic.AtomicLong(0);

    private void insertMessage(Long userId, String type, String title, String content) {
        insertMessage(userId, type, title, content, null);
    }

    /** 插入站内消息（带关联订单号，点击跳转订单详情） */
    private void insertMessage(Long userId, String type, String title, String content, String orderId) {
        if (userId == null) {
            return;
        }
        Message msg = new Message();
        msg.setId("MSG" + System.currentTimeMillis() + "_" + MSG_SEQ.incrementAndGet());
        msg.setUserId(userId);
        msg.setType(type);
        msg.setTitle(title);
        msg.setContent(content);
        msg.setOrderId(orderId);
        msg.setIsRead(0);
        messageRepository.save(msg);
    }

    private List<String> parseImages(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {
            });
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    /** 订单留痕列表（管理端质量监管：照片+位置+时间轴） */
    public Result<List<Map<String, Object>>> traces(String orderId) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (ServiceTrace t : traceRepository.findByOrderIdOrderByCreatedAtAsc(orderId)) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", t.getId());
            row.put("kind", t.getKind());
            row.put("kindName", "start".equals(t.getKind()) ? "开工打卡" : "完工打卡");
            row.put("photos", parseImages(t.getPhotos()).stream().map(this::fixImageUrl).toList());
            row.put("longitude", t.getLongitude());
            row.put("latitude", t.getLatitude());
            row.put("locationText", t.getLocationText());
            row.put("time", t.getCreatedAt() == null ? "" : t.getCreatedAt().format(FMT));
            rows.add(row);
        }
        return Result.ok(rows);
    }

    /**
     * 服务超时提醒：服务中订单超过预约时间仍未完成 → 通知互助员（订阅+短信），每单仅提醒一次
     */
    @Scheduled(fixedRate = 300000)
    public void notifyTimeoutOrders() {
        try {
            LocalDateTime now = LocalDateTime.now();
            List<Order> list = orderRepository.findByStatusKeyAndIsDeletedAndTimeoutNotified("serving", 0, 0);
            for (Order o : list) {
                LocalDateTime serviceTime = parseServiceTime(o.getServiceTime());
                if (serviceTime == null || serviceTime.isAfter(now)) continue;
                o.setTimeoutNotified(1);
                orderRepository.save(o);

                Map<String, String> data = new LinkedHashMap<>();
                data.put("thing1", o.getType());
                data.put("time2", o.getServiceTime());
                notifyService.notifySubscribe(o.getHelperId(), "timeout", data, "/pages/helper/order/order");
                notifyService.notifySms(o.getHelperId(), "timeout",
                        "{\"type\":\"" + o.getType() + "\",\"time\":\"" + o.getServiceTime() + "\"}");
                System.out.println("[notify] 服务超时提醒已发送: " + o.getId());
            }
        } catch (Exception e) {
            System.out.println("[notify] 超时扫描异常: " + e.getMessage());
        }
    }

    /** 解析预约时间 "2026-10-08 上午 08:00-12:00" → 取开始时刻 */
    private LocalDateTime parseServiceTime(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            String cleaned = s.replace("上午", "").replace("下午", "").replace("晚上", "").trim();
            return LocalDateTime.parse(cleaned.substring(0, 16), DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));
        } catch (Exception e) {
            return null;
        }
    }

    /** 通知联调测试：向管理员自己绑定的 openid 发送测试订阅消息 */
    public Result<String> notifyTest(Long uid) {
        User user = userRepository.findById(uid).orElse(null);
        if (user == null || user.getOpenid() == null || user.getOpenid().isBlank()) {
            return Result.error(400, "当前账号未绑定微信 openid（请在小程序端登录一次完成绑定）");
        }
        Map<String, String> data = new LinkedHashMap<>();
        data.put("thing1", "通知联调测试");
        data.put("time2", LocalDateTime.now().format(FMT));
        wechatService.sendSubscribe(user.getOpenid(), tplAssign, "/pages/helper/order/order", data);
        return Result.ok("测试订阅消息已尝试发送，请查看后端日志确认结果", null);
    }

    /** 字符串数组 JSON 解析（帮办事项） */
    private List<String> parseStringList(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {
            });
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    /** 对象 JSON 解析（健康评估结果） */
    private Map<String, Object> parseJsonMap(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {
            });
        } catch (Exception e) {
            return null;
        }
    }

    private String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    private String fixImageUrl(String url) {
        if (url == null || url.isBlank()) {
            return url;
        }
        String fixed;
        if (url.startsWith("http://") || url.startsWith("https://")) {
            fixed = url.replaceFirst("https?://[^/]+", Matcher.quoteReplacement(appConfig.imageBaseUrl()));
        } else {
            // 历史数据存的是纯文件名（如 compressed_xxx.jpg），补全为完整访问地址
            fixed = appConfig.imageBaseUrl() + "/uploads/" + url;
        }
        if (fixed.contains(".png") && !fixed.contains("compressed_")) {
            int idx = fixed.lastIndexOf('/');
            String fname = fixed.substring(idx + 1);
            fixed = fixed.substring(0, idx + 1) + "compressed_" + fname.replace(".png", ".jpg");
        }
        return fixed;
    }
}
