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
  // 不再将用户填写的“一句话构思/概述”直接拼接到自动生成的简介中。
  // 用户的构思保留在 payload.idea 中，如果需要展示，应在 UI 的其他位置单独呈现。
  
  // 按照 game-api.md 的返回格式组织 mock 返回
  // 如果是创作者模式（modifiable），返回章节大纲以供前端编辑
  if (payload.modifiable) {
    return {
      gameworkId: id,
      title: payload.title || generatedTitle,
      coverUrl: payload.coverUrl || '/images/仙界封面.jpg',
      description: payload.description || generatedDescription,
      initialAttributes: payload.initialAttributes || { '灵石': 50, '道心': 5, '人气': 5, '商业头脑': 10 },
      initialStatuses: payload.initialStatuses || { '修为': '炼气期三层' },
      total_chapters: 5,
      chapterOutlines: [
        { chapterIndex: 1, outline: '主角穿越到修仙世界，发现了一个奇怪的系统。' },
        { chapterIndex: 2, outline: '主角为赚取灵石进入坊市，卷入小冲突并获得线索。' },
        { chapterIndex: 3, outline: '主角深入洞府探险，遭遇妖兽与谜题。' },
        { chapterIndex: 4, outline: '主角在洞府中得到关键线索，揭开部分过去。' },
        { chapterIndex: 5, outline: '回到人世后，新的势力已经注意到主角。' }
      ]
    }
  }

  return {
    gameworkId: id,
    title: payload.title || generatedTitle,
    coverUrl: payload.coverUrl || '/images/仙界封面.jpg',
    description: payload.description || generatedDescription,
    // 初始属性（与后端约定的字段名一致）
    initialAttributes: payload.initialAttributes || { '灵石': 50, '道心': 5, '人气': 5, '商业头脑': 10 },
    // statuses 字段（game-api.md 中使用 statuses 作为可选的状态集合）
    statuses: payload.initialStatuses || { '修为': '炼气期三层' }
  }
}

export default { createWorkOnBackend }
