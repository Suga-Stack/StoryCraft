/**
 * Mock 数据服务
 * 在后端未就绪时提供模拟数据支持
 */

/**
 * 延迟函数,模拟网络延迟
 * @param {number} ms - 延迟毫秒数
 */
const delay = (ms = 500) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Mock 存档服务
 */
export class MockSaveService {
  constructor() {
    this.storageKey = 'storycraft_mock_saves'
  }

  /**
   * 获取所有存档数据
   */
  getAllSaves() {
    try {
      const data = localStorage.getItem(this.storageKey)
      return data ? JSON.parse(data) : {}
    } catch (error) {
      console.error('Failed to parse mock saves:', error)
      return {}
    }
  }

  /**
   * 保存所有存档数据
   */
  setAllSaves(saves) {
    localStorage.setItem(this.storageKey, JSON.stringify(saves))
  }

  /**
   * 保存存档
   */
  async saveGame(workId, slot, saveData) {
    await delay(300)

    const allSaves = this.getAllSaves()

    if (!allSaves[workId]) {
      allSaves[workId] = {}
    }

    allSaves[workId][slot] = {
      data: saveData,
      timestamp: Date.now()
    }

    this.setAllSaves(allSaves)

    console.log('Mock save:', workId, slot)
    return { ok: true }
  }

  /**
   * 读取存档
   */
  async loadGame(workId, slot) {
    await delay(200)

    const allSaves = this.getAllSaves()
    const save = allSaves[workId]?.[slot]

    console.log('Mock load:', workId, slot, save ? 'found' : 'not found')
    return save || null
  }

  /**
   * 获取存档列表
   */
  async getSavesList(workId) {
    await delay(200)

    const allSaves = this.getAllSaves()
    const workSaves = allSaves[workId] || {}

    return Object.keys(workSaves).map((slot) => ({
      slot,
      timestamp: workSaves[slot].timestamp,
      excerpt: this.generateExcerpt(workSaves[slot].data)
    }))
  }

  /**
   * 删除存档
   */
  async deleteSave(workId, slot) {
    await delay(200)

    const allSaves = this.getAllSaves()

    if (allSaves[workId]?.[slot]) {
      delete allSaves[workId][slot]
      this.setAllSaves(allSaves)
    }

    console.log('Mock delete:', workId, slot)
    return { ok: true }
  }

  /**
   * 生成存档摘要
   */
  generateExcerpt(saveData) {
    if (!saveData) return ''

    const { currentSceneIndex, storyScenes } = saveData
    const currentScene = storyScenes?.[currentSceneIndex]

    if (currentScene?.dialogues?.length > 0) {
      const dialogue = currentScene.dialogues[0]
      const text = typeof dialogue === 'string' ? dialogue : dialogue.text
      return text.substring(0, 30) + '...'
    }

    return '未知场景'
  }
}

/**
 * Mock 故事服务
 */
export class MockStoryService {
  /**
   * 获取后续剧情
   */
  async getNextScenes(workId, afterSceneId) {
    await delay(800)

    // 模拟生成中
    if (Math.random() < 0.1) {
      return { generating: true, end: false, nextScenes: [] }
    }

    // 模拟结束
    if (Math.random() < 0.2) {
      return { end: true }
    }

    // 返回模拟场景
    return {
      end: false,
      nextScenes: [
        {
          id: `scene_${Date.now()}`,
          backgroundImage: 'https://picsum.photos/1920/1080?random=' + Date.now(),
          dialogues: [
            '（场景描写）月色如水,宫墙内外一片寂静。',
            '你漫步在御花园的九曲桥上,思绪万千。',
            '远处传来微弱的脚步声……'
          ]
        }
      ]
    }
  }

  /**
   * 提交选项选择
   */
  async submitChoice(workId, choiceId, context) {
    await delay(600)

    return {
      attributesDelta: { 心计: 2, 声望: 1 },
      statusesDelta: { 德妃印象: 3 },
      insertScenes: [
        {
          id: `choice_scene_${Date.now()}`,
          dialogues: ['你的选择让局势发生了微妙的变化……', '德妃若有所思地看着你。']
        }
      ],
      end: false
    }
  }

  /**
   * 获取作品信息
   */
  async getWorkInfo(workId) {
    await delay(300)

    return {
      id: workId,
      title: '锦瑟深宫',
      coverUrl: 'https://picsum.photos/400/600?random=work' + workId,
      authorId: 'author_001',
      description: '第一章·初入宫闱……'
    }
  }

  /**
   * 获取初始场景
   */
  async getInitialScenes(workId) {
    await delay(500)

    return [
      {
        id: 1,
        backgroundImage: 'https://picsum.photos/1920/1080?random=init',
        dialogues: [
          { text: '（场景描写）宫门巍峨,红墙金瓦,檐角飞翘。' },
          '林微月提着行囊,缓步走入这深宫内院。',
          '她知道,从今日起,命运已不再属于自己。'
        ]
      }
    ]
  }
}

// 创建单例
export const mockSaveService = new MockSaveService()
export const mockStoryService = new MockStoryService()

// 默认导出
export default {
  save: mockSaveService,
  story: mockStoryService
}
