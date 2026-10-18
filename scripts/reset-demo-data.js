/**
 * 智慧互助养老平台 — 演示数据重置脚本
 *
 * 用法：后端启动后执行  node scripts/reset-demo-data.js
 *
 * 功能：
 * 1. 清空 transactions / messages / orders / users 四张表
 * 2. 重建 6 个测试账号（密码 = 手机号 + hhL.，scrypt 哈希，与后端 PasswordHasher 兼容）
 * 3. 老人 + 家属两个下单账号各创建 7 种状态 × 2 单 = 28 笔订单，部分带现场图片
 * 4. 订单生命周期全部走真实 API：提交 → 审核 → 接单 → 服务 → 确认 → 结算
 *    （时间币扣减/入账、流水、消息通知均为真实业务逻辑生成）
 */
/* eslint-disable */
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';
const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe';
const UPLOAD_DIR = 'D:/elderly-care-data/uploads';

// ---------- 工具 ----------

/** scrypt 哈希：与后端 PasswordHasher 格式一致（s2$盐hex$哈希hex，N=16384 r=8 p=1） */
function scryptHash(password) {
  const saltHex = crypto.randomBytes(16).toString('hex');
  const dk = crypto
    .scryptSync(password, saltHex, 32, { N: 16384, r: 8, p: 1 })
    .toString('hex');
  return `s2$${saltHex}$${dk}`;
}

/** 直接执行 SQL（通过 mysql 客户端 stdin 传入，避免转义问题） */
function runSql(sql) {
  execFileSync(
    MYSQL,
    ['-uroot', '-p123456', '--default-character-set=utf8mb4', 'elderly_care'],
    { input: sql, stdio: ['pipe', 'ignore', 'pipe'] }
  );
}

async function api(method, url, token, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`${method} ${url} 失败: ${data.message || JSON.stringify(data)}`);
  }
  return data.data;
}

async function login(phone) {
  const data = await api('POST', '/api/user/login', null, {
    account: phone,
    password: phone + 'hhL.',
    loginType: 'account',
  });
  return data.token;
}

// ---------- 1. 清空数据库 ----------
console.log('[1/4] 清空数据库…');
runSql(`
  SET NAMES utf8mb4;
  DELETE FROM transactions;
  DELETE FROM messages;
  DELETE FROM orders;
  DELETE FROM users;
  ALTER TABLE users AUTO_INCREMENT = 1;
`);

// ---------- 2. 重建 6 个账号 ----------
console.log('[2/4] 重建 6 个测试账号…');
const USERS = [
  { phone: '13800138001', name: '陈阿姨', role: '老人', coins: 300 },
  { phone: '13800138002', name: '陈小伟', role: '家属', coins: 300 },
  { phone: '13800138003', name: '李叔叔', role: '互助员', coins: 100 },
  { phone: '13900139000', name: '周管理员', role: '管理员', coins: 0 },
  { phone: '13800138004', name: '王民政', role: '民政管理员', coins: 0 },
  { phone: '13800138005', name: '赵超管', role: '超级管理员', coins: 0 },
];
const userValues = USERS.map((u) => {
  const pwd = scryptHash(u.phone + 'hhL.');
  return `('${u.phone}', '${pwd}', '${u.name}', '${u.role}', ${u.coins}, 0)`;
}).join(',\n  ');
runSql(`INSERT INTO users (phone, password, name, role, time_coins, service_count) VALUES\n  ${userValues};`);

// ---------- 3. 生成订单（走真实 API 生命周期） ----------
console.log('[3/4] 生成 28 笔订单（老人14 + 家属14，覆盖全部7种状态）…');

// 现场图片池：复用 uploads 目录中已有的压缩图片
const imagePool = fs
  .readdirSync(UPLOAD_DIR)
  .filter((f) => f.startsWith('compressed_') && f.endsWith('.jpg'));

function pickImages(n) {
  const out = [];
  for (let k = 0; k < n; k++) {
    out.push(imagePool[Math.floor(Math.random() * imagePool.length)]);
  }
  return out;
}

