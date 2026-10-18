/**
 * 陪诊试玩版演示数据准备脚本（10/1-10/5 排期，提前至 9/30 完成）
 * 用法：后端启动后执行  node scripts/prepare-peizhen-demo.js
 *
 * 功能（只操作「陪诊服务」订单，不影响其他数据）：
 * 1. 软删除两位下单账号（陈阿姨/陈小伟）名下的历史陪诊订单
 * 2. 创建 10 笔覆盖全状态的陪诊演示订单：待审核 / 待接单 / 待派单 / 服务中 / 待确认 / 已完成(含评价) / 已取消
 *    - 需求描述带【健康评估】附言（低/中/高风险），体现健康评估问卷与订单联动
 *    - 部分订单带现场图片；已完成订单附真实评分与评价内容（陪诊页「用户评价」区展示）
 * 3. 全程走真实 API 生命周期（发布→审核→接单→服务→确认→结算→评价），可重复执行
 */
/* eslint-disable */
const fs = require('fs');
const { execFileSync } = require('child_process');

const BASE = 'http://localhost:3000';
const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe';
const UPLOAD_DIR = 'D:/elderly-care-data/uploads';

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
    account: phone, password: phone + 'hhL.', loginType: 'account',
  });
  return data.token;
}

/** 现场图片池：复用 uploads 目录中已有的压缩图片（目录不存在则无图） */
function imagePool() {
  try {
    return fs.readdirSync(UPLOAD_DIR).filter((f) => f.startsWith('compressed_') && f.endsWith('.jpg'));
  } catch (e) {
    return [];
  }
}

// 健康评估附言（对应健康评估问卷低/中/高风险分级）
const ASSESS = {
  low: '【健康评估】低风险：身体状况良好，无特殊照护需求',
  mid: '【健康评估】中风险：行动能力：需搀扶或拐杖、高血压',
  high: '【健康评估】高风险：行动能力：需轮椅、自理能力：部分需要帮助、心脏病、药物过敏',
};

// 类型人民币价格（随订单存入 price_text，陪诊以人民币结算展示）
const PRICE = {
  '上门接送': '50元一次', '2小时陪诊': '198元一次', '4小时陪诊': '339元一次',
  '白天急诊4小时': '398元一次', '夜间急诊4小时': '598元一次', '8小时陪诊': '599元一次',
  '静脉输液': '198元', '穿刺活检': '258元', '近视手术': '259元', '全周期孕产检查': '259元',
  '骨折复位固定': '259元', '无痛肠胃镜检查': '259元', '复杂拔牙': '259元', '结石': '259元',
  '增强扫描（CT/MRI）': '259元', '透析': '299元', '化疗': '299元'
};

// 健康评估结构化结果（随订单存入 assessment 字段）
const ASSESS_OBJ = {
  low: { risk: '低风险', score: 1, summaryText: '身体状况良好，无特殊照护需求' },
  mid: { risk: '中风险', score: 4, summaryText: '行动能力：需搀扶或拐杖、高血压' },
  high: { risk: '高风险', score: 8, summaryText: '行动能力：需轮椅、自理能力：部分需要帮助、心脏病、药物过敏' },
};

const PUBLISHERS = [
  { phone: '13800138001', name: '陈阿姨', addr: '沈阳市 · 中国医科大学附属盛京医院' },
  { phone: '13800138002', name: '陈小伟', addr: '沈阳市 · 辽宁省人民医院' },
];
const HELPER_PHONES = ['13800138003', '13800138006', '13800138007'];
/** 演示互助员（全量重置后不存在时，用超管账号补建） */
const DEMO_HELPERS = [
  { phone: '13800138006', name: '王秀兰', role: '互助员' },
  { phone: '13800138007', name: '张建国', role: '互助员' }
];
const ADMIN_PHONE = '13900139000';
const SUPER_PHONE = '13800138005';

const day = (d, h) => `2026-10-${d} ${h}`;

