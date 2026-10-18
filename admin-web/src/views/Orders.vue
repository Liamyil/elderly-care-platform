<template>
  <div>
    <!-- 统计看板：点击卡片切换筛选 -->
    <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 12px; padding: 16px 16px 0">
      <div v-for="s in statCards" :key="s.key" class="stat-card" :class="{ active: status === s.key }" @click="switchStatus(s.key)">
        <div class="stat-num" :class="{ orange: s.key === 'dispatch_pool' || s.key === 'reviewing' }">{{ stats[s.key] ?? 0 }}</div>
        <div class="stat-label">{{ s.label }}</div>
      </div>
    </div>

    <!-- 筛选与搜索 -->
    <div class="page-card" style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap">
      <el-select v-model="status" placeholder="全部状态" style="width: 150px" clearable @change="load(1)">
        <el-option label="待审核" value="reviewing" />
        <el-option label="待接单" value="pending" />
        <el-option label="待派单" value="dispatch_pool" />
        <el-option label="服务中" value="serving" />
        <el-option label="待确认" value="pending_confirm" />
        <el-option label="已完成" value="completed" />
        <el-option label="已取消" value="cancelled" />
      </el-select>
      <el-select v-model="typeFilter" placeholder="全部服务类型" style="width: 150px" clearable @change="load(1)">
        <el-option v-for="t in serviceTypes" :key="t" :label="t" :value="t" />
      </el-select>
      <el-input v-model="keyword" placeholder="搜索订单号/服务类型/地址/互助员" style="width: 320px" clearable @keyup.enter="load(1)" @clear="load(1)">
        <template #prefix>🔍</template>
      </el-input>
      <el-button type="primary" @click="load(1)">搜索</el-button>
      <el-button @click="onReset">重置</el-button>
      <el-button @click="load()" style="margin-left: auto">🔄 刷新</el-button>
    </div>

    <!-- 订单表格 -->
    <div class="page-card">
      <el-table :data="list" stripe style="width: 100%" :header-cell-style="{ background: '#EBF5F0', color: '#2D7D46', fontWeight: 'bold' }">
        <el-table-column prop="id" label="订单号" width="150" />
        <el-table-column prop="type" label="服务类型" width="100" />
        <el-table-column prop="userNickname" label="发布人" width="90" />
        <el-table-column prop="address" label="服务地址" min-width="200" show-overflow-tooltip />
        <el-table-column prop="time" label="预约时间" width="140" />
        <el-table-column label="金额/时间币" width="130">
          <template #default="{ row }">
            <span style="color: #E8852E; font-weight: bold">{{ row.priceText ? String(row.priceText).replace(/一次/g, '') : row.reward + '时间币' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="95">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.statusKey)">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="helper" label="互助员" width="90">
          <template #default="{ row }">{{ row.helper || '-' }}</template>
        </el-table-column>
        <el-table-column prop="publishTime" label="发布时间" width="140" />
        <el-table-column label="操作" width="300">
          <template #default="{ row }">
            <div class="op-btns">
              <template v-if="canOperate">
                <!-- 第1格：审核动作 -->
                <el-button v-if="row.statusKey === 'reviewing'" type="success" size="small" @click="onReview(row, true)">通过</el-button>
                <el-button v-else-if="['pending', 'dispatch_pool'].includes(row.statusKey)" type="primary" size="small" @click="openAssign(row)">指派</el-button>
                <span v-else class="op-slot" />
                <!-- 第2格：驳回 -->
                <el-button v-if="row.statusKey === 'reviewing'" type="warning" size="small" @click="openReject(row)">驳回</el-button>
                <span v-else class="op-slot" />
                <!-- 第3格：取消 -->
                <el-button v-if="!['completed', 'cancelled'].includes(row.statusKey)" type="danger" size="small" plain @click="openCancel(row)">取消</el-button>
                <span v-else class="op-slot" />
                <!-- 第4格：详情 -->
                <el-button size="small" @click="openDetail(row)">详情</el-button>
              </template>
              <!-- 民政管理员：紧急干预（高危动作，原因必填 + 操作日志留痕） -->
              <template v-if="!canOperate">
                <el-button v-if="!['completed', 'cancelled'].includes(row.statusKey)" type="danger" size="small" plain @click="openForce(row, 'cancel')">强制取消</el-button>
                <el-button v-if="!['completed', 'cancelled'].includes(row.statusKey)" type="primary" size="small" plain @click="openForce(row, 'assign')">强制指派</el-button>
                <el-button size="small" @click="openDetail(row)">详情</el-button>
              </template>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div style="display: flex; justify-content: flex-end; margin-top: 16px">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="size"
          :page-sizes="[5, 10, 20, 50]"
          :total="total"
          layout="total, sizes, prev, pager, next"
          @current-change="load()"
          @size-change="load(1)"
        />
      </div>
    </div>

    <!-- 指派对话框 -->
    <el-dialog v-model="assignVisible" title="指派互助员" width="420px">
      <div style="margin-bottom: 12px; color: #666">
        订单：{{ assignRow.type }}（{{ assignRow.userNickname }} 发布，{{ assignRow.priceText ? String(assignRow.priceText).replace(/一次/g, '') : assignRow.reward + '时间币' }}）
      </div>
      <el-select v-model="assignHelperId" placeholder="选择互助员" style="width: 100%" size="large">
        <el-option v-for="h in helpers" :key="h.id" :label="h.name + '（已完成' + (h.serviceCount || 0) + '单）'" :value="h.id" />
      </el-select>
      <template #footer>
        <el-button @click="assignVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!assignHelperId" @click="onAssign">确认指派</el-button>
      </template>
    </el-dialog>

    <!-- 驳回对话框 -->
    <el-dialog v-model="rejectVisible" title="驳回订单" width="420px">
      <div style="margin-bottom: 12px; color: #666">订单：{{ assignRow.type }}（{{ assignRow.userNickname }} 发布）</div>
      <el-input v-model="rejectReason" type="textarea" :rows="3" placeholder="请填写驳回原因（将通知发布人）" />
      <template #footer>
        <el-button @click="rejectVisible = false">取消</el-button>
        <el-button type="warning" @click="onReject">确认驳回</el-button>
      </template>
    </el-dialog>

    <!-- 紧急干预对话框（民政管理员：强制取消/强制指派） -->
    <el-dialog v-model="forceVisible" :title="forceMode === 'assign' ? '强制指派 · 高危操作' : '强制取消 · 高危操作'" width="460px">
      <div style="margin-bottom: 12px; color: #666">订单：{{ forceRow.type }}（{{ forceRow.userNickname }} 发布）</div>
      <div v-if="forceMode === 'assign'" style="margin-bottom: 12px">
        <el-select v-model="forceHelperId" placeholder="选择互助员" style="width: 100%">
          <el-option v-for="h in helpers" :key="h.id" :label="h.name + '（已完成' + (h.serviceCount || 0) + '单）'" :value="h.id" />
        </el-select>
      </div>
      <el-input v-model="forceReason" type="textarea" :rows="3" placeholder="干预原因（必填，将写入不可篡改的操作日志）" />
      <div style="color: #CF1322; font-size: 12px; margin-top: 8px">⚠️ 高危动作：执行后自动写入操作日志留痕（操作人、时间、修改前后内容、原因）</div>
      <template #footer>
        <el-button @click="forceVisible = false">取消</el-button>
        <el-button type="danger" @click="onForceConfirm">{{ forceMode === 'assign' ? '确认强制指派' : '确认强制取消' }}</el-button>
      </template>
    </el-dialog>

    <!-- 取消对话框 -->
    <el-dialog v-model="cancelVisible" title="取消订单" width="420px">
      <div style="margin-bottom: 12px; color: #666">订单：{{ assignRow.type }}（{{ assignRow.userNickname }} 发布）</div>
      <el-input v-model="cancelReason" type="textarea" :rows="3" placeholder="请填写取消原因" />
      <template #footer>
        <el-button @click="cancelVisible = false">再想想</el-button>
        <el-button type="danger" @click="onCancel">确认取消</el-button>
      </template>
    </el-dialog>

    <!-- 详情对话框 -->
    <el-dialog v-model="detailVisible" title="订单详情" width="560px">
      <el-descriptions :column="2" border v-if="detail">
        <el-descriptions-item label="订单号" :span="2">{{ detail.id }}</el-descriptions-item>
        <el-descriptions-item label="服务类型">{{ detail.type }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ detail.status }}</el-descriptions-item>
        <el-descriptions-item label="发布人">{{ detail.userNickname }}</el-descriptions-item>
        <el-descriptions-item label="互助员">{{ detail.helper || '-' }}</el-descriptions-item>
        <el-descriptions-item label="服务地址" :span="2">{{ detail.address }}</el-descriptions-item>
        <el-descriptions-item label="预约时间">{{ detail.time }}</el-descriptions-item>
        <el-descriptions-item label="价格">{{ detail.priceText ? String(detail.priceText).replace(/一次/g, '') : (detail.reward + '时间币' + (detail.extraReward > 0 ? '（追加+' + detail.extraReward + '）' : '')) }}</el-descriptions-item>
        <el-descriptions-item label="发布时间">{{ detail.publishTime }}</el-descriptions-item>
        <el-descriptions-item label="接单时间">{{ detail.acceptedAt || '-' }}</el-descriptions-item>
        <el-descriptions-item v-if="detail.remark" label="需求描述" :span="2">{{ detail.remark }}</el-descriptions-item>
        <el-descriptions-item v-if="detail.patientRelation || detail.patientName" label="就诊人" :span="2">{{ detail.patientRelation || '' }} {{ detail.patientName || '' }}{{ detail.patientAge ? '（' + detail.patientAge + '岁）' : '' }}</el-descriptions-item>
        <el-descriptions-item v-if="detail.tasks && detail.tasks.length" label="帮办事项" :span="2">{{ detail.tasks.join('、') }}</el-descriptions-item>
        <el-descriptions-item v-if="detail.assessment" label="健康评估" :span="2">{{ detail.assessment.risk }} · {{ detail.assessment.summaryText }}</el-descriptions-item>
        <el-descriptions-item v-if="detail.cancelReason" label="取消原因" :span="2">{{ detail.cancelReason }}</el-descriptions-item>
        <el-descriptions-item v-if="detail.rating" label="服务评价">{{ '⭐'.repeat(detail.rating) }} {{ detail.comment || '' }}</el-descriptions-item>
      </el-descriptions>
      <div v-if="detail && detail.images && detail.images.length" style="margin-top: 12px">
        <div style="color: #666; margin-bottom: 8px">现场图片（{{ detail.images.length }}张）：</div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap">
          <el-image v-for="(img, i) in detail.images" :key="i" :src="img" style="width: 130px; height: 130px; border-radius: 8px" fit="cover" :preview-src-list="detail.images" />
        </div>
      </div>
      <div v-if="traces.length" style="margin-top: 12px">
        <div style="color: #666; margin-bottom: 8px">服务留痕（{{ traces.length }}条）：</div>
        <div v-for="(t, i) in traces" :key="i" style="border-left: 3px solid #2D7D46; padding-left: 10px; margin-bottom: 12px">
          <div style="font-weight: bold">{{ t.kindName }} · {{ t.time }}</div>
          <div v-if="t.locationText" style="font-size: 13px; color: #666; margin-top: 2px">位置：{{ t.locationText }}</div>
          <div v-if="t.latitude" style="font-size: 12px; color: #999; margin-top: 2px">坐标：{{ t.longitude }}, {{ t.latitude }}</div>
          <div v-if="t.photos && t.photos.length" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px">
            <el-image v-for="(p, j) in t.photos" :key="j" :src="p" style="width: 100px; height: 100px; border-radius: 6px" fit="cover" :preview-src-list="t.photos" />
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '../api/request'

