/**
 * HTTP 客户端配置
 * 基于 fetch API 实现的轻量级 HTTP 客户端
 */

// 获取后端 API 基础 URL
const getBaseURL = () => {
  // 可以从环境变量或配置文件获取
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }
  // 开发环境默认使用本地后端（Django runserver 默认端口 8000）
  return import.meta.env.DEV ? 'http://localhost:8000' : '/api'
}

const BASE_URL = getBaseURL()

/**
 * 获取认证 Token
 */
function getAuthToken() {
  // 优先从 window 对象获取注入的 token
  if (window.__STORYCRAFT_AUTH_TOKEN__) {
    return window.__STORYCRAFT_AUTH_TOKEN__
  }
  // 其次从 localStorage 获取
  return localStorage.getItem('auth_token')
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
  }

  /**
   * 构建完整 URL
   */
  buildURL(endpoint, params = {}) {
    const url = new URL(endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`)
    
    // 添加查询参数
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.append(key, params[key])
      }
    })
    
    return url.toString()
  }

  /**
   * 构建请求头
   */
  buildHeaders(customHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...customHeaders
    }

    // 添加认证 token
    const token = getAuthToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    // 如果没有提供 Authorization（例如使用 session auth），则尝试添加 CSRF token
    // 这有助于通过 Django 的 SessionAuthentication 的 CSRF 校验（开发/本地测试场景）
    if (!headers['Authorization']) {
      const csrf = getCSRFToken()
      if (csrf) {
        headers['X-CSRFToken'] = csrf
      }
    }

    return headers
  }

  /**
   * 处理响应
   */
  async handleResponse(response) {
    // 处理 204 No Content
    if (response.status === 204) {
      return null
    }

    const contentType = response.headers.get('content-type')
    const isJSON = contentType && contentType.includes('application/json')

    if (!response.ok) {
      const error = new Error(response.statusText || 'Request failed')
      error.status = response.status
      
      if (isJSON) {
        try {
          error.data = await response.json()
        } catch (e) {
          // JSON 解析失败,忽略
        }
      }
      
      throw error
    }

    return isJSON ? response.json() : response.text()
  }

  /**
   * GET 请求
   */
  async get(endpoint, params = {}, options = {}) {
    const url = this.buildURL(endpoint, params)
    const headers = this.buildHeaders(options.headers)

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        // 在本地开发或跨域代理场景下需要携带 cookie（session）以通过 CSRF 校验
        credentials: 'include',
        ...options
      })
      return await this.handleResponse(response)
    } catch (error) {
      console.error('GET request failed:', endpoint, error)
      throw error
    }
  }

  /**
   * POST 请求
   */
  async post(endpoint, data = {}, options = {}) {
    const url = this.buildURL(endpoint)
    const headers = this.buildHeaders(options.headers)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
        credentials: 'include',
        ...options
      })
      return await this.handleResponse(response)
    } catch (error) {
      console.error('POST request failed:', endpoint, error)
      throw error
    }
  }

  /**
   * PUT 请求
   */
  async put(endpoint, data = {}, options = {}) {
    const url = this.buildURL(endpoint)
    const headers = this.buildHeaders(options.headers)

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
        credentials: 'include',
        ...options
      })
      return await this.handleResponse(response)
    } catch (error) {
      console.error('PUT request failed:', endpoint, error)
      throw error
    }
  }

  /**
   * DELETE 请求
   */
  async delete(endpoint, options = {}) {
    const url = this.buildURL(endpoint)
    const headers = this.buildHeaders(options.headers)

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers,
        credentials: 'include',
        ...options
      })
      return await this.handleResponse(response)
    } catch (error) {
      console.error('DELETE request failed:', endpoint, error)
      throw error
    }
  }

  /**
   * PATCH 请求
   */
  async patch(endpoint, data = {}, options = {}) {
    const url = this.buildURL(endpoint)
    const headers = this.buildHeaders(options.headers)

    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
        credentials: 'include',
        ...options
      })
      return await this.handleResponse(response)
    } catch (error) {
      console.error('PATCH request failed:', endpoint, error)
      throw error
    }
  }
}

// 导出单例实例
export const http = new HttpClient(BASE_URL)

// 导出类供自定义实例化
export default HttpClient
