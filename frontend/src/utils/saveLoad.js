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
  const numWorkId = Number(workId)
  const url = `/api/users/${encodeURIComponent(userId)}/saves/${encodeURIComponent(numWorkId)}/${encodeURIComponent(slot)}`
  const body = { workId: numWorkId, slot, data }
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
  const numWorkId = Number(workId)
  const url = `/api/users/${encodeURIComponent(userId)}/saves/${encodeURIComponent(numWorkId)}/${encodeURIComponent(slot)}`
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
  // 新的存档结构：保存章节索引、场景 id 与对话索引，便于跨章节/不同场景序号复用
  // 优先使用传入的明确字段，否则从 storyScenes + 索引推导
    const deriveChapterIndex = () => {
      if (gameData.chapterIndex != null) return gameData.chapterIndex
      if (gameData.currentChapterIndex != null) return gameData.currentChapterIndex
      return (gameData.currentChapterIndex || 1)
    }

    const deriveSceneId = () => {
      if (gameData.sceneId != null) return gameData.sceneId
      if (gameData.currentSceneId != null) return gameData.currentSceneId
      // 不再从 gameData.storyScenes 回退（该字段已从存档 payload 中移除）
      return null
    }

  const payload = {
    work: gameData.work,
    // 新字段：chapterIndex, sceneId, dialogueIndex
    chapterIndex: deriveChapterIndex(),
    sceneId: deriveSceneId(),
    dialogueIndex: (gameData.currentDialogueIndex != null) ? gameData.currentDialogueIndex : (gameData.dialogueIndex || 0),
    attributes: deepClone(gameData.attributes),
    statuses: deepClone(gameData.statuses),
    // NOTE: 不再保存 `storyScenes` 到存档中（后端与前端都不应依赖此字段）
    // storyScenes: deepClone(gameData.storyScenes),
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
        const d = result.data
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
          // 不再包含 sceneTitle（因存档不再携带 storyScenes）
          sceneTitle: null
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