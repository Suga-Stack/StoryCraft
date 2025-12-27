import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig(({ mode }) => {
  // 根据模式加载环境变量
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [vue()], // 注册插件
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    // 根据环境变量定义全局常量(可在前端代码中访问)
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(env.VITE_API_BASE_URL),
      'import.meta.env.VITE_WS_BASE_URL': JSON.stringify(env.VITE_WS_BASE_URL),
      'import.meta.env.VITE_USE_MOCK': JSON.stringify(env.VITE_USE_MOCK),
      'import.meta.env.VITE_DEBUG': JSON.stringify(env.VITE_DEBUG)
    },
    server: {
      host: '0.0.0.0', // 允许局域网访问(调试时用)
      port: 5173,
      // 开发模式下代理 /api 到后端 Django runserver (8000),避免浏览器 CORS 问题
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'https://storycraft.work.gd',
          changeOrigin: true,
          secure: false,
          // 不需要 rewrite,因为 Django 的 URL 已经包含 /api 前缀
          // rewrite: (path) => path // 保持原路径不变
        }
        ,
        // 开发时代理媒体文件（音频/图片）到远端后端，避免浏览器 CORS 限制
        '/media': {
          target: env.VITE_API_BASE_URL || 'https://storycraft.work.gd',
          changeOrigin: true,
          secure: true,
          // 保持路径不变，使 /media/xxx 可以直接转发到远端
        }
      }
    },
    preview: {
      port: 5173
    },
    build: {
      // 确保构建时包含必要的 polyfills
      target: 'es2015',
      rollupOptions: {
        output: {
          manualChunks: {
            'vue-vendor': ['vue', 'vue-router', 'pinia'],
            'vant': ['vant']
          }
        }
      }
    }
  }
})
   