const PUBLISHERS = [
  {
    phone: '13800138001',
    name: '陈阿姨',
    addr: '幸福里小区 3 号楼 2 单元 101 室',
    day: '2026-09-18',
  },
  {
    phone: '13800138002',
    name: '陈小伟',
    addr: '阳光花园 5 栋 302 室',
    day: '2026-09-19',
  },
];

const HELPER_PHONE = '13800138003';
const ADMIN_PHONE = '13900139000';

/**
 * 为单个下单账号生成 14 笔订单（7 状态 × 2 单）
 */
async function seedPublisher(pub, helperToken, adminToken, stats) {
  const token = await login(pub.phone);
  let created = 0;

  /** 提交订单（初始状态：审核中） */
  async function submit({ type, reward, time, remark, imgs }) {
    const data = await api('POST', '/api/orders', token, {
      type,
      address: pub.addr,
      time,
      reward,
      remark,
      images: imgs || [],
    });
    created++;
    return data.id;
  }

  // 审核环节已按产品决定暂跳过（订单发布即待接单）：approve 保留为空操作，恢复审核时改回真实接口
  const approve = (id) => Promise.resolve();
  // 服务留痕打卡（方案要求：完工打卡是完成服务的前置条件）
  const trace = (id, kind, t) =>
    api('POST', `/api/orders/${id}/trace`, t, {
      kind,
      photos: [pickImages(1)[0] || 'compressed_cs_1.jpg'],
      longitude: 123.456789,
      latitude: 41.789123,
      locationText: pub.addr,
    });
  const reject = (id, reason) =>
    api('POST', `/api/admin/orders/${id}/review`, adminToken, { approve: false, reason });
  const accept = (id) => api('POST', `/api/orders/${id}/accept`, helperToken);
  const complete = (id) => api('POST', `/api/orders/${id}/complete-service`, helperToken);
  const confirm = (id) => api('POST', `/api/orders/${id}/confirm-complete`, token);
  const cancel = (id, reason) =>
    api('POST', `/api/admin/orders/${id}/cancel`, adminToken, { reason });

  const t = (h) => `${pub.day} ${h}`;
  const dispatchIds = [];

  // 状态1：待审核（2单，留在审核中供后台演示审核操作）
  await submit({ type: '助餐服务', reward: 20, time: t('10:30'), remark: '帮忙做一顿清淡午饭', imgs: pickImages(1) });
  await submit({ type: '日常陪伴', reward: 10, time: t('15:00'), remark: '下午陪老人聊聊天、下下棋' });

  // 状态2：待接单（2单，审核通过后公开抢单）
  let id = await submit({ type: '代买代办', reward: 15, time: t('09:00'), remark: '去菜市场代买青菜和鸡蛋', imgs: pickImages(1) });
  await approve(id);
  id = await submit({ type: '助餐服务', reward: 20, time: t('11:30'), remark: '帮忙做午饭，两菜一汤' });
  await approve(id);

  // 状态3：待派单（2单，审核通过后直接改为待派单池，演示超时兜底）
  const d1 = await submit({ type: '助洁服务', reward: 25, time: t('14:00'), remark: '房间打扫，重点是厨房和卫生间', imgs: pickImages(2) });
  const d2 = await submit({ type: '陪诊服务', reward: 30, time: t('08:30'), remark: '陪老人去社区医院复诊，帮忙挂号取药' });
  await approve(d1);
  await approve(d2);
  dispatchIds.push(d1, d2);

  // 状态4：服务中（2单，互助员已接单正在服务）
  id = await submit({ type: '助餐服务', reward: 20, time: t('12:00'), remark: '做午饭并陪同用餐', imgs: pickImages(1) });
  await approve(id);
  await accept(id);
  await trace(id, 'start', helperToken);
  id = await submit({ type: '助洁服务', reward: 25, time: t('16:00'), remark: '擦窗户、拖地', imgs: pickImages(2) });
  await approve(id);
  await accept(id);
  await trace(id, 'start', helperToken);

  // 状态5：待确认（2单，互助员已点完成，等待下单方确认）
  const c1 = await submit({ type: '日常陪伴', reward: 10, time: t('18:30'), remark: '晚饭后陪散步', imgs: pickImages(1) });
  const c2 = await submit({ type: '代买代办', reward: 15, time: t('10:00'), remark: '代取快递并送上门' });
  await approve(c1);
  await approve(c2);
  await accept(c1);
  await accept(c2);
  await trace(c1, 'start', helperToken);
  await trace(c2, 'start', helperToken);
  await trace(c1, 'end', helperToken);
  await trace(c2, 'end', helperToken);
  await complete(c1);
  await complete(c2);

  // 状态6：已完成（2单，下单方已确认，时间币已真实结算）
  const f1 = await submit({ type: '助餐服务', reward: 20, time: t('11:00'), remark: '帮忙做午饭', imgs: pickImages(1) });
  const f2 = await submit({ type: '助洁服务', reward: 25, time: t('14:30'), remark: '全屋保洁', imgs: pickImages(2) });
  await approve(f1);
  await approve(f2);
  await accept(f1);
  await accept(f2);
  await trace(f1, 'end', helperToken);
  await trace(f2, 'end', helperToken);
  await complete(f1);
  await complete(f2);
  await confirm(f1);
  await confirm(f2);

  // 状态7：已取消（2单，审核环节已暂跳过，均走取消）
  id = await submit({ type: '陪诊服务', reward: 30, time: t('09:30'), remark: '陪诊', imgs: pickImages(1) });
  await cancel(id, '服务时间与描述不一致，请重新发布');
  const x2 = await submit({ type: '代买代办', reward: 15, time: t('17:00'), remark: '代买生活用品' });
  await approve(x2);
  await cancel(x2, '老人临时有事，取消订单');

  // 待派单池订单改为待派单状态（超时兜底由定时任务负责，这里直接模拟结果）
  if (dispatchIds.length) {
    runSql(
      `UPDATE orders SET status = '待派单', status_key = 'dispatch_pool' WHERE id IN (${dispatchIds
        .map((id) => `'${id}'`)
        .join(',')});`
    );
  }

  stats.push({ name: pub.name, count: created });
  console.log(`  ${pub.name}（${pub.role || '下单方'}）已生成 ${created} 笔订单`);
}

