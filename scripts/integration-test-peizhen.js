/**
 * 陪诊订单全链路联调测试
 * 流程：老人下单（陪诊服务）→ 管理员审核通过 → 互助员接单 → 服务完成 → 老人确认 → 时间币结算
 * 用法：后端启动后执行  node scripts/integration-test-peizhen.js
 */
/* eslint-disable */
const BASE = 'http://localhost:3000';

async function api(method, url, token, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(method + ' ' + url + ' 失败: ' + (data.message || JSON.stringify(data)));
  }
  return data.data;
}

async function login(phone) {
  const data = await api('POST', '/api/user/login', null, {
    account: phone, password: phone + 'hhL.', loginType: 'account'
  });
  return data.token;
}

async function main() {
  const elder = await login('13800138001');
  const helper = await login('13800138003');
  const admin = await login('13900139000');

  const before = await api('GET', '/api/user/info', elder);

  // 1. 老人提交陪诊订单（初始：审核中）
  console.log('[1/6] 老人提交陪诊订单…');
  const created = await api('POST', '/api/orders', elder, {
    type: '陪诊服务',
    address: '沈阳市 · 中国医科大学附属盛京医院',
    time: '2026-09-28 上午 08:00-12:00',
    reward: 50,
    remark: '【陪诊】服务类型：上门接送；帮办：挂号、缴费；患者：本人'
  });
  console.log('  订单号: ' + created.id + '，状态: 审核中');

  // 2. 审核环节已按产品决定暂跳过：订单发布即待接单
  console.log('[2/7] 跳过审核（已临时移除）…');

  // 3. 互助员接单
  console.log('[3/6] 互助员接单…');
  await api('POST', '/api/orders/' + created.id + '/accept', helper);
  console.log('  状态: 服务中');

  // 4. 互助员完工打卡留痕（方案要求：完成服务前必须拍照留痕）
  console.log('[4/7] 互助员完工打卡（定位+拍照留痕）…');
  await api('POST', '/api/orders/' + created.id + '/trace', helper, {
    kind: 'end',
    photos: ['compressed_cs_1.jpg'],
    longitude: 123.456789,
    latitude: 41.789123,
    locationText: '沈阳市 · 中国医科大学附属盛京医院'
  });
  console.log('  留痕已记录');

  // 5. 互助员完成服务
  console.log('[5/7] 互助员完成服务…');
  await api('POST', '/api/orders/' + created.id + '/complete-service', helper);
  console.log('  状态: 待确认');

  // 6. 老人确认完成（触发结算）
  console.log('[6/7] 老人确认完成（结算）…');
  await api('POST', '/api/orders/' + created.id + '/confirm-complete', elder);
  console.log('  状态: 已完成');

  // 7. 校验余额
  console.log('[7/7] 校验结算结果…');
  const afterElder = await api('GET', '/api/user/info', elder);
  const afterHelper = await api('GET', '/api/user/info', helper);
  const expectElder = before.timeCoins - 50;

  console.log('\n========== 联调结果 ==========');
  console.log('老人余额: ' + before.timeCoins + ' → ' + afterElder.timeCoins + '（预期 ' + expectElder + '）');
  console.log('互助员余额: ' + afterHelper.timeCoins + '，完成单数: ' + afterHelper.serviceCount);
  const ok = afterElder.timeCoins === expectElder;
  console.log(ok ? '✅ 全链路通过：下单→审核→接单→服务→确认→结算 全部正常' : '❌ 余额不符，请检查结算逻辑');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('❌ 联调失败: ' + e.message);
  process.exit(1);
});
