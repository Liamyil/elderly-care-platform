import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '../router'

// 统一请求封装：与后端 {code, message, data} 响应结构对接
const request = axios.create({ baseURL: '', timeout: 15000 })

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token')
  if (token) {
    config.headers.Authorization = token
  }
  return config
})

request.interceptors.response.use(
  (res) => {
    const data = res.data
    if (data.code === 0) {
      return data.data
    }
    if (data.code === 401) {
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_user')
      router.push('/login')
    }
    // silent 静默请求（如轮询）失败不弹错误提示，避免打扰操作
    if (!res.config.silent) {
      ElMessage.error(data.message || '请求失败')
    }
    return Promise.reject(new Error(data.message || '请求失败'))
  },
  (err) => {
    if (!err.config || !err.config.silent) {
      ElMessage.error('网络连接异常')
    }
    return Promise.reject(err)
  }
)

export default request