// 民政管理员为只读监管账号，不显示操作按钮
const userRole = (JSON.parse(localStorage.getItem('admin_user') || '{}')).role || '管理员'
const canOperate = computed(() => userRole !== '民政管理员')

const statCards = [
  { key: 'reviewing', label: '待审核' },
  { key: 'pending', label: '待接单' },
  { key: 'dispatch_pool', label: '待派单' },
  { key: 'serving', label: '服务中' },
  { key: 'pending_confirm', label: '待确认' },
  { key: 'completed', label: '已完成' },
  { key: 'cancelled', label: '已取消' }
]

const status = ref('')
const typeFilter = ref('')
const keyword = ref('')
const page = ref(1)
const size = ref(10)
const total = ref(0)
const serviceTypes = ['助餐服务', '助洁服务', '陪诊服务', '代买代办', '日常陪伴', '助浴服务', '理发服务', '维修服务', '法律咨询', '心理关怀']
const list = ref([])
const stats = reactive({})
const helpers = ref([])

const assignVisible = ref(false)
const rejectVisible = ref(false)
const cancelVisible = ref(false)
const detailVisible = ref(false)
const forceVisible = ref(false)
const forceMode = ref('cancel') // cancel / assign
const forceReason = ref('')
const forceHelperId = ref(null)
const forceRow = ref({})
const assignHelperId = ref(null)
const rejectReason = ref('')
const cancelReason = ref('')
const assignRow = ref({})
const detail = ref(null)
const traces = ref([])

