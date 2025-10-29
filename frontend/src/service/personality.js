import mock from './personality.mock.js'

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
  const url = Number.isInteger(wid) ? `/api/settlement/report/${wid}` : '/api/settlement/report'

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attributes, statuses, ...options })
    })
    if (!resp.ok) throw new Error('bad response')
    const json = await resp.json()
    if (json && json.success && Array.isArray(json.reports)) return json.reports
    return mock.getPersonalityReportVariants()
  } catch (err) {
    return mock.getPersonalityReportVariants()
  }
}

export default { fetchPersonalityReportVariants }
