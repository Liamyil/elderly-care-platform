package com.elderly.care.service;

import com.elderly.care.common.Result;
import com.elderly.care.entity.Transaction;
import com.elderly.care.entity.User;
import com.elderly.care.repository.TransactionRepository;
import com.elderly.care.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 时间银行服务：余额 / 流水 / 服务兑换 / 实物兑换 / 转赠
 * 兑换价格由后端价目表控制（防止前端篡改，对应原版修复）
 */
@Service
public class BankService {

    /** 可兑换服务价目表（与小程序端 services 列表一致） */
    private static final Map<String, Integer> SERVICE_PRICES = Map.of(
            "S001", 20, "S002", 15, "S003", 30, "S004", 10);

    /** 可兑换实物价目表（与小程序端 gifts 列表一致） */
    private static final Map<String, Integer> GIFT_PRICES = Map.of(
            "G001", 10, "G002", 15, "G003", 8, "G004", 20);

    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("yyyy/M/d HH:mm:ss");

    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;

    public BankService(UserRepository userRepository, TransactionRepository transactionRepository) {
        this.userRepository = userRepository;
        this.transactionRepository = transactionRepository;
    }

    /** 余额查询（双轨制）：时间币余额 + 人民币余额（可提现）+ 累计赚取 + 已兑换 */
    public Result<Map<String, Object>> balance(Long uid) {
        User user = userRepository.findById(uid).orElse(null);
        if (user == null) {
            return Result.error(404, "用户不存在");
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("balance", user.getTimeCoins() == null ? 0 : user.getTimeCoins());
        data.put("rmbBalance", user.getRmbBalance() == null ? BigDecimal.ZERO : user.getRmbBalance());
        data.put("totalEarned", transactionRepository.sumAmountByUserIdAndType(uid, "income"));
        data.put("totalRedeemed", transactionRepository.sumAmountByUserIdAndType(uid, "expense"));
        return Result.ok(data);
    }

    /** 交易流水列表（双轨制：asset_type 区分时间币 / 人民币流水） */
    public Result<Map<String, Object>> transactions(Long uid) {
        List<Transaction> list = transactionRepository.findByUserIdOrderByCreatedAtDesc(uid);

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Transaction t : list) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", t.getId());
            row.put("type", t.getType());
            row.put("name", t.getName());
            row.put("amount", t.getAmount());
            row.put("assetType", t.getAssetType() == null ? "time_coin" : t.getAssetType());
            row.put("rmbAmount", t.getRmbAmount());
            row.put("time", t.getCreatedAt() == null ? "" : t.getCreatedAt().format(TIME_FORMAT));
            rows.add(row);
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("list", rows);
        data.put("total", rows.size());
        return Result.ok(data);
    }

    /** 兑换服务（事务 + 行锁防超扣，价格由后端价目表决定） */
    @Transactional
    public Result<Map<String, Object>> exchangeService(Long uid, String serviceId) {
        Integer cost = SERVICE_PRICES.get(serviceId);
        if (cost == null) {
            return Result.error(400, "服务不存在");
        }
        return exchange(uid, "兑换服务-" + serviceId, cost);
    }

    /** 兑换实物（事务 + 行锁防超扣，价格由后端价目表决定） */
    @Transactional
    public Result<Map<String, Object>> exchangeGift(Long uid, String giftId) {
        Integer cost = GIFT_PRICES.get(giftId);
        if (cost == null) {
            return Result.error(400, "商品不存在");
        }
        return exchange(uid, "兑换-" + giftId, cost);
    }

    private Result<Map<String, Object>> exchange(Long uid, String txName, int cost) {
        User user = userRepository.findByIdForUpdate(uid).orElse(null);
        int balance = user == null || user.getTimeCoins() == null ? 0 : user.getTimeCoins();
        if (user == null || balance < cost) {
            return Result.error(400, "时间币不足");
        }

        user.setTimeCoins(balance - cost);
        userRepository.save(user);

        Transaction tx = new Transaction();
        tx.setId("TX" + System.currentTimeMillis());
        tx.setUserId(uid);
        tx.setType("expense");
        tx.setName(txName);
        tx.setAmount(cost);
        transactionRepository.save(tx);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("balance", balance - cost);
        return Result.ok("兑换成功", data);
    }

    /** 时间币转赠（2026-10-18 资金双轨制新规则：时间币不能提现、不能转赠，接口直接拒绝） */
    public Result<Void> transfer(Long uid, Object toUserIdObj, Object amountObj) {
        return Result.error(400, "时间币暂不支持转赠");
    }

    /** 时间币转赠旧实现（已按新规则禁用，保留代码备查：如需恢复放开上方接口并删除本方法） */
    @Transactional
    public Result<Void> transferLegacy(Long uid, Object toUserIdObj, Object amountObj) {
        int amount;
        Long toUserId;
        try {
            amount = Integer.parseInt(String.valueOf(amountObj));
            toUserId = Long.parseLong(String.valueOf(toUserIdObj));
        } catch (Exception e) {
            return Result.error(400, "请填写有效的转赠信息");
        }
        if (amount <= 0) {
            return Result.error(400, "请填写有效的转赠信息");
        }
        if (toUserId.equals(uid)) {
            return Result.error(400, "不能转赠给自己");
        }

        User from = userRepository.findByIdForUpdate(uid).orElse(null);
        int fromBalance = from == null || from.getTimeCoins() == null ? 0 : from.getTimeCoins();
        if (from == null || fromBalance < amount) {
            return Result.error(400, "时间币不足");
        }

        User to = userRepository.findByIdForUpdate(toUserId).orElse(null);
        if (to == null) {
            return Result.error(404, "目标用户不存在");
        }

        from.setTimeCoins(fromBalance - amount);
        userRepository.save(from);
        to.setTimeCoins((to.getTimeCoins() == null ? 0 : to.getTimeCoins()) + amount);
        userRepository.save(to);

        String txId = "TX" + System.currentTimeMillis();
        Transaction out = new Transaction();
        out.setId(txId);
        out.setUserId(uid);
        out.setType("expense");
        out.setName("转赠给亲友");
        out.setAmount(amount);
        transactionRepository.save(out);

        Transaction in = new Transaction();
        in.setId(txId + "T");
        in.setUserId(toUserId);
        in.setType("income");
        in.setName("亲友转赠");
        in.setAmount(amount);
        transactionRepository.save(in);

        return Result.ok("转赠成功", null);
    }
}
