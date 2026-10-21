package com.elderly.care.config;

import com.elderly.care.entity.SystemConfig;
import com.elderly.care.entity.User;
import com.elderly.care.repository.SystemConfigRepository;
import com.elderly.care.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 启动初始化器（角色管理精细化）：
 * 1. ddl-auto 为 none，JPA 不自动建表 —— 幂等执行 CREATE TABLE IF NOT EXISTS 建 3 张新表，
 *    并给 users 表补 status 列、helper_applications 表补 age/gender 列（先用 information_schema 判断列是否存在）；
 * 2. 内置超级管理员：数据库写死、无创建入口，仅 H5 后台使用（已存在则不覆盖）；
 * 3. seed 默认系统配置（接单距离上限 / 并发订单数上限）。
 * 不改任何环境配置文件，每次启动幂等执行。
 */
@Component
public class SuperAdminInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SuperAdminInitializer.class);

    /** 超管账号：phone 字段存 "superadmin"（登录接口按 phone 查询），初始密码 Super@123456 */
    public static final String SUPER_ADMIN_ACCOUNT = "superadmin";
    public static final String SUPER_ADMIN_INIT_PASSWORD = "Super@123456";

    private final JdbcTemplate jdbcTemplate;
    private final UserRepository userRepository;
    private final SystemConfigRepository configRepository;
    private final PasswordHasher passwordHasher;

    public SuperAdminInitializer(JdbcTemplate jdbcTemplate, UserRepository userRepository,
                                 SystemConfigRepository configRepository, PasswordHasher passwordHasher) {
        this.jdbcTemplate = jdbcTemplate;
        this.userRepository = userRepository;
        this.configRepository = configRepository;
        this.passwordHasher = passwordHasher;
    }

    @Override
    public void run(ApplicationArguments args) {
        ensureTables();
        ensureUserStatusColumn();
        ensureHelperApplicationColumns();
        ensureUserIsHelperColumn();
        backfillHelperFlag();
        ensureFundColumns();
        ensureWithdrawalsTable();
        ensureMessageColumns();
        Long superAdminId = ensureSuperAdmin();
        seedDefaultConfigs(superAdminId);
        backfillRmbConsumeTransactions();
    }

    /** 幂等建表：3 张新表（utf8mb4 与现有表一致） */
    private void ensureTables() {
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS helper_applications (" +
                "id BIGINT AUTO_INCREMENT PRIMARY KEY," +
                "user_id BIGINT," +
                "real_name VARCHAR(50)," +
                "id_card VARCHAR(30)," +
                "phone VARCHAR(20)," +
                "service_types VARCHAR(255)," +
                "intro VARCHAR(500)," +
                "age INT," +
                "gender VARCHAR(10)," +
                "area VARCHAR(100)," +
                "experience VARCHAR(30)," +
                "confirmed INT," +
                "reject_read INT," +
                "pledge_version VARCHAR(20)," +
                "pledge_agreed_at DATETIME," +
                "status VARCHAR(20)," +
                "reject_reason VARCHAR(255)," +
                "reviewer_id BIGINT," +
                "review_time DATETIME," +
                "created_at DATETIME" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS system_configs (" +
                "id BIGINT AUTO_INCREMENT PRIMARY KEY," +
                "config_key VARCHAR(50) UNIQUE," +
                "config_value VARCHAR(100)," +
                "updated_by BIGINT," +
                "updated_at DATETIME" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS operation_logs (" +
                "id BIGINT AUTO_INCREMENT PRIMARY KEY," +
                "operator_id BIGINT," +
                "operate_type VARCHAR(30)," +
                "before_content TEXT," +
                "after_content TEXT," +
                "remark VARCHAR(255)," +
                "created_at DATETIME" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        log.info("[初始化] 角色管理 3 张新表已确保存在：helper_applications / system_configs / operation_logs");
    }

    /** users 表补 status 列（MySQL 8 不支持 ADD COLUMN IF NOT EXISTS，先查 information_schema） */
    private void ensureUserStatusColumn() {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.COLUMNS " +
                        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'status'",
                Integer.class);
        if (count != null && count > 0) {
            return;
        }
        jdbcTemplate.execute("ALTER TABLE users ADD COLUMN status INT DEFAULT NULL COMMENT '账号状态：1 正常 0 禁用'");
        log.info("[初始化] users 表已补 status 列");
    }

    /** helper_applications 表补新增列（age/gender/area/experience/confirmed/reject_read，先查 information_schema 幂等判断） */
    private void ensureHelperApplicationColumns() {
        ensureColumn("helper_applications", "age",
                "ALTER TABLE helper_applications ADD COLUMN age INT DEFAULT NULL COMMENT '年龄（18~70）'");
        ensureColumn("helper_applications", "gender",
                "ALTER TABLE helper_applications ADD COLUMN gender VARCHAR(10) DEFAULT NULL COMMENT '性别：男/女'");
        ensureColumn("helper_applications", "area",
                "ALTER TABLE helper_applications ADD COLUMN area VARCHAR(100) DEFAULT NULL COMMENT '常住区域（区/街道）'");
        ensureColumn("helper_applications", "experience",
                "ALTER TABLE helper_applications ADD COLUMN experience VARCHAR(30) DEFAULT NULL COMMENT '相关经验'");
        ensureColumn("helper_applications", "confirmed",
                "ALTER TABLE helper_applications ADD COLUMN confirmed INT DEFAULT NULL COMMENT '审核通过后是否已确认切换：1 已确认'");
        ensureColumn("helper_applications", "reject_read",
                "ALTER TABLE helper_applications ADD COLUMN reject_read INT DEFAULT NULL COMMENT '驳回通知是否已读：1 已读'");
    }

    /** users 表补 is_helper 列（双重身份共存：互助员标识，1 = 曾经审核通过） */
    private void ensureUserIsHelperColumn() {
        ensureColumn("users", "is_helper",
                "ALTER TABLE users ADD COLUMN is_helper INT DEFAULT NULL COMMENT '互助员标识：1 曾经审核通过（双重身份）'");
    }

    /** 资金双轨制（2026-10-18）：users / transactions / orders 补资金相关列（幂等，不改任何环境配置文件）
     * - users.rmb_balance：人民币余额（陪诊收入，可提现），与 time_coins 彻底隔离
     * - transactions.asset_type / rmb_amount：流水分币种
     * - orders：结算币种、人民币金额、支付状态、冻结时间币、结算/退款防重标记、服务时长 */
    private void ensureFundColumns() {
        ensureColumn("users", "rmb_balance",
                "ALTER TABLE users ADD COLUMN rmb_balance DECIMAL(10,2) DEFAULT 0 COMMENT '人民币余额（陪诊收入，可提现）'");
        ensureColumn("transactions", "asset_type",
                "ALTER TABLE transactions ADD COLUMN asset_type VARCHAR(20) DEFAULT 'time_coin' COMMENT '币种：time_coin/rmb'");
        ensureColumn("transactions", "rmb_amount",
                "ALTER TABLE transactions ADD COLUMN rmb_amount DECIMAL(10,2) DEFAULT NULL COMMENT '人民币流水金额（asset_type=rmb 时使用）'");
        ensureColumn("transactions", "order_id",
                "ALTER TABLE transactions ADD COLUMN order_id VARCHAR(50) DEFAULT NULL COMMENT '关联订单号（资金流水溯源）'");
        ensureColumn("orders", "asset_type",
                "ALTER TABLE orders ADD COLUMN asset_type VARCHAR(20) DEFAULT NULL COMMENT '结算币种：time_coin/rmb（null 为历史订单）'");
        ensureColumn("orders", "rmb_amount",
                "ALTER TABLE orders ADD COLUMN rmb_amount DECIMAL(10,2) DEFAULT NULL COMMENT '人民币订单金额（陪诊类）'");
        ensureColumn("orders", "pay_status",
                "ALTER TABLE orders ADD COLUMN pay_status VARCHAR(20) DEFAULT NULL COMMENT '支付状态：unpaid/paid/refunded'");
        ensureColumn("orders", "frozen_coins",
                "ALTER TABLE orders ADD COLUMN frozen_coins INT DEFAULT NULL COMMENT '下单冻结的时间币'");
        ensureColumn("orders", "settled",
                "ALTER TABLE orders ADD COLUMN settled INT DEFAULT 0 COMMENT '是否已结算打款给互助员 0/1'");
        ensureColumn("orders", "refunded",
                "ALTER TABLE orders ADD COLUMN refunded INT DEFAULT 0 COMMENT '是否已退款给下单人 0/1'");
        ensureColumn("orders", "hours",
                "ALTER TABLE orders ADD COLUMN hours INT DEFAULT NULL COMMENT '服务时长（小时），互助类 1小时=1时间币'");
    }

    /** messages 表补 order_id 列（站内信闭环：点击消息跳转关联订单详情） */
    private void ensureMessageColumns() {
        ensureColumn("messages", "order_id",
                "ALTER TABLE messages ADD COLUMN order_id VARCHAR(50) DEFAULT NULL COMMENT '关联订单号（点击消息跳转订单详情）'");
    }

    /** 幂等建表：人民币提现申请表（资金双轨制） */
    private void ensureWithdrawalsTable() {
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS withdrawals (" +
                "id VARCHAR(50) PRIMARY KEY," +
                "user_id BIGINT NOT NULL," +
                "amount DECIMAL(10,2) NOT NULL," +
                "status VARCHAR(20) NOT NULL," +
                "reject_reason VARCHAR(255)," +
                "reviewer_id BIGINT," +
                "review_time DATETIME," +
                "paid_at DATETIME," +
                "remark VARCHAR(255)," +
                "created_at DATETIME" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        log.info("[初始化] 资金双轨制：withdrawals 提现申请表已确保存在");
    }

    /** 回填互助员标识（幂等，每次启动执行）：
     * 存量互助员（role=互助员，含审核制上线前直接注册的老互助员）与已通过审核的申请人均置 is_helper=1 */
    private void backfillHelperFlag() {
        int updated = jdbcTemplate.update(
                "UPDATE users u SET u.is_helper = 1 WHERE u.is_helper IS NULL AND (" +
                        "u.role = '互助员' OR EXISTS (SELECT 1 FROM helper_applications a " +
                        "WHERE a.user_id = u.id AND a.status = 'approved'))");
        if (updated > 0) {
            log.info("[初始化] 已回填互助员标识 is_helper：{} 个用户", updated);
        }
    }

    /** 单列幂等补充：列不存在才执行 ALTER */
    private void ensureColumn(String table, String column, String alterSql) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.COLUMNS " +
                        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
                Integer.class, table, column);
        if (count != null && count > 0) {
            return;
        }
        jdbcTemplate.execute(alterSql);
        log.info("[初始化] {} 表已补 {} 列", table, column);
    }

    /** 确保超管账号存在（数据库写死，无创建入口；已存在则不覆盖密码） */
    private Long ensureSuperAdmin() {
        User superAdmin = userRepository.findByPhone(SUPER_ADMIN_ACCOUNT).orElse(null);
        if (superAdmin != null) {
            return superAdmin.getId();
        }
        superAdmin = new User();
        superAdmin.setPhone(SUPER_ADMIN_ACCOUNT);
        superAdmin.setPassword(passwordHasher.hash(SUPER_ADMIN_INIT_PASSWORD));
        superAdmin.setName("超级管理员");
        superAdmin.setRole("超级管理员");
        superAdmin.setTimeCoins(0);
        superAdmin.setServiceCount(0);
        superAdmin.setStatus(1);
        userRepository.save(superAdmin);
        log.info("[初始化] 已内置超级管理员账号：{}（初始密码见 账号密码.text）", SUPER_ADMIN_ACCOUNT);
        return superAdmin.getId();
    }

    /** seed 默认系统配置（已存在则跳过，不覆盖管理员改过的值） */
    private void seedDefaultConfigs(Long superAdminId) {
        seedConfig(SystemConfig.KEY_GRAB_RADIUS_KM, "5", superAdminId);
        seedConfig(SystemConfig.KEY_MAX_CONCURRENT_ORDERS, "3", superAdminId);
        seedConfig(SystemConfig.KEY_PAY_MOCK, "1", superAdminId);
    }

    private void seedConfig(String key, String value, Long superAdminId) {
        if (configRepository.findByConfigKey(key).isPresent()) {
            return;
        }
        SystemConfig config = new SystemConfig();
        config.setConfigKey(key);
        config.setConfigValue(value);
        config.setUpdatedBy(superAdminId);
        config.setUpdatedAt(LocalDateTime.now());
        configRepository.save(config);
        log.info("[初始化] 已写入默认配置 {} = {}", key, value);
    }

    /**
     * 历史数据补账（幂等）：人民币已支付订单补下单人消费支出流水。
     * 修复背景：旧版支付接口只置 pay_status=paid 不写支出流水，导致老人端「人民币消费账单」明细缺失
     * （顶部 rmbSpent 从 orders 合计有数、流水表却无记录）。ID 沿用历史修复惯例 TXREPAIR-<订单号>。
     */
    private void backfillRmbConsumeTransactions() {
        List<Map<String, Object>> orders = jdbcTemplate.queryForList(
                "SELECT o.id, o.user_id, o.type, o.rmb_amount FROM orders o " +
                "WHERE o.asset_type = 'rmb' AND o.pay_status = 'paid' AND o.rmb_amount IS NOT NULL AND o.rmb_amount > 0 " +
                "AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.user_id = o.user_id AND t.order_id = o.id " +
                "AND t.asset_type = 'rmb' AND t.type = 'expense')");
        int inserted = 0;
        for (Map<String, Object> row : orders) {
            String orderId = String.valueOf(row.get("id"));
            Long userId = ((Number) row.get("user_id")).longValue();
            String orderType = String.valueOf(row.get("type"));
            Object rmbAmount = row.get("rmb_amount");
            jdbcTemplate.update("INSERT INTO transactions (id, user_id, type, name, amount, asset_type, rmb_amount, order_id) " +
                            "VALUES (?, ?, 'expense', ?, 0, 'rmb', ?, ?)",
                    "TXREPAIR-" + orderId, userId, orderType + "-服务消费", rmbAmount, orderId);
            inserted++;
        }
        if (inserted > 0) {
            log.info("[初始化] 人民币消费流水补账完成：为 {} 笔已支付订单补写支出流水", inserted);
        }
    }
}
