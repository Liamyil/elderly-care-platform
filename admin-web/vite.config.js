import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 开发服务器配置：接口代理到本机后端 3000 端口
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    // 放行内网穿透域名（周总外网演示用），localhost 默认放行
    allowedHosts: ['.trycloudflare.com', '.cpolar.top', '.cpolar.cn'],
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3000', changeOrigin: true }
    }
  }
})
