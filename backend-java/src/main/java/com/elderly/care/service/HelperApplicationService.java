package com.elderly.care.service;

import com.elderly.care.common.Result;
import com.elderly.care.config.JwtUtil;
import com.elderly.care.entity.HelperApplication;
import com.elderly.care.entity.Message;
import com.elderly.care.entity.User;
import com.elderly.care.repository.HelperApplicationRepository;
import com.elderly.care.repository.MessageRepository;
import com.elderly.care.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 互助员注册申请服务：填信息 + 签承诺书 → 提交待审核 → 社区管理员审核。
 * 审核通过：仅更新申请状态（用户保持普通用户），用户在小程序端弹窗点「立即切换」时
 *          由 confirm 接口真正置为互助员并签发新 token；审核驳回：填原因，账号保持普通用户。
 */
@Service
public class HelperApplicationService {

    /** 承诺书版本号（签署时落库留痕） */
    public static final String PLEDGE_VERSION = "v1";

    /** 承诺书文案（后端常量，小程序端展示并签署） */
    public static final String PLEDGE_TEXT =
            "本人自愿申请成为社区互助养老平台互助员，郑重承诺：\n"
                    + "一、遵纪守法，遵守平台服务规范与社区管理规定；\n"
                    + "二、如实提供个人信息，绝不弄虚作假；\n"
                    + "三、服务中尊重老人，耐心细致，不向服务对象索取额外报酬；\n"
                    + "四、保护服务对象隐私，不泄露其个人信息；\n"
                    + "五、接受社区管理员监督管理，服从调度安排。\n"
                    + "如违反以上承诺，本人愿承担相应责任。";

    private final HelperApplicationRepository applicationRepository;
    private final UserRepository userRepository;
    private final MessageRepository messageRepository;
    private final JwtUtil jwtUtil;

    public HelperApplicationService(HelperApplicationRepository applicationRepository,
                                    UserRepository userRepository,
                                    MessageRepository messageRepository,
                                    JwtUtil jwtUtil) {
        this.applicationRepository = applicationRepository;
        this.userRepository = userRepository;
        this.messageRepository = messageRepository;
        this.jwtUtil = jwtUtil;
    }

