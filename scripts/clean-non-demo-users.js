/**
 * 智慧互助养老平台 — 非演示账号清理脚本
 *
 * 用法：node scripts/clean-non-demo-users.js
 *
 * 功能：删除除官方演示账号与内置超管之外的所有账号，及其产生的数据：
 *   订单（发布或接单）、时间币流水、站内消息、服务打卡留痕、互助员注册申请。
 * 保留：账号密码.text 中的 8 个演示账号 + 内置超管 superadmin；
 *   操作日志（operation_logs）为管理员审计留痕，不删除。
 */
/* eslint-disable */
const { execFileSync } = require('child_process');

const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe';

/** 保留的手机号清单：8 个官方演示账号 + 内置超管 */
const KEEP_PHONES = [
  '13800138001', // 陈阿姨 老人
  '13800138002', // 陈小伟 家属
  '13800138003', // 李叔叔 互助员
  '13900139000', // 周管理员 管理员（社区）
  '13800138004', // 王民政 民政管理员
  '13800138005', // 赵超管 超级管理员
  '13800138006', // 王秀兰 互助员
  '13800138007', // 张建国 互助员
  'superadmin'   // 内置超级管理员（无创建入口）
];

/** 执行 SQL（无返回值） */
function runSql(sql) {
  execFileSync(
    MYSQL,
    ['-uroot', '-p123456', '--default-character-set=utf8mb4', 'elderly_care'],
    { input: sql, stdio: ['pipe', 'ignore', 'pipe'] }
  );
}

/** 查询 SQL（返回制表符分隔文本） */
function query(sql) {
  return execFileSync(
    MYSQL,
    ['-uroot', '-p123456', '--default-character-set=utf8mb4', '-N', '-B', 'elderly_care'],
    { input: sql, stdio: ['pipe', 'pipe', 'ignore'], encoding: 'utf8' }
  );
}

// ---------- 主流程 ----------

const keepIn = KEEP_PHONES.map((p) => `'${p}'`).join(',');

// 1. 找出待删账号（手机号不在保留清单内，含无手机号的微信账号）
const targetRows = query(
  `SELECT id, IFNULL(phone,'(无手机号)'), name, IFNULL(role,'(无角色)') FROM users ` +
  `WHERE phone IS NULL OR phone NOT IN (${keepIn}) ORDER BY id;`
);
const targets = targetRows
  .trim()
  .split('\n')
  .filter((line) => line.trim() !== '')
  .map((line) => {
    const [id, phone, name, role] = line.split('\t');
    return { id: Number(id), phone, name, role };
  });

console.log('=== 待删除账号 ===');
if (!targets.length) {
  console.log('没有待删除的账号，无需清理');
  process.exit(0);
}
targets.forEach((t) => console.log(`  id=${t.id}  ${t.phone}  ${t.name}  ${t.role}`));

// 安全护栏：内置超管（superadmin）绝不允许出现在删除清单里
const superAdminTarget = targets.find((t) => t.phone === 'superadmin');
if (superAdminTarget) {
  console.error('!! 安全护栏触发：待删清单中包含 superadmin，已中止，请检查保留清单');
  process.exit(1);
}

const idList = targets.map((t) => t.id).join(',');

// 2. 按依赖顺序删除：消息 → 打卡留痕 → 订单 → 流水 → 互助员申请 → 账号
console.log('=== 开始清理 ===');
runSql(`DELETE FROM messages WHERE user_id IN (${idList});`);
console.log('  已删除：站内消息');
runSql(
  `DELETE FROM service_traces WHERE order_id COLLATE utf8mb4_unicode_ci IN ` +
  `(SELECT id FROM orders WHERE user_id IN (${idList}) OR helper_id IN (${idList}));`
);
console.log('  已删除：服务打卡留痕');
runSql(`DELETE FROM orders WHERE user_id IN (${idList}) OR helper_id IN (${idList});`);
console.log('  已删除：订单');
runSql(`DELETE FROM transactions WHERE user_id IN (${idList});`);
console.log('  已删除：时间币流水');
runSql(`DELETE FROM helper_applications WHERE user_id IN (${idList});`);
console.log('  已删除：互助员注册申请');
runSql(`DELETE FROM users WHERE id IN (${idList});`);
console.log('  已删除：账号');

// 3. 清理结果校验
const remaining = query(
  `SELECT id, IFNULL(phone,'(无手机号)'), name, IFNULL(role,'(无角色)') FROM users ORDER BY id;`
);
console.log('=== 清理后剩余账号 ===');
remaining
  .trim()
  .split('\n')
  .filter((line) => line.trim() !== '')
  .forEach((line) => {
    const [id, phone, name, role] = line.split('\t');
    console.log(`  id=${id}  ${phone}  ${name}  ${role}`);
  });
console.log('=== 清理完成 ===');
