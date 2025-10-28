/**
 * 故事服务 API
 * 处理故事内容、场景、选项等相关的后端接口调用
 */

import { http, getUserId } from './http.js'

/**
 * 获取指定章节的剧情场景
 * @param {string|number} workId - 作品 ID
 * @param {number} chapterIndex - 章节索引（1-based，1表示第一章）
 * @returns {Promise<{generating: boolean, end: boolean, scenes: Array}>}
 * 
 * 场景对象结构：
 * {
 *   sceneId: number,           // 场景唯一ID
 *   backgroundImage: string,   // 背景图片URL
 *   dialogues: Array,          // 对话数组（字符串或对象）
 *   choiceTriggerIndex?: number, // 选项触发位置（对话索引）
 *   choices?: Array,           // 选项数组
 *   chapterEnd?: boolean       // 标记章节结束（用于章节切换）
 * }
 * 
 * 当场景标记了 chapterEnd: true 时，表示该场景是本章最后一个场景，
 * 播放完该场景后，前端应增加 currentChapterIndex 并请求下一章内容。
 */
export async function getScenes(workId, chapterIndex = 1) {
  // 与后端约定：chapterIndex 为 1-based（1 表示第一章）
  try {
    const body = { gameworkId: workId, chapterIndex }
    // 严格按 game-api.md：POST /api/game/chapter/ 请求体使用 gameworkId 与 chapterIndex
    const data = await http.post('/api/game/chapter/', body)

    // 返回后端原始结构：{ chapterIndex, title, scenes, isGameEnding }
    return Object.assign({}, data || {})
  } catch (error) {
    const status = error && error.status ? error.status : (error && error.response && error.response.status)
    if (status === 202 || status === 204) {
      return { generating: true }
    }
    throw error
  }
}

/**
 * 提交选项选择
 * @param {string|number} workId - 作品 ID
 * @param {string|number} choiceId - 选项 ID
 * @param {Object} context - 上下文信息
 * @param {string|number} context.currentSceneId - 当前场景 ID
 * @param {number} context.currentDialogueIndex - 当前对话索引
 * @param {Object} context.attributes - 当前属性
 * @param {Object} context.statuses - 当前状态
 * @returns {Promise<{attributesDelta: Object, statusesDelta: Object, nextScenes: Array, end: boolean}>}
 * 
 * nextScenes 数组中的场景对象结构：
 * {
 *   sceneId: number,           // 场景唯一ID
 *   backgroundImage: string,   // 背景图片URL
 *   dialogues: Array,          // 对话数组
 *   chapterEnd?: boolean       // 标记章节结束（用于章节切换）
 * }
 * 
 * 选项返回的最后一个场景应标记 chapterEnd: true 以触发章节切换。
 * 例如：第一章选项返回的最后场景标记 chapterEnd: true，
 * 播放完后前端会自动增加章节索引并请求第二章内容。
 */
// NOTE: submitChoice removed — front-end now expects choices to include subsequentDialogues/nextScenes

/**
 * 获取作品信息
 * @param {string|number} workId - 作品 ID
 * @returns {Promise<{id: string|number, title: string, coverUrl?: string, authorId?: string, description?: string}>}
 */
export async function getWorkInfo(workId) {
  return await http.get(`/api/works/${workId}`)
}

/**
 * 获取作品列表
 * @param {Object} params - 查询参数
 * @param {number} params.page - 页码
 * @param {number} params.pageSize - 每页数量
 * @param {string} params.keyword - 搜索关键词
 * @returns {Promise<{works: Array, total: number}>}
 */
export async function getWorkList(params = {}) {
  return await http.get('/api/works', params)
}

/**
 * 创建新作品
 * @param {Object} workData - 作品数据
 * @param {string} workData.title - 标题
 * @param {string} workData.description - 描述
 * @param {string} workData.coverUrl - 封面 URL
 * @returns {Promise<{id: string|number, title: string}>}
 */
export async function createWork(workData) {
  const userId = getUserId()
  return await http.post('/api/works', {
    ...workData,
    authorId: userId
  })
}

/**
 * 更新作品信息
 * @param {string|number} workId - 作品 ID
 * @param {Object} updates - 更新的字段
 * @returns {Promise<Object>}
 */
export async function updateWork(workId, updates) {
  return await http.patch(`/api/works/${workId}`, updates)
}

/**
 * 删除作品
 * @param {string|number} workId - 作品 ID
 * @returns {Promise<void>}
 */
export async function deleteWork(workId) {
  return await http.delete(`/api/works/${workId}`)
}

/**
 * 获取初始场景
 * @param {string|number} workId - 作品 ID
 * @returns {Promise<Array>}
 */
// 兼容旧接口：保留导出名以便其他模块临时依赖（内部现在调用 getScenes(workId, 1)）
export async function getInitialScenes(workId) {
  // 兼容旧名称：首次章节请求（使用 1 作为首章索引）
  const res = await getScenes(workId, 1)
  return res.scenes || []
}

// 导出所有 API
export default {
  getScenes,
  getWorkInfo,
  getWorkList,
  createWork,
  updateWork,
  deleteWork,
  getInitialScenes
}