    /** 承诺书文案（含版本号，签署时随申请一起落库） */
    public Result<Map<String, Object>> pledge() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("version", PLEDGE_VERSION);
        data.put("text", PLEDGE_TEXT);
        return Result.ok(data);
    }

    /** 提交互助员注册申请：必须填写信息并签署承诺书 */
    public Result<Map<String, Object>> submit(Long userId, Map<String, Object> body) {
        String realName = str(body.get("realName"));
        String phone = str(body.get("phone"));
        Integer age = intOrNull(body.get("age"));
        String gender = str(body.get("gender"));
        String intro = str(body.get("intro"));
        String area = str(body.get("area"));
        String experience = str(body.get("experience"));
        boolean pledged = Boolean.TRUE.equals(body.get("pledged"));

        if (realName.isBlank() || phone.isBlank() || age == null || gender.isBlank()) {
            return Result.error(400, "请完整填写姓名、手机号、年龄与性别");
        }
        if (age < 18 || age > 70) {
            return Result.error(400, "请输入18-70岁之间的年龄");
        }
        if (area.isBlank() || experience.isBlank()) {
            return Result.error(400, "请完整填写常住区域与相关经验");
        }
        if (!pledged) {
            return Result.error(400, "请先阅读并签署《互助员服务承诺书》");
        }
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return Result.error(404, "用户不存在");
        }
        if ("互助员".equals(user.getRole())) {
            return Result.error(409, "您已是互助员，无需重复申请");
        }
        if (Integer.valueOf(1).equals(user.getIsHelper())) {
            return Result.error(409, "您已通过互助员审核，无需重复申请");
        }
        if (applicationRepository.existsByUserIdAndStatus(userId, HelperApplication.STATUS_PENDING)) {
            return Result.error(409, "您已有待审核的申请，请耐心等待");
        }

        HelperApplication app = new HelperApplication();
        app.setUserId(userId);
        app.setRealName(realName);
        app.setPhone(phone);
        app.setAge(age);
        app.setGender(gender);
        app.setArea(area);
        app.setExperience(experience);
        app.setIntro(intro);
        app.setPledgeVersion(PLEDGE_VERSION);
        app.setPledgeAgreedAt(LocalDateTime.now());
        app.setStatus(HelperApplication.STATUS_PENDING);
        app.setCreatedAt(LocalDateTime.now());
        applicationRepository.save(app);

        return Result.ok("申请已提交，请等待社区管理员审核", appInfo(app, user));
    }

    /** 我的申请状态（申请页展示：审核中 / 已通过 / 被驳回原因） */
    public Result<Map<String, Object>> myApplication(Long userId) {
        HelperApplication app = applicationRepository.findTopByUserIdOrderByIdDesc(userId).orElse(null);
        if (app == null) {
            return Result.ok(null);
        }
        User user = userRepository.findById(userId).orElse(null);
        return Result.ok(appInfo(app, user));
    }

    /** 确认切换角色：引导弹窗点「立即切换」时调用。在此处才真正把用户角色置为互助员，
     *  申请置为已确认（之后不再弹窗），并签发新 token 返回给前端替换本地令牌 */
    public Result<Map<String, Object>> confirmSwitch(Long userId) {
        HelperApplication app = applicationRepository.findTopByUserIdOrderByIdDesc(userId).orElse(null);
        if (app == null || !HelperApplication.STATUS_APPROVED.equals(app.getStatus())) {
            return Result.error(404, "没有待确认的已通过申请");
        }
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return Result.error(404, "用户不存在");
        }
        user.setRole("互助员");
        // 双重身份共存：互助员标识永久置 1（审核通过时已置，此处防御性兜底存量已通过数据）
        user.setIsHelper(1);
        userRepository.save(user);

        app.setConfirmed(1);
        applicationRepository.save(app);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("token", jwtUtil.sign(user.getId(), user.getPhone()));
        return Result.ok("已确认切换", data);
    }

    /** 驳回通知已读：驳回弹窗展示后调用，置已读避免下次重复弹窗 */
    public Result<Map<String, Object>> markRejectRead(Long userId) {
        HelperApplication app = applicationRepository.findTopByUserIdOrderByIdDesc(userId).orElse(null);
        if (app != null && HelperApplication.STATUS_REJECTED.equals(app.getStatus())) {
            app.setRejectRead(1);
            applicationRepository.save(app);
        }
        return Result.ok("已读", null);
    }

    /** 管理端申请列表；status 为空查全部，否则按 pending/approved/rejected 筛选 */
    public Result<List<Map<String, Object>>> list(String status) {
        List<HelperApplication> apps = (status == null || status.isBlank())
                ? applicationRepository.findAllByOrderByIdDesc()
                : applicationRepository.findByStatusOrderByIdDesc(status);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (HelperApplication app : apps) {
            User user = userRepository.findById(app.getUserId()).orElse(null);
            rows.add(appInfo(app, user));
        }
        return Result.ok(rows);
    }

    /** 审核通过：更新申请状态并发站内消息；同时给用户打上永久互助员标识 is_helper=1
     * （双重身份共存：此后用户同时拥有接单与发单权限）。角色切换仍统一由 confirm 接口
     * （用户在小程序端弹窗点「立即切换」）触发，保证切换前用户保持普通用户身份 */
    public Result<Map<String, Object>> approve(Long applicationId, Long reviewerId) {
        HelperApplication app = applicationRepository.findById(applicationId).orElse(null);
        if (app == null) {
            return Result.error(404, "申请不存在");
        }
        if (!HelperApplication.STATUS_PENDING.equals(app.getStatus())) {
            return Result.error(409, "该申请已处理，请刷新列表");
        }
        User user = userRepository.findById(app.getUserId()).orElse(null);
        if (user == null) {
            return Result.error(404, "申请人账号不存在");
        }

        app.setStatus(HelperApplication.STATUS_APPROVED);
        app.setReviewerId(reviewerId);
        app.setReviewTime(LocalDateTime.now());
        applicationRepository.save(app);

        // 双重身份共存：审核通过即打上永久互助员标识（发单权限不受影响）
        user.setIsHelper(1);
        userRepository.save(user);

        sendMessage(user.getId(), "互助员申请已通过",
                "恭喜！您的互助员申请已审核通过，下次进入小程序时将提示您切换至互助员工作台。");
        return Result.ok("已通过", null);
    }

    /** 审核驳回：必填原因，账号保持普通用户 */
    public Result<Map<String, Object>> reject(Long applicationId, Long reviewerId, String reason) {
        if (reason == null || reason.isBlank()) {
            return Result.error(400, "请填写驳回原因");
        }
        HelperApplication app = applicationRepository.findById(applicationId).orElse(null);
        if (app == null) {
            return Result.error(404, "申请不存在");
        }
        if (!HelperApplication.STATUS_PENDING.equals(app.getStatus())) {
            return Result.error(409, "该申请已处理，请刷新列表");
        }
        app.setStatus(HelperApplication.STATUS_REJECTED);
        app.setRejectReason(reason.trim());
        app.setReviewerId(reviewerId);
        app.setReviewTime(LocalDateTime.now());
        applicationRepository.save(app);

        sendMessage(app.getUserId(), "互助员申请被驳回",
                "很抱歉，您的互助员申请未通过审核。驳回原因：" + reason.trim() + "。如有疑问请联系社区管理员。");
        return Result.ok("已驳回", null);
    }

    // ===== 私有工具 =====

    private Map<String, Object> appInfo(HelperApplication app, User user) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", app.getId());
        row.put("userId", app.getUserId());
        row.put("realName", app.getRealName());
        row.put("idCard", app.getIdCard());
        row.put("phone", app.getPhone());
        row.put("serviceTypes", app.getServiceTypes());
        row.put("intro", app.getIntro());
        row.put("age", app.getAge());
        row.put("gender", app.getGender());
        row.put("area", app.getArea());
        row.put("experience", app.getExperience());
        row.put("confirmed", app.getConfirmed() != null && app.getConfirmed() == 1);
        row.put("rejectRead", app.getRejectRead() != null && app.getRejectRead() == 1);
        row.put("pledgeVersion", app.getPledgeVersion());
        row.put("pledgeAgreedAt", app.getPledgeAgreedAt());
        row.put("status", app.getStatus());
        row.put("rejectReason", app.getRejectReason());
        row.put("reviewerId", app.getReviewerId());
        row.put("reviewTime", app.getReviewTime());
        row.put("createdAt", app.getCreatedAt());
        if (user != null) {
            row.put("applicantName", user.getName());
            row.put("applicantRole", user.getRole());
        }
        return row;
    }

    private void sendMessage(Long userId, String title, String content) {
        Message msg = new Message();
        msg.setId("MSG" + System.currentTimeMillis());
        msg.setUserId(userId);
        msg.setType("notice");
        msg.setTitle(title);
        msg.setContent(content);
        msg.setIsRead(0);
        messageRepository.save(msg);
    }

    private String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    /** 数字入参转换：非法/空 → null（配合必填校验） */
    private Integer intOrNull(Object o) {
        if (o == null) {
            return null;
        }
        try {
            return Integer.valueOf(String.valueOf(o).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