function statusTagType(key) {
  const map = { reviewing: 'warning', pending: 'primary', dispatch_pool: 'danger', serving: 'success', pending_confirm: 'warning', completed: 'info', cancelled: 'info' }
  return map[key] || 'info'
}

async function loadStats() {
  const data = await request.get('/api/admin/orders/stats')
  Object.assign(stats, data)
}

async function loadHelpers() {
  helpers.value = await request.get('/api/admin/helpers')
}

async function load(p) {
  if (p) page.value = p
  const data = await request.get('/api/admin/orders', {
    params: { status: status.value || undefined, type: typeFilter.value || undefined, keyword: keyword.value || undefined, page: page.value, size: size.value }
  })
  list.value = data.list
  total.value = data.total
  loadStats()
}

function switchStatus(key) {
  status.value = status.value === key ? '' : key
  load(1)
}

function onReset() {
  status.value = ''
  typeFilter.value = ''
  keyword.value = ''
  load(1)
}

async function onReview(row, approve) {
  await ElMessageBox.confirm(
    approve ? `确认通过「${row.type}」订单（${row.userNickname} 发布）？通过后将公开到订单广场。` : '确认驳回该订单？',
    '审核确认',
    { confirmButtonText: approve ? '通过' : '驳回', type: approve ? 'success' : 'warning' }
  )
  await request.post(`/api/admin/orders/${row.id}/review`, { approve: true })
  ElMessage.success('审核通过，订单已公开')
  load()
}

