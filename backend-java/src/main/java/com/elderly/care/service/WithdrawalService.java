package com.elderly.care.service;

import com.elderly.care.common.Result;
import com.elderly.care.entity.OperationLog;
import com.elderly.care.entity.User;
import com.elderly.care.entity.Withdrawal;
import com.elderly.care.repository.UserRepository;
import com.elderly.care.repository.WithdrawalRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 人民币提现服务（资金双轨制 · 人民币体系）：
 * 互助员将陪诊收入（rmb_balance）申请提现 → 申请即冻结（扣减余额）→ 管理员审核 →
 * 审核通过后线下打款并标记已打款；驳回则退回余额。
 * 审核通过 / 驳回 / 确认打款均写操作日志（append-only 留痕）。
 * 一期打款方式为线下打款+后台标记，微信企业付款到零钱留二期（需商户号）。
 */
@Service
public class WithdrawalService {

    public static final String STATUS_PENDING = "pending";
    public static final String STATUS_APPROVED = "approved";
    public static final String STATUS_REJECTED = "rejected";
    public static final String STATUS_PAID = "paid";

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final WithdrawalRepository withdrawalRepository;
    private final UserRepository userRepository;
    private final OrderFundService fundService;
    private final OperationLogService operationLogService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public WithdrawalService(WithdrawalRepository withdrawalRepository, UserRepository userRepository,
                             OrderFundService fundService, OperationLogService operationLogService) {
        this.withdrawalRepository = withdrawalRepository;
        this.userRepository = userRepository;
        this.fundService = fundService;
        this.operationLogService = operationLogService;
    }

    /** 申请提现：仅互助员，金额不超过可提现余额，申请即冻结（扣减 rmb_balance）并记人民币支出流水 */
    @Transactional
    public Result<Map<String, Object>> apply(Long uid, Object amountObj) {
        BigDecimal amount;
        try {
            amount = new BigDecimal(String.valueOf(amountObj));
        } catch (Exception e) {
            return Result.error(400, "请输入有效的提现金额");
        }
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            return Result.error(400, "请输入有效的提现金额");
        }
        User user = userRepository.findByIdForUpdate(uid).orElse(null);
        if (user == null) {
            return Result.error(404, "用户不存在");
        }
        if (!"互助员".equals(user.getRole())) {
            return Result.error(403, "仅互助员可申请提现");
        }
        BigDecimal balance = user.getRmbBalance() == null ? BigDecimal.ZERO : user.getRmbBalance();
        if (balance.compareTo(amount) < 0) {
            return Result.error(400, "可提现余额不足");
        }

        user.setRmbBalance(balance.subtract(amount));
        userRepository.save(user);

        Withdrawal w = new Withdrawal();
        w.setId("WD" + System.currentTimeMillis());
        w.setUserId(uid);
        w.setAmount(amount);
        w.setStatus(STATUS_PENDING);
        w.setCreatedAt(LocalDateTime.now());
        withdrawalRepository.save(w);

