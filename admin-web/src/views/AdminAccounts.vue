<template>
  <div>
    <div class="page-card" style="display: flex; align-items: center; gap: 12px">
      <el-button type="success" @click="openCreate">➕ 新建管理员</el-button>
      <el-button @click="load">🔄 刷新</el-button>
      <span style="color: #999; font-size: 13px">超级管理员仅可创建 / 启停社区管理员与民政管理员账号（超级管理员账号为系统内置，无创建入口）</span>
    </div>

    <div class="page-card">
      <el-table :data="list" stripe :header-cell-style="{ background: '#EBF5F0', color: '#2D7D46', fontWeight: 'bold' }">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="name" label="姓名" width="140" />
        <el-table-column prop="phone" label="账号（手机号）" width="160" />
        <el-table-column label="角色" width="120">
          <template #default="{ row }">
            <el-tag :type="row.role === '管理员' ? 'danger' : 'warning'">{{ row.role }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 0 ? 'danger' : 'success'">{{ row.status === 0 ? '已禁用' : '正常' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" min-width="140" />
        <el-table-column label="启停" width="110" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status !== 0" size="small" type="danger" plain @click="onToggleStatus(row, 0)">禁用</el-button>
            <el-button v-else size="small" type="success" plain @click="onToggleStatus(row, 1)">启用</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 新建管理员账号 -->
    <el-dialog v-model="createVisible" title="新建管理员账号" width="440px">
      <el-form label-width="90px">
        <el-form-item label="姓名"><el-input v-model="createForm.name" placeholder="请输入姓名" /></el-form-item>
        <el-form-item label="手机号"><el-input v-model="createForm.phone" placeholder="登录账号，请输入手机号" maxlength="11" /></el-form-item>
        <el-form-item label="初始密码">
          <el-input v-model="createForm.password" placeholder="默认 手机号+hhL.，可修改" show-password />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="createForm.role" placeholder="选择管理员角色" style="width: 100%">
            <el-option label="社区管理员" value="管理员" />
            <el-option label="街道民政管理员" value="民政管理员" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="onCreate">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '../api/request'

const adminRoles = ['管理员', '民政管理员']

const list = ref([])
const createVisible = ref(false)
const createForm = reactive({ name: '', phone: '', password: '', role: '' })

async function load() {
  const users = await request.get('/api/admin/users')
  list.value = users.filter((u) => adminRoles.includes(u.role))
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
  await request.post('/api/admin/accounts', { ...createForm })
  ElMessage.success('管理员账号创建成功')
  createVisible.value = false
  load()
}

async function onToggleStatus(row, status) {
  await ElMessageBox.confirm(
    `确认${status === 1 ? '启用' : '禁用'}「${row.name}」账号？禁用后该账号将无法登录。`,
    '启停确认',
    { type: status === 1 ? 'success' : 'warning', confirmButtonText: status === 1 ? '启用' : '禁用' }
  )
  await request.put(`/api/admin/accounts/${row.id}/status`, { status })
  ElMessage.success(status === 1 ? '账号已启用' : '账号已禁用')
  load()
}

onMounted(load)
</script>
