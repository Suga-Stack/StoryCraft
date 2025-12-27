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



// 设置状态栏样式
if (Capacitor.getPlatform() === 'android') {
  let startX = 0
  let startY = 0
  let tracking = false
  let moved = false
  let isEdge = false

  // 边缘判定宽度(px)
  const EDGE_WIDTH = 32
  // 滑动触发距离
  const threshold = 60
  // 垂直/水平容忍度
  const tolerance = 40

  function isPortrait() {
    return window.innerHeight >= window.innerWidth
  }

  const onTouchStart = (e) => {
    const t = e.touches && e.touches[0]
    if (!t) return
    startX = t.clientX
    startY = t.clientY
    moved = false
    tracking = false
    isEdge = false

    if (isPortrait()) {
      // 竖屏：左右边缘
      if (startX <= EDGE_WIDTH || startX >= window.innerWidth - EDGE_WIDTH) {
        isEdge = true
        tracking = true
      }
    } else {
      // 横屏：上下边缘
      if (startY <= EDGE_WIDTH || startY >= window.innerHeight - EDGE_WIDTH) {
        isEdge = true
        tracking = true
      }
    }
  }

  const onTouchMove = (e) => {
    if (!tracking || !isEdge) return
    const t = e.touches && e.touches[0]
    if (!t) return
    if (isPortrait()) {
      // 竖屏：左右滑
      const dx = t.clientX - startX
      const dy = Math.abs(t.clientY - startY)
      if (Math.abs(dx) > threshold && dy < tolerance) {
        moved = true
      }
    } else {
      // 横屏：上下滑
      const dy = t.clientY - startY
      const dx = Math.abs(t.clientX - startX)
      if (Math.abs(dy) > threshold && dx < tolerance) {
        moved = true
      }
    }
  }

  const onTouchEnd = () => {
    if (!tracking || !isEdge) return
    tracking = false
    if (moved) {
      const route = router.currentRoute.value
      if (route && route.meta && route.meta.disableSwipeBack) {
        return
      }
      router.back()
    }
  }

  document.addEventListener('touchstart', onTouchStart, { passive: true })
  document.addEventListener('touchmove', onTouchMove, { passive: true })
  document.addEventListener('touchend', onTouchEnd, { passive: true })
}

