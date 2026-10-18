/**
 * 演示数据脚本：给已完成的陪诊订单补充真实评价
 * 用法：node scripts/seed-evaluations.js
 * 效果：陪诊类型详情页「用户评价」区展示真实评分与内容（可重复执行，只评价未评价订单）
 */
const BASE = 'http://localhost:3000'

async function api(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method: method,
    headers: Object.assign(
      { 'Content-Type': 'application/json' },
      token ? { Authorization: token } : {}
    ),
    body: body ? JSON.stringify(body) : undefined
  })
  return res.json()
}

async function login(phone, password) {
  const res = await api('POST', '/api/user/login', { loginType: 'account', account: phone, password: password })
  if (res.code !== 0) throw new Error('登录失败: ' + (res.message || JSON.stringify(res)))
  return res.data.token
}

// 评价种子内容（按顺序分配给未评价的已完成陪诊订单）
const SEED = [
  { rating: 5, comment: '态度很好、很专业，全程陪同检查，老人很满意' },
  { rating: 4, comment: '准时到达、耐心细致，取报告也代办了' },
  { rating: 5, comment: '第一次用陪诊服务，体验很好，放心' }
]

async function main() {
  // 用老人账号登录（评价只能由下单人提交）
  const token = await login('13800138001', '13800138001hhL.')

  const mine = await api('GET', '/api/orders?status=completed', null, token)
  const orders = Array.isArray(mine.data) ? mine.data : []
  const peizhenDone = orders.filter(function (o) { return o.type === '陪诊服务' })
  const targets = peizhenDone.filter(function (o) { return !o.evaluated }).slice(0, SEED.length)
  console.log('已完成陪诊订单 ' + peizhenDone.length + ' 单，其中未评价 ' + targets.length + ' 单')

  for (let i = 0; i < targets.length; i++) {
    const o = targets[i]
    const seed = SEED[i]
    const res = await api('POST', '/api/orders/' + o.id + '/evaluate', { rating: seed.rating, comment: seed.comment }, token)
    console.log(o.id + ' → ' + (res.code === 0 ? '评价成功（' + seed.rating + '星）' : '失败: ' + res.message))
  }

  const evals = await api('GET', '/api/orders/evaluations?type=' + encodeURIComponent('陪诊服务'))
  console.log('陪诊评价接口当前返回 ' + ((evals.data && evals.data.length) || 0) + ' 条')
}

main().catch(function (e) {
  console.error('脚本执行失败:', e && e.message ? e.message : e)
  process.exit(1)
})
