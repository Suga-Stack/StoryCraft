import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // 添加以下配置
  base: './', // 使用相对路径，Capacitor 必需
  server: {
    host: '0.0.0.0', // 允许局域网访问（调试时用）
    port: 5173
  }
})