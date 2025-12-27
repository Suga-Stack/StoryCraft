/**
 * 存档服务 API
 * 处理游戏存档的保存、读取、列表等操作
 */

import { http } from './http.js'
import { getUserId } from '../utils/auth.js'

/**
 * 保存存档
 * @param {string|number} workId - 作品 ID
 * @param {string} slot - 存档槽位 (slot1-slot6)
 * @param {Object} saveData - 存档数据
 * @param {Object} saveData.work - 作品信息
 * @param {number} saveData.currentSceneIndex - 当前场景索引
 * @param {number} saveData.currentDialogueIndex - 当前对话索引
 * @param {Object} saveData.attributes - 属性
 * @param {Object} saveData.statuses - 状态
 * @param {Array} saveData.storyScenes - 已加载的场景
 * @param {number} saveData.timestamp - 时间戳
 * @returns {Promise<{ok: boolean}>}
 */
export async function saveGame(workId, slot, saveData) {
  // 将 slot1-slot6 转换为 1-6
  const slotNum = slot.replace('slot', '')

  const requestBody = {
    title: `存档 ${new Date().toLocaleString()}`,
    timestamp: Date.now(),
    state: {
      chapterIndex: saveData.chapterIndex || 1,
      sceneId: saveData.sceneId || null,
      dialogueIndex: saveData.dialogueIndex || 0,
      attributes: saveData.attributes || {},
      statuses: saveData.statuses || {},
      choiceHistory: saveData.choiceHistory || []
    }
  }

  try {
    const result = await http.put(`/api/game/saves/${Number(workId)}/${slotNum}`, requestBody)
    // axios 响应拦截器已经返回 response.data
    return result || { ok: true }
  } catch (error) {
    console.error('Save game failed:', error)
    throw error
  }
}

/**
 * 读取存档
 * @param {string|number} workId - 作品 ID
 * @param {string} slot - 存档槽位 (slot1-slot6)
 * @returns {Promise<{data: Object, timestamp: number}|null>}
 */
export async function loadGame(workId, slot) {
  // 将 slot1-slot6 转换为 1-6
  const slotNum = slot.replace('slot', '')

  try {
    const result = await http.get(`/api/game/saves/${Number(workId)}/${slotNum}`)
    // axios 响应拦截器已经返回 response.data
    return result
  } catch (error) {
    // 404 表示该槽位无存档
    if (error.status === 404) {
      return null
    }
    console.error('Load game failed:', error)
    throw error
  }
}

/**
 * 获取所有存档槽位的摘要信息
 * @param {string|number} workId - 作品 ID
 * @returns {Promise<Array<{slot: string, timestamp: number, excerpt?: string}>>}
 */
export async function getSavesList(workId) {
  try {
    const result = await http.get(`/api/game/saves/${Number(workId)}`)
    // axios 响应拦截器已经返回 response.data
    return result.saves || []
  } catch (error) {
    // 如果后端不支持批量获取,则返回空数组
    // 前端会逐个槽位读取
    if (error.status === 404 || error.status === 501) {
      return []
    }
    console.error('Get saves list failed:', error)
    throw error
  }
}

/**
 * 删除存档
 * @param {string|number} workId - 作品 ID
 * @param {string} slot - 存档槽位
 * @returns {Promise<{ok: boolean}>}
 */
export async function deleteSave(workId, slot) {
  // 将 slot1-slot6 转换为 1-6
  const slotNum = slot.replace('slot', '')

  try {
    const result = await http.delete(`/api/game/saves/${Number(workId)}/${slotNum}`)
    // axios 响应拦截器已经返回 response.data
    return result || { ok: true }
  } catch (error) {
    console.error('Delete save failed:', error)
    throw error
  }
}

/**
 * 批量读取所有槽位的存档
 * @param {string|number} workId - 作品 ID
 * @param {Array<string>} slots - 槽位数组,默认 ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6']
 * @returns {Promise<Object>} - 返回 { slot1: data, slot2: data, ... } 形式的对象
 */
export async function loadAllSlots(
  workId,
  slots = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6']
) {
  const result = {}

  // 先尝试批量获取
  try {
    const savesList = await getSavesList(workId)
    if (savesList.length > 0) {
      // 如果有批量接口返回数据,转换为槽位映射
      savesList.forEach((save) => {
        result[save.slot] = save
      })
      return result
    }
  } catch (error) {
    // 批量获取失败,继续逐个读取
    console.warn('Batch get saves failed, will load individually:', error)
  }

  // 逐个读取各槽位
  await Promise.all(
    slots.map(async (slot) => {
      try {
        const saveData = await loadGame(workId, slot)
        result[slot] = saveData
      } catch (error) {
        // 单个槽位读取失败不影响其他槽位
        console.warn(`Failed to load ${slot}:`, error)
        result[slot] = null
      }
    })
  )

  return result
}

// 导出所有 API
export default {
  saveGame,
  loadGame,
  getSavesList,
  deleteSave,
  loadAllSlots
}
