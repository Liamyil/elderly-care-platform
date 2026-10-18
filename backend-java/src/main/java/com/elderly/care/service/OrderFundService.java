package com.elderly.care.service;

import com.elderly.care.entity.Order;
import com.elderly.care.entity.Transaction;
import com.elderly.care.entity.User;
import com.elderly.care.repository.TransactionRepository;
import com.elderly.care.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

/**
 * 订单资金服务（资金与流水底层逻辑 · 双轨制）：
 * 时间币（互助类）：发单冻结 → 完成结算给互助员 / 取消退回下单人，1小时=1时间币，不能提现不能转赠；
 * 人民币（陪诊类）：微信支付（一期模拟）→ 完成结算给互助员 → 互助员申请提现（管理员审核+线下打款）。
 * 两类资产彻底隔离：users 分 time_coins / rmb_balance 两列，transactions 按 asset_type 分币种记流水。
 * 所有余额变动均使用行锁（findByIdForUpdate），防并发超扣。
 */
@Service
public class OrderFundService {

    /** 币种 */
    public static final String ASSET_TIME_COIN = "time_coin";
    public static final String ASSET_RMB = "rmb";

    /** 支付状态（人民币订单） */
    public static final String PAY_UNPAID = "unpaid";
    public static final String PAY_PAID = "paid";
    public static final String PAY_REFUNDED = "refunded";

    /** 陪诊订单支付前状态 */
    public static final String STATUS_PENDING_PAY = "pending_pay";

    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;

    public OrderFundService(UserRepository userRepository, TransactionRepository transactionRepository) {
        this.userRepository = userRepository;
        this.transactionRepository = transactionRepository;
    }

    /** 互助类发单冻结时间币：余额足够则扣减并记支出流水，返回是否成功（余额不足返回 false） */
    public boolean freezeCoins(Long uid, int coins, String orderType) {
        User user = userRepository.findByIdForUpdate(uid).orElse(null);
        int balance = user == null || user.getTimeCoins() == null ? 0 : user.getTimeCoins();
        if (user == null || balance < coins) {
            return false;
        }
        user.setTimeCoins(balance - coins);
        userRepository.save(user);
        insertCoinTx(uid, "expense", orderType + "-下单冻结", coins);
        return true;
    }

    /**
     * 取消退款（refunded 幂等防重）：
     * 时间币 → 退回下单人余额并记收入流水；人民币已支付 → 标记原路退款
     * （模拟支付直接置 refunded；真实微信支付接入后在此调用微信退款接口）。
     */
    public void refundOnCancel(Order order) {
        if (Integer.valueOf(1).equals(order.getRefunded())) {
            return;
        }
        if (ASSET_TIME_COIN.equals(order.getAssetType())) {
            int frozen = order.getFrozenCoins() == null ? 0 : order.getFrozenCoins();
            if (frozen > 0) {
                User owner = userRepository.findByIdForUpdate(order.getUserId()).orElse(null);
                if (owner != null) {
                    owner.setTimeCoins((owner.getTimeCoins() == null ? 0 : owner.getTimeCoins()) + frozen);
                    userRepository.save(owner);
                }
                insertCoinTx(order.getUserId(), "income", order.getType() + "-取消退回", frozen);
            }
            order.setRefunded(1);
        } else if (ASSET_RMB.equals(order.getAssetType()) && PAY_PAID.equals(order.getPayStatus())) {
            order.setPayStatus(PAY_REFUNDED);
            order.setRefunded(1);
        }
    }

    /** 是否存在冻结中的资金（人工退款前置判断用）：时间币已冻结 / 人民币已支付未退款 */
    public boolean hasFrozenFunds(Order order) {
        if (ASSET_TIME_COIN.equals(order.getAssetType())) {
            return order.getFrozenCoins() != null && order.getFrozenCoins() > 0;
        }
        if (ASSET_RMB.equals(order.getAssetType())) {
            return PAY_PAID.equals(order.getPayStatus());
        }
        return false;
    }

    /**
     * 完成结算（settled 幂等防重）：按币种打款给互助员，返回结算描述（无资金可结算返回 null）。
     * 时间币：互助员 +reward（下单人发单时已冻结扣款，此处不再重复扣）；
     * 人民币：互助员 rmb_balance += rmb_amount（进入可提现余额）。
     */
    public String settleOnComplete(Order order) {
        if (Integer.valueOf(1).equals(order.getSettled())) {
            return null;
        }
        Long helperId = order.getHelperId();
        if (helperId == null) {
            return null;
        }
        if (ASSET_TIME_COIN.equals(order.getAssetType())) {
            int reward = order.getReward() == null ? 0 : order.getReward();
            if (reward <= 0) {
                return null;
            }
            User helper = userRepository.findByIdForUpdate(helperId).orElse(null);
            if (helper != null) {
                helper.setTimeCoins((helper.getTimeCoins() == null ? 0 : helper.getTimeCoins()) + reward);
                helper.setServiceCount((helper.getServiceCount() == null ? 0 : helper.getServiceCount()) + 1);
                userRepository.save(helper);
            }
            insertCoinTx(helperId, "income", order.getType(), reward);
            order.setSettled(1);
            return "获得" + reward + "个时间币";
        }
        if (ASSET_RMB.equals(order.getAssetType())) {
            BigDecimal amount = order.getRmbAmount();
            if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
                return null;
            }
            User helper = userRepository.findByIdForUpdate(helperId).orElse(null);
            if (helper != null) {
                BigDecimal balance = helper.getRmbBalance() == null ? BigDecimal.ZERO : helper.getRmbBalance();
                helper.setRmbBalance(balance.add(amount));
                helper.setServiceCount((helper.getServiceCount() == null ? 0 : helper.getServiceCount()) + 1);
                userRepository.save(helper);
            }
            insertRmbTx(helperId, "income", order.getType(), amount);
            order.setSettled(1);
            return "获得" + amount.stripTrailingZeros().toPlainString() + "元";
        }
        return null;
    }

    /** 时间币流水（amount 记币数） */
    public void insertCoinTx(Long userId, String type, String name, int amount) {
        Transaction tx = new Transaction();
        tx.setId("TX" + System.currentTimeMillis());
        tx.setUserId(userId);
        tx.setType(type);
        tx.setName(name);
        tx.setAmount(amount);
        tx.setAssetType(ASSET_TIME_COIN);
        transactionRepository.save(tx);
    }

    /** 人民币流水（amount 记 0，rmb_amount 记金额） */
    public void insertRmbTx(Long userId, String type, String name, BigDecimal amount) {
        Transaction tx = new Transaction();
        tx.setId("TX" + System.currentTimeMillis());
        tx.setUserId(userId);
        tx.setType(type);
        tx.setName(name);
        tx.setAmount(0);
        tx.setAssetType(ASSET_RMB);
        tx.setRmbAmount(amount);
        transactionRepository.save(tx);
    }
}
