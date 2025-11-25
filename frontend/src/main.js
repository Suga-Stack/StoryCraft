import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from './router'
import Vant from 'vant'
import 'vant/lib/index.css'
import { useUserStore } from '../src/store/index' // 用户状态 Store
import { useCheckInStore } from '../src/store/checkIn' // 签到状态 Store
import http from './utils/http'


const app = createApp(App)
const pinia = createPinia()


app.use(Vant)
app.use(pinia)
app.use(router)

async function initApp() {
  // 从本地存储获取 token
  const token = localStorage.getItem('token')

  if (token) {
    // 有 token，尝试获取用户信息
    const userStore = useUserStore()
    try {
      const storedUser = localStorage.getItem('userInfo');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        await userStore.fetchUserInfo(user.id) 
      }

      // 用户已登录，检查签到状态
      try {
        const response = await http.get('/user/check-in/status/')
        const { has_checked_in } = response.data

        if (!has_checked_in) {
          console.log('用户今日未签到，显示弹窗')
          const checkInStore = useCheckInStore()
          checkInStore.setShowModal(true) // 触发弹窗
        } else {
          console.log('用户今日已签到')
        }
      } catch (checkInError) {
        console.error('检查签到状态失败:', checkInError)
      }

    } catch (authError) {
      // token 无效或过期
      console.log('自动登录失败，token 无效')
      localStorage.removeItem('token')
      userStore.isLoggedIn(false) // 更新用户登录状态
    }
  } else {
    console.log('未找到 token，用户未登录')
  }

  // 5. 所有检查完成后，挂载应用
  app.mount('#app')
}
initApp()