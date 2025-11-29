/**
 * 错误处理工具
 * 统一处理 API 错误和异常
 */

/**
 * API 错误类
 */
export class APIError extends Error {
  constructor(message, status, data) {
    super(message)
    this.name = 'APIError'
    this.status = status
    this.data = data
  }
}

/**
 * 错误处理器
 */
export class ErrorHandler {
  /**
   * 处理 API 错误
   * @param {Error} error - 错误对象
   * @param {Object} options - 配置选项
   * @param {boolean} options.showToast - 是否显示提示
   * @param {Function} options.onAuthError - 认证错误回调
   * @param {Function} options.onNetworkError - 网络错误回调
   * @returns {Object} - 格式化的错误信息
   */
  static handle(error, options = {}) {
    const {
      showToast = false,
      onAuthError,
      onNetworkError
    } = options

    let errorMessage = '未知错误'
    let errorType = 'unknown'

    if (error instanceof APIError || error.status) {
      const status = error.status
      
      switch (status) {
        case 400:
          errorMessage = '请求参数错误'
          errorType = 'validation'
          break
        case 401:
          errorMessage = '未登录或登录已过期'
          errorType = 'auth'
          if (onAuthError) onAuthError(error)
          break
        case 403:
          errorMessage = '没有权限访问'
          errorType = 'permission'
          break
        case 404:
          errorMessage = '请求的资源不存在'
          errorType = 'not_found'
          break
        case 409:
          errorMessage = '数据冲突'
          errorType = 'conflict'
          break
        case 422:
          errorMessage = '数据验证失败'
          errorType = 'validation'
          break
        case 429:
          errorMessage = '请求过于频繁,请稍后再试'
          errorType = 'rate_limit'
          break
        case 500:
        case 502:
        case 503:
        case 504:
          errorMessage = '服务器错误,请稍后再试'
          errorType = 'server'
          break
        default:
          errorMessage = error.message || '请求失败'
      }

      // 尝试从响应数据中获取更详细的错误信息
      if (error.data?.message) {
        errorMessage = error.data.message
      }
    } else if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
      errorMessage = '网络连接失败,请检查网络'
      errorType = 'network'
      if (onNetworkError) onNetworkError(error)
    } else {
      errorMessage = error.message || '未知错误'
    }

    const result = {
      message: errorMessage,
      type: errorType,
      original: error
    }

    // 显示提示
    if (showToast) {
      this.showToast(errorMessage, 'error')
    }

    console.error('Error handled:', result)
    return result
  }

  /**
   * 显示提示消息
   * @param {string} message - 消息内容
   * @param {string} type - 消息类型 (success, error, warning, info)
   */
  static showToast(message, type = 'info') {
    // 这里可以集成第三方 toast 库
    // 目前简单使用原生 alert
    console.log(`[${type.toUpperCase()}] ${message}`)
    
    // 如果在移动端环境,可以使用 Capacitor 的 Toast 插件
    if (window.Capacitor?.Plugins?.Toast) {
      window.Capacitor.Plugins.Toast.show({
        text: message,
        duration: 'short',
        position: 'bottom'
      })
    }
  }

  /**
   * 重试函数
   * @param {Function} fn - 要重试的异步函数
   * @param {number} maxRetries - 最大重试次数
   * @param {number} delay - 重试延迟(毫秒)
   * @returns {Promise}
   */
  static async retry(fn, maxRetries = 3, delay = 1000) {
    let lastError
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error
        
        // 如果是认证错误或参数错误,不重试
        if (error.status === 401 || error.status === 400 || error.status === 422) {
          throw error
        }
        
        // 最后一次尝试失败后直接抛出
        if (i === maxRetries - 1) {
          throw error
        }
        
        // 等待后重试
        console.log(`Retry attempt ${i + 1}/${maxRetries} after ${delay}ms`)
        await new Promise(resolve => setTimeout(resolve, delay))
        
        // 指数退避
        delay *= 2
      }
    }
    
    throw lastError
  }
}

// 默认导出
export default ErrorHandler