/** 陈阿姨（老人）5 单 */
const ELDER_SPECS = [
  { label: '上门接送', target: '待审核', reward: 50, time: day('08', '上午 08:00-12:00'), remark: ASSESS.mid + '\n服务类型：上门接送；帮办：挂号、缴费', img: true, tasks: ['挂号', '缴费'], assessKey: 'mid' },
  { label: '2小时陪诊', target: '待接单', reward: 30, time: day('09', '上午 08:00-12:00'), remark: ASSESS.low + '\n服务类型：2小时陪诊；帮办：取报告', flow: 'approve', tasks: ['取报告'], assessKey: 'low' },
  { label: '4小时陪诊', target: '服务中', reward: 45, time: day('10', '上午 08:00-12:00'), remark: ASSESS.mid + '\n服务类型：4小时陪诊；帮办：陪同就诊、缴费', flow: 'accept', tasks: ['陪同就诊', '缴费'], assessKey: 'mid' },
  { label: '静脉输液', target: '待确认', reward: 40, time: day('11', '上午 08:00-12:00'), remark: ASSESS.mid + '\n服务类型：静脉输液', flow: 'confirming', tasks: ['陪同就诊'], assessKey: 'mid' },
  { label: '无痛肠胃镜检查', target: '已完成·已评价', reward: 60, time: day('12', '上午 08:00-12:00'), remark: ASSESS.mid + '\n服务类型：无痛肠胃镜检查；帮办：陪同检查、取报告', flow: 'done', rating: 5, comment: '态度很好、很专业，全程陪同检查，老人很满意', tasks: ['陪同检查', '取报告'], assessKey: 'mid' },
];

/** 陈小伟（家属）5 单 */
const FAMILY_SPECS = [
  { label: '8小时陪诊', target: '待审核', reward: 80, time: day('08', '上午 08:00-12:00'), remark: ASSESS.high + '\n患者：父亲（78岁）；服务类型：8小时陪诊；帮办：住院手续办理', img: true, patient: { relation: '家人', name: '陈父', age: '78' }, tasks: ['陪同就诊', '缴费'], assessKey: 'high' },
  { label: '白天急诊4小时', target: '待派单', reward: 55, time: day('09', '下午 13:00-17:00'), remark: ASSESS.mid + '\n服务类型：白天急诊4小时；帮办：急诊陪同', flow: 'dispatch', tasks: ['急诊陪同'], assessKey: 'mid' },
  { label: '夜间急诊4小时', target: '服务中', reward: 70, time: day('10', '晚上 18:00-21:00'), remark: ASSESS.high + '\n服务类型：夜间急诊4小时', flow: 'accept', tasks: ['急诊陪同'], assessKey: 'high' },
  { label: '2小时陪诊', target: '已完成·已评价', reward: 30, time: day('11', '上午 08:00-12:00'), remark: ASSESS.low + '\n服务类型：2小时陪诊；帮办：复诊陪同', flow: 'done', rating: 4, comment: '准时到达、耐心细致，取报告也代办了', tasks: ['复诊陪同'], assessKey: 'low' },
  { label: '透析', target: '已取消', reward: 50, time: day('12', '上午 08:00-12:00'), remark: ASSESS.high + '\n服务类型：透析', flow: 'reject', reason: '服务时间与描述不一致，请重新发布', tasks: ['陪同就诊'], assessKey: 'high' },
];

