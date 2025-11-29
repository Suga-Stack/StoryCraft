import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()], // 注册插件
  server: {
    host: '0.0.0.0', // 允许局域网访问(调试时用)
    port: 5173,
    // 开发模式下代理 /api 到后端 Django runserver (8000),避免浏览器 CORS 问题
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        // 不需要 rewrite,因为 Django 的 URL 已经包含 /api 前缀
        // rewrite: (path) => path // 保持原路径不变
      }
    }
  },
  // 开发模式下代理 /api 到后端 Django runserver (8000)，避免浏览器 CORS 问题
  // 若你已在环境变量中配置 VITE_API_BASE_URL 可跳过
  preview: {
    port: 5173
  },
  // 你可以在此处扩展其他代理规则（例如 WebSocket 或特殊路径）
})
   
