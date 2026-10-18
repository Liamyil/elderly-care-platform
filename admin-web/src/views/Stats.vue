<template>
  <div style="padding: 16px">
    <!-- KPI 指标行 -->
    <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 16px">
      <div class="stat-card">
        <div class="stat-num">{{ dash.totalOrders ?? 0 }}</div>
        <div class="stat-label">总订单数</div>
      </div>
      <div class="stat-card">
        <div class="stat-num orange">{{ dash.todayNew ?? 0 }}</div>
        <div class="stat-label">今日新增</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ dash.completionRate ?? 0 }}%</div>
        <div class="stat-label">订单完成率</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ dash.coinsInBank ?? 0 }}</div>
        <div class="stat-label">时间币存量</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ dash.totalEarned ?? 0 }}</div>
        <div class="stat-label">累计赚取</div>
      </div>
      <div class="stat-card">
        <div class="stat-num orange">{{ dash.totalRedeemed ?? 0 }}</div>
        <div class="stat-label">累计兑换</div>
      </div>
    </div>

    <!-- 导出（前端 CSV，无需新依赖）：社区管理员批量报表 / 民政管理员月度汇总存档 -->
    <div style="display: flex; justify-content: flex-end; margin-bottom: 4px">
      <el-button size="small" @click="onExport">⬇️ 导出汇总报表（CSV）</el-button>
    </div>

    <!-- 类型切换（默认全部订单，选择后图表切到该类型） -->
    <div style="display: flex; align-items: center; gap: 10px; margin: 16px 0 12px">
      <span style="font-size: 15px; font-weight: bold; color: #333">图表数据范围</span>
      <el-select v-model="typeSel" placeholder="全部订单" style="width: 180px" clearable @change="load">
        <el-option v-for="t in serviceTypes" :key="t" :label="t" :value="t" />
      </el-select>
      <span v-if="typeSummary" style="font-size: 13px; color: #666">{{ typeSummary }}</span>
    </div>

    <!-- 图表区 -->
    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px">
      <div class="page-card" style="margin: 0">
        <div class="chart-title">近14天订单趋势（发布 vs 完成）</div>
        <div ref="trendRef" style="height: 360px"></div>
      </div>
      <div class="page-card" style="margin: 0">
        <div class="chart-title">订单状态分布</div>
        <div ref="statusRef" style="height: 360px"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import * as echarts from 'echarts'
import request from '../api/request'

// 图表色板（已通过色盲安全校验：蓝=发布，橙=完成；蓝色渐变用于数量条形）
const BLUE = '#2a78d6'
const ORANGE = '#eb6834'
const BLUE_RAMP = ['#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab']
const INK = '#0b0b0b'
const MUTED = '#898781'
const GRIDLINE = '#e1e0d9'

const dash = reactive({})
const statusSrc = reactive({})
const typeSel = ref('')
const typeSummary = ref('')
const trendRef = ref(null)
const statusRef = ref(null)
const serviceTypes = ['助餐服务', '助洁服务', '陪诊服务', '代买代办', '日常陪伴', '助浴服务', '理发服务', '维修服务', '法律咨询', '心理关怀']
let trendChart = null
let statusChart = null

const STATUS_LABELS = {
  reviewing: '待审核',
  pending: '待接单',
  dispatch_pool: '待派单',
  serving: '服务中',
  pending_confirm: '待确认',
  completed: '已完成',
  cancelled: '已取消'
}

let loading = false

