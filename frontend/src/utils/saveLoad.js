// GamePage 存档/读档相关逻辑的复用工具

import { getCurrentUserId, deepClone } from './auth.js'

// ---- 配置项 ----
const USE_BACKEND_SAVE = true
const USE_MOCK_SAVE = false

// 本地存档key
const localSaveKey = (userId, workId, slot = 'default') => `storycraft_save_${userId}_${workId}_${slot}`

// Mock后端存档
const mockBackendKey = (userId) => `storycraft_mock_saves_${userId}`

const mockBackendSave = async (userId, workId, slot, data) => {
  const mapRaw = localStorage.getItem(mockBackendKey(userId)) || '{}'
  const map = JSON.parse(mapRaw)
  map[`${workId}::${slot}`] = { data, timestamp: Date.now() }
  localStorage.setItem(mockBackendKey(userId), JSON.stringify(map))
  await new Promise(r => setTimeout(r, 120))
  return { ok: true }
}

const mockBackendLoad = async (userId, workId, slot) => {
  const mapRaw = localStorage.getItem(mockBackendKey(userId)) || '{}'
  const map = JSON.parse(mapRaw)
  const entry = map[`${workId}::${slot}`]
  await new Promise(r => setTimeout(r, 120))
  return entry ? entry.data : null
}

// 后端存档
const backendSave = async (userId, workId, slot, data) => {
  if (USE_MOCK_SAVE) return mockBackendSave(userId, workId, slot, data)
  const numWorkId = Number(workId)
  // 将 slot1-slot6 转换为 1-6
  const slotNum = slot.replace('slot', '')
  const url = `/api/game/saves/${encodeURIComponent(numWorkId)}/${encodeURIComponent(slotNum)}/`  // ← 添加尾部斜杠
  const headers = { 'Content-Type': 'application/json' }
  // 优先使用 window 注入的 token，其次从 localStorage 获取
  const token = localStorage.getItem('token')
  if (token) headers['Authorization'] = `Bearer ${token}`
  
  // 按照API文档格式化数据
  const body = {
    title: `存档 ${new Date().toLocaleString()}`,
    timestamp: Date.now(),
    state: data.state || data
  }
  
  const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(txt || res.statusText)
  }
  return res.json().catch(() => ({ ok: true }))
}

const backendLoad = async (userId, workId, slot) => {
  if (USE_MOCK_SAVE) return mockBackendLoad(userId, workId, slot)
  const numWorkId = Number(workId)
  // 将 slot1-slot6 转换为 1-6
  const slotNum = slot.replace('slot', '')
  const url = `/api/game/saves/${encodeURIComponent(numWorkId)}/${encodeURIComponent(slotNum)}/`  // ← 添加尾部斜杠
  const headers = {}
  // 优先使用 window 注入的 token，其次从 localStorage 获取
  const token = localStorage.getItem('token')
  if (token) headers['Authorization'] = `Bearer ${token}`
  
  console.log(`🌐 后端读档请求 - URL: ${url}`)
  const res = await fetch(url, { method: 'GET', headers })
  console.log(`📡 后端响应状态: ${res.status}`)
  
  if (res.status === 404) {
    console.log(`⚠️ ${slot} 不存在 (404)`)
    return null
  }
  if (!res.ok) {
    const txt = await res.text()
    console.error(`❌ 后端读档失败:`, txt)
    throw new Error(txt || res.statusText)
  }
  const obj = await res.json()
  console.log(`✅ 后端返回数据:`, obj)
  return obj
}

