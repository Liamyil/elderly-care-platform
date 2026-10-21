package com.elderly.care.service;

import com.elderly.care.common.PhoneMaskUtil;
import com.elderly.care.common.Result;
import com.elderly.care.config.AppConfig;
import com.elderly.care.entity.Message;
import com.elderly.care.entity.Order;
import com.elderly.care.entity.ServiceTrace;
import com.elderly.care.entity.SystemConfig;
import com.elderly.care.entity.Transaction;
import com.elderly.care.entity.User;
import com.elderly.care.repository.MessageRepository;
import com.elderly.care.repository.OrderRepository;
import com.elderly.care.repository.ServiceTraceRepository;
import com.elderly.care.repository.TransactionRepository;
import com.elderly.care.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.regex.Matcher;

/**
 * 订单服务：发单 / 接单 / 履约 / 确认 / 结算 / 评价 全流程
 * 状态机：pending → serving → pending_confirm → completed；pending/serving 可 cancelled
 * 资金双轨制（2026-10-18）：
 * - 互助类（type≠陪诊服务）：1小时=1时间币，发单冻结 → 完成结算给互助员 / 取消退回下单人；
 * - 陪诊类（type=陪诊服务）：人民币结算，pending_pay(待支付) → 支付成功(一期模拟) → pending 抢单。
 */
@Service
public class OrderService {

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final List<String> CANCEL_REASONS = List.of(
            "我不需要服务了", "发布信息有误", "已找到其他互助员", "服务时间需要更改", "其他原因");

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final MessageRepository messageRepository;
    private final TransactionRepository transactionRepository;
    private final ServiceTraceRepository traceRepository;
    private final NotifyService notifyService;
    private final AppConfig appConfig;
    private final SystemConfigService systemConfigService;
    private final OrderFundService fundService;
    private final WechatPayService wechatPayService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Random random = new Random();

    public OrderService(OrderRepository orderRepository, UserRepository userRepository,
                        MessageRepository messageRepository, TransactionRepository transactionRepository,
                        ServiceTraceRepository traceRepository, NotifyService notifyService, AppConfig appConfig,
                        SystemConfigService systemConfigService, OrderFundService fundService,
                        WechatPayService wechatPayService) {
        this.orderRepository = orderRepository;
        this.userRepository = userRepository;
        this.messageRepository = messageRepository;
        this.transactionRepository = transactionRepository;
        this.traceRepository = traceRepository;
        this.notifyService = notifyService;
        this.appConfig = appConfig;
        this.systemConfigService = systemConfigService;
        this.fundService = fundService;
        this.wechatPayService = wechatPayService;
    }

    // ==================== 查询类 ====================

    /** 首页数据：公告 + 附近待接单订单 + 用户信息（公告为占位数据，用户信息取真实值） */
    public Result<Map<String, Object>> home(Long uid) {
        List<Map<String, Object>> notices = new ArrayList<>();
        Map<String, Object> n1 = new LinkedHashMap<>();
        n1.put("id", 1);
        n1.put("title", "平台公告");
        n1.put("content", "欢迎使用智慧互助养老平台");
        n1.put("time", "2026-07-01 10:00");
        Map<String, Object> n2 = new LinkedHashMap<>();
        n2.put("id", 2);
        n2.put("title", "新服务上线");
        n2.put("content", "助浴服务、心理关怀等服务已上线");
        n2.put("time", "2026-07-02 09:00");
        notices.add(n1);
        notices.add(n2);

        // 用户信息取真实值（原为硬编码占位）：余额 + 实时统计的已完成订单数
        User u = userRepository.findById(uid).orElse(null);
        Map<String, Object> userInfo = new LinkedHashMap<>();
        userInfo.put("timeCoins", u == null || u.getTimeCoins() == null ? 0 : u.getTimeCoins());
        userInfo.put("serviceCount", u == null ? 0 : (int) orderRepository.countCompletedByUser(u.getId()));

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("notices", notices);
        data.put("nearbyOrders", nearbyList(uid, 10));
        data.put("userInfo", userInfo);
        return Result.ok(data);
    }

    /** 附近待接单订单（订单广场抢单用），排除本人发布 */
    public Result<List<Map<String, Object>>> nearby(Long uid) {
        return Result.ok(nearbyList(uid, 50));
    }

