/**
 * HTTP 客户端配置
 * 基于 axios 实现的 HTTP 客户端
 */

import axios from 'axios'

// 检测是否在 Capacitor 应用中
const isCapacitor = () => {
  return window.Capacitor !== undefined
}

// 获取后端 API 基础 URL
const getBaseURL = () => {
  // 优先使用环境变量
  if (import.meta.env.VITE_API_BASE_URL) {
    const url = import.meta.env.VITE_API_BASE_URL
    console.log('[getBaseURL] 使用环境变量 VITE_API_BASE_URL:', url)
    return url
  }
  
  // 在 Capacitor Android 应用中,默认使用远程服务器
  // (因为 10.0.2.2 只能在模拟器中访问宿主机,真机需要实际 IP)
  if (isCapacitor()) {
    console.log('[getBaseURL] Capacitor 环境,使用远程服务器')
    return 'https://storycraft.work.gd'
  }
  
  // 浏览器环境:默认使用远程服务器地址
  console.log('[getBaseURL] 浏览器环境,使用远程服务器')
  return 'https://storycraft.work.gd'
}

const BASE_URL = getBaseURL()
console.log('[HTTP Client] 初始化,BASE_URL:', BASE_URL)

/**
 * 获取认证 Token
 */
function getAuthToken() {
  // 优先从 window 对象获取注入的 token
  if (window.__STORYCRAFT_AUTH_TOKEN__) {
    console.log('[getAuthToken] 使用 window.__STORYCRAFT_AUTH_TOKEN__:', window.__STORYCRAFT_AUTH_TOKEN__)
    return window.__STORYCRAFT_AUTH_TOKEN__
  }
  // 从 localStorage 获取（统一使用 'token' 作为 key）
  const token = localStorage.getItem('token')
  console.log('[getAuthToken] 从 localStorage 读取 token:', token ? '存在(' + token.substring(0, 20) + '...)' : '不存在')
  return token
}

/**
 * 从 cookie 中读取值
 */
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : null
}

/**
 * 获取 CSRF token（Django 默认 cookie 名称为 csrftoken）
 */
function getCSRFToken() {
  return getCookie('csrftoken') || getCookie('CSRF-TOKEN') || null
}

/**
 * 获取用户 ID
 */
export function getUserId() {
  // 优先从 window 对象获取注入的 userId
  if (window.__STORYCRAFT_USER__?.id) {
    return window.__STORYCRAFT_USER__.id
  }
  // 从 localStorage 获取
  let userId = localStorage.getItem('user_id')
  if (!userId) {
    // 生成匿名 ID（仅用于本地调试）
    userId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem('user_id', userId)
  }
  return userId
}

/**
 * HTTP 请求配置
 */
class HttpClient {
  constructor(baseURL) {
    this.baseURL = baseURL
    this.axiosInstance = axios.create({
      baseURL: baseURL,
      timeout: 30000,
      withCredentials: false, // 允许跨域携带凭证
      headers: {
        'Content-Type': 'application/json'
      }
    })

    // 请求拦截器：添加 Token 和 CSRF
    this.axiosInstance.interceptors.request.use(
      (config) => {
        console.log(`[HTTP] ${config.method?.toUpperCase()} ${config.url}`, {
          params: config.params,
          data: config.data
        })

        // 添加认证 token
        const token = getAuthToken()
        if (token) {
          config.headers['Authorization'] = `Bearer ${token}`
          console.log('[HTTP] 已添加 Authorization header')
        } else {
          console.warn('[HTTP] 未找到 token，请求可能会被拒绝')
        }

        // 如果没有 Authorization，尝试添加 CSRF token
        if (!config.headers['Authorization']) {
          const csrf = getCSRFToken()
          if (csrf) {
            config.headers['X-CSRFToken'] = csrf
          }
        }

        return config
      },
      (error) => {
        console.error('[HTTP] 请求配置错误:', error)
        return Promise.reject(error)
      }
    )

    // 响应拦截器：处理响应和错误
    this.axiosInstance.interceptors.response.use(
      (response) => {
        console.log(`[HTTP] 响应成功:`, {
          status: response.status,
          url: response.config.url,
          data: response.data
        })
        // axios 自动处理 JSON，直接返回 data
        return response.data
      },
      async (error) => {
        console.error('[HTTP] 请求失败:', {
          message: error.message,
          code: error.code,
          url: error.config?.url,
          status: error.response?.status,
          statusText: error.response?.statusText,
          responseData: error.response?.data
        })

        // 统一错误格式
        const customError = new Error(error.response?.statusText || error.message || 'Request failed')
        customError.status = error.response?.status
        customError.data = error.response?.data
        customError.code = error.code

        throw customError
      }
    )
  }

  /**
   * GET 请求
   */
  async get(endpoint, params = {}, options = {}) {
    return await this.axiosInstance.get(endpoint, {
      params,
      ...options
    })
  }

  /**
   * POST 请求
   */
  async post(endpoint, data = {}, options = {}) {
    return await this.axiosInstance.post(endpoint, data, options)
  }

  /**
   * PUT 请求
   */
  async put(endpoint, data = {}, options = {}) {
    return await this.axiosInstance.put(endpoint, data, options)
  }

  /**
   * DELETE 请求
   */
  async delete(endpoint, options = {}) {
    return await this.axiosInstance.delete(endpoint, options)
  }

  /**
   * PATCH 请求
   */
  async patch(endpoint, data = {}, options = {}) {
    return await this.axiosInstance.patch(endpoint, data, options)
  }
}

// 导出单例实例
export const http = new HttpClient(BASE_URL)

// 导出类供自定义实例化
export default HttpClient
