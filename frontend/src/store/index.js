import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUserStore = defineStore('user', () => {
  // 状态
  const user = ref(null)
  const isLoggedIn = ref(false)
  const token = ref(localStorage.getItem('token') || '')

  // 初始化时检查登录状态
  if (token.value) {
    isLoggedIn.value = true
  }

  // 计算属性
  const userInfo = computed(() => user.value)
  const isAuthenticated = computed(() => isLoggedIn.value && !!token.value)

  // 方法
  const login = (userData, authToken) => {
    user.value = userData
    token.value = authToken
    isLoggedIn.value = true
    localStorage.setItem('token', authToken)
  }

  const logout = () => {
    user.value = null
    token.value = ''
    isLoggedIn.value = false
    localStorage.removeItem('token')
  }

  const updateUser = (userData) => {
    user.value = { ...user.value, ...userData }
  }

  return {
    user,
    isLoggedIn,
    token,
    userInfo,
    isAuthenticated,
    login,
    logout,
    updateUser
  }
})
