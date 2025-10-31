/**
 * 流式数据服务 API
 * 处理 SSE (Server-Sent Events) 或 WebSocket 等流式数据传输
 */

import { getUserId } from './http.js'

/**
 * 创建 SSE 连接
 * @param {string|number} workId - 作品 ID
 * @param {Object} options - 配置选项
 * @param {number} options.resumeAfterSeq - 从指定序号后恢复
 * @param {Function} options.onMessage - 消息回调
 * @param {Function} options.onError - 错误回调
 * @param {Function} options.onOpen - 连接打开回调
 * @param {Function} options.onClose - 连接关闭回调
 * @returns {Object} - 返回控制对象 { close, reconnect }
 */
export function createSSEConnection(workId, options = {}) {
  const {
    resumeAfterSeq,
    onMessage,
    onError,
    onOpen,
    onClose
  } = options

  const userId = getUserId()
  const baseURL = import.meta.env.VITE_API_BASE_URL || 
                  (import.meta.env.DEV ? 'http://localhost:8000' : '')
  
  // 构建 SSE URL
  let url = `${baseURL}/api/story/${workId}/stream?userId=${userId}`
  if (resumeAfterSeq !== undefined) {
    url += `&resumeAfterSeq=${resumeAfterSeq}`
  }

  let eventSource = null
  let isClosed = false
  let reconnectTimer = null
  let lastSeq = resumeAfterSeq || 0

  function connect() {
    if (isClosed) return

    try {
      eventSource = new EventSource(url)

      eventSource.onopen = () => {
        console.log('SSE connection opened for work:', workId)
        if (onOpen) onOpen()
      }

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          // 更新最后接收的序号
          if (data.seq !== undefined) {
            lastSeq = data.seq
          }
          
          if (onMessage) onMessage(data)
        } catch (error) {
          console.error('Failed to parse SSE message:', error)
        }
      }

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error)
        
        if (onError) onError(error)
        
        // 自动重连(如果连接未被主动关闭)
        if (!isClosed && eventSource.readyState === EventSource.CLOSED) {
          attemptReconnect()
        }
      }
    } catch (error) {
      console.error('Failed to create SSE connection:', error)
      if (onError) onError(error)
    }
  }

  function attemptReconnect() {
    if (isClosed) return
    
    // 5秒后尝试重连
    reconnectTimer = setTimeout(() => {
      console.log('Attempting to reconnect SSE...')
      // 使用最后接收的序号恢复连接
      url = url.replace(/resumeAfterSeq=\d+/, `resumeAfterSeq=${lastSeq}`)
      if (!url.includes('resumeAfterSeq')) {
        url += `&resumeAfterSeq=${lastSeq}`
      }
      connect()
    }, 5000)
  }

  function close() {
    isClosed = true
    
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    
    if (onClose) onClose()
  }

  function reconnect() {
    close()
    isClosed = false
    connect()
  }

  // 初始连接
  connect()

  return {
    close,
    reconnect,
    getLastSeq: () => lastSeq
  }
}

/**
 * 创建 WebSocket 连接
 * @param {string|number} workId - 作品 ID
 * @param {Object} options - 配置选项
 * @param {number} options.resumeAfterSeq - 从指定序号后恢复
 * @param {Function} options.onMessage - 消息回调
 * @param {Function} options.onError - 错误回调
 * @param {Function} options.onOpen - 连接打开回调
 * @param {Function} options.onClose - 连接关闭回调
 * @returns {Object} - 返回控制对象 { send, close, reconnect }
 */
export function createWebSocketConnection(workId, options = {}) {
  const {
    resumeAfterSeq,
    onMessage,
    onError,
    onOpen,
    onClose
  } = options

  const userId = getUserId()
  const baseURL = import.meta.env.VITE_WS_BASE_URL || 
                  (import.meta.env.DEV ? 'ws://localhost:8000' : `ws://${window.location.host}`)
  
  // 构建 WebSocket URL
  let url = `${baseURL}/api/story/${workId}/ws?userId=${userId}`
  if (resumeAfterSeq !== undefined) {
    url += `&resumeAfterSeq=${resumeAfterSeq}`
  }

  let ws = null
  let isClosed = false
  let reconnectTimer = null
  let lastSeq = resumeAfterSeq || 0

  function connect() {
    if (isClosed) return

    try {
      ws = new WebSocket(url)

      ws.onopen = () => {
        console.log('WebSocket connection opened for work:', workId)
        if (onOpen) onOpen()
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          // 更新最后接收的序号
          if (data.seq !== undefined) {
            lastSeq = data.seq
          }
          
          if (onMessage) onMessage(data)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        if (onError) onError(error)
      }

      ws.onclose = () => {
        console.log('WebSocket connection closed')
        
        // 自动重连(如果连接未被主动关闭)
        if (!isClosed) {
          attemptReconnect()
        }
      }
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      if (onError) onError(error)
    }
  }

  function attemptReconnect() {
    if (isClosed) return
    
    // 3秒后尝试重连
    reconnectTimer = setTimeout(() => {
      console.log('Attempting to reconnect WebSocket...')
      // 使用最后接收的序号恢复连接
      url = url.replace(/resumeAfterSeq=\d+/, `resumeAfterSeq=${lastSeq}`)
      if (!url.includes('resumeAfterSeq')) {
        url += `&resumeAfterSeq=${lastSeq}`
      }
      connect()
    }, 3000)
  }

  function send(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data))
    } else {
      console.warn('WebSocket is not open, cannot send message')
    }
  }

  function close() {
    isClosed = true
    
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    
    if (ws) {
      ws.close()
      ws = null
    }
    
    if (onClose) onClose()
  }

  function reconnect() {
    close()
    isClosed = false
    connect()
  }

  // 初始连接
  connect()

  return {
    send,
    close,
    reconnect,
    getLastSeq: () => lastSeq
  }
}

/**
 * 解析 NDJSON 流式数据
 * @param {string} ndjsonText - NDJSON 格式的文本(每行一个 JSON)
 * @returns {Array<Object>} - 解析后的对象数组
 */
export function parseNDJSON(ndjsonText) {
  const lines = ndjsonText.trim().split('\n')
  const results = []
  
  for (const line of lines) {
    if (!line.trim()) continue
    
    try {
      results.push(JSON.parse(line))
    } catch (error) {
      console.error('Failed to parse NDJSON line:', line, error)
    }
  }
  
  return results
}

// 导出所有 API
export default {
  createSSEConnection,
  createWebSocketConnection,
  parseNDJSON
}