// 导出汇总报表：KPI + 订单状态分布 + 角色分布（前端生成 CSV，UTF-8 BOM 兼容 Excel）
function onExport() {
  const rows = [
    ['指标', '数值'],
    ['总订单数', dash.totalOrders ?? 0],
    ['今日新增', dash.todayNew ?? 0],
    ['订单完成率(%)', dash.completionRate ?? 0],
    ['时间币存量', dash.coinsInBank ?? 0],
    ['累计赚取', dash.totalEarned ?? 0],
    ['累计兑换', dash.totalRedeemed ?? 0],
    [],
    ['订单状态分布', '数量']
  ]
  for (const [key, label] of Object.entries(STATUS_LABELS)) {
    rows.push([label, statusSrc[key] ?? 0])
  }
  rows.push([], ['角色分布', '人数'])
  for (const [role, count] of Object.entries(dash.roleCounts || {})) {
    rows.push([role, count])
  }
  rows.push([], ['导出时间', new Date().toLocaleString()])

  const csv = '﻿' + rows.map((r) => r.map((c) => String(c ?? '').replace(/,/g, '，')).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `互助养老汇总报表_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

async function load() {
  if (loading) return
  loading = true
  try {
    const d = await request.get('/api/admin/stats/dashboard')
    Object.assign(dash, d)
    Object.assign(statusSrc, d)
    typeSummary.value = ''

    if (typeSel.value) {
      // 选中具体类型：图表与该类型的统计切换到该类型数据
      const t = await request.get('/api/admin/stats/type', { params: { type: typeSel.value } })
      Object.assign(statusSrc, t)
      typeSummary.value = `${typeSel.value}：共 ${t.totalOrders} 单 · 完成率 ${t.completionRate}% · 累计 ${t.totalCoins} 币`
    }

    const trend = await request.get('/api/admin/stats/trend', {
      params: { days: 14, ...(typeSel.value ? { type: typeSel.value } : {}) }
    })
    renderTrend(trend.list)
    renderStatus()
  } finally {
    loading = false
  }
}

function renderTrend(list) {
  if (!trendChart) trendChart = echarts.init(trendRef.value)
  trendChart.setOption({
    color: [BLUE, ORANGE],
    tooltip: { trigger: 'axis' },
    legend: {
      data: ['发布订单', '完成订单'],
      top: 0,
      right: 10,
      textStyle: { color: INK, fontSize: 12 }
    },
    grid: { left: 40, right: 40, top: 40, bottom: 30 },
    xAxis: {
      type: 'category',
      data: list.map((d) => d.date),
      axisLine: { lineStyle: { color: GRIDLINE } },
      axisLabel: { color: MUTED, fontSize: 11 },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: GRIDLINE } },
      axisLabel: { color: MUTED, fontSize: 11 }
    },
    series: [
      {
        name: '发布订单',
        type: 'line',
        data: list.map((d) => d.created),
        smooth: true,
        symbolSize: 8,
        lineStyle: { width: 2 },
        emphasis: { focus: 'series' },
        endLabel: { show: true, formatter: '发布', color: BLUE }
      },
      {
        name: '完成订单',
        type: 'line',
        data: list.map((d) => d.completed),
        smooth: true,
        symbolSize: 8,
        lineStyle: { width: 2 },
        emphasis: { focus: 'series' },
        endLabel: { show: true, formatter: '完成', color: ORANGE }
      }
    ]
  })
}

function renderStatus() {
  if (!statusChart) statusChart = echarts.init(statusRef.value)
  // 按数量从高到低排列，数量越高颜色越深（单一蓝色渐变，符合顺序色带规范）
  const entries = Object.entries(STATUS_LABELS)
    .map(([key, label]) => ({ key, label, value: statusSrc[key] ?? 0 }))
    .sort((a, b) => a.value - b.value)
  const n = entries.length
  statusChart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} 单' },
    grid: { left: 10, right: 60, top: 10, bottom: 10, containLabel: true },
    xAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: GRIDLINE } }, axisLabel: { color: MUTED, fontSize: 11 } },
    yAxis: {
      type: 'category',
      data: entries.map((e) => e.label),
      axisLine: { lineStyle: { color: GRIDLINE } },
      axisLabel: { color: INK, fontSize: 12 },
      axisTick: { show: false }
    },
    series: [
      {
        type: 'bar',
        data: entries.map((e, i) => ({
          value: e.value,
          // 数量越高颜色越深：升序排列后第 i 个取色带第 i 档（0=最浅，末尾=最深）
          itemStyle: { color: BLUE_RAMP[Math.min(i, BLUE_RAMP.length - 1)], borderRadius: [0, 4, 4, 0] }
        })),
        barWidth: 18,
        label: { show: true, position: 'right', color: MUTED, fontSize: 11 }
      }
    ]
  })
}

function onResize() {
  trendChart && trendChart.resize()
  statusChart && statusChart.resize()
}

// 双端实时同步：每 10 秒静默刷新 KPI 与图表（切到后台标签页时暂停）
let autoTimer = null

onMounted(() => {
  load()
  window.addEventListener('resize', onResize)
  autoTimer = setInterval(() => {
    if (!document.hidden) load()
  }, 10000)
})

onBeforeUnmount(() => {
  clearInterval(autoTimer)
  window.removeEventListener('resize', onResize)
  trendChart && trendChart.dispose()
  statusChart && statusChart.dispose()
})
</script>

<style scoped>
.chart-title {
  font-size: 15px;
  font-weight: bold;
  color: #333;
  margin-bottom: 8px;
}
</style>
