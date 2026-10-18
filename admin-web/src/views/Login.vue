<template>
  <div class="login-bg">
    <el-card class="login-card">
      <div class="login-title">智慧互助养老平台</div>
      <div class="login-sub">社区管理后台</div>
      <el-form :model="form" @keyup.enter="onLogin">
        <el-form-item>
          <el-input v-model="form.account" placeholder="管理账号（手机号）" size="large">
            <template #prefix>👤</template>
          </el-input>
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" type="password" placeholder="密码" size="large" show-password>
            <template #prefix>🔒</template>
          </el-input>
        </el-form-item>
        <el-button type="primary" size="large" class="login-btn" :loading="loading" @click="onLogin">
          登 录
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import request from '../api/request'

const router = useRouter()
const loading = ref(false)
const form = reactive({ account: '', password: '' })

async function onLogin() {
  if (!form.account.trim() || !form.password.trim()) {
    ElMessage.warning('请输入账号和密码')
    return
  }
  loading.value = true
  try {
    const data = await request.post('/api/user/login', {
      account: form.account.trim(),
      password: form.password,
      loginType: 'account'
    })
    if (!data.user || !['管理员', '民政管理员', '超级管理员'].includes(data.user.role)) {
      ElMessage.error('该账号不是管理角色，无法登录后台')
      return
    }
    localStorage.setItem('admin_token', data.token)
    localStorage.setItem('admin_user', JSON.stringify(data.user))
    ElMessage.success('登录成功')
    router.push('/orders')
  } catch (e) {
    // 错误提示已由请求封装处理
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-card {
  width: 400px;
  border-radius: 16px;
  padding: 10px 20px 20px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
}

.login-title {
  font-size: 22px;
  font-weight: bold;
  color: #2D7D46;
  text-align: center;
  margin-top: 8px;
}

.login-sub {
  font-size: 14px;
  color: #999;
  text-align: center;
  margin: 6px 0 24px;
}

.login-btn {
  width: 100%;
}
</style>
