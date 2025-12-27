import { createPinia } from 'pinia'
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getUserInfo } from '../api/user'

export const useUserStore = defineStore('user', () => {
  const user = ref(null)
  const isLoggedIn = ref(false)
  const token = ref(localStorage.getItem('token') || '')
  const refreshToken = ref(localStorage.getItem('refreshToken') || '')
  const preferences = ref(JSON.parse(localStorage.getItem('userPreferences')) || null)

  // ========== 初始化逻辑 ==========
  if (token.value) {
    isLoggedIn.value = true
  }

  // ========== 计算属性 ==========
  const userInfo = computed(() => user.value)
  const isAuthenticated = computed(() => isLoggedIn.value && !!token.value)

  // ========== 方法定义==========
  // 1. 登录方法
  const login = (userData, authToken) => {
    user.value = userData
    token.value = authToken
    isLoggedIn.value = true
    localStorage.setItem('token', authToken)

    if (userData.preferences) {
      setPreferences(userData.preferences)
    }
  }

  // 2. 退出登录方法
  const logout = () => {
    user.value = null
    token.value = ''
    isLoggedIn.value = false
    preferences.value = null // 清空偏好
    localStorage.removeItem('token')
    localStorage.removeItem('userPreferences') // 清除偏好持久化
    refreshToken.value = ''
    localStorage.removeItem('refreshToken')
  }

  // 3. 更新用户信息
  const updateUser = (userData) => {
    user.value = { ...user.value, ...userData }
  }

  // 4. 设置用户偏好
  const setPreferences = (prefs) => {
    // 合并新旧偏好
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
      refreshToken.value = ''
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

  const fetchUserInfo = async (userId) => {
    try {
      // 调用用户信息API
      const response = await getUserInfo(userId)

      // 检查业务状态码
      if (response.data.code && response.data.code !== 200) {
        throw new Error(`业务错误: ${response.data.message || '获取用户信息失败'}`)
      }

      // 更新Pinia中的用户信息
      user.value = response.data

      // 同步更新localStorage缓存
      localStorage.setItem('userInfo', JSON.stringify(response.data))

      return response.data
    } catch (error) {
      const errorMsg = `获取用户信息失败: ${error.message}`
      console.error(errorMsg)
      // 可以根据需要添加错误提示逻辑
      throw error // 抛出错误让调用方处理
    }
  }

  // ========== 暴露状态和方法 ==========
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
    setAuthenticated,
    fetchUserInfo
  }
})

// 故事/作品状态 Store
export const useStoryStore = defineStore('story', {
  state: () => ({
    currentStory: null, // 当前阅读的故事
    bookshelf: [] // 书架数据
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

// 导出 Pinia 实例
export const store = createPinia()
