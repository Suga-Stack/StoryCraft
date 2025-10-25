/**
 * 创建作品并返回作品元数据与首章/初始属性
 * 接口设计参考 story.js 风格，统一使用项目内 http helper
 */

import { http, getUserId } from './http.js'

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
 * @returns {Promise<{backendWork: Object, initialAttributes: Object, initialStatuses: Object}>}
 */
export async function createWorkOnBackend(payload = {}) {
  const userId = getUserId()
  const body = {
    // 用户输入的核心参数
    tags: payload.tags || [],
    idea: payload.idea || '',
    length: payload.length || 'medium',
    // 可选的作品元信息
    title: payload.title || '',
    description: payload.description || '',
    coverUrl: payload.coverUrl || '',
    // 初始游戏属性
    initialAttributes: payload.initialAttributes || {},
    initialStatuses: payload.initialStatuses || {},
    // 元信息
    meta: {
      createdBy: userId,
      clientTimestamp: Date.now()
    }
  }

  // POST /api/works 创建作品并返回作品信息（不包含首章内容）
  const res = await http.post('/api/works', body)

  // 期望后端返回结构：{ id, title, coverUrl, description, initialAttributes, initialStatuses }
  const backendWork = {
    id: res.id || res._id || res.workId,
    title: res.title || body.title || 'AI生成作品',
    coverUrl: res.coverUrl || body.coverUrl,
    description: res.description || body.description,
    authorId: res.authorId || userId,
    tags: body.tags
  }

  return {
    backendWork,
    initialAttributes: res.initialAttributes || body.initialAttributes || {},
    initialStatuses: res.initialStatuses || body.initialStatuses || {}
  }
}

export default {
  createWorkOnBackend
}