function openReject(row) {
  assignRow.value = row
  rejectReason.value = ''
  rejectVisible.value = true
}

async function onReject() {
  if (!rejectReason.value.trim()) {
    ElMessage.warning('请填写驳回原因')
    return
  }
  await request.post(`/api/admin/orders/${assignRow.value.id}/review`, { approve: false, reason: rejectReason.value.trim() })
  ElMessage.success('已驳回')
  rejectVisible.value = false
  load()
}

function openAssign(row) {
  assignRow.value = row
  assignHelperId.value = null
  assignVisible.value = true
  loadHelpers()
}

async function onAssign() {
  await request.post(`/api/admin/orders/${assignRow.value.id}/assign`, { helperId: assignHelperId.value })
  ElMessage.success('指派成功')
  assignVisible.value = false
  load()
}

function openCancel(row) {
  assignRow.value = row
  cancelReason.value = ''
  cancelVisible.value = true
}

async function onCancel() {
  await request.post(`/api/admin/orders/${assignRow.value.id}/cancel`, { reason: cancelReason.value.trim() })
  ElMessage.success('订单已取消')
  cancelVisible.value = false
  load()
}

// ===== 紧急干预（民政管理员：强制取消/强制指派，原因必填 + 操作日志） =====
function openForce(row, mode) {
  forceRow.value = row
  forceMode.value = mode
  forceReason.value = ''
  forceHelperId.value = null
  forceVisible.value = true
  if (mode === 'assign') loadHelpers()
}

async function onForceConfirm() {
  if (!forceReason.value.trim()) {
    ElMessage.warning('请填写干预原因（必填）')
    return
  }
  if (forceMode.value === 'assign' && !forceHelperId.value) {
    ElMessage.warning('请选择互助员')
    return
  }
  if (forceMode.value === 'assign') {
    await request.post(`/api/admin/orders/${forceRow.value.id}/force-assign`, { helperId: forceHelperId.value, reason: forceReason.value.trim() })
  } else {
    await request.post(`/api/admin/orders/${forceRow.value.id}/force-cancel`, { reason: forceReason.value.trim() })
  }
  ElMessage.success('已执行，操作日志已留痕')
  forceVisible.value = false
  load()
}

async function openDetail(row) {
  detail.value = row
  detailVisible.value = true
  // 加载服务留痕时间轴（失败不阻塞详情展示）
  traces.value = []
  try {
    traces.value = await request.get(`/api/admin/orders/${row.id}/traces`)
  } catch (e) {
    console.error('加载留痕失败:', e)
  }
}

// 双端实时同步：页面打开时每 5 秒静默刷新列表和统计卡片（切到后台标签页时暂停）
let autoTimer = null

onMounted(() => {
  load()
  autoTimer = setInterval(() => {
    if (!document.hidden) load()
  }, 5000)
})

onUnmounted(() => {
  clearInterval(autoTimer)
})
</script>

<style scoped>
/* 操作列按钮：固定4格（审核/驳回/取消/详情），空位用占位符，保证每一行的按钮位置对齐 */
.op-btns {
  display: flex;
  gap: 4px;
  align-items: center;
}
.op-btns .el-button {
  width: 58px;
  margin-left: 0;
}
.op-slot {
  display: inline-block;
  width: 58px;
}
</style>