(async () => {
  const helperToken = await login(HELPER_PHONE);
  const adminToken = await login(ADMIN_PHONE);
  const stats = [];
  for (const pub of PUBLISHERS) {
    await seedPublisher(pub, helperToken, adminToken, stats);
  }

  // ---------- 4. 校验 ----------
  console.log('[4/4] 校验结果…');
  const st = await api('GET', '/api/admin/orders/stats', adminToken);
  const elder = await api('GET', '/api/user/info', await login('13800138001'));
  const family = await api('GET', '/api/user/info', await login('13800138002'));
  const helper = await api('GET', '/api/user/info', await login('13800138003'));

  console.log('\n========== 重置完成 ==========');
  console.log('各状态订单数：');
  console.log(`  待审核 ${st.reviewing} | 待接单 ${st.pending} | 待派单 ${st.dispatch_pool} | 服务中 ${st.serving}`);
  console.log(`  待确认 ${st.pending_confirm} | 已完成 ${st.completed} | 已取消 ${st.cancelled}`);
  console.log('时间币余额：');
  console.log(`  陈阿姨(老人) ${elder.timeCoins} 币 | 陈小伟(家属) ${family.timeCoins} 币 | 李叔叔(互助员) ${helper.timeCoins} 币（完成 ${helper.serviceCount} 单）`);
  console.log('\n测试账号（密码 = 手机号 + hhL.，验证码 = 123456）：');
  for (const u of USERS) {
    console.log(`  ${u.phone} ${u.name}（${u.role}）`);
  }
})();
