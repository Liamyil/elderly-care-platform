<template>
  <div>
    <el-tabs v-model="activeTab" style="padding: 16px">
      <!-- 业务参数 -->
      <el-tab-pane label="⚙️ 业务参数" name="config">
        <div class="page-card" v-for="c in configs" :key="c.configKey" style="display: flex; justify-content: space-between; align-items: center">
          <div>
            <div style="font-weight: bold">{{ labelOf(c.configKey) }}</div>
            <div style="color: #999; font-size: 13px; margin-top: 4px">最后修改：{{ c.updatedAt || '-' }}</div>
          </div>
          <div style="display: flex; align-items: center; gap: 20px">
            <span style="font-size: 26px; font-weight: bold; color: #2D7D46">{{ c.configValue }} <span style="font-size: 14px; color: #999">{{ unitOf(c.configKey) }}</span></span>
            <el-button v-if="canEdit" size="small" type="primary" @click="openEdit(c)">修改</el-button>
          </div>
        </div>
        <div v-if="!canEdit" class="page-card" style="color: #B26A00; background: #FFF7E6">📖 民政管理员为只读监管账号：仅可查看配置，不可修改</div>
        <div class="page-card" style="color: #666; font-size: 13px">
          每次修改都会强制写入不可篡改的操作日志（操作人、操作时间、修改前后内容），可在「操作日志」页签查看。
        </div>
      </el-tab-pane>

      <!-- 操作日志 -->
      <el-tab-pane label="📜 操作日志" name="logs">
        <div class="page-card" style="display: flex; align-items: center; gap: 12px">
          <el-select v-model="logTypeFilter" placeholder="全部操作类型" style="width: 180px" clearable @change="loadLogs(1)">
            <el-option label="配置修改" value="CONFIG_CHANGE" />
            <el-option label="强制取消" value="FORCE_CANCEL" />
            <el-option label="强制指派" value="FORCE_ASSIGN" />
          </el-select>
          <span style="color: #999; font-size: 13px">操作日志为只读留痕，不提供修改 / 删除入口</span>
          <el-button style="margin-left: auto" @click="loadLogs(1)">🔄 刷新</el-button>
        </div>

        <div class="page-card">
          <el-table :data="logs" stripe :header-cell-style="{ background: '#EBF5F0', color: '#2D7D46', fontWeight: 'bold' }">
            <el-table-column prop="id" label="ID" width="70" />
            <el-table-column label="操作类型" width="110">
              <template #default="{ row }">
                <el-tag :type="row.operateType === 'CONFIG_CHANGE' ? 'primary' : row.operateType === 'FORCE_CANCEL' ? 'danger' : 'warning'">{{ typeLabel(row.operateType) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="operatorName" label="操作人" width="120" />
            <el-table-column prop="beforeContent" label="修改前内容" min-width="200" show-overflow-tooltip />
            <el-table-column prop="afterContent" label="修改后内容" min-width="200" show-overflow-tooltip />
            <el-table-column prop="remark" label="原因 / 备注" min-width="160" show-overflow-tooltip />
            <el-table-column prop="createdAt" label="操作时间" width="150" />
          </el-table>
          <div style="display: flex; justify-content: flex-end; margin-top: 16px">
            <el-pagination
              v-model:current-page="logPage"
              :page-size="logSize"
              :total="logTotal"
              layout="total, prev, pager, next"
              @current-change="loadLogs()"
            />
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '../api/request'

const CONFIG_META = {
  helper_grab_radius_km: { label: '互助员接单距离上限', unit: '公里' },
  helper_max_concurrent_orders: { label: '互助员并发订单数上限', unit: '个' }
}

const userRole = (JSON.parse(localStorage.getItem('admin_user') || '{}')).role || '管理员'
// 民政管理员只读：可看配置与日志，不可修改配置
const canEdit = computed(() => userRole !== '民政管理员')

const activeTab = ref('config')
const configs = ref([])
const logs = ref([])
const logTypeFilter = ref('')
const logPage = ref(1)
const logSize = ref(10)
const logTotal = ref(0)

function labelOf(key) {
  return (CONFIG_META[key] || {}).label || key
}

function unitOf(key) {
  return (CONFIG_META[key] || {}).unit || ''
}

function typeLabel(type) {
  return { CONFIG_CHANGE: '配置修改', FORCE_CANCEL: '强制取消', FORCE_ASSIGN: '强制指派' }[type] || type
}

async function loadConfigs() {
  configs.value = await request.get('/api/admin/configs')
}

async function openEdit(c) {
  const meta = CONFIG_META[c.configKey] || {}
  const res = await ElMessageBox.prompt(
    `当前值：${c.configValue} ${meta.unit || ''}。输入新值后点击确定，本次修改将写入操作日志（记录修改前后内容）。`,
    `修改「${meta.label || c.configKey}」`,
    { inputValue: c.configValue, inputPattern: /^\d+(\.\d+)?$/, inputErrorMessage: '请输入数字' }
  ).catch(() => null)
  if (!res || !res.value) return
  const value = res.value.trim()
  if (value === c.configValue) return
  await request.put('/api/admin/configs', { key: c.configKey, value })
  ElMessage.success('配置已更新，操作日志已记录')
  loadConfigs()
}

async function loadLogs(p) {
  if (p) logPage.value = p
  const data = await request.get('/api/admin/operation-logs', {
    params: { operateType: logTypeFilter.value || undefined, page: logPage.value, size: logSize.value }
  })
  logs.value = data.list
  logTotal.value = data.total
}

onMounted(() => {
  loadConfigs()
  loadLogs(1)
})
</script>