    /** 公开订单列表（H5 公示用，无需登录），可按状态过滤 */
    public Result<Map<String, Object>> publicOrders(String status) {
        PageRequest pageable = PageRequest.of(0, 100, Sort.by(Sort.Direction.DESC, "createdAt"));
        List<Order> orders = (status == null || status.isBlank())
                ? orderRepository.findPublicAll(pageable)
                : orderRepository.findPublicByStatus(status, pageable);

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Order o : orders) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", o.getId());
            row.put("userId", o.getUserId());
            row.put("type", o.getType());
            row.put("address", o.getAddress());
            row.put("serviceTime", o.getServiceTime());
            row.put("reward", o.getReward());
            row.put("status", o.getStatus());
            row.put("statusKey", o.getStatusKey());
            row.put("helper", o.getHelper());
            row.put("distance", o.getDistance());
            row.put("remark", o.getRemark());
            row.put("images", parseImages(o.getImages()).stream().map(this::fixImageUrl).toList());
            row.put("cancelReason", o.getCancelReason());
            row.put("publishTime", formatDateTime(o.getCreatedAt()));
            LocalDateTime cancelTime = o.getCancelTime() != null
                    ? o.getCancelTime()
                    : ("cancelled".equals(o.getStatusKey()) ? o.getUpdatedAt() : null);
            row.put("cancelTime", formatDateTime(cancelTime));
            rows.add(row);
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("total", rows.size());
        data.put("orders", rows);
        return Result.ok("success", data);
    }

    /** 公开评价列表（无需登录，陪诊页展示真实评价用），可选按服务类型/子类型过滤 */
    public Result<List<Map<String, Object>>> evaluations(String type, String subType) {
        PageRequest pageable = PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "updatedAt"));
        List<Order> orders = orderRepository.findByIsDeletedAndStatusKeyAndEvaluated(0, "completed", 1, pageable);

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Order o : orders) {
            if (type != null && !type.isBlank() && !type.equals(o.getType())) {
                continue;
            }
            if (subType != null && !subType.isBlank() && !subType.equals(o.getSubType())) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("type", o.getType());
            row.put("helper", o.getHelper());
            row.put("rating", o.getRating());
            row.put("comment", o.getComment());
            row.put("serviceTime", o.getServiceTime());
            rows.add(row);
        }
        return Result.ok(rows);
    }

    /** 我的订单（我发布的 + 我接的），可选状态过滤 */
    public Result<List<Map<String, Object>>> mine(Long uid, String status) {
        List<Order> orders = (status == null || status.isBlank())
                ? orderRepository.findMine(uid)
                : orderRepository.findMineByStatus(uid, status);

        // 下单人姓名批量查询（互助员端卡片「下单人：XX」展示用，纯返回字段）
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
            rows.add(toMineMap(o, uid, nameMap));
        }
        return Result.ok(rows);
    }

    /** 订单详情：按查看人身份下发时间轴与双方联系方式。
     *  防泄露红线：老人姓名/电话仅接单互助员可见；互助员电话仅下单人可见；
     *  未接单/已取消/非当事方一律不下发完整信息（姓名脱敏、电话置空）。 */
    public Result<Map<String, Object>> detail(Long uid, String orderId) {
        Order o = orderRepository.findById(orderId).orElse(null);
        if (o == null || Integer.valueOf(1).equals(o.getIsDeleted())) {
            return Result.error(404, "订单不存在");
        }

        boolean isCreator = uid != null && uid.equals(o.getUserId());
        boolean accepted = o.getHelperId() != null;
        boolean isAssignedHelper = accepted && uid != null && uid.equals(o.getHelperId());
        boolean contactAllowed = accepted && !"cancelled".equals(o.getStatusKey());

        User elderUser = userRepository.findById(o.getUserId()).orElse(null);
        User helperUser = accepted ? userRepository.findById(o.getHelperId()).orElse(null) : null;

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", o.getId());
        row.put("type", o.getType());
        row.put("subType", o.getSubType());
        row.put("priceText", o.getPriceText());
        row.put("assetType", o.getAssetType());
        row.put("rmbAmount", o.getRmbAmount());
        row.put("payStatus", o.getPayStatus());
        row.put("hours", o.getHours());
        row.put("address", o.getAddress());
        row.put("time", o.getServiceTime());
        row.put("reward", o.getReward());
        row.put("status", o.getStatus());
        row.put("statusKey", o.getStatusKey());
        row.put("helper", o.getHelper());
        row.put("distance", o.getDistance());
        row.put("remark", o.getRemark());
        row.put("images", parseImages(o.getImages()).stream().map(this::fixImageUrl).toList());
        row.put("cancelReason", o.getCancelReason());
        row.put("evaluated", Integer.valueOf(1).equals(o.getEvaluated()));
        row.put("rating", o.getRating());
        row.put("comment", o.getComment());
        // 时间轴：发单 / 接单 / 服务完成（有值才下发，前端按非空渲染）
        row.put("publishTime", formatDateTime(o.getCreatedAt()));
        row.put("acceptedAt", formatDateTime(o.getAcceptedAt()));
        row.put("completedAt", formatDateTime(o.getCompletedAt()));
        LocalDateTime cancelTime = o.getCancelTime() != null
                ? o.getCancelTime()
                : ("cancelled".equals(o.getStatusKey()) ? o.getUpdatedAt() : null);
        row.put("cancelTime", formatDateTime(cancelTime));
        row.put("patientRelation", o.getPatientRelation());
        row.put("patientName", o.getPatientName());
        row.put("patientAge", o.getPatientAge());
        row.put("tasks", parseStringList(o.getTasks()));
        row.put("assessment", parseJsonMap(o.getAssessment()));
        // 双方联系方式（仅当事方可见，见方法注释的防泄露规则）
        String elderName = elderUser != null && !elderUser.getName().isBlank()
                ? elderUser.getName() : "用户" + o.getUserId();
        String helperName = o.getHelper() != null && !o.getHelper().isBlank()
                ? o.getHelper()
                : (helperUser != null && !helperUser.getName().isBlank() ? helperUser.getName() : "互助员");
        row.put("elderName", contactAllowed && isAssignedHelper ? elderName : PhoneMaskUtil.maskName(elderName));
        row.put("elderPhone", contactAllowed && isAssignedHelper && elderUser != null && elderUser.getPhone() != null
                ? elderUser.getPhone() : "");
        row.put("helperName", contactAllowed ? helperName : "");
        row.put("helperPhone", contactAllowed && isCreator && helperUser != null && helperUser.getPhone() != null
                ? helperUser.getPhone() : "");
        row.put("isCreator", isCreator);
        row.put("isAssignedHelper", isAssignedHelper);
        return Result.ok(row);
    }

    // ==================== 操作类 ====================

    /**
     * 老人/家属发布需求订单（资金双轨制 · 对应方案"需求发起双模式"）：
     * - 互助类：1小时=1时间币，后端按服务时长自动算币，发单即冻结扣余额（余额不足拒绝）；
     * - 陪诊类（type=陪诊服务）：人民币结算，发单先落"待支付"，支付成功（一期模拟）后转待接单。
     */
    @Transactional
    public Result<Map<String, Object>> create(Long uid, Map<String, Object> body) {
        String type = str(body.get("type"));
        String subType = str(body.get("subType"));
        String address = str(body.get("address"));
        String time = str(body.get("time"));
        Object rewardObj = body.get("reward");
        // 结构化字段：就诊人 / 帮办事项 / 健康评估（后台统计用）
        String priceText = str(body.get("priceText"));
        String patientRelation = str(body.get("patientRelation"));
        String patientName = str(body.get("patientName"));
        String patientAge = str(body.get("patientAge"));
        List<?> tasks = body.get("tasks") instanceof List ? (List<?>) body.get("tasks") : null;
        Object assessment = body.get("assessment");
        // 资金双轨制字段：服务时长（互助类，1小时=1币）/ 人民币金额（陪诊类）
        Integer hours = body.get("hours") == null ? null : parseInt(body.get("hours"));
        BigDecimal rmbAmount = body.get("rmbAmount") == null ? null : parseDecimal(body.get("rmbAmount"));

        if (type.isBlank() || address.isBlank() || time.isBlank()) {
            return Result.error(400, "请填写完整订单信息");
        }

        boolean rmbOrder = "陪诊服务".equals(type);

        Order order = new Order();
        order.setId("DD" + String.valueOf(System.currentTimeMillis()).substring(3));
        order.setUserId(uid);
        order.setType(type);
        if (!subType.isBlank()) {
            order.setSubType(subType);
        }
        order.setAddress(address);
        order.setServiceTime(time);
        if (!priceText.isBlank()) order.setPriceText(priceText);
        if (!patientRelation.isBlank()) order.setPatientRelation(patientRelation);
        if (!patientName.isBlank()) order.setPatientName(patientName);
        if (!patientAge.isBlank()) order.setPatientAge(patientAge);
        if (tasks != null && !tasks.isEmpty()) {
            try {
                order.setTasks(objectMapper.writeValueAsString(tasks));
            } catch (Exception ignored) {
            }
        }
        if (assessment != null) {
            try {
                order.setAssessment(objectMapper.writeValueAsString(assessment));
            } catch (Exception ignored) {
            }
        }
        order.setDistance((random.nextInt(2000) + 100) + "m");
        order.setRemark(str(body.get("remark")));
        List<?> images = body.get("images") instanceof List ? (List<?>) body.get("images") : null;
        if (images != null && !images.isEmpty()) {
            try {
                order.setImages(objectMapper.writeValueAsString(images));
            } catch (Exception ignored) {
            }
        }
        order.setIsDeleted(0);
        order.setEvaluated(0);
        // 2026-10-10 产品决定：暂跳过审核环节（《方案》原流程为"先审核后公开"，
        // 恢复审核时改回 reviewing 并放开订单页"待审核"页签）

        if (rmbOrder) {
            // ===== 陪诊类：人民币结算，发单不扣时间币，支付成功后进广场 =====
            if (rmbAmount == null || rmbAmount.compareTo(BigDecimal.ZERO) <= 0) {
                return Result.error(400, "请选择陪诊服务项目（缺少支付金额）");
            }
            order.setAssetType(OrderFundService.ASSET_RMB);
            order.setRmbAmount(rmbAmount);
            order.setReward(0);
            order.setOriginalReward(0);
            order.setPayStatus(OrderFundService.PAY_UNPAID);
            order.setFrozenCoins(0);
            order.setSettled(0);
            order.setRefunded(0);
            order.setStatus("待支付");
            order.setStatusKey(OrderFundService.STATUS_PENDING_PAY);
            orderRepository.save(order);
            insertMessage(uid, "order", "订单已提交", "您的" + type + "订单已提交，请完成支付", order.getId());
        } else {
            // ===== 互助类：1小时=1时间币，发单即冻结（余额即可用余额） =====
            // 服务时长必选（老前端未传时长时兼容 reward 字段取值）
            int hoursVal = hours != null ? hours : parseInt(rewardObj);
            if (hoursVal < 1 || hoursVal > 24) {
                return Result.error(400, "请选择服务时长（1~24小时）");
            }
            order.setAssetType(OrderFundService.ASSET_TIME_COIN);
            order.setHours(hoursVal);
            order.setReward(hoursVal);
            order.setOriginalReward(hoursVal);
            order.setFrozenCoins(hoursVal);
            order.setSettled(0);
            order.setRefunded(0);
            order.setStatus("待接单");
            order.setStatusKey("pending");
            // 发单即冻结时间币（先冻结后落库：余额不足直接拒绝，未写库无需回滚）
            if (!fundService.freezeCoins(uid, hoursVal, type, order.getId())) {
                return Result.error(400, "时间币不足，当前余额无法支付该订单");
            }
            orderRepository.save(order);
            insertMessage(uid, "order", "订单已提交", "您的" + type + "订单已提交并冻结" + hoursVal + "时间币，等待互助员接单", order.getId());
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", order.getId());
        return Result.ok("订单已提交", data);
    }

    /**
     * 陪诊订单支付（一期模拟支付：pay_mock=1 支付即成功；真实微信支付接入后返回 JSAPI 支付参数）
     */
    @Transactional
    public Result<Map<String, Object>> pay(Long uid, String orderId) {
        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null) {
            return Result.error(404, "订单不存在");
        }
        if (!uid.equals(order.getUserId())) {
            return Result.error(403, "只有下单用户才能支付");
        }
        if (!OrderFundService.ASSET_RMB.equals(order.getAssetType())) {
            return Result.error(400, "该订单为时间币结算，无需支付");
        }
        if (!OrderFundService.STATUS_PENDING_PAY.equals(order.getStatusKey())) {
            return Result.error(400, "订单不在待支付状态");
        }
        if (!OrderFundService.PAY_UNPAID.equals(order.getPayStatus())) {
            return Result.error(400, "订单已支付或已退款");
        }
        if (!wechatPayService.isMockMode()) {
            return wechatPayService.createPayParams(order, null);
        }
        order.setPayStatus(OrderFundService.PAY_PAID);
        order.setStatus("待接单");
        order.setStatusKey("pending");
        orderRepository.save(order);
        // 下单人消费流水：支付即记支出（rmbSpent 统计口径 = pay_status=paid，与明细完全对应；退款时删回）
        fundService.insertRmbTx(uid, "expense", order.getType() + "-服务消费", order.getRmbAmount(), order.getId());
        insertMessage(uid, "order", "支付成功", "您的" + order.getType() + "订单支付成功（模拟支付），等待互助员接单", order.getId());

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("mock", true);
        data.put("statusKey", order.getStatusKey());
        return Result.ok("支付成功", data);
    }

    /** 互助员接单（订单广场抢单） */
    public Result<Void> accept(Long uid, String orderId) {
        User helper = userRepository.findById(uid).orElse(null);
        if (helper == null) {
            return Result.error(404, "用户不存在");
        }
        if ("老人".equals(helper.getRole()) || "家属".equals(helper.getRole())) {
            return Result.error(403, "老人和家属账号不可接单，仅可发布订单");
        }

        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null) {
            return Result.error(404, "订单不存在");
        }
        // 待接单可接；待派单兼容接单（2026-10-16 接单逻辑调整后超时订单仍可抢）
        if (!"pending".equals(order.getStatusKey()) && !"dispatch_pool".equals(order.getStatusKey())) {
            return Result.error(400, "订单已被接单或已取消");
        }
        if (order.getUserId().equals(uid)) {
            return Result.error(400, "不能承接自己发布的订单");
        }
        Result<Void> limit = checkGrabLimits(uid);
        if (limit != null) {
            return limit;
        }

        order.setStatus("服务中");
        order.setStatusKey("serving");
        String helperName = helper.getName() == null || helper.getName().isBlank() ? "互助员" : helper.getName();
        order.setHelper(helperName);
        order.setHelperId(uid);
        order.setAcceptedAt(LocalDateTime.now());
        orderRepository.save(order);

        // 站内信闭环：接单 → 通知发单老人（带关联订单号，点击跳转订单详情）
        insertMessage(order.getUserId(), "order", "订单已接单",
                "互助员" + helperName + "已接单，请保持电话畅通。", order.getId());
        return Result.ok("接单成功", null);
    }

    /** 接单限制校验（角色管理精细化 · 系统配置）：
     * 1. 并发订单数上限：服务中 + 待确认订单数达到上限则拒绝；
     * 2. 接单距离上限：当前数据模型订单与互助员均无经纬度字段（订单仅存展示距离文本），
     *    暂无法计算真实距离，配置值保留在系统配置页展示，待补充坐标后启用实际校验。 */
    private Result<Void> checkGrabLimits(Long helperId) {
        int maxConcurrent = systemConfigService.getIntValue(SystemConfig.KEY_MAX_CONCURRENT_ORDERS, 3);
        long active = orderRepository.countByHelperIdAndStatusKeyInAndIsDeleted(
                helperId, List.of("serving", "pending_confirm"), 0);
        if (active >= maxConcurrent) {
            return Result.error(400, "您有" + active + "个进行中的订单，已达并发上限" + maxConcurrent + "个，请先完成现有服务");
        }
        return null;
    }

    /** 互助员抢单（与原版 grab 接口一致，保留兼容） */
    public Result<Void> grab(Long uid, String orderId) {
        User helper = userRepository.findById(uid).orElse(null);
        if (helper == null) {
            return Result.error(404, "用户不存在");
        }
        if ("老人".equals(helper.getRole()) || "家属".equals(helper.getRole())) {
            return Result.error(403, "老人和家属账号不可接单，仅可发布订单");
        }

        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null) {
            return Result.error(404, "订单不存在");
        }
        if (!"pending".equals(order.getStatusKey()) && !"dispatch_pool".equals(order.getStatusKey())) {
            return Result.error(400, "订单已被接单");
        }
        if (order.getUserId().equals(uid)) {
            return Result.error(400, "不能承接自己发布的订单");
        }
        Result<Void> limit = checkGrabLimits(uid);
        if (limit != null) {
            return limit;
        }

        order.setStatus("服务中");
        order.setStatusKey("serving");
        String helperName = helper.getName() == null || helper.getName().isBlank() ? "互助员" : helper.getName();
        order.setHelper(helperName);
        order.setHelperId(uid);
        order.setAcceptedAt(LocalDateTime.now());
        orderRepository.save(order);

        // 站内信闭环：抢单与接单同属"互助员接单"，同样通知发单老人
        insertMessage(order.getUserId(), "order", "订单已接单",
                "互助员" + helperName + "已接单，请保持电话畅通。", order.getId());
        return Result.ok("抢单成功", null);
    }

    /**
     * 取消订单（仅发布人，待接单/待支付/服务中可取消）。
     * 资金规则（双轨制）：取消即自动退回冻结资金——时间币退回下单人余额并记退款流水，
     * 人民币已支付标记原路退款（refunded 幂等防重）。
     * 2026-10-19 产品调整：服务中取消同样自动退款（原「冻结待管理员人工裁决」在演示期无 UI 入口，
     * 资金会永久冻结；人工退款接口保留作兜底）。
     */
    @Transactional
    public Result<Void> cancel(Long uid, String orderId, String reason) {
        Order order = orderRepository.findByIdForUpdate(orderId).orElse(null);
        if (order == null) {
            return Result.error(404, "订单不存在");
        }
        if (!order.getUserId().equals(uid)) {
            return Result.error(403, "只能取消自己发布的订单");
        }
        String statusKey = order.getStatusKey();
        if (!"pending".equals(statusKey) && !"serving".equals(statusKey)
                && !"pending_pay".equals(statusKey) && !"dispatch_pool".equals(statusKey)) {
            return Result.error(400, "当前状态无法取消订单");
        }
        if (reason == null || !CANCEL_REASONS.contains(reason)) {
            return Result.error(400, "取消原因选择不正确");
        }

        int frozenBefore = order.getFrozenCoins() == null ? 0 : order.getFrozenCoins();
        order.setStatus("已取消");
        order.setStatusKey("cancelled");
        order.setCancelReason(reason);
        order.setCancelTime(LocalDateTime.now());
        // 取消即退回冻结资金（任何可取消状态一律退款，refunded 幂等防重）
        fundService.refundOnCancel(order);
        orderRepository.save(order);

        String refundTip = (frozenBefore > 0 && OrderFundService.ASSET_TIME_COIN.equals(order.getAssetType()))
                ? "，冻结的" + frozenBefore + "时间币已退回" : "";
        // 站内信闭环：取消/退款 → 通知双方（下单人退款提示 + 互助员取消告知）
        insertMessage(uid, "order", "订单已取消",
                "订单[" + order.getId() + "]因\"" + reason + "\"已取消" + refundTip, order.getId());
        if (order.getHelperId() != null) {
            insertMessage(order.getHelperId(), "order", "订单已取消",
                    "订单[" + order.getId() + "]已被下单人取消，原因：" + reason + "。", order.getId());
        }
        return Result.ok("订单已取消", null);
    }

    /** 删除订单（软删除，仅发布人） */
    public Result<Void> softDelete(Long uid, String orderId) {
        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null || !order.getUserId().equals(uid)) {
            return Result.error(404, "订单不存在");
        }
        order.setIsDeleted(1);
        order.setDeletedAt(LocalDateTime.now());
        orderRepository.save(order);
        return Result.ok("订单已删除", null);
    }

    /** 互助员完成服务 → 订单进入待确认 */
    public Result<Void> completeService(Long uid, String orderId) {
        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null) {
            return Result.error(404, "订单不存在");
        }
        if (!"serving".equals(order.getStatusKey())) {
            return Result.error(400, "订单状态不正确");
        }
        if (!uid.equals(order.getHelperId())) {
            return Result.error(403, "只有接单的互助员才能完成服务");
        }
        // 方案要求：完工打卡（定位+现场拍照）是完成服务的前置条件
        boolean hasEndTrace = traceRepository.findByOrderIdOrderByCreatedAtAsc(orderId).stream()
                .anyMatch(t -> "end".equals(t.getKind()) && t.getPhotos() != null && !t.getPhotos().isBlank());
        if (!hasEndTrace) {
            return Result.error(400, "请先完成完工打卡（拍照留痕）");
        }

        order.setStatus("待确认");
        order.setStatusKey("pending_confirm");
        orderRepository.save(order);

        // 站内信闭环：互助员完工（完工打卡为前置，此处完成服务）→ 通知老人确认
        insertMessage(order.getUserId(), "order", "服务已完成",
                "互助员已完成服务，请确认。", order.getId());
        return Result.ok("服务已完成，等待对方确认", null);
    }

    /** 下单人追加时间币（传增量）：仅时间币订单可追加，追加部分同样冻结扣余额（历史订单兼容旧行为只加数字） */
    @Transactional
    public Result<Map<String, Object>> addReward(Long uid, String orderId, int addAmount) {
        if (addAmount <= 0) {
            return Result.error(400, "请输入有效的时间币数量");
        }

        Order order = orderRepository.findByIdForUpdate(orderId).orElse(null);
        if (order == null) {
            return Result.error(404, "订单不存在");
        }
        if (!"pending_confirm".equals(order.getStatusKey()) && !"serving".equals(order.getStatusKey())) {
            return Result.error(400, "订单状态不正确");
        }
        if (!order.getUserId().equals(uid)) {
            return Result.error(403, "只有下单用户才能添加时间币");
        }
        if (OrderFundService.ASSET_RMB.equals(order.getAssetType())) {
            return Result.error(400, "人民币结算订单不支持追加时间币");
        }
        // 时间币订单：追加部分先冻结扣余额，不足则拒绝
        if (OrderFundService.ASSET_TIME_COIN.equals(order.getAssetType())
                && !fundService.freezeCoins(uid, addAmount, order.getType(), order.getId())) {
            return Result.error(400, "时间币不足，无法追加");
        }

        int currentReward = order.getReward() == null ? 0 : order.getReward();
        // 首次追加时记录原始奖励，保证 extra 计算不重复累加
        int originalReward = order.getOriginalReward() == null ? currentReward : order.getOriginalReward();
        int newReward = currentReward + addAmount;

        order.setOriginalReward(originalReward);
        order.setReward(newReward);
        order.setFrozenCoins((order.getFrozenCoins() == null ? 0 : order.getFrozenCoins()) + addAmount);
        orderRepository.save(order);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("totalReward", newReward);
        data.put("extraReward", newReward - originalReward);
        return Result.ok("已添加" + addAmount + "时间币，总服务时间币：" + newReward, data);
    }

    /**
     * 下单人确认完成 → 订单已完成 + 自动结算（事务保证一致性，settled 防重）
     * 资金双轨制：时间币订单给互助员加时间币（下单人发单时已冻结扣款）；
     * 人民币订单给互助员加 rmb_balance（进入可提现余额）；
     * 双轨制上线前的历史订单（asset_type 为空）沿用旧逻辑（互助员加币 + 下单人扣币）。
     */
    @Transactional
    public Result<Void> confirmComplete(Long uid, String orderId) {
        Order order = orderRepository.findByIdForUpdate(orderId).orElse(null);
        if (order == null) {
            return Result.error(404, "订单不存在");
        }
        if (!"pending_confirm".equals(order.getStatusKey())) {
            return Result.error(400, "订单状态不正确，需互助员先完成服务");
        }
        if (!order.getUserId().equals(uid)) {
            return Result.error(403, "只有下单用户才能确认完成");
        }

        order.setStatus("已完成");
        order.setStatusKey("completed");
        order.setCompletedAt(LocalDateTime.now());

        String settleDesc = null;
        Long helperId = order.getHelperId();
        if (helperId != null) {
            if (order.getAssetType() == null) {
                // 历史订单（无币种标记）：沿用旧结算逻辑，只流转状态+按旧方式打币
                if (order.getReward() != null) {
                    int reward = order.getReward();
                    User helper = userRepository.findByIdForUpdate(helperId).orElse(null);
                    if (helper != null) {
                        helper.setTimeCoins((helper.getTimeCoins() == null ? 0 : helper.getTimeCoins()) + reward);
                        helper.setServiceCount((helper.getServiceCount() == null ? 0 : helper.getServiceCount()) + 1);
                        userRepository.save(helper);
                    }

                    String txId = "TX" + System.currentTimeMillis();
                    Transaction income = new Transaction();
                    income.setId(txId);
                    income.setUserId(helperId);
                    income.setType("income");
                    income.setName(order.getType());
                    income.setAmount(reward);
                    transactionRepository.save(income);

                    Transaction expense = new Transaction();
                    expense.setId(txId + "U");
                    expense.setUserId(order.getUserId());
                    expense.setType("expense");
                    expense.setName(order.getType() + "-服务消费");
                    expense.setAmount(reward);
                    transactionRepository.save(expense);

                    User owner = userRepository.findByIdForUpdate(order.getUserId()).orElse(null);
                    if (owner != null) {
                        owner.setTimeCoins((owner.getTimeCoins() == null ? 0 : owner.getTimeCoins()) - reward);
                        userRepository.save(owner);
                    }
                    settleDesc = "获得" + reward + "个时间币";
                }
            } else {
                // 双轨制订单：按币种打款给互助员（时间币发单已冻结扣款，此处不重复扣下单人）
                settleDesc = fundService.settleOnComplete(order);
            }
        }
        orderRepository.save(order);

        if (helperId != null) {
            // 站内信闭环：老人确认完成（资金结算）→ 通知互助员报酬入账
            insertMessage(helperId, "order", "资金已结算",
                    "订单[" + order.getId() + "]已结算，报酬已存入您的账户"
                            + (settleDesc == null ? "。" : "，" + settleDesc + "。"), order.getId());

            if (settleDesc != null) {
                // 订阅消息：结算到账提醒互助员
                Map<String, String> settleData = new LinkedHashMap<>();
                settleData.put("thing1", order.getType());
                settleData.put("amount3", settleAmountText(order));
                notifyService.notifySubscribe(helperId, "settle", settleData, "/pages/helper/order/order");
            }
        }

        return Result.ok("订单已完成", null);
    }

    /** 结算提醒金额文本（订阅消息 amount3 用纯数字） */
    private String settleAmountText(Order order) {
        if (OrderFundService.ASSET_RMB.equals(order.getAssetType()) && order.getRmbAmount() != null) {
            return order.getRmbAmount().stripTrailingZeros().toPlainString();
        }
        return String.valueOf(order.getReward() == null ? 0 : order.getReward());
    }

    /** 服务评价 */
    public Result<Void> evaluate(Long uid, String orderId, Object ratingObj, String comment) {
        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null) {
            return Result.error(404, "订单不存在");
        }

        order.setEvaluated(1);
        if (ratingObj != null) {
            try {
                order.setRating(Integer.parseInt(String.valueOf(ratingObj)));
            } catch (NumberFormatException ignored) {
            }
        }
        order.setComment(comment);
        orderRepository.save(order);
        return Result.ok("评价成功", null);
    }

    // ==================== 服务留痕 ====================

    /**
     * 互助员打卡留痕（开工 start / 完工 end）：定位 + 现场照片
     * 一期不做距离硬校验（订单地址为文字描述），由小程序端弹窗人工确认"已到达服务地点"
     */
    public Result<Map<String, Object>> addTrace(Long uid, String orderId, String kind,
                                                List<?> photos, Double longitude, Double latitude, String locationText) {
        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null) {
            return Result.error(404, "订单不存在");
        }
        if (!uid.equals(order.getHelperId())) {
            return Result.error(403, "只有接单的互助员才能打卡留痕");
        }
        if (!"serving".equals(order.getStatusKey())) {
            return Result.error(400, "订单不在服务中，无法打卡");
        }
        if (!"start".equals(kind) && !"end".equals(kind)) {
            return Result.error(400, "打卡类型不正确");
        }
        if (photos == null || photos.isEmpty()) {
            return Result.error(400, "请拍摄现场照片后再打卡");
        }

        ServiceTrace trace = new ServiceTrace();
        trace.setId("TR" + System.currentTimeMillis());
        trace.setOrderId(orderId);
        trace.setHelperId(uid);
        trace.setKind(kind);
        trace.setLongitude(longitude);
        trace.setLatitude(latitude);
        trace.setLocationText(locationText == null ? "" : locationText.trim());
        try {
            trace.setPhotos(objectMapper.writeValueAsString(photos));
        } catch (Exception ignored) {
        }
        traceRepository.save(trace);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", trace.getId());
        data.put("kind", kind);
        return Result.ok("打卡成功", data);
    }

    /** 类型销量统计：某服务类型已完成订单按子类型计数（公开，展示真实销量） */
    public Result<Map<String, Object>> typeStats(String type) {
        List<Order> list = orderRepository.findByIsDeletedAndTypeAndStatusKey(0, type, "completed");
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (Order o : list) {
            String key = o.getSubType() == null || o.getSubType().isBlank() ? o.getType() : o.getSubType();
            counts.put(key, counts.getOrDefault(key, 0) + 1);
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("total", list.size());
        data.put("counts", counts);
        return Result.ok(data);
    }

    /** 订单留痕列表（时间正序，照片补全完整访问地址） */
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
            row.put("time", formatDateTime(t.getCreatedAt()));
            rows.add(row);
        }
        return Result.ok(rows);
    }

    /** 订单打卡状态摘要（订单列表展示用） */
    private Map<String, Object> traceSummary(Order o) {
        List<ServiceTrace> list = traceRepository.findByOrderIdOrderByCreatedAtAsc(o.getId());
        boolean hasStart = false;
        boolean hasEnd = false;
        for (ServiceTrace t : list) {
            if ("start".equals(t.getKind())) hasStart = true;
            if ("end".equals(t.getKind())) hasEnd = true;
        }
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("hasStart", hasStart);
        s.put("hasEnd", hasEnd);
        s.put("count", list.size());
        return s;
    }

    // ==================== 私有工具 ====================

    /** 附近订单列表（含发布人昵称）；超过30分钟未接单的订单置顶（2026-10-16 产品调整：不再转池） */
    private List<Map<String, Object>> nearbyList(Long uid, int limit) {
        PageRequest pageable = PageRequest.of(0, limit, Sort.by(Sort.Direction.DESC, "createdAt"));
        List<Order> orders = orderRepository.findByStatusKeyAndIsDeletedAndUserIdNotOrderByCreatedAtDesc(
                "pending", 0, uid, pageable);
        // 超时订单置顶：30 分钟以上未接单的排前面，其余按发布时间倒序
        final LocalDateTime now = LocalDateTime.now();
        orders.sort(Comparator
                .comparing((Order o) -> o.getCreatedAt() != null && o.getCreatedAt().plusMinutes(30).isBefore(now) ? 0 : 1)
                .thenComparing(o -> o.getCreatedAt(), Comparator.nullsLast(Comparator.reverseOrder())));

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
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", o.getId());
            row.put("type", o.getType());
            row.put("address", o.getAddress());
            row.put("time", o.getServiceTime());
            row.put("reward", o.getReward());
            row.put("priceText", o.getPriceText());
            row.put("distance", o.getDistance());
            long minutes = o.getCreatedAt() == null ? 0 : ChronoUnit.MINUTES.between(o.getCreatedAt(), LocalDateTime.now());
            row.put("minutesSincePublish", Math.max(minutes, 0));
            row.put("timeout", minutes >= 30);
            row.put("remark", o.getRemark());
            row.put("images", parseImages(o.getImages()).stream().map(this::fixImageUrl).toList());
            String name = nameMap.get(o.getUserId());
            // 防泄露：抢单大厅未接单订单，发布人姓名脱敏展示（电话本就不下发）
            String nickname = name == null || name.isBlank() ? "用户" + o.getUserId() : name;
            row.put("userNickname", PhoneMaskUtil.maskName(nickname));
            row.put("publishTime", formatDateTime(o.getCreatedAt()));
            rows.add(row);
        }
        return rows;
    }

    /** 我的订单响应结构（含 isHelper / originalReward / extraReward / elderName） */
    private Map<String, Object> toMineMap(Order o, Long uid, Map<Long, String> nameMap) {
        int original = o.getOriginalReward() == null
                ? (o.getReward() == null ? 0 : o.getReward())
                : o.getOriginalReward();
        int reward = o.getReward() == null ? 0 : o.getReward();

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", o.getId());
        row.put("type", o.getType());
        row.put("address", o.getAddress());
        row.put("time", o.getServiceTime());
        row.put("reward", reward);
        row.put("originalReward", original);
        row.put("extraReward", reward - original);
        row.put("status", o.getStatus());
        row.put("statusKey", o.getStatusKey());
        row.put("helper", o.getHelper());
        row.put("isHelper", o.getHelperId() != null && o.getHelperId().equals(uid));
        String elderName = nameMap.get(o.getUserId());
        row.put("elderName", elderName == null || elderName.isBlank() ? "用户" + o.getUserId() : elderName);
        row.put("subType", o.getSubType());
        row.put("priceText", o.getPriceText());
        row.put("assetType", o.getAssetType());
        row.put("rmbAmount", o.getRmbAmount());
        row.put("payStatus", o.getPayStatus());
        row.put("hours", o.getHours());
        row.put("traceSummary", traceSummary(o));
        row.put("patientRelation", o.getPatientRelation());
        row.put("patientName", o.getPatientName());
        row.put("patientAge", o.getPatientAge());
        row.put("tasks", parseStringList(o.getTasks()));
        row.put("assessment", parseJsonMap(o.getAssessment()));
        row.put("distance", o.getDistance());
        row.put("remark", o.getRemark());
        row.put("images", parseImages(o.getImages()).stream().map(this::fixImageUrl).toList());
        row.put("cancelReason", o.getCancelReason());
        row.put("evaluated", Integer.valueOf(1).equals(o.getEvaluated()));
        row.put("rating", o.getRating());
        row.put("comment", o.getComment());
        row.put("publishTime", formatDateTime(o.getCreatedAt()));
        row.put("acceptedAt", formatDateTime(o.getAcceptedAt()));
        LocalDateTime cancelTime = o.getCancelTime() != null
                ? o.getCancelTime()
                : ("cancelled".equals(o.getStatusKey()) ? o.getUpdatedAt() : null);
        row.put("cancelTime", formatDateTime(cancelTime));
        return row;
    }

    /** 消息 ID 自增序列：同一毫秒连发多条消息（如取消通知双方）时保证主键唯一 */
    private static final java.util.concurrent.atomic.AtomicLong MSG_SEQ = new java.util.concurrent.atomic.AtomicLong(0);

    /** 插入站内消息 */
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

    /** 图片 URL 修正：相对文件名补全为完整地址；绝对地址统一替换为当前服务器地址；旧 PNG 换为压缩 JPG */
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

    private String formatDateTime(LocalDateTime dt) {
        return dt == null ? "" : dt.format(FMT);
    }

    private String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    private int parseInt(Object o) {
        try {
            return Integer.parseInt(String.valueOf(o));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private BigDecimal parseDecimal(Object o) {
        try {
            return new BigDecimal(String.valueOf(o).trim());
        } catch (Exception e) {
            return null;
        }
    }
}
