/**
 * 故事服务 API
 * 处理故事内容、场景、选项等相关的后端接口调用
 */

import { http, getUserId } from './http.js'
import { STORY_MAX_RETRIES, STORY_RETRY_INTERVAL_MS } from '../config/polling.js'

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
export async function getScenes(workId, chapterIndex = 1, options = {}) {
  const {
    // 默认更耐心：约 10 分钟（120 次 * 5 秒）
    maxRetries = STORY_MAX_RETRIES,
    retryInterval = STORY_RETRY_INTERVAL_MS,
    onProgress  // 进度回调函数
  } = options

  let retries = 0

  while (retries < maxRetries) {
    try {
      console.log(`[Story] 请求章节 ${chapterIndex}，重试 ${retries + 1}/${maxRetries}`)
      console.log(`[Story] 使用 workId: ${workId}`)
      const data = await http.get(`/api/game/chapter/${workId}/${chapterIndex}`)

      console.log(`[Story] API响应:`, data)

      // 根据API文档处理不同状态
      if (data.status === 'pending') {
        console.log(`[Story] 章节 ${chapterIndex} 等待生成中...`)
        if (onProgress) onProgress({ status: 'pending', message: '等待生成中...' })
      } else if (data.status === 'generating') {
        console.log(`[Story] 章节 ${chapterIndex} 生成中...`, data.progress)
        if (onProgress) onProgress({ status: 'generating', progress: data.progress })
      } else if (data.status === 'ready') {
        console.log(`[Story] 章节 ${chapterIndex} 生成完成！`)
        console.log(`[Story] 返回数据:`, {
          chapterIndex: data.chapter.chapterIndex,
          title: data.chapter.title,
          scenesCount: data.chapter.scenes ? data.chapter.scenes.length : 0,
          scenes: data.chapter.scenes
        })
        return {
          chapterIndex: data.chapter.chapterIndex,
          title: data.chapter.title,
          scenes: data.chapter.scenes,
          isGameEnding: data.chapter.isGameEnding || false
        }
      } else if (data.status === 'error') {
        throw new Error(data.message || '获取章节失败')
      } else {
        // 兼容旧格式或其他未知状态
        console.log(`[Story] 收到未知状态:`, data.status)
        if (data.scenes && Array.isArray(data.scenes)) {
          return Object.assign({}, data)
        }
      }

      // 如果还没准备好，继续等待
      await new Promise(resolve => setTimeout(resolve, retryInterval))
      retries++
    } catch (error) {
      console.error(`[Story] 获取章节 ${chapterIndex} 失败:`, error)
      const status = error && error.status ? error.status : (error && error.response && error.response.status)
      
      // 对于某些HTTP状态码，继续重试
      if (status === 202 || status === 204 || status === 503) {
        console.log(`[Story] 服务器返回 ${status}，继续等待...`)
        await new Promise(resolve => setTimeout(resolve, retryInterval))
        retries++
        continue
      }
      
      // 其他错误直接抛出
      throw error
    }
  }

  throw new Error(`获取章节超时，已重试 ${maxRetries} 次`)
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
  return await http.get(`/api/gameworks/gameworks/${workId}`)
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
 * 创建新游戏作品
 * @param {Object} gameData - 游戏数据
 * @param {Array} gameData.tags - 用户选择的标签数组
 * @param {string} gameData.idea - 用户输入的构思文本
 * @param {string} gameData.length - 篇幅类型 ("short"|"medium"|"long")
 * @returns {Promise<{gameworkId: number, title: string, coverUrl: string, description: string, initialAttributes: Object, initialStatuses: Object, total_chapters: number}>}
 */
export async function createGame(gameData) {
  try {
    // 注意：Django 需要 URL 以斜杠结尾
    const result = await http.post('/api/game/create/', gameData)
    return result
  } catch (error) {
    console.error('Create game failed:', error)
    throw error
  }
}

/**
 * 在创作者模式下：基于用户最终确认的大纲 & prompt 启动后端章节生成
 * @param {number|string} gameworkId
 * @param {number} chapterIndex
 * @param {Object} body - { chapterOutlines: Array, userPrompt?: string }
 */
export async function generateChapter(gameworkId, chapterIndex, body = {}) {
  try {
    return await http.post(`/api/game/chapter/generate/${gameworkId}/${chapterIndex}/`, body)
  } catch (e) {
    console.error('generateChapter failed', e)
    throw e
  }
}

/**
 * 将创作者在前端修改后的章节内容持久化到后端（PUT 覆盖）
 */
export async function saveChapter(gameworkId, chapterIndex, chapterData = {}) {
  try {
    return await http.put(`/api/game/chapter/${gameworkId}/${chapterIndex}/`, chapterData)
  } catch (e) {
    console.error('saveChapter failed', e)
    throw e
  }
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

/**
 * 获取个性化结算报告
 * @param {string|number} workId - 作品 ID
 * @param {Object} gameState - 游戏状态
 * @param {Object} gameState.attributes - 当前属性
 * @param {Object} gameState.statuses - 当前状态
 * @returns {Promise<Object|null>} 结算报告数据，失败时返回 null
 */
export async function fetchSettlementReport(workId, gameState = {}) {
  try {
    const { attributes = {}, statuses = {} } = gameState
    
    console.log('[Story] 请求结算报告 - workId:', workId)
    console.log('[Story] 游戏状态 - attributes:', attributes, 'statuses:', statuses)
    
    const data = await http.post(
      `/api/settlement/report/${workId}/`,
      { attributes, statuses }
    )
    
    console.log('[Story] 结算报告获取成功:', data)
    return data
  } catch (error) {
    console.warn('[Story] 获取结算报告失败:', error)
    return null
  }
}

// 导出所有 API
export default {
  getScenes,
  createGame,
  generateChapter,
  saveChapter,
  getWorkInfo,
  getWorkList,
  updateWork,
  deleteWork,
  getInitialScenes,
  fetchSettlementReport
}
