package com.elderly.care.controller;

import com.elderly.care.common.Result;
import com.elderly.care.service.BankService;
import com.elderly.care.service.WithdrawalService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 时间银行接口：余额 / 流水 / 兑换 / 转赠（已禁用）/ 人民币提现
 * 资金双轨制：时间币与人民币余额分列展示，提现仅人民币（互助员）
 */
@RestController
@RequestMapping("/api/bank")
public class BankController {

    private final BankService bankService;
    private final WithdrawalService withdrawalService;

    public BankController(BankService bankService, WithdrawalService withdrawalService) {
        this.bankService = bankService;
        this.withdrawalService = withdrawalService;
    }

    /** 余额（需登录） */
    @GetMapping("/balance")
    public Result<Map<String, Object>> balance(HttpServletRequest request) {
        return bankService.balance(uid(request));
    }

    /** 交易流水（需登录） */
    @GetMapping("/transactions")
    public Result<Map<String, Object>> transactions(HttpServletRequest request) {
        return bankService.transactions(uid(request));
    }

    /** 兑换服务（需登录） */
    @PostMapping("/exchange/service")
    public Result<Map<String, Object>> exchangeService(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        return bankService.exchangeService(uid(request), body == null ? null : String.valueOf(body.get("serviceId")));
    }

    /** 兑换实物（需登录） */
    @PostMapping("/exchange/gift")
    public Result<Map<String, Object>> exchangeGift(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        return bankService.exchangeGift(uid(request), body == null ? null : String.valueOf(body.get("giftId")));
    }

    /** 转赠（需登录；2026-10-18 双轨制新规则：时间币不能转赠，接口拒绝） */
    @PostMapping("/transfer")
    public Result<Void> transfer(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        return bankService.transfer(uid(request),
                body == null ? null : body.get("toUserId"),
                body == null ? null : body.get("amount"));
    }

    /** 申请人民币提现（需登录，仅互助员；申请即冻结余额，管理员审核+线下打款） */
    @PostMapping("/withdraw")
    public Result<Map<String, Object>> withdraw(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        return withdrawalService.apply(uid(request), body == null ? null : body.get("amount"));
    }

    /** 我的提现记录（需登录） */
    @GetMapping("/withdrawals")
    public Result<List<Map<String, Object>>> withdrawals(HttpServletRequest request) {
        return withdrawalService.myList(uid(request));
    }

    private Long uid(HttpServletRequest request) {
        return (Long) request.getAttribute("userId");
    }
}
