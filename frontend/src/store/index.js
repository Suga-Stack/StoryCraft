import { createPinia } from 'pinia'
import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null, // 登录后从后端获取的用户信息
    isLoggedIn: false, // 登录状态标记
    preferences: null // 用户偏好（从后端获取）
  }),
  actions: {
    // 登录成功后保存用户信息
    setLoginUser(userData) {
      this.user = userData
      this.isLoggedIn = true
    },
    // 退出登录时清空状态
    logout() {
      this.user = null
      this.isLoggedIn = false
      localStorage.removeItem('token') // 清除token
    },
    // 更新用户偏好
    setPreferences(prefs) {
      this.preferences = prefs
    }
  }
})

// 故事/作品状态（仅存储当前会话所需数据）
export const useStoryStore = defineStore('story', {
  state: () => ({
    currentStory: null, // 当前阅读的故事
    bookshelf: [] // 书架数据（从后端获取）
  }),
  actions: {
    setCurrentStory(story) {
      this.currentStory = story
    },
    setBookshelf(data) {
      this.bookshelf = data
    }
  }
})

export const store = createPinia()