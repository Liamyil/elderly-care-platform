/**
 * 服务时间选项生成工具（发布需求页 / 陪诊下单页共用）
 *
 * 产品规则：
 * 1. 第一项固定「尽快服务」——选中代表立即开始（订单时间存「尽快服务」，后端超时提醒解析失败自动跳过）
 * 2. 具体时间 = 当前时间 + 30 分钟，向上取整到最近的 5 分钟倍数（例：10:02 + 30min = 10:32 → 10:35）
 * 3. 从默认时间起按 5 分钟一档（10:35 / 10:40 / 10:45 ...）生成到今晚 23:55，不早于当前时间
 * 4. 深夜下单（取整后已过今晚 23:55）时今天无可用具体时间，仅保留「尽快服务」
 * 5. 展示为「今天 HH:mm」；写入订单时带当天日期（yyyy-MM-dd HH:mm，供后端超时提醒解析）
 */

const ASAP = '尽快服务'
const STEP_MS = 5 * 60 * 1000

function pad2(n) {
  return n < 10 ? '0' + n : '' + n
}

// 当前时间 + 30 分钟 → 向上取整到 5 分钟倍数的时间戳
function defaultStartTs(now) {
  return Math.ceil((now.getTime() + 30 * 60 * 1000) / STEP_MS) * STEP_MS
}

// 今晚 23:55 的时间戳
function endOfTodayTs(now) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 55, 0, 0).getTime()
}

// 生成展示选项：['尽快服务', '今天 10:35', '今天 10:40', ...]（跨小时自动进位，跨天则只保留「尽快服务」）
function generateTimeSlots(now) {
  now = now || new Date()
  const options = [ASAP]
  for (let ts = defaultStartTs(now); ts <= endOfTodayTs(now); ts += STEP_MS) {
    const d = new Date(ts)
    options.push('今天 ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()))
  }
  return options
}

// 默认选中项：取整后的具体时间；深夜下单（已过 23:55）时回退「尽快服务」
function defaultTimeLabel(now) {
  now = now || new Date()
  if (defaultStartTs(now) > endOfTodayTs(now)) return ASAP
  const d = new Date(defaultStartTs(now))
  return '今天 ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes())
}

// 选项 label → 写入订单的时间字符串（具体时间带当天日期；尽快服务原样返回）
function labelToTime(label, now) {
  if (!label || label === ASAP) return ASAP
  now = now || new Date()
  const dateStr = now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate())
  return dateStr + ' ' + label.substring(3)
}

module.exports = {
  ASAP: ASAP,
  generateTimeSlots: generateTimeSlots,
  defaultTimeLabel: defaultTimeLabel,
  labelToTime: labelToTime
}
