import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()], // 注册插件
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',  // 后端地址
        changeOrigin: true
      }
    }
  }
});
