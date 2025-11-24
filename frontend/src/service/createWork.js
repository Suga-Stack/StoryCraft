/**
 * 创建作品并返回作品元数据与首章/初始属性
 * 接口设计参考 story.js 风格，统一使用项目内 http helper
 */

import { http, getUserId } from './http.js'
import { POLL_DETAILS_INTERVAL_MS, POLL_DETAILS_TIMEOUT_MS } from '../config/polling.js'

/**
 * 将用户在创建界面输入的数据发送至后端创建作品
 * @param {Object} payload - 来自创建界面的表单数据
 * @param {Array<string>} payload.tags - 用户选择的标签数组（3-6个）
 * @param {string} payload.idea - 用户输入的构思文本（可选）
 * @param {string} payload.length - 篇幅类型：'short' | 'medium' | 'long'
 * @param {string} [payload.title] - 作品标题（可选，后端可生成）
 * @param {string} [payload.description] - 作品简介（可选）
 * @param {string} [payload.coverUrl] - 封面 URL（可选）
 * @param {Object} [payload.initialAttributes] - 可选的初始属性覆盖
 * @param {Object} [payload.initialStatuses] - 可选的初始状态覆盖
 * @returns {Promise<Object>} 后端返回的原始对象，示例结构参考 game-api.md：
 * {
 *   gameworkId: number,
 *   title: string,
 *   coverUrl: string,
 *   description: string,
 *   initialAttributes: Object,
 *   initialStatuses: Object,
 *   total_chapters: number
 * }
 */
export async function createWorkOnBackend(payload = {}) {
  const userId = getUserId()
  // 按 game-api.md 要求：POST /api/game/create
  const body = {
    tags: payload.tags || [],
    idea: payload.idea || '',
    length: payload.length || 'medium',
    // 如果前端告诉后端 modifiable=true，后端应返回章节大纲（chapterOutlines）而不是直接生成完整章节内容
    modifiable: payload.modifiable === true
  }
  // POST 创建作品，后端应返回 { gameworkId: number }
  const res = await http.post('/api/game/create/', body)

  // 新接口约定：POST 返回 { gameworkId }，随后需轮询 GET /api/gameworks/gameworks/{id}/
  if (!res || !res.gameworkId) {
    // 如果没有按约定返回 id，抛出错误（不再兼容旧格式）
    const err = new Error('createWork: unexpected response from /api/game/create, missing gameworkId')
    err.raw = res
    throw err
  }

  const id = res.gameworkId
  // 轮询间隔与整体超时由配置控制
  const pollIntervalMs = POLL_DETAILS_INTERVAL_MS
  const timeoutMs = POLL_DETAILS_TIMEOUT_MS // 默认 10 分钟，可通过环境变量覆盖
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    try {
      const details = await http.get(`/api/gameworks/gameworks/${id}/`)
      // 新接口在 ready 时返回 { status: 'ready', data: {...} }
      if (details && details.status === 'ready') {
        return { gameworkId: id, backendWork: details.data }
      }
    } catch (err) {
      // 忽略单次轮询错误，继续重试直到超时
      console.warn('polling gamework details failed, will retry', err)
    }
    await new Promise(r => setTimeout(r, pollIntervalMs))
  }

  // 超时：抛出错误以由调用方处理（前端可展示超时提示）
  const timeoutError = new Error('createWork: polling gamework details timed out')
  timeoutError.gameworkId = id
  throw timeoutError
}

export default {
  createWorkOnBackend
}