// 存档API
export const saveGameData = async (gameData, slot = 'default') => {
  // 新的存档结构：保存章节索引、场景 id 与对话索引，符合 API 文档格式
  const deriveChapterIndex = () => {
    if (gameData.chapterIndex != null) return gameData.chapterIndex
    if (gameData.currentChapterIndex != null) return gameData.currentChapterIndex
    return 1
  }

  const deriveSceneId = () => {
    if (gameData.sceneId != null) return Number(gameData.sceneId)
    if (gameData.currentSceneId != null) return Number(gameData.currentSceneId)
    return null
  }

  // 清理 choiceHistory，只保留 API 需要的字段
  const cleanedChoiceHistory = (gameData.choiceHistory || []).map(choice => {
    // 确保 choiceId 是整数(后端要求)
    let choiceId = choice.choiceId
    if (typeof choiceId === 'string') {
      // 如果是字符串,尝试解析为整数
      choiceId = parseInt(choiceId, 10)
    }
    if (isNaN(choiceId)) {
      choiceId = null
    }
    
    return {
      chapterIndex: choice.chapterIndex || deriveChapterIndex(),
      sceneId: choice.sceneId,
      choiceTriggerIndex: choice.choiceTriggerIndex || 0,
      choiceId: choiceId
    }
  })

  // 构建符合 API 文档的 payload
  const payload = {
    title: `存档 ${new Date().toLocaleString()}`,
    timestamp: Date.now(),
    state: {
      chapterIndex: deriveChapterIndex(),
      sceneId: deriveSceneId(),
      dialogueIndex: (gameData.currentDialogueIndex != null) ? gameData.currentDialogueIndex : (gameData.dialogueIndex || 0),
      attributes: deepClone(gameData.attributes),
      statuses: deepClone(gameData.statuses),
      choiceHistory: cleanedChoiceHistory
    }
  }

  const userId = getCurrentUserId()
  const workId = gameData.work.id

  // 尝试后端存储
  if (USE_BACKEND_SAVE) {
    try {
      await backendSave(userId, workId, slot, payload.state)
      return { success: true, message: `后端存档成功 (${slot})`, payload }
    } catch (err) {
      console.warn('后端存档失败，回退到本地:', err)
    }
  }

  // 本地存储回退
  try {
    const key = localSaveKey(userId, workId, slot)
    // 本地保存整份 payload 以便 UI 读取
    localStorage.setItem(key, JSON.stringify(payload))
    return { success: true, message: `本地存档成功 (${slot})`, payload }
  } catch (err) {
    throw new Error('存档失败：' + err.message)
  }
}

// 读档API
export const loadGameData = async (workId, slot = 'default') => {
  const userId = getCurrentUserId()

  // 尝试后端读取
  if (USE_BACKEND_SAVE) {
    try {
      const data = await backendLoad(userId, workId, slot)
      if (data) {
        return { success: true, data, message: `后端读档成功 (${slot})` }
      }
    } catch (err) {
      console.warn('后端读档失败，回退到本地:', err)
    }
  }

  // 本地读取回退
  try {
    const key = localSaveKey(userId, workId, slot)
    const raw = localStorage.getItem(key)
    if (!raw) {
      return { success: false, message: '未找到存档' }
    }
    const data = JSON.parse(raw)
    return { success: true, data, message: `本地读档成功 (${slot})` }
  } catch (err) {
    throw new Error('读档失败：' + err.message)
  }
}