        fundService.insertRmbTx(uid, "expense", "提现申请冻结", amount, null);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", w.getId());
        data.put("status", w.getStatus());
        data.put("balance", user.getRmbBalance());
        return Result.ok("提现申请已提交，等待管理员审核", data);
    }

    /** 我的提现记录（时间倒序） */
    public Result<List<Map<String, Object>>> myList(Long uid) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Withdrawal w : withdrawalRepository.findByUserIdOrderByCreatedAtDesc(uid)) {
            rows.add(toMap(w, null));
        }
        return Result.ok(rows);
    }

    /** 全部提现申请（管理端，时间倒序） */
    public Result<List<Map<String, Object>>> adminList() {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Withdrawal w : withdrawalRepository.findAllByOrderByCreatedAtDesc()) {
            String userName = userRepository.findById(w.getUserId()).map(User::getName).orElse(null);
            rows.add(toMap(w, userName));
        }
        return Result.ok(rows);
    }

    /** 审核通过（进入待线下打款；打款完成后由管理员标记已打款） */
    @Transactional
    public Result<Void> approve(Long reviewerId, String id) {
        Withdrawal w = withdrawalRepository.findById(id).orElse(null);
        if (w == null) {
            return Result.error(404, "提现申请不存在");
        }
        if (!STATUS_PENDING.equals(w.getStatus())) {
            return Result.error(400, "仅待审核的申请可操作");
        }
        String before = snapshotJson(w);
        w.setStatus(STATUS_APPROVED);
        w.setReviewerId(reviewerId);
        w.setReviewTime(LocalDateTime.now());
        withdrawalRepository.save(w);
        operationLogService.record(reviewerId, OperationLog.TYPE_WITHDRAW_APPROVE,
                before, snapshotJson(w), "提现审核通过，待线下打款");
        return Result.ok("已审核通过，请线下打款后标记已打款", null);
    }

    /** 审核驳回（原因必填）：退回冻结余额并记人民币收入流水 */
    @Transactional
    public Result<Void> reject(Long reviewerId, String id, String reason) {
        if (reason == null || reason.isBlank()) {
            return Result.error(400, "驳回提现申请必须填写原因");
        }
        Withdrawal w = withdrawalRepository.findById(id).orElse(null);
        if (w == null) {
            return Result.error(404, "提现申请不存在");
        }
        if (!STATUS_PENDING.equals(w.getStatus())) {
            return Result.error(400, "仅待审核的申请可操作");
        }
        String before = snapshotJson(w);
        w.setStatus(STATUS_REJECTED);
        w.setRejectReason(reason.trim());
        w.setReviewerId(reviewerId);
        w.setReviewTime(LocalDateTime.now());
        withdrawalRepository.save(w);

        User user = userRepository.findByIdForUpdate(w.getUserId()).orElse(null);
        if (user != null) {
            BigDecimal balance = user.getRmbBalance() == null ? BigDecimal.ZERO : user.getRmbBalance();
            user.setRmbBalance(balance.add(w.getAmount()));
            userRepository.save(user);
        }
        fundService.insertRmbTx(w.getUserId(), "income", "提现驳回退回", w.getAmount(), null);

        operationLogService.record(reviewerId, OperationLog.TYPE_WITHDRAW_REJECT,
                before, snapshotJson(w), reason.trim());
        return Result.ok("已驳回并退回余额", null);
    }

    /** 确认已线下打款（审核通过 → 已打款） */
    @Transactional
    public Result<Void> confirmPaid(Long operatorId, String id) {
        Withdrawal w = withdrawalRepository.findById(id).orElse(null);
        if (w == null) {
            return Result.error(404, "提现申请不存在");
        }
        if (!STATUS_APPROVED.equals(w.getStatus())) {
            return Result.error(400, "仅审核通过的申请可标记打款");
        }
        String before = snapshotJson(w);
        w.setStatus(STATUS_PAID);
        w.setPaidAt(LocalDateTime.now());
        withdrawalRepository.save(w);
        operationLogService.record(operatorId, OperationLog.TYPE_WITHDRAW_PAID,
                before, snapshotJson(w), "确认已线下打款");
        return Result.ok("已标记打款完成", null);
    }

    /** 提现记录响应结构（userName 为空时查询申请人昵称补全） */
    private Map<String, Object> toMap(Withdrawal w, String userName) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", w.getId());
        row.put("userId", w.getUserId());
        row.put("userName", userName);
        row.put("amount", w.getAmount());
        row.put("status", w.getStatus());
        row.put("rejectReason", w.getRejectReason());
        row.put("reviewTime", w.getReviewTime() == null ? "" : w.getReviewTime().format(FMT));
        row.put("paidAt", w.getPaidAt() == null ? "" : w.getPaidAt().format(FMT));
        row.put("createdAt", w.getCreatedAt() == null ? "" : w.getCreatedAt().format(FMT));
        return row;
    }

    /** 提现记录快照（操作日志 before / after 内容） */
    private String snapshotJson(Withdrawal w) {
        try {
            Map<String, Object> snap = new LinkedHashMap<>();
            snap.put("id", w.getId());
            snap.put("userId", w.getUserId());
            snap.put("amount", w.getAmount());
            snap.put("status", w.getStatus());
            snap.put("rejectReason", w.getRejectReason());
            return objectMapper.writeValueAsString(snap);
        } catch (Exception e) {
            return "{}";
        }
    }
}
