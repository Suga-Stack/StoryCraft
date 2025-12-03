/**
 * API 配置文件
 * 集中管理 API 相关的配置项
 */

/**
 * API 端点配置
 */
export const API_ENDPOINTS = {
  // 认证相关
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    LOGOUT: '/api/auth/logout',
    VALIDATE: '/api/auth/validate'
  },
  
  // 用户相关
  USERS: {
    DETAIL: (userId) => `/api/users/${userId}`,
    UPDATE: (userId) => `/api/users/${userId}`,
    PASSWORD: (userId) => `/api/users/${userId}/password`
  },
  
  // 作品相关
  WORKS: {
    LIST: '/api/works',
    DETAIL: (workId) => `/api/works/${workId}`,
    CREATE: '/api/works',
    UPDATE: (workId) => `/api/works/${workId}`,
    DELETE: (workId) => `/api/works/${workId}`
  },
  
  // 故事相关
  STORY: {
    INIT: (workId) => `/api/story/${workId}/init`,
    NEXT: (workId) => `/api/story/${workId}/next`,
    CHOICE: (workId) => `/api/story/${workId}/choice`,
    STREAM: (workId) => `/api/story/${workId}/stream`,
    WS: (workId) => `/api/story/${workId}/ws`
  },
  
  // 存档相关
  SAVES: {
    LIST: (userId, workId) => `/api/users/${userId}/saves/${workId}`,
    DETAIL: (userId, workId, slot) => `/api/users/${userId}/saves/${workId}/${slot}`,
    SAVE: (userId, workId, slot) => `/api/users/${userId}/saves/${workId}/${slot}`,
    DELETE: (userId, workId, slot) => `/api/users/${userId}/saves/${workId}/${slot}`
  }
}

/**
 * 存档槽位配置
 */
export const SAVE_SLOTS = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6']

/**
 * 自动存档槽位
 */
export const AUTO_SAVE_SLOT = 'slot6'

/**
 * HTTP 配置
 */
export const HTTP_CONFIG = {
  // 请求超时时间(毫秒)
  TIMEOUT: 30000,
  
  // 重试配置
  RETRY: {
    MAX_RETRIES: 3,
    INITIAL_DELAY: 1000,
    MAX_DELAY: 10000
  },
  
  // 响应拦截
  INTERCEPT_RESPONSE: true
}

/**
 * SSE 配置
 */
export const SSE_CONFIG = {
  // 重连延迟(毫秒)
  RECONNECT_DELAY: 5000,
  
  // 最大重连次数
  MAX_RECONNECT_ATTEMPTS: 10,
  
  // 心跳间隔(毫秒)
  HEARTBEAT_INTERVAL: 30000
}

/**
 * WebSocket 配置
 */
export const WS_CONFIG = {
  // 重连延迟(毫秒)
  RECONNECT_DELAY: 3000,
  
  // 最大重连次数
  MAX_RECONNECT_ATTEMPTS: 10,
  
  // 心跳间隔(毫秒)
  HEARTBEAT_INTERVAL: 30000,
  
  // 心跳消息
  HEARTBEAT_MESSAGE: { type: 'ping' }
}

/**
 * 缓存配置
 */
export const CACHE_CONFIG = {
  // 是否启用缓存
  ENABLED: true,
  
  // 缓存过期时间(毫秒)
  TTL: {
    USER_INFO: 5 * 60 * 1000,      // 5分钟
    WORK_LIST: 10 * 60 * 1000,      // 10分钟
    WORK_DETAIL: 30 * 60 * 1000     // 30分钟
  }
}

/**
 * 环境配置
 */
export const ENV_CONFIG = {
  // 是否为开发环境
  IS_DEV: import.meta.env.DEV,
  
  // 是否为生产环境
  IS_PROD: import.meta.env.PROD,
  
  // API 基础 URL
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/',
  
  // WebSocket 基础 URL
  WS_BASE_URL: import.meta.env.VITE_WS_BASE_URL || 'ws://storycraft.work.gd',
  
  // 是否启用 Mock
  USE_MOCK: import.meta.env.VITE_USE_MOCK === 'true'
}

// 导出默认配置对象
export default {
  API_ENDPOINTS,
  SAVE_SLOTS,
  AUTO_SAVE_SLOT,
  HTTP_CONFIG,
  SSE_CONFIG,
  WS_CONFIG,
  CACHE_CONFIG,
  ENV_CONFIG
}
