package com.elderly.care.controller;

import com.elderly.care.common.Result;
import com.elderly.care.service.HelperApplicationService;
import com.elderly.care.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 用户接口：登录 / 注册 / 个人信息 / 证书 / 用户列表
 * 路径与原 Node 版完全一致，小程序端无需改动
 */
@RestController
@RequestMapping("/api/user")
public class UserController {

    private final UserService userService;
    private final HelperApplicationService helperApplicationService;

    public UserController(UserService userService, HelperApplicationService helperApplicationService) {
        this.userService = userService;
        this.helperApplicationService = helperApplicationService;
    }

    /** 登录（公开）：账号密码 或 手机号+验证码 */
    @PostMapping("/login")
    public Result<Map<String, Object>> login(@RequestBody Map<String, Object> body) {
        return userService.login(body);
    }

    /** 注册（公开） */
    @PostMapping("/register")
    public Result<Map<String, Object>> register(@RequestBody Map<String, Object> body) {
        return userService.register(body);
    }

    /** 绑定微信 openid（需登录）：小程序 wx.login 后调用，订阅消息推送用 */
    @PostMapping("/bind-openid")
    public Result<Map<String, Object>> bindOpenid(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        return userService.bindOpenid(uid(request), body == null ? null : String.valueOf(body.get("code")));
    }

    /** 手机号直接登录（公开）：已注册直接登录，未注册自动建号（试玩阶段约定，正式运营前加回验证码） */
    @PostMapping("/phone-login")
    public Result<Map<String, Object>> phoneLogin(@RequestBody Map<String, Object> body) {
        return userService.phoneLogin(body == null ? null : String.valueOf(body.get("phone")));
    }

    /** 首次登录后选择角色（需登录）：普通用户（老人）/ 互助员 */
    @PutMapping("/role")
    public Result<Map<String, Object>> setRole(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        return userService.setRole(uid(request), body == null ? null : String.valueOf(body.get("role")));
    }

    /** 补绑手机号（需登录）：微信直接登录的账号后续绑定，手机号唯一规则不变 */
    @PostMapping("/bind-phone")
    public Result<Map<String, Object>> bindPhone(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        return userService.bindPhone(uid(request),
                body == null ? null : String.valueOf(body.get("phone")),
                body == null ? null : String.valueOf(body.get("smsCode")));
    }

    /** 微信快捷登录（公开）：已绑定则免密登录；未绑定返回 1001 引导补绑手机号 */
    @PostMapping("/wechat-login")
    public Result<Map<String, Object>> wechatLogin(@RequestBody Map<String, Object> body) {
        return userService.wechatLogin(body == null ? null : String.valueOf(body.get("code")));
    }

    /** 微信快捷登录补绑手机号（公开）：严格一对一绑定后登录 */
    @PostMapping("/wechat-bind")
    public Result<Map<String, Object>> wechatBind(@RequestBody Map<String, Object> body) {
        return userService.wechatBind(
                body == null ? null : String.valueOf(body.get("code")),
                body == null ? null : String.valueOf(body.get("phone")),
                body == null ? null : String.valueOf(body.get("smsCode")),
                body == null ? null : String.valueOf(body.get("role")));
    }

    /** 当前用户信息（需登录） */
    @GetMapping("/info")
    public Result<Map<String, Object>> info(HttpServletRequest request) {
        return userService.info(uid(request));
    }

    /** 修改昵称/头像（需登录） */
    @PutMapping("/info")
    public Result<Map<String, Object>> updateInfo(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        return userService.updateInfo(uid(request), body);
    }

    /** 认证证书（需登录） */
    @GetMapping("/certificates")
    public Result<List<String>> certificates() {
        return userService.certificates();
    }

    /** 用户列表（公开，H5 后台用户管理使用） */
    @GetMapping("/list")
    public Result<List<Map<String, Object>>> list() {
        return userService.listAll();
    }

    // ==================== 互助员注册申请（角色管理精细化） ====================

    /** 互助员服务承诺书（需登录）：文案 + 版本号，签署后随申请落库留痕 */
    @GetMapping("/helper-pledge")
    public Result<Map<String, Object>> helperPledge() {
        return helperApplicationService.pledge();
    }

    /** 提交互助员注册申请（需登录）：填信息 + 签承诺书，由社区管理员审核 */
    @PostMapping("/helper-application")
    public Result<Map<String, Object>> submitHelperApplication(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        return helperApplicationService.submit(uid(request), body);
    }

    /** 我的互助员申请状态（需登录）：审核中 / 已通过 / 被驳回原因 */
    @GetMapping("/helper-application")
    public Result<Map<String, Object>> myHelperApplication(HttpServletRequest request) {
        return helperApplicationService.myApplication(uid(request));
    }

    /** 确认互助员申请通过后的角色切换（需登录）：引导弹窗点「立即切换」时调用 */
    @PostMapping("/helper-application/confirm")
    public Result<Map<String, Object>> confirmHelperSwitch(HttpServletRequest request) {
        return helperApplicationService.confirmSwitch(uid(request));
    }

    /** 驳回通知已读（需登录）：驳回弹窗展示后调用，避免下次重复弹窗 */
    @PostMapping("/helper-application/reject-read")
    public Result<Map<String, Object>> markHelperRejectRead(HttpServletRequest request) {
        return helperApplicationService.markRejectRead(uid(request));
    }

    /** 从请求属性取当前登录用户ID（由 JwtAuthFilter 写入） */
    static Long uid(HttpServletRequest request) {
        return (Long) request.getAttribute("userId");
    }
}
