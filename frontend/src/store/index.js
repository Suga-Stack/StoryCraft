import { createPinia } from 'pinia'
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'


export const useUserStore = defineStore('user', () => {
  const user = ref(null)
  const isLoggedIn = ref(false)
  const token = ref(localStorage.getItem('token') || '')
  const refreshToken = ref(localStorage.getItem('refreshToken') || '')
  const preferences = ref(
    JSON.parse(localStorage.getItem('userPreferences')) || null
  )

  // ========== 初始化逻辑（来自组合式API文件）==========
  if (token.value) {
    isLoggedIn.value = true
  }

  // ========== 计算属性（来自组合式API文件）==========
  const userInfo = computed(() => user.value)
  const isAuthenticated = computed(() => isLoggedIn.value && !!token.value)

  // ========== 方法定义（合并两个文件的方法，去重优化）==========
  // 1. 登录方法（来自组合式API，保留token持久化）
  const login = (userData, authToken) => {
    user.value = userData
    token.value = authToken
    isLoggedIn.value = true
    localStorage.setItem('token', authToken)

    // 新增：如果后端返回用户偏好，同步到本地（兼容选项式API的后端获取逻辑）
    if (userData.preferences) {
      setPreferences(userData.preferences)
    }
  }

  // 2. 退出登录方法（合并两个文件的逻辑：清空用户+token+偏好）
  const logout = () => {
    user.value = null
    token.value = ''
    isLoggedIn.value = false
    preferences.value = null // 清空偏好（可根据需求保留，注释即可）
    localStorage.removeItem('token')
    localStorage.removeItem('userPreferences') // 清除偏好持久化
    refreshToken.value = '' // 新增：清空刷新令牌
    localStorage.removeItem('refreshToken') // 新增：清除刷新令牌持久化
  }

  // 3. 更新用户信息（来自组合式API，保留合并逻辑）
  const updateUser = (userData) => {
    user.value = { ...user.value, ...userData }
  }

  // 4. 设置用户偏好（来自选项式API，优化合并逻辑+持久化）
  const setPreferences = (prefs) => {
    // 合并新旧偏好（避免覆盖未修改字段）
    preferences.value = { ...preferences.value, ...prefs }
    // 持久化到localStorage，防止刷新丢失
    localStorage.setItem('userPreferences', JSON.stringify(preferences.value))
  }

   const setAuthenticated = (status) => {
    isLoggedIn.value = status
    // 如果设置为未认证，同步清空token
    if (!status) {
      token.value = ''
      localStorage.removeItem('token')
      refreshToken.value = '' // 新增：同步清空刷新令牌
      localStorage.removeItem('refreshToken')
    }
  }

    const handleLoginSuccess = (userData, tokens) => {
    try {
      // 处理用户信息存储
      if (userData && typeof userData === 'object' && !Array.isArray(userData)) {
        localStorage.setItem('userInfo', JSON.stringify(userData))
        user.value = userData // 直接更新用户信息
      } else {
        console.warn('用户信息格式无效，存储空对象')
        localStorage.setItem('userInfo', '{}')
        user.value = {}
      }
    } catch (stringifyError) {
      console.error('用户信息序列化失败:', stringifyError)
      localStorage.setItem('userInfo', '{}')
      user.value = {}
    }

    // 处理令牌存储
    token.value = tokens.access
    localStorage.setItem('token', tokens.access)
    
    // 处理刷新令牌
    if (tokens.refresh) {
      refreshToken.value = tokens.refresh
      localStorage.setItem('refreshToken', tokens.refresh)
    } else {
      console.warn('未获取到刷新令牌，可能导致会话持续问题')
    }

    // 设置认证状态
    isLoggedIn.value = true
  }

  // ========== 暴露状态和方法（供组件使用）==========
  return {
    user,
    isLoggedIn,
    handleLoginSuccess,
    token,
    preferences, // 暴露偏好状态
    userInfo,
    isAuthenticated,
    login,
    logout,
    updateUser,
    setPreferences, // 暴露偏好设置方法
    setAuthenticated
  }
})

// 2. 故事/作品状态 Store（直接保留选项式API文件的逻辑，无需修改）
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

// 3. 导出 Pinia 实例（供 main.js 注册）
export const store = createPinia()