import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from './router'
import Vant from 'vant'
import 'vant/lib/index.css'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

const app = createApp(App)
const pinia = createPinia()


app.use(Vant)
app.use(pinia)
app.use(router)
app.mount('#app')


// Android 平台添加右滑返回的简单触摸手势
if (Capacitor.getPlatform() === 'android') {
  let startX = 0
  let startY = 0
  let tracking = false
  let moved = false

  const thresholdX = 60 // 触发返回的最小水平距离
  const thresholdY = 40 // 垂直容忍度，避免竖向滑动误触

  const onTouchStart = (e) => {
    const t = e.touches && e.touches[0]
    if (!t) return
    startX = t.clientX
    startY = t.clientY
    tracking = true
    moved = false
  }

  const onTouchMove = (e) => {
    if (!tracking) return
    const t = e.touches && e.touches[0]
    if (!t) return
    const dx = t.clientX - startX
    const dy = Math.abs(t.clientY - startY)
    // 记录是否达到返回阈值
    if (dx > thresholdX && dy < thresholdY) {
      moved = true
    }
  }

  const onTouchEnd = () => {
    if (!tracking) return
    tracking = false
    if (moved) {
      // 避免在根页面误触发
      const route = router.currentRoute.value
      if (route && route.meta && route.meta.disableSwipeBack) {
        return
      }
      // 如果有历史栈，执行返回
      router.back()
    }
  }

  // 监听整个文档，保持简单
  document.addEventListener('touchstart', onTouchStart, { passive: true })
  document.addEventListener('touchmove', onTouchMove, { passive: true })
  document.addEventListener('touchend', onTouchEnd, { passive: true })
}

