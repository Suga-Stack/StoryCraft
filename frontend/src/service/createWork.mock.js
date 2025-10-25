/**
 * 本地 mock 的 createWork 实现，用于在无后端时测试创建流程
 * 支持接收用户选择的标签、构思、篇幅等参数
 */
import * as storyMock from './story.mock.js'

const delay = (ms) => new Promise(r => setTimeout(r, ms))

/**
 * Mock 创建作品函数
 * @param {Object} payload - 包含 tags, idea, length 等参数
 */
export async function createWorkOnBackend(payload = {}) {
  await delay(300)
  
  const id = 'mock-' + Math.floor(Math.random() * 100000)
  
  // 根据用户选择的标签和构思生成标题（简单 mock 逻辑）
  const tags = payload.tags || []
  const idea = payload.idea || ''
  const length = payload.length || 'medium'
  
  // 根据标签生成标题（示例逻辑）
  let generatedTitle = '我在仙门靠才华致富'
  if (tags.includes('系统')) {
    generatedTitle = '云舒的修仙商业帝国'
  } else if (tags.includes('穿越')) {
    generatedTitle = '穿越修仙界的商业女强人'
  } else if (tags.includes('玄幻')) {
    generatedTitle = '仙道酬勤：氪金就变强'
  }
  
  // 根据构思和标签生成简介
  let generatedDescription = '现代理财师魂穿仙侠世界，成了个小宗门弟子。没有逆天资质，却有个需要氪金才能变强的奇怪系统。为了"充值"，她在仙门开创了一系列"商业项目"。从此，整个宗门的风气开始跑偏……'
  if (idea) {
    generatedDescription = idea + '。' + generatedDescription
  }
  
  const backendWork = {
    id,
    title: payload.title || generatedTitle,
    coverUrl: payload.coverUrl || '/images/仙界封面.jpg',
    description: payload.description || generatedDescription,
    authorId: 'mock-user',
    tags: tags,
    length: length
  }

  return {
    backendWork,
    initialAttributes: payload.initialAttributes || { '灵石': 50, '道心': 5, '人气': 5, '商业头脑': 10 },
    initialStatuses: payload.initialStatuses || { '修为': '炼气期三层' }
  }
}

export default { createWorkOnBackend }
