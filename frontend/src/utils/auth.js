
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

// 简单深拷贝（避免引用被后续修改影响到存档/展示）
const deepClone = (obj) => JSON.parse(JSON.stringify(obj))

export { getCurrentUserId, generateUUID, deepClone }