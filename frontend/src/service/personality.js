import mock from './personality.mock.js'

/**
 * 请求后端返回“所有候选个性报告”列表，前端在本地基于 attributes/statuses 选择匹配的报告。
 * 后端响应约定：{ success: true, reports: [ { id, minAttributes?, requiredStatuses?, report } ] }
 * 若后端不可用或响应不符合预期，则回退到前端 mock 的 variants。
 */
export async function fetchPersonalityReportVariants(model = 'all') {
  try {
    const resp = await fetch('/api/settlement/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model })
    })
    if (!resp.ok) throw new Error('bad response')
    const json = await resp.json()
    if (json && json.success && Array.isArray(json.reports)) return json.reports
    // fallback to mock variants
    return mock.getPersonalityReportVariants()
  } catch (err) {
    // 网络或后端未启动时使用前端 mock 的变体集合
    return mock.getPersonalityReportVariants()
  }
}

export default { fetchPersonalityReportVariants }
