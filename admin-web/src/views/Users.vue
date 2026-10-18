<template>
  <div>
    <div class="page-card" style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap">
      <el-input v-model="keyword" placeholder="搜索姓名/手机号" style="width: 260px" clearable @keyup.enter="applyFilter" @clear="applyFilter">
        <template #prefix>🔍</template>
      </el-input>
      <el-select v-model="roleFilter" placeholder="全部角色" style="width: 160px" clearable @change="applyFilter">
        <el-option label="老人" value="老人" />
        <el-option label="家属" value="家属" />
        <el-option label="互助员" value="互助员" />
        <el-option label="管理员" value="管理员" />
        <el-option label="民政管理员" value="民政管理员" />
        <el-option label="超级管理员" value="超级管理员" />
      </el-select>
      <el-button type="primary" @click="applyFilter">筛选</el-button>
      <el-button @click="onReset">重置</el-button>
      <el-button v-if="isSuper" type="success" style="margin-left: auto" @click="openCreate">➕ 新建账号</el-button>
      <el-button @click="load">🔄 刷新</el-button>
    </div>

    <div class="page-card">
      <el-table :data="filteredUsers" stripe :header-cell-style="{ background: '#EBF5F0', color: '#2D7D46', fontWeight: 'bold' }">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column prop="phone" label="手机号" width="150" />
        <el-table-column label="角色" width="120">
          <template #default="{ row }">
            <el-tag :type="row.role === '超级管理员' || row.role === '管理员' ? 'danger' : row.role === '民政管理员' ? 'warning' : row.role === '互助员' ? 'success' : 'info'">{{ row.role }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="时间币" width="100">
          <template #default="{ row }">
            <span style="color: #E8852E; font-weight: bold">{{ row.timeCoins }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="serviceCount" label="完成订单" width="100" />
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 0 ? 'danger' : 'success'" size="small">{{ row.status === 0 ? '已禁用' : '正常' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="注册时间" min-width="140" />
        <el-table-column v-if="isCommunity" label="启停账号" width="100" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="['老人', '家属', '互助员'].includes(row.role)"
              :type="row.status === 0 ? 'success' : 'danger'"
              size="small"
              plain
              @click="onToggleStatus(row)"
            >{{ row.status === 0 ? '启用' : '禁用' }}</el-button>
            <span v-else style="color: #ccc">—</span>
          </template>
        </el-table-column>
        <el-table-column v-if="isSuper" label="账号管理" width="170" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openChangeRole(row)">改角色</el-button>
            <el-button size="small" type="warning" plain @click="openResetPwd(row)">重置密码</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 新建账号 -->
    <el-dialog v-model="createVisible" title="新建账号" width="440px">
      <el-form label-width="80px">
        <el-form-item label="姓名"><el-input v-model="createForm.name" placeholder="请输入姓名" /></el-form-item>
        <el-form-item label="手机号"><el-input v-model="createForm.phone" placeholder="请输入手机号" maxlength="11" /></el-form-item>
        <el-form-item label="密码"><el-input v-model="createForm.password" placeholder="请输入初始密码" show-password /></el-form-item>
        <el-form-item label="角色">
          <el-select v-model="createForm.role" placeholder="选择管理员角色" style="width: 100%">
            <el-option label="社区管理员" value="管理员" />
            <el-option label="街道民政管理员" value="民政管理员" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <span style="color: #999; font-size: 12px">超级管理员仅能创建社区管理员与民政管理员账号（普通用户/互助员在小程序端自主注册）</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="onCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- 改角色 -->
    <el-dialog v-model="roleVisible" title="修改角色" width="400px">
      <div style="margin-bottom: 12px; color: #666">用户：{{ currentRow.name }}（{{ currentRow.phone }}），当前角色：{{ currentRow.role }}</div>
      <el-select v-model="newRole" placeholder="选择新角色" style="width: 100%">
        <el-option v-for="r in allRoles" :key="r" :label="r" :value="r" />
      </el-select>
      <template #footer>
        <el-button @click="roleVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!newRole" @click="onChangeRole">确认修改</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码 -->
    <el-dialog v-model="pwdVisible" title="重置密码" width="400px">
      <div style="margin-bottom: 12px; color: #666">用户：{{ currentRow.name }}（{{ currentRow.phone }}）</div>
      <el-input v-model="newPassword" placeholder="请输入新密码" show-password />
      <template #footer>
        <el-button @click="pwdVisible = false">取消</el-button>
        <el-button type="warning" :disabled="!newPassword" @click="onResetPwd">确认重置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '../api/request'

const allRoles = ['老人', '家属', '互助员', '管理员', '民政管理员', '超级管理员']

const userRole = (JSON.parse(localStorage.getItem('admin_user') || '{}')).role || '管理员'
const isSuper = userRole === '超级管理员'
const isCommunity = userRole === '管理员'

const keyword = ref('')
const roleFilter = ref('')
const allUsers = ref([])
const filteredUsers = ref([])

const createVisible = ref(false)
const roleVisible = ref(false)
const pwdVisible = ref(false)
const createForm = reactive({ name: '', phone: '', password: '', role: '' })
const currentRow = ref({})
const newRole = ref('')
const newPassword = ref('')

async function load() {
  allUsers.value = await request.get('/api/admin/users')
  applyFilter()
}

function applyFilter() {
  const kw = keyword.value.trim()
  filteredUsers.value = allUsers.value.filter((u) => {
    const matchRole = !roleFilter.value || u.role === roleFilter.value
    const matchKw = !kw || u.name.includes(kw) || u.phone.includes(kw) || String(u.id).includes(kw)
    return matchRole && matchKw
  })
}

function onReset() {
  roleFilter.value = ''
  keyword.value = ''
  applyFilter()
}

function openCreate() {
  Object.assign(createForm, { name: '', phone: '', password: '', role: '' })
  createVisible.value = true
}

async function onCreate() {
  if (!createForm.name || !createForm.phone || !createForm.password || !createForm.role) {
    ElMessage.warning('请填写完整信息')
    return
  }
  await request.post('/api/admin/users', { ...createForm })
  ElMessage.success('账号创建成功')
  createVisible.value = false
  load()
}

function openChangeRole(row) {
  currentRow.value = row
  newRole.value = ''
  roleVisible.value = true
}

async function onChangeRole() {
  await request.put(`/api/admin/users/${currentRow.value.id}/role`, { role: newRole.value })
  ElMessage.success('角色已修改')
  roleVisible.value = false
  load()
}

function openResetPwd(row) {
  currentRow.value = row
  newPassword.value = ''
  pwdVisible.value = true
}

async function onResetPwd() {
  await request.put(`/api/admin/users/${currentRow.value.id}/password`, { password: newPassword.value })
  ElMessage.success('密码已重置')
  pwdVisible.value = false
}

// 启停普通用户/互助员账号（社区管理员；禁用后该账号无法登录与操作）
async function onToggleStatus(row) {
  const status = row.status === 0 ? 1 : 0
  await ElMessageBox.confirm(
    `确认${status === 1 ? '启用' : '禁用'}「${row.name}」账号？禁用后该账号将无法登录。`,
    '启停确认',
    { type: status === 1 ? 'success' : 'warning', confirmButtonText: status === 1 ? '启用' : '禁用' }
  )
  await request.put(`/api/admin/users/${row.id}/status`, { status })
  ElMessage.success(status === 1 ? '账号已启用' : '账号已禁用')
  load()
}

onMounted(load)
</script>
