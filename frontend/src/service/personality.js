import mock from './personality.mock.js'
import { http } from './http.js'

/**
 * 请求后端返回“所有候选个性报告”列表。
 * 路径按 spec: POST /api/settlement/report/:workId
 * 请求体：{ attributes, statuses, ...optional }
 * 返回：{ success: true, reports: [...] }
 * 若后端不可用或响应不符合预期，则回退到前端 mock 的 variants。
 */
export async function fetchPersonalityReportVariants(workId, attributes = {}, statuses = {}, options = {}) {
  // allow workId to be numeric or string; ensure numeric in URL if possible
  const wid = Number(workId)
  // 注意：Django 需要 URL 以斜杠结尾
  const url = Number.isInteger(wid) ? `/api/settlement/report/${wid}/` : '/api/settlement/report/'

  try {
    // 使用统一的 http 客户端，自动携带 token / CSRF 等认证信息
    const json = await http.post(url, { attributes, statuses, ...options })
    if (json && json.success && Array.isArray(json.reports)) return json.reports
    return mock.getPersonalityReportVariants()
  } catch (err) {
    console.warn('[personality] fetchPersonalityReportVariants failed, using mock', err)
    return mock.getPersonalityReportVariants()
  }
}

export default { fetchPersonalityReportVariants }