(async () => {
  const pool = imagePool();
  const pickImage = () => (pool.length ? [pool[Math.floor(Math.random() * pool.length)]] : []);

  const adminToken = await login(ADMIN_PHONE);
  // 互助员账号逐个尝试登录（不存在则用超管账号补建），接单轮换使用
  const superToken = await login(SUPER_PHONE);
  const helperTokens = [];
  for (const p of HELPER_PHONES) {
    try {
      helperTokens.push(await login(p));
    } catch (e) {
      const h = DEMO_HELPERS.find(function (x) { return x.phone === p; });
      if (!h) continue;
      try {
        await api('POST', '/api/admin/users', superToken, {
          phone: h.phone, password: h.phone + 'hhL.', name: h.name, role: h.role
        });
        console.log('  补建演示互助员：' + h.name + '（' + h.phone + '）');
      } catch (e2) {
        console.log('  互助员 ' + h.name + ' 补建失败跳过：' + e2.message);
        continue;
      }
      helperTokens.push(await login(p));
    }
  }
  if (!helperTokens.length) throw new Error('没有可用的互助员账号（13800138003 应存在）');
  let hi = 0;
  const nextHelper = () => helperTokens[hi++ % helperTokens.length];

  // 审核环节已按产品决定暂跳过（订单发布即待接单）：approve/reject 保留为空操作，恢复审核时改回真实接口
  const approve = (id) => Promise.resolve();
  const reject = (id, reason) => Promise.resolve();
  const cancel = (id, reason) => api('POST', `/api/admin/orders/${id}/cancel`, adminToken, { reason });
  const accept = (id, t) => api('POST', `/api/orders/${id}/accept`, t);
  const complete = (id, t) => api('POST', `/api/orders/${id}/complete-service`, t);
  const confirm = (id, t) => api('POST', `/api/orders/${id}/confirm-complete`, t);
  const evaluate = (id, t, rating, comment) => api('POST', `/api/orders/${id}/evaluate`, t, { rating, comment });

  // ---------- 1. 清理两位下单账号的历史陪诊订单（软删除） ----------
  console.log('[1/3] 清理历史陪诊订单…');
  for (const pub of PUBLISHERS) {
    const token = await login(pub.phone);
    const mine = await api('GET', '/api/orders', token);
    const targets = mine.filter((o) => o.type === '陪诊服务');
    for (const o of targets) {
      await api('DELETE', '/api/orders/' + o.id, token);
    }
    console.log(`  ${pub.name}：删除历史陪诊订单 ${targets.length} 笔`);
  }

  // ---------- 2. 创建演示订单 ----------
  console.log('[2/3] 创建陪诊演示订单（全状态覆盖）…');
  const created = [];

  async function runSpecs(pub, specs) {
    const token = await login(pub.phone);
    for (const spec of specs) {
      const data = await api('POST', '/api/orders', token, {
        type: '陪诊服务',
        subType: spec.label,
        priceText: PRICE[spec.label] || null,
        address: spec.addr || pub.addr,
        time: spec.time,
        reward: spec.reward,
        remark: spec.remark,
        images: spec.img ? pickImage() : [],
        // 结构化字段：就诊人 / 帮办事项 / 健康评估
        patientRelation: spec.patient ? spec.patient.relation : '本人',
        patientName: spec.patient ? (spec.patient.name || '') : '',
        patientAge: spec.patient ? (spec.patient.age || '') : '',
        tasks: spec.tasks || [],
        assessment: spec.assessKey ? ASSESS_OBJ[spec.assessKey] : null,
      });
      const id = data.id;
      const helper = nextHelper();

      // 服务留痕打卡（方案要求：完工打卡是完成服务的前置条件）
      const trace = (kind) => api('POST', '/api/orders/' + id + '/trace', helper, {
        kind: kind,
        photos: [pool.length ? pool[Math.floor(Math.random() * pool.length)] : 'compressed_cs_1.jpg'],
        longitude: 123.456789,
        latitude: 41.789123,
        locationText: spec.addr || pub.addr
      });

      if (spec.flow === 'approve') {
        await approve(id);
      } else if (spec.flow === 'accept') {
        await approve(id);
        await accept(id, helper);
        await trace('start');
      } else if (spec.flow === 'confirming') {
        await approve(id);
        await accept(id, helper);
        await trace('start');
        await trace('end');
        await complete(id, helper);
      } else if (spec.flow === 'done') {
        await approve(id);
        await accept(id, helper);
        await trace('start');
        await trace('end');
        await complete(id, helper);
        await confirm(id, token);
        await evaluate(id, token, spec.rating, spec.comment);
      } else if (spec.flow === 'dispatch') {
        await approve(id);
        // 待派单池由 30 分钟超时定时任务负责，演示数据直接模拟结果
        runSql(`UPDATE orders SET status = '待派单', status_key = 'dispatch_pool' WHERE id = '${id}';`);
      } else if (spec.flow === 'reject') {
        await cancel(id, spec.reason);
      }

      created.push(`${id}  ${spec.target.padEnd(10, '　')}${pub.name} · ${spec.label}${spec.rating ? '（' + spec.rating + '星）' : ''}`);
      console.log(`  ${id}  ${spec.target}  ${pub.name} · ${spec.label}`);
    }
  }

  await runSpecs(PUBLISHERS[0], ELDER_SPECS);
  await runSpecs(PUBLISHERS[1], FAMILY_SPECS);

  // ---------- 3. 校验 ----------
  console.log('[3/3] 校验结果…');
  const st = await api('GET', '/api/admin/orders/stats', adminToken);
  const evals = await api('GET', '/api/orders/evaluations?type=' + encodeURIComponent('陪诊服务'));

  console.log('\n========== 陪诊演示数据就绪 ==========');
  console.log('本次创建订单：');
  for (const line of created) console.log('  ' + line);
  console.log('陪诊评价接口当前返回 ' + (evals.length || 0) + ' 条（详情页「用户评价」区展示）');
  console.log('全站订单状态分布：');
  console.log(`  待审核 ${st.reviewing} | 待接单 ${st.pending} | 待派单 ${st.dispatch_pool} | 服务中 ${st.serving}`);
  console.log(`  待确认 ${st.pending_confirm} | 已完成 ${st.completed} | 已取消 ${st.cancelled}`);
})().catch((e) => {
  console.error('❌ 脚本执行失败: ' + e.message);
  process.exit(1);
});
