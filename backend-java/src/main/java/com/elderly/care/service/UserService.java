package com.elderly.care.service;

import com.elderly.care.common.Result;
import com.elderly.care.config.JwtUtil;
import com.elderly.care.config.PasswordHasher;
import com.elderly.care.entity.HelperApplication;
import com.elderly.care.entity.User;
import com.elderly.care.repository.HelperApplicationRepository;
import com.elderly.care.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 用户服务：注册 / 登录 / 个人信息 / 证书
 */
@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordHasher passwordHasher;
    private final JwtUtil jwtUtil;
    private final WechatService wechatService;
    private final HelperApplicationRepository helperApplicationRepository;

    public UserService(UserRepository userRepository, PasswordHasher passwordHasher, JwtUtil jwtUtil,
                       WechatService wechatService, HelperApplicationRepository helperApplicationRepository) {
        this.userRepository = userRepository;
        this.passwordHasher = passwordHasher;
        this.jwtUtil = jwtUtil;
        this.wechatService = wechatService;
        this.helperApplicationRepository = helperApplicationRepository;
    }

    /**
     * 绑定微信 openid（订阅消息推送用）：小程序 wx.login 后调用
     * 账号规则：手机号为唯一主账号；一个手机号只绑一个微信 openid（绑定后不可换绑）；
     * 一个 openid 只能绑一个账号（禁止多微信共用同一手机号）；微信仅作登录凭证
     */
    public Result<Map<String, Object>> bindOpenid(Long uid, String code) {
        if (code == null || code.isBlank()) {
            return Result.error(400, "缺少 code");
        }
        String openid = wechatService.code2session(code);
        if (openid == null) {
            return Result.error(400, "微信登录码校验失败，请重试");
        }
        User user = userRepository.findById(uid).orElse(null);
        if (user == null) {
            return Result.error(404, "用户不存在");
        }
        // 规则1：一个手机号只绑一个 openid，绑定后不可更换
        if (user.getOpenid() != null && !user.getOpenid().isBlank()) {
            if (user.getOpenid().equals(openid)) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("openid", openid);
                return Result.ok("已绑定该微信", data);
            }
            return Result.error(409, "该账号已绑定其他微信，禁止更换绑定");
        }
        // 规则2：一个 openid 只能绑定一个手机号账号
        User other = userRepository.findByOpenid(openid).orElse(null);
        if (other != null && !other.getId().equals(uid)) {
            return Result.error(409, "该微信已绑定其他手机号账号");
        }
        user.setOpenid(openid);
        userRepository.save(user);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("openid", openid);
        return Result.ok("已绑定微信身份", data);
    }

    /**
     * 手机号直接登录（短信登录入口，无验证码——试玩/演示阶段约定，正式运营前加回验证码）：
     * 已注册 → 直接登录；未注册 → 自动建号，默认普通用户（老人）。
     * 互助员身份改审核制：经「申请成为互助员」审核通过后获得，注册不再直接选择角色。
     */
    public Result<Map<String, Object>> phoneLogin(String phone) {
        if (phone == null || phone.isBlank()) {
            return Result.error(400, "请输入手机号");
        }
        User user = userRepository.findByPhone(phone).orElse(null);
        if (user == null) {
            user = new User();
            user.setPhone(phone);
            // 随机密码：后续可用"手机号+验证码"登录
            user.setPassword(passwordHasher.hash(String.valueOf(System.currentTimeMillis())));
            user.setName("用户" + phone.substring(phone.length() - 4));
            // 新账号默认普通用户（老人）；互助员身份经申请审核获得
            user.setRole("老人");
            user.setTimeCoins(100);
            user.setServiceCount(0);
            userRepository.save(user);
        }
        Result<Map<String, Object>> disabled = checkDisabled(user);
        if (disabled != null) {
            return disabled;
        }
        return Result.ok("登录成功", loginResult(user));
    }

    /** 禁用账号拦截：status=0 → 返回 403 错误，正常返回 null */
    private Result<Map<String, Object>> checkDisabled(User user) {
        if (user != null && Integer.valueOf(0).equals(user.getStatus())) {
            return Result.error(403, "账号已被禁用，请联系社区管理员");
        }
        return null;
    }

    /** 首次登录后选择角色：普通用户（老人）/ 互助员。
     *  角色管理精细化：选「互助员」先落普通用户，返回 needApplyHelper 引导提交申请，审核通过后置为互助员 */
    public Result<Map<String, Object>> setRole(Long uid, String role) {
        User user = userRepository.findById(uid).orElse(null);
        if (user == null) {
            return Result.error(404, "用户不存在");
        }
        user.setRole("老人");
        userRepository.save(user);
        if ("互助员".equals(role)) {
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("needApplyHelper", true);
            return Result.ok("请先提交互助员申请资料，由社区管理员审核", data);
        }
        return Result.ok("角色已更新", null);
    }

    /** 微信快捷登录：已绑定 → 免密直接登录；未绑定 → 自动以微信建号直接登录（手机号后续在账号与安全页补绑） */
    public Result<Map<String, Object>> wechatLogin(String code) {
        if (code == null || code.isBlank()) {
            return Result.error(400, "缺少 code");
        }
        String openid = wechatService.code2session(code);
        if (openid == null) {
            return Result.error(400, "微信登录码校验失败，请重试");
        }
        User user = userRepository.findByOpenid(openid).orElse(null);
        if (user == null) {
            user = new User();
            user.setPhone(null);
            user.setPassword(passwordHasher.hash(String.valueOf(System.currentTimeMillis())));
            user.setName("微信用户");
            user.setRole("老人");
            user.setOpenid(openid);
            user.setTimeCoins(100);
            user.setServiceCount(0);
            userRepository.save(user);
        }
        Result<Map<String, Object>> disabled = checkDisabled(user);
        if (disabled != null) {
            return disabled;
        }
        return Result.ok("登录成功", loginResult(user));
    }

    /** 补绑手机号（微信直接登录的账号后续绑定；手机号为唯一主账号，一对一规则不变） */
    public Result<Map<String, Object>> bindPhone(Long uid, String phone, String smsCode) {
        if (phone == null || phone.isBlank()) {
            return Result.error(400, "请输入手机号");
        }
        if (!"123456".equals(smsCode)) {
            return Result.error(400, "验证码错误");
        }
        User user = userRepository.findById(uid).orElse(null);
        if (user == null) {
            return Result.error(404, "用户不存在");
        }
        if (user.getPhone() != null && !user.getPhone().isBlank()) {
            return Result.error(409, "该账号已绑定手机号");
        }
        User byPhone = userRepository.findByPhone(phone).orElse(null);
        if (byPhone != null) {
            return Result.error(409, "该手机号已被其他账号使用");
        }
        user.setPhone(phone);
        userRepository.save(user);
        return Result.ok("手机号绑定成功", null);
    }

    /**
     * 微信快捷登录补绑手机号（强制绑定，严格执行一对一规则）：
     * 手机号已注册 → 绑定该微信后直接登录；手机号未注册 → 以手机号为主账号新建用户并绑定
     */
    public Result<Map<String, Object>> wechatBind(String code, String phone, String smsCode, String role) {
        if (code == null || code.isBlank() || phone == null || phone.isBlank()) {
            return Result.error(400, "请填写手机号后重试");
        }
        if (!"123456".equals(smsCode)) {
            return Result.error(400, "验证码错误");
        }
        String openid = wechatService.code2session(code);
        if (openid == null) {
            return Result.error(400, "微信登录码校验失败，请重试");
        }
        // 规则：一个 openid 只能绑定一个手机号账号
        User byOpenid = userRepository.findByOpenid(openid).orElse(null);
        if (byOpenid != null) {
            return Result.error(409, "该微信已绑定其他手机号账号");
        }

        User user = userRepository.findByPhone(phone).orElse(null);
        if (user == null) {
            // 手机号未注册：新建账号（手机号为主账号，微信仅作登录凭证）
            user = new User();
            user.setPhone(phone);
            // 随机密码（微信登录用户后续可用"手机号+验证码"登录）
            user.setPassword(passwordHasher.hash(String.valueOf(System.currentTimeMillis())));
            user.setName("微信用户" + phone.substring(phone.length() - 4));
            // 极简二选一：互助员 / 普通用户（普通用户落库为"老人"，家属区分后续个人中心补齐）
            // 角色管理精细化：选互助员先落普通用户，返回 needApplyHelper 引导提交申请
            user.setRole("老人");
            user.setTimeCoins(100);
            user.setServiceCount(0);
        }
        // 规则：一个手机号只绑定一个微信 openid，绑定后不可更换
        if (user.getOpenid() != null && !user.getOpenid().isBlank() && !user.getOpenid().equals(openid)) {
            return Result.error(409, "该手机号账号已绑定其他微信，禁止更换绑定");
        }
        if (user.getOpenid() == null || user.getOpenid().isBlank()) {
            user.setOpenid(openid);
        }
        userRepository.save(user);
        Map<String, Object> data = loginResult(user);
        if ("互助员".equals(role) && !"互助员".equals(user.getRole())) {
            data.put("needApplyHelper", true);
        }
        return Result.ok("登录成功", data);
    }

    /**
     * 登录：支持两种方式（与原版一致）
     * 1. loginType=account：账号(手机号) + 密码
     * 2. 手机号 + 验证码（固定 123456）
     */
    public Result<Map<String, Object>> login(Map<String, Object> body) {
        String loginType = str(body.get("loginType"));
        String phone = str(body.get("phone"));
        String code = str(body.get("code"));

        if ("account".equals(loginType)) {
            String account = str(body.get("account"));
            String password = str(body.get("password"));
            if (!account.isBlank() && !password.isBlank()) {
                User user = userRepository.findByPhone(account).orElse(null);
                if (user == null || !passwordHasher.verify(password, user.getPassword())) {
                    return Result.error(404, "账号或密码错误");
                }
                if (Integer.valueOf(0).equals(user.getStatus())) {
                    return Result.error(403, "账号已被禁用，请联系社区管理员");
                }
                // 历史明文密码登录成功后自动升级为哈希存储
                if (!user.getPassword().startsWith("s2$")) {
                    user.setPassword(passwordHasher.hash(password));
                    userRepository.save(user);
                }
                return Result.ok("登录成功", loginResult(user));
            }
        }

        if (!phone.isBlank() && "123456".equals(code)) {
            User user = userRepository.findByPhone(phone).orElse(null);
            if (user == null) {
                return Result.error(404, "用户不存在，请先注册");
            }
            if (Integer.valueOf(0).equals(user.getStatus())) {
                return Result.error(403, "账号已被禁用，请联系社区管理员");
            }
            return Result.ok("登录成功", loginResult(user));
        }

        return Result.error(400, "登录参数错误");
    }

    /** 注册：验证码固定 123456，新用户赠送 100 时间币 */
    public Result<Map<String, Object>> register(Map<String, Object> body) {
        String phone = str(body.get("phone"));
        String password = str(body.get("password"));
        String name = str(body.get("name"));
        String code = str(body.get("code"));

        if (phone.isBlank() || password.isBlank() || name.isBlank() || code.isBlank()) {
            return Result.error(400, "请填写完整信息");
        }
        if (!"123456".equals(code)) {
            return Result.error(400, "验证码错误");
        }
        if (userRepository.existsByPhone(phone)) {
            return Result.error(400, "该手机号已注册");
        }

        User user = new User();
        user.setPhone(phone);
        user.setPassword(passwordHasher.hash(password));
        user.setName(name);
        // 注册统一落普通用户（老人）；互助员身份改审核制，经申请审核通过后获得
        user.setRole("老人");
        user.setTimeCoins(100);
        user.setServiceCount(0);
        userRepository.save(user);

        return Result.ok("注册成功", loginResult(user));
    }

    /** 当前登录用户信息 */
    public Result<Map<String, Object>> info(Long userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return Result.error(404, "用户不存在");
        }
        return Result.ok(userInfo(user));
    }

    /** 修改昵称 / 头像 */
    public Result<Map<String, Object>> updateInfo(Long userId, Map<String, Object> body) {
        String name = str(body.get("name"));
        String avatar = str(body.get("avatar"));

        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return Result.error(404, "用户不存在");
        }
        if (!name.isBlank()) {
            user.setName(name);
        }
        if (!avatar.isBlank()) {
            user.setAvatar(avatar);
        }
        userRepository.save(user);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", user.getId());
        data.put("phone", user.getPhone());
        data.put("name", user.getName());
        data.put("role", user.getRole());
        return Result.ok("更新成功", data);
    }

    /** 认证证书（原版为占位数据） */
    public Result<List<String>> certificates() {
        return Result.ok(new ArrayList<>(List.of("实名认证", "健康认证")));
    }

    /** 全部用户列表（公开接口，H5 后台用户管理会用到） */
    public Result<List<Map<String, Object>>> listAll() {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (User u : userRepository.findAll()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", u.getId());
            row.put("phone", u.getPhone());
            row.put("name", u.getName());
            row.put("role", u.getRole());
            row.put("time_coins", u.getTimeCoins());
            row.put("service_count", u.getServiceCount());
            rows.add(row);
        }
        return Result.ok(rows);
    }

    // ===== 私有工具 =====

    private Map<String, Object> loginResult(User user) {
        String token = jwtUtil.sign(user.getId(), user.getPhone());
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("token", token);
        data.put("user", userInfo(user));
        return data;
    }

    private Map<String, Object> userInfo(User user) {
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("id", user.getId());
        info.put("userId", user.getId());
        info.put("phone", user.getPhone());
        info.put("name", user.getName());
        info.put("role", user.getRole());
        info.put("isHelper", isHelper(user));
        info.put("timeCoins", user.getTimeCoins());
        info.put("rmbBalance", user.getRmbBalance());
        info.put("serviceCount", user.getServiceCount());
        info.put("avatar", user.getAvatar());
        info.put("wechatBound", user.getOpenid() != null && !user.getOpenid().isBlank());
        return info;
    }

    /** 双重身份共存：是否拥有互助员身份（曾经审核通过即永久为 true），三重兜底：
     * 1. is_helper 标识列 == 1（审核通过时写入 + 启动回填）；
     * 2. role 为互助员（存量老互助员 / 已确认切换）；
     * 3. 存在 approved 状态的申请（历史数据兜底）。 */
    private boolean isHelper(User user) {
        return Integer.valueOf(1).equals(user.getIsHelper())
                || "互助员".equals(user.getRole())
                || helperApplicationRepository.existsByUserIdAndStatus(user.getId(), HelperApplication.STATUS_APPROVED);
    }

    private String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }
}
