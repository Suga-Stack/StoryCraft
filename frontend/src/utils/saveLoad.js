// GamePage 存档/读档相关逻辑的复用工具

// ---- 配置项 ----
const USE_BACKEND_SAVE = true
const USE_MOCK_SAVE = true

// 获取当前用户 ID
const getCurrentUserId = () => {
  try {
    if (window.__STORYCRAFT_USER__ && window.__STORYCRAFT_USER__.id) return window.__STORYCRAFT_USER__.id
  } catch (e) {}
  const key = 'storycraft_user_id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    localStorage.setItem(key, id)
  }
  return id
}

// 生成UUID
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// 深拷贝
const deepClone = (obj) => JSON.parse(JSON.stringify(obj))

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
  const url = `/api/users/${encodeURIComponent(userId)}/saves/${encodeURIComponent(workId)}/${encodeURIComponent(slot)}`
  const body = { workId, slot, data }
  const headers = { 'Content-Type': 'application/json' }
  if (window.__STORYCRAFT_AUTH_TOKEN__) headers['Authorization'] = `Bearer ${window.__STORYCRAFT_AUTH_TOKEN__}`
  const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(txt || res.statusText)
  }
  return res.json().catch(() => ({}))
}

const backendLoad = async (userId, workId, slot) => {
  if (USE_MOCK_SAVE) return mockBackendLoad(userId, workId, slot)
  const url = `/api/users/${encodeURIComponent(userId)}/saves/${encodeURIComponent(workId)}/${encodeURIComponent(slot)}`
  const headers = {}
  if (window.__STORYCRAFT_AUTH_TOKEN__) headers['Authorization'] = `Bearer ${window.__STORYCRAFT_AUTH_TOKEN__}`
  const res = await fetch(url, { method: 'GET', headers })
  if (res.status === 404) return null
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(txt || res.statusText)
  }
  const obj = await res.json()
  return obj && obj.data ? obj.data : obj
}

// 存档API
export const saveGameData = async (gameData, slot = 'default') => {
  const payload = {
    work: gameData.work,
    currentSceneIndex: gameData.currentSceneIndex,
    currentDialogueIndex: gameData.currentDialogueIndex,
    attributes: deepClone(gameData.attributes),
    statuses: deepClone(gameData.statuses),
    storyScenes: deepClone(gameData.storyScenes),
    choiceHistory: deepClone(gameData.choiceHistory),
    timestamp: Date.now()
  }

  const userId = getCurrentUserId()
  const workId = gameData.work.id

  // 尝试后端存储
  if (USE_BACKEND_SAVE) {
    try {
      await backendSave(userId, workId, slot, payload)
      return { success: true, message: `后端存档成功 (${slot})`, payload }
    } catch (err) {
      console.warn('后端存档失败，回退到本地:', err)
    }
  }

  // 本地存储回退
  try {
    const key = localSaveKey(userId, workId, slot)
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
export const refreshSlotInfos = async (workId, slots = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6']) => {
  const userId = getCurrentUserId()
  const results = {}

  for (const slot of slots) {
    try {
      const result = await loadGameData(workId, slot)
      if (result.success) {
        results[slot] = {
          slot,
          data: deepClone(result.data),
          timestamp: result.data.timestamp || Date.now(),
          sceneTitle: `场景 ${(result.data.currentSceneIndex || 0) + 1}`,
          dialogueIndex: result.data.currentDialogueIndex || 0
        }
      } else {
        results[slot] = null
      }
    } catch (err) {
      console.error(`刷新 ${slot} 失败:`, err)
      results[slot] = null
    }
  }

  return results
}

// 常量导出
export const SLOTS = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6']
export const AUTO_SAVE_SLOT = 'slot6'