// 刷新存档槽位信息
export const refreshSlotInfosUtil = async (workId, slots = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6']) => {
  console.log('📦 refreshSlotInfos 调用 - workId:', workId, 'slots:', slots)
  const userId = getCurrentUserId()
  console.log('👤 当前用户ID:', userId)
  const results = {}

  for (const slot of slots) {
    try {
      console.log(`🔍 正在加载 ${slot}...`)
      const result = await loadGameData(workId, slot)
      console.log(`📥 ${slot} 加载结果:`, result)
      if (result.success) {
        let d = result.data
        console.log(`✅ ${slot} 原始数据:`, d)
        
        // 处理后端返回的嵌套结构: {game_state: {...}, timestamp: ...}
        // 或新格式: {state: {...}, timestamp: ...}
        if (d.game_state) {
          console.log(`🔄 ${slot} 检测到 game_state 字段，展开嵌套结构`)
          d = { ...d.game_state, timestamp: d.timestamp }
        } else if (d.state && typeof d.state === 'object') {
          console.log(`🔄 ${slot} 检测到 state 字段，展开嵌套结构`)
          d = { ...d.state, timestamp: d.timestamp }
        }
        
        console.log(`✅ ${slot} 处理后数据:`, d)
        
        results[slot] = {
          slot,
          data: deepClone(d),
          timestamp: d.timestamp || Date.now(),
          // 显示友好字段：章节 / 场景 id / 对话索引
          chapterIndex: d.chapterIndex != null ? d.chapterIndex : (d.currentChapterIndex != null ? d.currentChapterIndex : null),
          // sceneId 以字符串形式返回（例如 "1000"）以便统一展示与比较
          sceneId: d.sceneId != null ? String(d.sceneId) : (d.currentSceneIndex != null ? String(d.currentSceneIndex) : null),
          dialogueIndex: d.dialogueIndex != null ? d.dialogueIndex : (d.currentDialogueIndex != null ? d.currentDialogueIndex : 0),
          // 兼容旧字段：某些代码仍会读取 currentSceneIndex/currentDialogueIndex
          currentSceneIndex: (typeof d.currentSceneIndex === 'number') ? d.currentSceneIndex : null,
          currentDialogueIndex: (typeof d.currentDialogueIndex === 'number') ? d.currentDialogueIndex : (d.dialogueIndex != null ? d.dialogueIndex : 0),
          // 缩略图字段
          thumbnail: d.thumbnail || null,
          thumbnailData: d.thumbnailData || null,
          // 不再包含 sceneTitle（因存档不再携带 storyScenes）
          sceneTitle: null
        }
      } else {
        console.log(`⚠️ ${slot} 无数据`)
        results[slot] = null
      }
    } catch (err) {
      console.error(`❌ 刷新 ${slot} 失败:`, err)
      results[slot] = null
    }
  }

  console.log('📊 最终槽位信息汇总:', results)
  return results
}

// 删除存档API
export const deleteGameData = async (workId, slot = 'default') => {
  const userId = getCurrentUserId()

  // 优先使用后端删除
  if (USE_BACKEND_SAVE) {
    try {
      // 真实后端删除
      const numWorkId = Number(workId)
      // 将 slot1-slot6 转换为 1-6
      const slotNum = slot.replace('slot', '')
      const url = `/api/game/saves/${encodeURIComponent(numWorkId)}/${encodeURIComponent(slotNum)}/`
      
      const headers = {}
      // 使用 Bearer token 认证，与读档/存档保持一致
      const token = localStorage.getItem('token')
      if (token) headers['Authorization'] = `Bearer ${token}`
      
      console.log(`🗑️ 后端删档请求 - URL: ${url}`)
      const response = await fetch(url, {
        method: 'DELETE',
        headers
      })
      console.log(`📡 后端删档响应状态: ${response.status}`)
      
      if (response.ok) {
        const result = await response.json().catch(() => ({ ok: true }))
        console.log(`✅ 后端删档成功:`, result)
        return { success: true, message: '存档已删除' }
      } else {
        const txt = await response.text()
        console.error(`❌ 后端删档失败:`, txt)
        throw new Error(`删除失败: ${response.status} - ${txt}`)
      }
    } catch (err) {
      console.error('❌ 后端删除失败，回退到本地删除:', err)
      // 回退到本地删除
      if (USE_MOCK_SAVE) {
        try {
          const mapRaw = localStorage.getItem(mockBackendKey(userId)) || '{}'
          const map = JSON.parse(mapRaw)
          delete map[`${workId}::${slot}`]
          localStorage.setItem(mockBackendKey(userId), JSON.stringify(map))
          return { success: true, message: '本地存档已删除' }
        } catch (localErr) {
          console.error('本地删除也失败:', localErr)
          return { success: false, message: '删除失败: ' + localErr.message }
        }
      }
      return { success: false, message: '删除失败: ' + err.message }
    }
  } else {
    // 仅本地删除
    try {
      const mapRaw = localStorage.getItem(mockBackendKey(userId)) || '{}'
      const map = JSON.parse(mapRaw)
      delete map[`${workId}::${slot}`]
      localStorage.setItem(mockBackendKey(userId), JSON.stringify(map))
      return { success: true, message: '本地存档已删除' }
    } catch (err) {
      console.error('本地删除失败:', err)
      return { success: false, message: '删除失败: ' + err.message }
    }
  }
}

// 常量导出
export const SLOTS = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6']
export const AUTO_SAVE_SLOT = 'slot6'