// 简单的前端敏感词审核与替换工具
// 规则：对预定义敏感词进行全词或部分匹配，替换为等长度的星号（*）

import sensitiveExtra from './sensitiveExtra'

// 敏感词库（可根据需要扩展）
let SENSITIVE_WORDS = []

// 编译用于替换的正则列表（使用全局标志），以及匹配检测时构建无全局标志的测试正则
const regexList = []

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 将匹配到的片段替换为同长度的星号
export function sanitize(text) {
  if (!text || typeof text !== 'string') return text
  let out = text
  for (const r of regexList) {
    out = out.replace(r, (match) => '*'.repeat(match.length))
  }
  return out
}

// 检测是否包含任何敏感词
export function containsSensitive(text) {
  if (!text || typeof text !== 'string') return false
  // 使用非全局正则进行检测以避免 lastIndex 问题
  return SENSITIVE_WORDS.some(w => new RegExp(escapeRegExp(w), 'i').test(text))
}

// 允许外部扩展敏感词
export function addSensitiveWords(words) {
  if (!Array.isArray(words)) return
  for (const w of words) {
    if (typeof w !== 'string' || !w) continue
    if (!SENSITIVE_WORDS.includes(w)) {
      SENSITIVE_WORDS.push(w)
      regexList.push(new RegExp(escapeRegExp(w), 'ig'))
    }
  }
}
// 如果从外部文件导入了数组，则将其作为敏感词库覆盖/添加
try {
  if (Array.isArray(sensitiveExtra) && sensitiveExtra.length > 0) {
    // 仅加入合法的字符串项，去重
    const toAdd = Array.from(new Set(sensitiveExtra.filter(w => typeof w === 'string' && w && w.length > 0)))
      .filter(w => !SENSITIVE_WORDS.includes(w))
    if (toAdd.length > 0) addSensitiveWords(toAdd)
  }
} catch (e) {
  // 安全容错：导入有问题时不影响主功能
}

export default { sanitize, containsSensitive, addSensitiveWords }
