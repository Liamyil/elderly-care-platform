<template>
  <el-container style="height: 100%">
    <el-aside width="200px" style="background: #fff; border-right: 1px solid #eee">
      <div class="brand-bar">🏡 互助养老管理</div>
      <el-menu :default-active="activeMenu" router style="border-right: none">
        <el-menu-item index="/stats">
          <span>📊 数据统计</span>
        </el-menu-item>
        <el-menu-item index="/orders">
          <span>📋 订单管理</span>
        </el-menu-item>
        <el-menu-item index="/users">
          <span>👥 用户管理</span>
        </el-menu-item>
        <el-menu-item v-if="adminRole === '超级管理员'" index="/accounts">
          <span>🛡️ 管理员账号</span>
        </el-menu-item>
        <el-menu-item v-if="adminRole === '管理员'" index="/helper-audit">
          <span>📝 互助员审核</span>
        </el-menu-item>
        <el-menu-item index="/config">
          <span>⚙️ 系统配置与日志</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header style="background: #fff; border-bottom: 1px solid #eee; display: flex; align-items: center; justify-content: space-between">
        <div style="font-size: 16px; font-weight: bold; color: #2D7D46">社区管理后台</div>
        <div style="display: flex; align-items: center; gap: 12px">
          <span style="color: #666">{{ adminName }}（{{ adminRole }}）</span>
          <el-button size="small" @click="onLogout">退出登录</el-button>
        </div>
      </el-header>
      <el-main style="padding: 0">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const activeMenu = computed(() => route.path)

const adminUser = JSON.parse(localStorage.getItem('admin_user') || '{}')
const adminName = computed(() => adminUser.name || '管理员')
const adminRole = computed(() => adminUser.role || '管理员')

function onLogout() {
  localStorage.removeItem('admin_token')
  localStorage.removeItem('admin_user')
  router.push('/login')
}
</script>
