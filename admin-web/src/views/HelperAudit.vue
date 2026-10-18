<template>
  <div>
    <div class="page-card" style="display: flex; align-items: center; gap: 12px">
      <el-radio-group v-model="statusFilter" @change="load">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="pending">待审核</el-radio-button>
        <el-radio-button value="approved">已通过</el-radio-button>
        <el-radio-button value="rejected">已驳回</el-radio-button>
      </el-radio-group>
      <el-button style="margin-left: auto" @click="load">🔄 刷新</el-button>
    </div>

    <div class="page-card">
      <el-table :data="list" stripe :header-cell-style="{ background: '#EBF5F0', color: '#2D7D46', fontWeight: 'bold' }">
        <el-table-column prop="realName" label="姓名" width="110" />
        <el-table-column prop="phone" label="联系电话" width="140" />
        <el-table-column prop="idCard" label="身份证号" width="180" />
        <el-table-column prop="serviceTypes" label="服务意向" min-width="160" show-overflow-tooltip />
        <el-table-column prop="area" label="常住区域" min-width="120" show-overflow-tooltip />
        <el-table-column prop="experience" label="相关经验" min-width="110" show-overflow-tooltip />
        <el-table-column label="承诺书签署" width="170">
          <template #default="{ row }">{{ row.pledgeVersion }} 版 · {{ row.pledgeAgreedAt }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'pending' ? 'warning' : row.status === 'approved' ? 'success' : 'danger'">
              {{ row.status === 'pending' ? '待审核' : row.status === 'approved' ? '已通过' : '已驳回' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="rejectReason" label="驳回原因" min-width="140" show-overflow-tooltip />
        <el-table-column label="申请时间" width="150">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="审核操作" width="170" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'pending'">
              <el-button size="small" type="success" @click="onApprove(row)">通过</el-button>
              <el-button size="small" type="warning" plain @click="openReject(row)">驳回</el-button>
            </template>
            <span v-else style="color: #999">—</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 驳回对话框 -->
    <el-dialog v-model="rejectVisible" title="驳回互助员申请" width="420px">
      <div style="margin-bottom: 12px; color: #666">申请人：{{ currentRow.realName }}（{{ currentRow.phone }}）</div>
      <el-input v-model="rejectReason" type="textarea" :rows="3" placeholder="请填写驳回原因（必填，将通知申请人）" />
      <template #footer>
        <el-button @click="rejectVisible = false">取消</el-button>
        <el-button type="warning" @click="onReject">确认驳回</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '../api/request'

const statusFilter = ref('')
const list = ref([])
const rejectVisible = ref(false)
const rejectReason = ref('')
const currentRow = ref({})

let pollTimer = null

async function load(silent) {
  const params = statusFilter.value ? { status: statusFilter.value } : {}
  list.value = await request.get('/api/admin/helper-applications', { params, silent: !!silent })
}

/** 10 秒静默轮询：新提交的申请自动出现，不弹 loading 也不打扰当前操作 */
function startPolling() {
  stopPolling()
  pollTimer = setInterval(() => {
    load(true).catch(() => {})
  }, 10000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function onApprove(row) {
  await ElMessageBox.confirm(
    `确认通过「${row.realName}」的互助员申请？通过后申请人保持普通用户身份，下次进入小程序时将收到切换提示，点击确认后进入互助员端。`,
    '审核通过',
    { confirmButtonText: '通过', type: 'success' }
  )
  await request.post(`/api/admin/helper-applications/${row.id}/approve`)
  ElMessage.success('已通过，申请人下次进入小程序时将收到切换提示')
  load()
}

/** 申请时间格式化：后端 ISO 时间 → YYYY-MM-DD HH:mm */
function formatTime(value) {
  if (!value) return ''
  return String(value).replace('T', ' ').slice(0, 16)
}

function openReject(row) {
  currentRow.value = row
  rejectReason.value = ''
  rejectVisible.value = true
}

async function onReject() {
  if (!rejectReason.value.trim()) {
    ElMessage.warning('请填写驳回原因')
    return
  }
  await request.post(`/api/admin/helper-applications/${currentRow.value.id}/reject`, { reason: rejectReason.value.trim() })
  ElMessage.success('已驳回')
  rejectVisible.value = false
  load()
}

onMounted(() => {
  load()
  startPolling()
})

onUnmounted(stopPolling)
</script>
