/**
 * 服务工具函数
 * 提供辅助功能和常用工具方法
 */

/**
 * 合并属性变化
 * @param {Object.<string, number>} current - 当前属性
 * @param {Object.<string, number>} delta - 属性变化
 * @returns {Object.<string, number>} - 合并后的属性
 */
export function mergeAttributes(current = {}, delta = {}) {
  const result = { ...current }

  Object.keys(delta).forEach((key) => {
    const value = delta[key]
    if (typeof value === 'number') {
      result[key] = (result[key] || 0) + value
    }
  })

  return result
}

/**
 * 合并状态变化
 * @param {Object.<string, any>} current - 当前状态
 * @param {Object.<string, any>} delta - 状态变化
 * @returns {Object.<string, any>} - 合并后的状态
 */
export function mergeStatuses(current = {}, delta = {}) {
  const result = { ...current }

  Object.keys(delta).forEach((key) => {
    const value = delta[key]

    // null 或 false 表示删除
    if (value === null || value === false) {
      delete result[key]
    }
    // 数值类型累加
    else if (typeof value === 'number' && typeof result[key] === 'number') {
      result[key] = result[key] + value
    }
    // 其他类型覆盖
    else {
      result[key] = value
    }
  })

  return result
}

/**
 * 格式化时间戳
 * @param {number} timestamp - 时间戳(毫秒)
 * @param {string} format - 格式 ('date', 'time', 'datetime', 'relative')
 * @returns {string} - 格式化后的时间
 */
export function formatTimestamp(timestamp, format = 'datetime') {
  if (!timestamp) return ''

  const date = new Date(timestamp)

  if (format === 'relative') {
    const now = Date.now()
    const diff = now - timestamp

    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 7) return `${days}天前`

    // 超过一周显示日期
    format = 'date'
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  const second = String(date.getSeconds()).padStart(2, '0')

  switch (format) {
    case 'date':
      return `${year}-${month}-${day}`
    case 'time':
      return `${hour}:${minute}:${second}`
    case 'datetime':
    default:
      return `${year}-${month}-${day} ${hour}:${minute}:${second}`
  }
}

/**
 * 节流函数
 * @param {Function} func - 要节流的函数
 * @param {number} wait - 等待时间(毫秒)
 * @returns {Function} - 节流后的函数
 */
export function throttle(func, wait = 300) {
  let timeout = null
  let previous = 0

  return function (...args) {
    const now = Date.now()
    const remaining = wait - (now - previous)

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      previous = now
      func.apply(this, args)
    } else if (!timeout) {
      timeout = setTimeout(() => {
        previous = Date.now()
        timeout = null
        func.apply(this, args)
      }, remaining)
    }
  }
}

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间(毫秒)
 * @returns {Function} - 防抖后的函数
 */
export function debounce(func, wait = 300) {
  let timeout = null

  return function (...args) {
    if (timeout) {
      clearTimeout(timeout)
    }

    timeout = setTimeout(() => {
      func.apply(this, args)
    }, wait)
  }
}

/**
 * 深拷贝对象
 * @param {*} obj - 要拷贝的对象
 * @returns {*} - 拷贝后的对象
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime())
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item))
  }

  if (obj instanceof Object) {
    const cloned = {}
    Object.keys(obj).forEach((key) => {
      cloned[key] = deepClone(obj[key])
    })
    return cloned
  }

  return obj
}

/**
 * 生成唯一 ID
 * @param {string} prefix - ID 前缀
 * @returns {string} - 唯一 ID
 */
export function generateId(prefix = 'id') {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 9)
  return `${prefix}_${timestamp}_${random}`
}

/**
 * 验证对象是否包含必需字段
 * @param {Object} obj - 要验证的对象
 * @param {string[]} requiredFields - 必需字段数组
 * @returns {boolean} - 是否有效
 */
export function validateRequired(obj, requiredFields) {
  if (!obj || typeof obj !== 'object') {
    return false
  }

  return requiredFields.every((field) => {
    return obj[field] !== undefined && obj[field] !== null && obj[field] !== ''
  })
}

/**
 * 构建查询参数字符串
 * @param {Object} params - 参数对象
 * @returns {string} - 查询参数字符串
 */
export function buildQueryString(params = {}) {
  const pairs = []

  Object.keys(params).forEach((key) => {
    const value = params[key]
    if (value !== undefined && value !== null && value !== '') {
      pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    }
  })

  return pairs.length > 0 ? `?${pairs.join('&')}` : ''
}

/**
 * 解析查询参数字符串
 * @param {string} queryString - 查询参数字符串
 * @returns {Object} - 参数对象
 */
export function parseQueryString(queryString = '') {
  const params = {}

  if (!queryString) return params

  const search = queryString.startsWith('?') ? queryString.slice(1) : queryString
  const pairs = search.split('&')

  pairs.forEach((pair) => {
    const [key, value] = pair.split('=')
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(value || '')
    }
  })

  return params
}

/**
 * 获取文件扩展名
 * @param {string} filename - 文件名
 * @returns {string} - 扩展名(小写,不含点)
 */
export function getFileExtension(filename) {
  if (!filename) return ''

  const parts = filename.split('.')
  if (parts.length < 2) return ''

  return parts[parts.length - 1].toLowerCase()
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @param {number} decimals - 小数位数
 * @returns {string} - 格式化后的大小
 */
export function formatFileSize(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i]
}

/**
 * 检查是否为移动设备
 * @returns {boolean} - 是否为移动设备
 */
export function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

/**
 * 本地存储工具
 */
export const storage = {
  /**
   * 设置存储项
   */
  set(key, value) {
    try {
      const data = JSON.stringify(value)
      localStorage.setItem(key, data)
      return true
    } catch (error) {
      console.error('Storage set failed:', error)
      return false
    }
  },

  /**
   * 获取存储项
   */
  get(key, defaultValue = null) {
    try {
      const data = localStorage.getItem(key)
      return data ? JSON.parse(data) : defaultValue
    } catch (error) {
      console.error('Storage get failed:', error)
      return defaultValue
    }
  },

  /**
   * 删除存储项
   */
  remove(key) {
    try {
      localStorage.removeItem(key)
      return true
    } catch (error) {
      console.error('Storage remove failed:', error)
      return false
    }
  },

  /**
   * 清空存储
   */
  clear() {
    try {
      localStorage.clear()
      return true
    } catch (error) {
      console.error('Storage clear failed:', error)
      return false
    }
  }
}

// 默认导出
export default {
  mergeAttributes,
  mergeStatuses,
  formatTimestamp,
  throttle,
  debounce,
  deepClone,
  generateId,
  validateRequired,
  buildQueryString,
  parseQueryString,
  getFileExtension,
  formatFileSize,
  isMobile,
  storage
}
