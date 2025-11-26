<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { fetchPersonalityReportVariants } from '../service/personality.js'
import { getScenes, getWorkInfo } from '../service/story.js'
import { http } from '../service/http.js'

const router = useRouter()
const route = useRoute()

// 从sessionStorage获取游戏数据（优先），然后才是路由state
const getGameDataFromSession = () => {
  try {
    const stored = sessionStorage.getItem('settlementData')
    if (stored) {
      const parsed = JSON.parse(stored)
      console.log('Loaded settlement data from sessionStorage:', parsed)
      return parsed
    }
  } catch (e) {
    console.warn('Failed to parse settlement data from sessionStorage:', e)
  }
  return null
}

const sessionData = getGameDataFromSession()

// 尝试从多个来源获取 workId
const getWorkId = () => {
  // 优先级：sessionData > history.state > route.params > sessionStorage.lastWorkMeta
  if (sessionData?.work?.id) {
    console.log('[Settlement] workId 来自 sessionData.work.id:', sessionData.work.id)
    return sessionData.work.id
  }
  if (history.state?.work?.id) {
    console.log('[Settlement] workId 来自 history.state.work.id:', history.state.work.id)
    return history.state.work.id
  }
  if (route.params?.id) {
    console.log('[Settlement] workId 来自 route.params.id:', route.params.id)
    return parseInt(route.params.id)
  }
  
  // 尝试从 sessionStorage 获取最后一次游戏的作品信息
  try {
    const lastWorkMeta = JSON.parse(sessionStorage.getItem('lastWorkMeta'))
    if (lastWorkMeta?.id) {
      console.log('[Settlement] workId 来自 lastWorkMeta:', lastWorkMeta.id)
      return lastWorkMeta.id
    }
  } catch (e) {
    console.warn('Failed to parse lastWorkMeta:', e)
  }
  
  console.error('[Settlement] 无法获取 workId，将使用默认值 1')
  return 1
}

const workId = getWorkId()

// 从多个来源获取完整的 work 对象
const getWorkObject = () => {
  // 优先从 sessionData 获取完整的 work 对象
  if (sessionData?.work && typeof sessionData.work === 'object') {
    console.log('[Settlement] work 对象来自 sessionData:', sessionData.work)
    // 确保 work 对象包含 id
    return {
      id: sessionData.work.id || workId,
      ...sessionData.work
    }
  }
  
  // 其次从 history.state 获取
  if (history.state?.work && typeof history.state.work === 'object') {
    console.log('[Settlement] work 对象来自 history.state:', history.state.work)
    // 确保 work 对象包含 id
    return {
      id: history.state.work.id || workId,
      ...history.state.work
    }
  }
  
  // 尝试从 lastWorkMeta 获取
  try {
    const lastWorkMeta = JSON.parse(sessionStorage.getItem('lastWorkMeta'))
    if (lastWorkMeta && typeof lastWorkMeta === 'object') {
      console.log('[Settlement] work 对象来自 lastWorkMeta:', lastWorkMeta)
      // 确保 work 对象包含 id
      return {
        id: lastWorkMeta.id || workId,
        ...lastWorkMeta
      }
    }
  } catch (e) {
    console.warn('Failed to parse lastWorkMeta:', e)
  }
  
  // 如果都没有，构造一个基本的 work 对象
  console.warn('[Settlement] 无法获取完整 work 对象，使用基本信息构造')
  return {
    id: workId,
    title: sessionData?.work?.title || history.state?.work?.title || '未知作品'
  }
}

// 从多个来源获取游戏数据，优先级：sessionStorage > history.state > 默认值
const gameData = ref({
  work: getWorkObject(),
  choiceHistory: sessionData?.choiceHistory || history.state?.choiceHistory || [],
  finalAttributes: sessionData?.finalAttributes || history.state?.finalAttributes || {},
  finalStatuses: sessionData?.finalStatuses || history.state?.finalStatuses || {},
  storyScenes: sessionData?.storyScenes || history.state?.storyScenes || [],
  currentSceneIndex: sessionData?.currentSceneIndex || history.state?.currentSceneIndex || 0,
  currentDialogueIndex: sessionData?.currentDialogueIndex || history.state?.currentDialogueIndex || 0
})

console.log('[Settlement] 使用的 workId:', workId, '完整 work 信息:', gameData.value.work)

// 如果没有传递真实的属性数据，才使用默认值（用于调试）
// NOTE: Removed local mock defaults so settlement page uses backend-provided data for testing.
// If backend does not provide finalAttributes/finalStatuses, leave them empty and
// surface a visible warning in the UI (handled in template) or in the console.
if (Object.keys(gameData.value.finalAttributes).length === 0) {
  console.warn('SettlementPage: finalAttributes not provided by backend; leaving empty for backend testing')
}

if (Object.keys(gameData.value.finalStatuses).length === 0) {
  console.warn('SettlementPage: finalStatuses not provided by backend; leaving empty for backend testing')
}

console.log('SettlementPage - Final Game Data:', gameData.value) // 调试日志

// UI 状态
const showAttributesModal = ref(false)
const currentView = ref('overview') // overview, branching, personality

// 分支探索图状态
const branchingGraph = ref({ nodes: [], edges: [] })
const isDragging = ref(false)
const dragNode = ref(null)
const isBranchingFullscreen = ref(false)
// 节点与缩略图尺寸（统一缩略图用于节点顶部）
const THUMB_W = 160
const THUMB_H = 96
const NODE_MARGIN = 20
// 节点内边距（用于使图片与边框保持间距，产生“包裹/融合”感）
const NODE_PAD_X = 12
const NODE_PAD_Y = 10

// 文本拆行辅助：将长字符串按固定宽度切分为多行（用于 SVG <tspan> 渲染）
const splitLines = (text = '', chunk = 12) => {
  if (!text) return []
  const s = String(text)
  const lines = []
  for (let i = 0; i < s.length; i += chunk) {
    lines.push(s.substring(i, i + chunk))
  }
  return lines
}

// 去掉装饰性破折号等前后缀，提取实际标题
const stripDecorative = (s = '') => {
  if (!s) return ''
  return String(s).replace(/^[\-—_\s]+|[\-—_\s]+$/g, '').trim()
}

// 计算节点尺寸和描述行：基于字符宽度估算，使节点宽度/高度自适应文本
const computeNodeLayout = (title = '', description = '', opts = {}) => {
  // 支持图片尺寸的布局计算：如果提供 imageWidth/imageHeight，则节点宽度与图片宽一致
  const CHAR_PX = opts.charPx || 8
  const PAD_X = typeof opts.padX === 'number' ? opts.padX : NODE_PAD_X
  const PAD_Y = typeof opts.padY === 'number' ? opts.padY : NODE_PAD_Y
  const TITLE_H = opts.titleH || 18
  const LINE_H = opts.lineH || 14
  const MIN_W = opts.minW || 80
  const MAX_W = opts.maxW || 360
  const MAX_CHARS = Math.max(6, Math.floor((MAX_W - PAD_X * 2) / CHAR_PX))

  const descLines = splitLines(stripDecorative(description || ''), Math.max(6, Math.min(MAX_CHARS, opts.chunk || 18)))
  const maxLineLen = Math.max(String(title || '').length, ...descLines.map(l => l.length || 0))

  // 图片优先决定宽度。为让边框包裹图片，节点宽度在图片宽度基础上增加左右内边距
  const imageW = opts.imageW || null
  const width = imageW ? (imageW + PAD_X * 2) : Math.min(MAX_W, Math.max(MIN_W, maxLineLen * CHAR_PX + PAD_X * 2))

  // 高度：上下内边距 + 顶部图片高度 + 标题高度 + 描述行高度
  const imageH = opts.imageH || 0
  const height = PAD_Y * 2 + imageH + TITLE_H + (descLines.length > 0 ? descLines.length * LINE_H : 0)
  return { width, height, descLines, imageW, imageH }
}

// 根据节点动态计算画布尺寸，确保可以滚动查看全部内容
const graphHeight = computed(() => {
  const nodes = branchingGraph.value.nodes || []
  if (!nodes || nodes.length === 0) return 600
  // 计算基于节点底部的高度，并添加上下留白
  const bottoms = nodes.map(n => (n.y || 0) + (n.height || THUMB_H) / 2)
  const tops = nodes.map(n => (n.y || 0) - (n.height || THUMB_H) / 2)
  const maxBottom = Math.max(...bottoms)
  const minTop = Math.min(...tops)
  const padding = 200
  const h = (maxBottom - minTop) + padding
  return Math.max(600, h)
})

const graphWidth = computed(() => {
  const nodes = branchingGraph.value.nodes || []
  if (!nodes || nodes.length === 0) return 900
  // 计算基于节点左右边界的画布宽度
  const lefts = nodes.map(n => (n.x || 0) - (n.width || THUMB_W) / 2)
  const rights = nodes.map(n => (n.x || 0) + (n.width || THUMB_W) / 2)
  const minLeft = Math.min(...lefts)
  const maxRight = Math.max(...rights)
  const padding = 300
  const w = (maxRight - minLeft) + padding
  return Math.max(900, w)
})

// 简单的碰撞消解：多轮相互推开，减少重叠
const resolveNodeOverlaps = () => {
  const nodes = branchingGraph.value.nodes
  if (!nodes || nodes.length <= 1) return
  const maxIter = 10
  // 基于每个节点的宽高做碰撞消解，支持节点尺寸不一（图片导致宽度不同）
  for (let iter = 0; iter < maxIter; iter++) {
    let moved = false
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]
        // 确保有坐标
        if (typeof a.x !== 'number' || typeof a.y !== 'number' || typeof b.x !== 'number' || typeof b.y !== 'number') continue

        const dx = a.x - b.x
        const dy = a.y - b.y

        const aHalfW = (a.width || THUMB_W) / 2
        const bHalfW = (b.width || THUMB_W) / 2
        const aHalfH = (a.height || THUMB_H) / 2
        const bHalfH = (b.height || THUMB_H) / 2

        const overlapX = (aHalfW + bHalfW + NODE_MARGIN) - Math.abs(dx)
        const overlapY = (aHalfH + bHalfH + NODE_MARGIN) - Math.abs(dy)

        if (overlapX > 0 && overlapY > 0) {
          // 优先沿着重合更严重的方向分离
          if (overlapX > overlapY) {
            const push = overlapX / 2
            const sign = dx >= 0 ? 1 : -1
            a.x += sign * push
            b.x -= sign * push
          } else {
            const push = overlapY / 2
            const sign = dy >= 0 ? 1 : -1
            a.y += sign * push
            b.y -= sign * push
          }
          moved = true
        }
      }
    }
    if (!moved) break
  }
}

// 个性报告
const personalityReport = ref({
  title: '',
  content: '',
  traits: [],
  scores: {}
})

// 预设个性报告模板（基于最终属性）
const personalityTemplates = [
  {
    condition: (attrs) => attrs['心计'] >= 50 && attrs['圣宠'] >= 30,
    title: '宫心计谋家',
    content: '你在深宫中展现了出色的智慧与手段，善于察言观色，步步为营。你的每一个选择都经过深思熟虑，最终在宫斗中占据了有利位置。',
    traits: ['善于谋划', '察言观色', '步步为营', '深谋远虑'],
    scores: { 智慧: 95, 手段: 88, 人缘: 75, 威望: 82 }
  },
  {
    condition: (attrs) => attrs['才情'] >= 60 && attrs['声望'] >= 20,
    title: '才华横溢的文雅佳人',
    content: '你凭借出众的才华和优雅的气质在宫中赢得了众人的赞赏。无论是诗词歌赋还是琴棋书画，你都能信手拈来，成为宫中的一道亮丽风景。',
    traits: ['才华出众', '气质优雅', '博学多才', '温文尔雅'],
    scores: { 才华: 92, 气质: 90, 学识: 85, 魅力: 88 }
  },
  {
    condition: (attrs) => attrs['健康'] >= 80 && attrs['心计'] <= 30,
    title: '天真烂漫的纯真少女',
    content: '你保持着一颗纯真的心，在复杂的宫廷中依然坚持自己的本心。虽然不善权谋，但你的真诚和善良为你赢得了真心朋友。',
    traits: ['心地善良', '真诚待人', '天真无邪', '坚持本心'],
    scores: { 纯真: 95, 善良: 92, 真诚: 90, 坚韧: 78 }
  },
  {
    condition: (attrs) => attrs['声望'] >= 30,
    title: '备受瞩目的宫中新星',
    content: '你在宫中迅速崭露头角，凭借自己的努力和智慧获得了众人的认可。你的名声在后宫中传播，成为了不可忽视的存在。',
    traits: ['迅速成长', '备受瞩目', '努力上进', '潜力无限'],
    scores: { 影响力: 88, 成长性: 92, 适应力: 85, 潜力: 90 }
  }
]

// 默认个性报告
const defaultPersonalityReport = {
  title: '谨慎新人',
  content: '你小心翼翼,每一步都走得格外谨慎。虽然还在适应星际生活,但你的谨慎和观察力将会是你在太空中生存的重要武器。',
  traits: ['小心谨慎', '善于观察', '稳重内敛', '厚积薄发'],
  scores: { 谨慎: 85, 观察力: 80, 适应力: 75, 潜力: 82 }
}

// 缓存章节数据,避免重复请求
const chapterDataCache = ref({})

// 获取指定章节的数据(包括背景图等)
const fetchChapterData = async (workId, chapterIndex) => {
  const cacheKey = `${workId}_${chapterIndex}`
  
  // 如果已缓存,直接返回
  if (chapterDataCache.value[cacheKey]) {
    return chapterDataCache.value[cacheKey]
  }
  
  try {
    console.log(`[Settlement] 获取章节 ${chapterIndex} 的数据...`)
    const data = await getScenes(workId, chapterIndex, { maxRetries: 1 })
    
    // 提取第一个场景的背景图作为章节代表图
    let backgroundImage = null
    if (data && data.scenes && data.scenes.length > 0) {
      backgroundImage = data.scenes[0].backgroundImage || null
    }
    
    const result = {
      chapterIndex: data?.chapterIndex || chapterIndex,
      title: data?.title || `第${chapterIndex}章`,
      backgroundImage: backgroundImage,
      scenes: data?.scenes || []
    }
    
    // 缓存结果
    chapterDataCache.value[cacheKey] = result
    console.log(`[Settlement] 章节 ${chapterIndex} 数据获取成功:`, result)
    
    return result
  } catch (error) {
    console.warn(`[Settlement] 获取章节 ${chapterIndex} 数据失败:`, error)
    // 返回默认数据
    return {
      chapterIndex: chapterIndex,
      title: `第${chapterIndex}章`,
      backgroundImage: null,
      scenes: []
    }
  }
}

// 生成分支探索图
// 规则：
// - 每个选择场景都会展示所有选项；
// - 用户实际选择的选项用高亮标记，并连接到"主线继续"节点；
// - 未选择的选项连接到一个问号节点"?"；
// - 所有节点标题限制为前6个字符；
// - 尝试在末端显示"故事完结"或"主线"汇合节点。
const generateBranchingGraph = async () => {
  const nodes = []
  const edges = []
  let nodeId = 0

  // 确保使用有效的 workId
  const currentWorkId = gameData.value.work?.id || workId
  if (!currentWorkId || currentWorkId <= 0) {
    console.warn('[Settlement] 无法生成分支图: 缺少有效的 workId，当前值:', currentWorkId)
    branchingGraph.value = { nodes: [], edges: [] }
    return
  }
  
  console.log('[Settlement] 生成分支图，使用 workId:', currentWorkId)

  // 收集所有需要获取的章节索引
  const chaptersToFetch = new Set([1]) // 始终获取第一章
  gameData.value.choiceHistory.forEach((userChoice) => {
    const chapterIdx = userChoice.chapterIndex
    if (chapterIdx != null && chapterIdx > 0) {
      chaptersToFetch.add(chapterIdx)
    }
  })
  
  // 批量获取所有章节数据
  console.log('[Settlement] 需要获取的章节:', Array.from(chaptersToFetch))
  const chapterDataPromises = Array.from(chaptersToFetch).map(idx => 
    fetchChapterData(currentWorkId, idx)
  )
  await Promise.all(chapterDataPromises)
  console.log('[Settlement] 所有章节数据已加载完成')

  // 起始节点：优先使用后端传来的第一章标题作为起始节点名称（例如"第一章 标题"），
  // 如果没有可用章节数据则回退到默认标题
  const firstChapter = (gameData.value.storyScenes && gameData.value.storyScenes.length > 0) ? gameData.value.storyScenes[0] : null
  let startTitle = '初入深宫'
  let startDescription = '故事开始，初入宫闱'
  let startImage = null
  
  // 从缓存中获取第一章数据 - 使用 currentWorkId
  const cacheKey1 = `${currentWorkId}_1`
  const chapter1Data = chapterDataCache.value[cacheKey1]
  if (chapter1Data) {
    startTitle = chapter1Data.title || startTitle
    startDescription = chapter1Data.title || startDescription
    startImage = chapter1Data.backgroundImage || null
    
    // 如果缓存中的标题为空，尝试从第一个场景的 dialogue 获取
    if (!startDescription || startDescription === chapter1Data.title) {
      if (chapter1Data.scenes && chapter1Data.scenes.length > 0) {
        const firstScene = chapter1Data.scenes[0]
        if (Array.isArray(firstScene.dialogues) && firstScene.dialogues.length > 0) {
          const raw = firstScene.dialogues[0]
          const txt = raw && (raw.text ?? raw.narration ?? '')
          const stripped = stripDecorative(txt)
          if (stripped) startDescription = stripped
        }
      }
    }
  } 
  // 如果缓存中没有数据，再使用 firstChapter（来自 gameData）
  else if (firstChapter) {
    const idx = firstChapter.chapterIndex || 1
    const chapterLabel = idx === 1 ? '第一章' : `第${idx}章`
    startTitle = `${chapterLabel} ${firstChapter.title || ''}`.trim()
    // 优先使用 chapterTitle/title 字段；若缺失则尝试从第一个 dialogue 的文本中提取（去掉装饰性破折号）
    startDescription = firstChapter.title || ''
    if (!startDescription && Array.isArray(firstChapter.dialogues) && firstChapter.dialogues.length > 0) {
      const raw = firstChapter.dialogues[0]
      const txt = raw && (raw.text ?? raw.narration ?? '')
      startDescription = stripDecorative(txt)
    }
  }

  // 起始节点的粗体标题只显示章节编号（例如：第1章），完整章节名放在 description 中
  const startShortTitle = '第1章'
  {
    // 如果还没有图片，尝试从 chapter1Data 或 firstChapter 获取（作为后备）
    if (!startImage) {
      if (chapter1Data && chapter1Data.scenes && chapter1Data.scenes.length > 0) {
        startImage = chapter1Data.scenes[0].backgroundImage || null
      } else if (firstChapter) {
        if (Array.isArray(firstChapter.scenes) && firstChapter.scenes.length > 0) {
          startImage = firstChapter.scenes[0].backgroundImage || null
        } else if (firstChapter.backgroundImage) {
          startImage = firstChapter.backgroundImage || null
        } else if (firstChapter.scene && firstChapter.scene.backgroundImage) {
          startImage = firstChapter.scene.backgroundImage || null
        }
      }
    }
    const layout = computeNodeLayout(startShortTitle, startDescription, { imageW: THUMB_W, imageH: THUMB_H })
    nodes.push({
      id: nodeId++,
      title: startShortTitle,
      type: 'start',
      x: 400,
      y: 50,
      description: startDescription,
      width: layout.width,
      height: layout.height,
      descLines: layout.descLines,
      image: startImage,
      imageW: layout.imageW || 0,
      imageH: layout.imageH || 0
    })
  }

  let currentY = 150
  let lastNodeId = 0

  // 根据用户的选择历史按顺序生成分支图
  gameData.value.choiceHistory.forEach((userChoice, historyIndex) => {
    // 首先确定章节索引
    let chapterIdx = null
    if (userChoice && userChoice.chapterIndex) {
      chapterIdx = userChoice.chapterIndex
    }
    const fallbackIdx = historyIndex + 1
    const displayIdx = chapterIdx != null ? chapterIdx : fallbackIdx
    
    // 🔑 关键修复：从缓存中获取该章节的完整数据
    const cacheKey = `${currentWorkId}_${displayIdx}`
    const cachedChapterData = chapterDataCache.value[cacheKey]
    
    console.log(`[Settlement] 处理章节 ${displayIdx}，缓存数据:`, cachedChapterData)
    
    // 🔑 关键修复：优先使用缓存的章节数据中的选项列表
    let choicesForThisChapter = []
    
    // 从缓存的章节数据中提取所有选项
    if (cachedChapterData && cachedChapterData.scenes && cachedChapterData.scenes.length > 0) {
      // 查找具有 choices 的场景（通常是第一个有选择的场景）
      const sceneWithChoices = cachedChapterData.scenes.find(s => s.choices && s.choices.length > 0)
      if (sceneWithChoices && sceneWithChoices.choices) {
        choicesForThisChapter = sceneWithChoices.choices
        console.log(`[Settlement] 章节 ${displayIdx} 从缓存获取到 ${choicesForThisChapter.length} 个选项:`, choicesForThisChapter)
      }
    }
    
    // 如果缓存中没有找到选项，尝试从 userChoice 中恢复
    if (choicesForThisChapter.length === 0) {
      console.log(`[Settlement] 警告：章节 ${displayIdx} 缓存中无选项，尝试从 userChoice 恢复`)
      
      if (userChoice.allChoices && Array.isArray(userChoice.allChoices) && userChoice.allChoices.length > 0) {
        choicesForThisChapter = userChoice.allChoices
        console.log(`[Settlement] 从 userChoice.allChoices 恢复了 ${choicesForThisChapter.length} 个选项`)
      } else if (userChoice.choices && Array.isArray(userChoice.choices) && userChoice.choices.length > 0) {
        choicesForThisChapter = userChoice.choices
        console.log(`[Settlement] 从 userChoice.choices 恢复了 ${choicesForThisChapter.length} 个选项`)
      } else if (userChoice.choiceId) {
        // 至少构造用户选择的那个选项
        choicesForThisChapter = [{ 
          id: userChoice.choiceId, 
          text: userChoice.choiceText || '已选择',
          choiceId: userChoice.choiceId
        }]
        console.log(`[Settlement] 从 userChoice 构造了单个选项`)
      }
    }

    // 场景节点（选择发生的地方）
    const sceneNodeId = nodeId++
    
    // 场景节点：粗体（title）只显示章节编号，如 "第1章"；浅色描述（description）显示完整章节标题
    let chapterTitle = ''
    
    // 优先从缓存的章节数据获取标题
    if (cachedChapterData && cachedChapterData.title) {
      chapterTitle = cachedChapterData.title
    } else if (userChoice && userChoice.sceneTitle) {
      chapterTitle = userChoice.sceneTitle
    }

    const sceneShortTitle = `第${displayIdx}章`
    let sceneFullTitle = chapterTitle || `第${displayIdx}章`
    
    // 若没有显式的 chapterTitle，则尝试从缓存的章节数据或场景第一个 dialogue 提取
    if (!chapterTitle || chapterTitle === '') {
      if (cachedChapterData && cachedChapterData.scenes && cachedChapterData.scenes.length > 0) {
        const firstCachedScene = cachedChapterData.scenes[0]
        if (Array.isArray(firstCachedScene.dialogues) && firstCachedScene.dialogues.length > 0) {
          const raw = firstCachedScene.dialogues[0]
          const txt = raw && (raw.text ?? raw.narration ?? '')
          const stripped = stripDecorative(txt)
          if (stripped) sceneFullTitle = stripped
        }
      }
    }

    // 从缓存中获取当前章节的背景图
    const sceneImage = cachedChapterData?.backgroundImage || null
    
    {
      const layout = computeNodeLayout(sceneShortTitle, sceneFullTitle, { imageW: THUMB_W, imageH: THUMB_H })
      nodes.push({
        id: sceneNodeId,
        title: sceneShortTitle,
        type: 'scene',
        x: 400,
        y: currentY,
        description: sceneFullTitle,
        width: layout.width,
        height: layout.height,
        descLines: layout.descLines,
        image: sceneImage,
        imageW: layout.imageW || 0,
        imageH: layout.imageH || 0
      })
    }

    // 连接上一个节点到当前场景
    edges.push({
      from: lastNodeId,
      to: sceneNodeId,
      label: historyIndex === 0 ? '开始' : '',
      isSelected: true
    })

    // 🔑 关键修复：为这个章节的所有选项创建节点（使用正确的选项列表）
    const choiceSpacing = 240
    const startX = 400 - (choicesForThisChapter.length - 1) * choiceSpacing / 2
    
    console.log(`[Settlement] 章节 ${displayIdx} 渲染 ${choicesForThisChapter.length} 个选项`)

    choicesForThisChapter.forEach((choice, choiceIndex) => {
      const choiceX = startX + choiceIndex * choiceSpacing
      const choiceY = currentY + 120

      // 兼容选项的 id 或 choiceId 字段
      const currentChoiceId = choice.id || choice.choiceId
      
      // 判断是否是用户实际选择的选项
      const selectedChoiceId = userChoice && userChoice.choiceId ? userChoice.choiceId : null
      const isUserChoice = selectedChoiceId != null && currentChoiceId === selectedChoiceId

      const optLetter = String.fromCharCode(65 + choiceIndex) // A, B, C...
      const choiceShortTitle = `选项${optLetter}`

      console.log(`[Settlement] 章节 ${displayIdx} 选项 ${choiceIndex}: choiceId=${currentChoiceId}, isUserChoice=${isUserChoice}, text="${choice.text}"`)

      if (isUserChoice) {
        // 显示带缩略图的用户选择节点
        const choiceNodeId = nodeId++
        
        const layout = computeNodeLayout(choiceShortTitle, (choice.text || '').toString(), { imageW: THUMB_W, imageH: THUMB_H })
        nodes.push({
          id: choiceNodeId,
          title: choiceShortTitle,
          type: 'choice-selected',
          x: choiceX,
          y: choiceY,
          description: (choice.text || '').toString(),
          width: layout.width,
          height: layout.height,
          descLines: layout.descLines,
          isSelected: true,
          image: sceneImage, // 使用场景的背景图
          imageW: layout.imageW || 0,
          imageH: layout.imageH || 0
        })

        // 连接场景到选项
        edges.push({ from: sceneNodeId, to: choiceNodeId, label: '', isSelected: true })

        // 为用户选择创建主线节点
        const mainlineNodeId = nodeId++
        const mainDesc = `选择"${(choice.text || '').toString()}"后接入主线`
        const layoutMain = computeNodeLayout('主线', mainDesc, { imageW: THUMB_W, imageH: THUMB_H })
        nodes.push({
          id: mainlineNodeId,
          title: '主线',
          type: 'result',
          x: choiceX,
          y: choiceY + 120,
          description: mainDesc,
          width: layoutMain.width,
          height: layoutMain.height,
          descLines: layoutMain.descLines,
          image: sceneImage, // 使用场景的背景图
          imageW: layoutMain.imageW || 0,
          imageH: layoutMain.imageH || 0
        })

        edges.push({ from: choiceNodeId, to: mainlineNodeId, label: '', isSelected: true })
        lastNodeId = mainlineNodeId
      } else {
        // 未选择的选项直接显示问号节点（不显示背景图和具体选项文本）
        const questionNodeId = nodeId++
        const layoutQ = computeNodeLayout('?', '未探索的分支')
        nodes.push({
          id: questionNodeId,
          title: '?',
          type: 'question',
          x: choiceX,
          y: choiceY + 80,
          description: '未探索的分支',
          width: layoutQ.width,
          height: layoutQ.height,
          descLines: layoutQ.descLines,
          imageW: layoutQ.imageW || 0,
          imageH: layoutQ.imageH || 0
        })

        // 场景直接连接到问号节点
        edges.push({ from: sceneNodeId, to: questionNodeId, label: '', isSelected: false })
      }
    })

    currentY += 320 // 增加垂直间距以容纳缩略图与文字
  })

  // 结束节点
  // 在生成结束/汇合节点之前，尝试获取后端的结局列表并把已进入的结局显示为图像，其它结局显示为问号并在下方显示标题
  try {
    const resp = await http.get(`/api/game/storyending/${currentWorkId}`)
    const payload = resp && resp.data ? resp.data : resp
    const endings = Array.isArray(payload?.endings) ? payload.endings : []
    if (endings.length > 0) {
      const storedTitle = sessionStorage.getItem(`selectedEndingTitle_${currentWorkId}`)
      const endCount = endings.length
      const endSpacing = 240
      const endStartX = 400 - (endCount - 1) * endSpacing / 2
      let endY = currentY + 40
      // 保存进入结局前的父节点ID，所有结局分支都从该节点分出，避免将未选中结局连接到已选中结局的节点上
      const endingsParentNodeId = lastNodeId
      for (let ei = 0; ei < endings.length; ei++) {
        const ed = endings[ei]
        const ex = endStartX + ei * endSpacing
        const etitle = ed.title || `结局 ${ei + 1}`
        if (storedTitle && etitle === storedTitle) {
          // 已进入的结局：显示首图缩略并连接为已选分支
          const endImage = (Array.isArray(ed.scenes) && ed.scenes.length > 0) ? (ed.scenes[0].backgroundImage || null) : null
          const layoutE = computeNodeLayout('结局', etitle, { imageW: THUMB_W, imageH: THUMB_H })
          const endNodeId = nodeId++
          nodes.push({
            id: endNodeId,
            title: '结局',
            type: 'ending-selected',
            x: ex,
            y: endY,
            description: etitle,
            width: layoutE.width,
            height: layoutE.height,
            descLines: layoutE.descLines,
            image: endImage,
            imageW: layoutE.imageW || 0,
            imageH: layoutE.imageH || 0,
            isSelected: true
          })
          edges.push({ from: endingsParentNodeId, to: endNodeId, label: '', isSelected: true })
          // 不要修改 lastNodeId，这样后续未选中结局仍然从 parent 出发
        } else {
          // 未进入的结局：显示问号节点，但在描述中显示结局标题
          const layoutQ = computeNodeLayout('?', etitle)
          const qNodeId = nodeId++
          nodes.push({
            id: qNodeId,
            title: '?',
            type: 'ending-unseen',
            x: ex,
            y: endY,
            description: etitle,
            width: layoutQ.width,
            height: layoutQ.height,
            descLines: layoutQ.descLines,
            imageW: layoutQ.imageW || 0,
            imageH: layoutQ.imageH || 0
          })
          edges.push({ from: endingsParentNodeId, to: qNodeId, label: '', isSelected: false })
        }
      }
      currentY += 220
    }
  } catch (e) {
    console.warn('[Settlement] 获取结局列表失败，跳过在分支图显示结局缩略图:', e)
  }

  if (gameData.value.choiceHistory.length > 0) {
    const endNodeId = nodeId++
    const layoutEnd = computeNodeLayout('主线/完结', '分支收束于主线，完成一次旅程')
    nodes.push({
      id: endNodeId,
      title: '主线/完结',
      type: 'end',
      x: 400,
      y: currentY + 100,
      description: '分支收束于主线，完成一次旅程',
      width: layoutEnd.width,
      height: layoutEnd.height,
      descLines: layoutEnd.descLines,
      imageW: layoutEnd.imageW || 0,
      imageH: layoutEnd.imageH || 0
    })

    edges.push({
      from: lastNodeId,
      to: endNodeId,
      label: '',
      isSelected: true
    })
  }
  branchingGraph.value = { nodes, edges }
  // 生成后做一次碰撞消解，减少重合
  resolveNodeOverlaps()
  // 归一化：确保最左/最上有足够留白，避免被 svg 裁剪
  if (nodes.length > 0) {
    const lefts = nodes.map(n => (n.x || 0) - (n.width || THUMB_W) / 2)
    const tops = nodes.map(n => (n.y || 0) - (n.height || THUMB_H) / 2)
    const minLeft = Math.min(...lefts)
    const minTop = Math.min(...tops)
    const PAD = 40
    const offsetX = minLeft < PAD ? (PAD - minLeft) : 0
    const offsetY = minTop < PAD ? (PAD - minTop) : 0
    if (offsetX !== 0 || offsetY !== 0) {
      nodes.forEach(n => {
        n.x = (n.x || 0) + offsetX
        n.y = (n.y || 0) + offsetY
      })
    }
  }
}

// 生成个性报告（调用 service 层；service 会尝试后端，失败时回退到前端 mock）
// 辅助：判断变体是否满足当前属性/状态
const variantMatches = (variant, attrs = {}, stats = {}) => {
  const min = variant.minAttributes || {}
  for (const k of Object.keys(min)) {
    if ((attrs[k] || 0) < (min[k] || 0)) return false
  }
  const req = variant.requiredStatuses || {}
  for (const sk of Object.keys(req)) {
    const want = req[sk]
    if (want === true) {
      if (!stats || stats[sk] !== true) return false
    } else {
      if (!stats || stats[sk] !== want) return false
    }
  }
  return true
}

const generatePersonalityReport = async () => {
  try {
    const attrs = gameData.value.finalAttributes || {}
    const statuses = gameData.value.finalStatuses || {}
    // 确保使用有效的 workId
    const currentWorkId = gameData.value.work?.id || workId
    console.log('Fetching personality report variants... workId:', currentWorkId, 'attrs/statuses:', attrs, statuses)
    const variants = await fetchPersonalityReportVariants(currentWorkId, attrs, statuses)
    console.log('Variants received:', variants)

    const matched = (Array.isArray(variants) ? variants.find(v => variantMatches(v, attrs, statuses)) : null)
    if (matched && matched.report) {
      personalityReport.value = matched.report
    } else {
      personalityReport.value = defaultPersonalityReport
    }
    console.log('Selected personality report:', personalityReport.value)
  } catch (err) {
    console.warn('generatePersonalityReport failed, using default:', err)
    personalityReport.value = defaultPersonalityReport
  }
}

// 拖拽相关函数
const startDrag = (event, node) => {
  if (event.type === 'mousedown') {
    isDragging.value = true
    dragNode.value = node
    
    const onMouseMove = (e) => {
      if (isDragging.value && dragNode.value) {
        const container = document.querySelector('.branching-graph')
        const rect = container.getBoundingClientRect()
        const scrollLeft = container.scrollLeft || 0
        const scrollTop = container.scrollTop || 0
        dragNode.value.x = e.clientX - rect.left + scrollLeft
        dragNode.value.y = e.clientY - rect.top + scrollTop
      }
    }
    
    const onMouseUp = () => {
      isDragging.value = false
      dragNode.value = null
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      // 拖拽结束后整理布局，避免与其它节点重叠
      resolveNodeOverlaps()
    }
    
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }
}

// 返回游戏或主页
const goBack = () => {
  router.push('/works')
}

const continueGame = () => {
  // 重新开始当前作品，携带封面与标题用于加载页背景
  try {
    const meta = {
      id: gameData.value.work.id,
      title: gameData.value.work.title,
      coverUrl: gameData.value.work.coverUrl
    }
    sessionStorage.setItem('lastWorkMeta', JSON.stringify(meta))
  } catch {}
  router.push({
    path: `/game/${gameData.value.work.id}`,
    state: {
      title: gameData.value.work.title,
      coverUrl: gameData.value.work.coverUrl
    }
  })
}

onMounted(async () => {
  console.log('SettlementPage mounted with data:', gameData.value)
  console.log('Final Attributes:', gameData.value.finalAttributes)
  console.log('Final Statuses:', gameData.value.finalStatuses)
  
  // 获取作品详情，更新作品标题
  try {
    const workInfo = await getWorkInfo(workId)
    if (workInfo && workInfo.title) {
      gameData.value.work.title = workInfo.title
      console.log('[Settlement] 成功获取作品详情:', workInfo.title)
    }
  } catch (error) {
    console.warn('[Settlement] 获取作品详情失败:', error)
    // 保持使用原有的 title，不影响页面渲染
  }
  
  await generateBranchingGraph()
  await generatePersonalityReport()
  
  // 清理sessionStorage中的临时数据
  setTimeout(() => {
    sessionStorage.removeItem('settlementData')
  }, 1000) // 延迟1秒清理，确保页面已经加载完成
})
</script>

<template>
  <div class="settlement-page">
    <!-- 顶部导航 -->
    <div class="top-nav">
      <button class="nav-btn back-btn" @click="goBack">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M19 12H6m6-7l-7 7 7 7"/>
        </svg>
        返回
      </button>
      
      <h1 class="page-title">{{ gameData.work.title }} - 游戏结算</h1>
      
      <div class="quick-actions">
        <button class="nav-btn" @click="showAttributesModal = true">属性</button>
      </div>
    </div>

    <!-- 视图切换标签 -->
    <div class="view-tabs">
      <button 
        class="tab-btn" 
        :class="{ active: currentView === 'overview' }"
        @click="currentView = 'overview'"
      >
        总览
      </button>
      <button 
        class="tab-btn" 
        :class="{ active: currentView === 'branching' }"
        @click="currentView = 'branching'; isBranchingFullscreen = true"
      >
        分支探索
      </button>
      <button 
        class="tab-btn" 
        :class="{ active: currentView === 'personality' }"
        @click="currentView = 'personality'"
      >
        个性报告
      </button>
    </div>

    <!-- 主要内容区域 -->
    <div class="content-area">
      <!-- 总览页面 -->
      <div v-if="currentView === 'overview'" class="overview-content">
        <div class="completion-stats">
          <div class="stat-card">
            <h3>完成度</h3>
            <div class="stat-value">100%</div>
            <p>恭喜通关全部剧情！</p>
          </div>
          
          <div class="stat-card">
            <h3>选择次数</h3>
            <div class="stat-value">{{ gameData.choiceHistory.length }}</div>
            <p>做出的关键决定</p>
          </div>
          
          <div class="stat-card">
            <h3>最终评价</h3>
            <div class="stat-value">{{ personalityReport.title }}</div>
            <p>{{ personalityReport.content.substring(0, 50) }}...</p>
          </div>
        </div>
      </div>

      <!-- 分支探索图 -->
      <div v-if="currentView === 'branching'" :class="['branching-content', { 'fullscreen': isBranchingFullscreen }]">
        <div v-if="isBranchingFullscreen" class="fullscreen-header">
          <button class="exit-fullscreen-btn" @click="isBranchingFullscreen = false">×</button>
        </div>
        <div class="branching-graph" :style="{ 
            width: isBranchingFullscreen ? 'auto' : graphWidth + 'px',
            height: isBranchingFullscreen ? 'auto' : graphHeight + 'px',
            minWidth: isBranchingFullscreen ? graphWidth + 'px' : 'auto',
            minHeight: isBranchingFullscreen ? graphHeight + 'px' : 'auto',
            maxWidth: isBranchingFullscreen ? 'none' : graphWidth + 'px',
            maxHeight: isBranchingFullscreen ? 'none' : graphHeight + 'px'
          }">
          <!-- 全屏展开按钮放入图框左上角（只有在非全屏时显示） -->
          <button v-if="!isBranchingFullscreen" class="expand-fullscreen-btn" @click="isBranchingFullscreen = true" title="全屏查看">⛶</button>
          <svg class="graph-svg" :width="isBranchingFullscreen ? graphWidth : graphWidth" :height="graphHeight" :viewBox="isBranchingFullscreen ? `0 0 ${graphWidth} ${graphHeight}` : null" preserveAspectRatio="xMidYMid meet">
            <defs>
              <!-- 墨汁晕染渐变 -->
              <radialGradient id="inkGradient" cx="30%" cy="30%" r="70%">
                <stop offset="0%" style="stop-color:#2c1810;stop-opacity:0.9"/>
                <stop offset="40%" style="stop-color:#4a2c1a;stop-opacity:0.7"/>
                <stop offset="70%" style="stop-color:#8b7355;stop-opacity:0.4"/>
                <stop offset="100%" style="stop-color:#d4c4a8;stop-opacity:0.2"/>
              </radialGradient>
              
              <radialGradient id="inkGradientStart" cx="40%" cy="40%" r="80%">
                <stop offset="0%" style="stop-color:#8b4513;stop-opacity:0.95"/>
                <stop offset="30%" style="stop-color:#a0522d;stop-opacity:0.8"/>
                <stop offset="60%" style="stop-color:#cd853f;stop-opacity:0.5"/>
                <stop offset="100%" style="stop-color:#f4e4bc;stop-opacity:0.3"/>
              </radialGradient>
              
              <radialGradient id="inkGradientScene" cx="35%" cy="35%" r="75%">
                <stop offset="0%" style="stop-color:#654321;stop-opacity:0.85"/>
                <stop offset="35%" style="stop-color:#8b7355;stop-opacity:0.7"/>
                <stop offset="65%" style="stop-color:#b8860b;stop-opacity:0.4"/>
                <stop offset="100%" style="stop-color:#f5f5dc;stop-opacity:0.2"/>
              </radialGradient>
              
              <radialGradient id="inkGradientChoice" cx="25%" cy="25%" r="65%">
                <stop offset="0%" style="stop-color:#8b4513;stop-opacity:0.8"/>
                <stop offset="40%" style="stop-color:#a0522d;stop-opacity:0.6"/>
                <stop offset="70%" style="stop-color:#cd853f;stop-opacity:0.3"/>
                <stop offset="100%" style="stop-color:#fff8dc;stop-opacity:0.1"/>
              </radialGradient>
              
              <radialGradient id="inkGradientSelected" cx="45%" cy="45%" r="85%">
                <stop offset="0%" style="stop-color:#2c1810;stop-opacity:1"/>
                <stop offset="25%" style="stop-color:#4a2c1a;stop-opacity:0.9"/>
                <stop offset="50%" style="stop-color:#8b7355;stop-opacity:0.7"/>
                <stop offset="75%" style="stop-color:#d4c4a8;stop-opacity:0.4"/>
                <stop offset="100%" style="stop-color:#f5f5dc;stop-opacity:0.2"/>
              </radialGradient>
            </defs>
            
            <!-- 边 -->
            <g class="edges">
              <line
                v-for="edge in branchingGraph.edges"
                :key="`edge-${edge.from}-${edge.to}`"
                :x1="branchingGraph.nodes.find(n => n.id === edge.from)?.x || 0"
                :y1="branchingGraph.nodes.find(n => n.id === edge.from)?.y || 0"
                :x2="branchingGraph.nodes.find(n => n.id === edge.to)?.x || 0"
                :y2="branchingGraph.nodes.find(n => n.id === edge.to)?.y || 0"
                :class="['edge-line', edge.isSelected ? 'edge-selected' : 'edge-unselected']"
              />
            </g>
            
            <!-- 节点 -->
            <g class="nodes">
              <g
                v-for="node in branchingGraph.nodes"
                :key="node.id"
                :transform="`translate(${(node.x || 0) - (node.width || 120) / 2}, ${(node.y || 0) - (node.height || 60) / 2})`"
                class="node-group"
                :class="[`node-${node.type}`]"
                @mousedown="startDrag($event, node)"
              >
                <rect
                  :width="node.width || 120"
                  :height="node.height || 60"
                  rx="8"
                  class="node-rect"
                />
                <!-- 缩略图（位于节点顶部） -->
                <image
                  v-if="node.image"
                  :href="node.image"
                  :x="NODE_PAD_X"
                  :y="NODE_PAD_Y"
                  :width="(node.width || THUMB_W) - NODE_PAD_X * 2"
                  :height="node.imageH || THUMB_H"
                  preserveAspectRatio="xMidYMid slice"
                  style="filter: drop-shadow(0 6px 12px rgba(0,0,0,0.12)); border-radius:4px;"
                />
                <text
                  :x="(node.width || 120) / 2"
                  :y="( (node.imageH || 0) ? (NODE_PAD_Y + (node.imageH || 0) + 18) : (NODE_PAD_Y + 16) )"
                  text-anchor="middle"
                  class="node-title"
                >{{ node.title }}</text>
                <text
                  :x="(node.width || 120) / 2"
                  :y="( (node.imageH || 0) ? (NODE_PAD_Y + (node.imageH || 0) + 36) : (NODE_PAD_Y + 34) )"
                  text-anchor="middle"
                  class="node-desc"
                >
                  <tspan
                    v-for="(line, idx) in (node.descLines || splitLines(node.description || '', Math.floor(((node.width || 120) - 24) / 8)))"
                    :key="idx"
                    :x="(node.width || 120) / 2"
                    :dy="idx === 0 ? 0 : 14"
                  >
                    {{ line }}
                  </tspan>
                </text>
              </g>
            </g>
          </svg>
        </div>
      </div>

      <!-- 个性报告 -->
      <div v-if="currentView === 'personality'" class="personality-content">
        <div class="personality-header">
          <h2 class="personality-title">{{ personalityReport.title }}</h2>
        </div>
        
        <div class="personality-body">
          <div class="personality-description">
            <p>{{ personalityReport.content }}</p>
          </div>
          
          <div class="personality-traits">
            <h4>性格特征</h4>
            <div class="traits-list">
              <span 
                v-for="trait in personalityReport.traits" 
                :key="trait"
                class="trait-tag"
              >
                {{ trait }}
              </span>
            </div>
          </div>
          
          <div class="personality-scores">
            <h4>综合评分</h4>
            <div class="scores-grid">
              <div 
                v-for="(score, key) in personalityReport.scores" 
                :key="key"
                class="score-item"
              >
                <span class="score-name">{{ key }}</span>
                <div class="score-bar">
                  <div 
                    class="score-fill" 
                    :style="{ width: `${score}%` }"
                  ></div>
                  <span class="score-value">{{ score }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="bottom-actions">
      <button class="action-btn secondary" @click="goBack">
        返回主页
      </button>
      <button class="action-btn primary" @click="continueGame">
        重新游戏
      </button>
    </div>

    <!-- 属性弹窗（复用GamePage的样式） -->
    <div v-if="showAttributesModal" class="modal-backdrop" @click="showAttributesModal = false">
      <div class="modal-panel attributes-panel" @click.stop>
        <div class="modal-header">
          <h3>角色属性与状态</h3>
          <button class="modal-close" @click="showAttributesModal = false">×</button>
        </div>
        
        <div class="attr-status-grid">
          <div class="attributes-section">
            <div class="section-title">属性数值</div>
            <ul class="kv-list">
              <li v-for="(value, key) in gameData.finalAttributes" :key="key">
                <span class="kv-key">{{ key }}</span>
                <span class="kv-sep">:</span>
                <span class="kv-val">{{ value }}</span>
              </li>
            </ul>
          </div>
          
          <div class="statuses-section">
            <div class="section-title">状态档案</div>
            <ul class="kv-list">
              <li v-for="(value, key) in gameData.finalStatuses" :key="key">
                <span class="kv-key">{{ key }}</span>
                <span class="kv-sep">:</span>
                <span class="kv-val">{{ value }}</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div class="modal-actions">
          <button @click="showAttributesModal = false">关闭</button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.settlement-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #faf8f3 0%, #f0ebe3 100%);
  display: flex;
  flex-direction: column;
}

/* 顶部导航 */
.top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 1rem; /* 压缩上下与左右空间，腾出内容区 */
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(212, 165, 165, 0.2);
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(212, 165, 165, 0.1);
  border: 1px solid rgba(212, 165, 165, 0.3);
  border-radius: 8px;
  color: #8B7355;
  cursor: pointer;
  transition: all 0.3s ease;
}

.nav-btn:hover {
  background: rgba(212, 165, 165, 0.2);
  transform: translateY(-1px);
}

.nav-btn svg {
  width: 16px;
  height: 16px;
}

.page-title {
  font-size: 1.15rem; /* 缩小以节省垂直空间 */
  color: #2c1810;
  margin: 0;
  font-weight: 600;
}

.quick-actions {
  display: flex;
  gap: 0.35rem;
}

/* 视图切换标签 */
.view-tabs {
  display: flex;
  background: white;
  border-bottom: 1px solid rgba(212, 165, 165, 0.2);
  padding: 0 1rem; /* 压缩左右内边距 */
  height: 44px; /* 固定较小高度 */
  align-items: center;
}

.tab-btn {
  padding: 0.55rem 1rem; /* 缩小垂直占用 */
  border: none;
  background: transparent;
  color: #8B7355;
  font-size: 0.95rem;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  transition: all 0.18s ease;
}

.tab-btn:hover {
  background: rgba(212, 165, 165, 0.1);
}

.tab-btn.active {
  color: #d4a5a5;
  border-bottom-color: #d4a5a5;
  background: rgba(212, 165, 165, 0.05);
}

/* 内容区域 */
.content-area {
  flex: 1;
  padding: 1rem; /* 减少整体内边距，让主要内容占更多可视高度 */
  overflow-y: auto;
}

/* 总览内容 */
.completion-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.stat-card h3 {
  color: #8B7355;
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #d4a5a5;
  margin-bottom: 0.5rem;
}

.stat-card p {
  color: #666;
  margin: 0;
  font-size: 0.9rem;
}

/* 已移除：结算总览中的最终属性视觉块，改为通过“属性”按钮查看 */

/* 分支探索图 */
.branching-content {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  overflow: auto;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  position: relative;
}

.branching-content.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  border-radius: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: auto;
  padding: 2rem;
  z-index: 1000;
  /* 纯色羊皮纸底色并加上微小斑点以模拟瑕疵，避免条纹 */
  background: 
    radial-gradient(circle at 20% 80%, rgba(101, 67, 33, 0.08) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(139, 115, 85, 0.06) 0%, transparent 50%),
    radial-gradient(circle at 40% 40%, rgba(160, 130, 90, 0.04) 0%, transparent 50%),
    radial-gradient(circle at 60% 30%, rgba(139, 115, 85, 0.03) 0%, transparent 40%),
    radial-gradient(circle at 30% 70%, rgba(101, 67, 33, 0.05) 0%, transparent 45%),
    linear-gradient(135deg, #f4f1e8 0%, #e8dcc0 30%, #f4f1e8 70%, #e8dcc0 100%);
  background-size: 100% 100%, 100% 100%, 100% 100%, 80% 80%, 70% 70%, 100% 100%;
  box-shadow: inset 0 0 100px rgba(139, 115, 85, 0.3);
}

.fullscreen-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
}

.exit-fullscreen-btn {
  background: rgba(44, 24, 16, 0.8);
  color: #f4e4bc;
  border: 2px solid #8b7355;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(44, 24, 16, 0.3);
}

.exit-fullscreen-btn:hover {
  background: rgba(44, 24, 16, 0.9);
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(44, 24, 16, 0.4);
}

.expand-fullscreen-btn {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(44, 24, 16, 0.8);
  color: #f4e4bc;
  border: 2px solid #8b7355;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(44, 24, 16, 0.3);
  z-index: 10;
}

.expand-fullscreen-btn:hover {
  background: rgba(44, 24, 16, 0.9);
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(44, 24, 16, 0.4);
}

.branching-graph {
  position: relative;
  height: calc(100vh - 200px);
  overflow: auto;
  border: 1px solid #eee;
  border-radius: 8px;
  flex: 1;
}

.branching-content.fullscreen .branching-graph {
  flex: 1;
  width: auto;
  min-width: 100%;
  min-height: 100%;
  border: none;
  border-radius: 0;
  overflow: auto;
  display: flex;
  justify-content: flex-start;
  align-items: flex-start;
  padding: 1rem;
}

.graph-svg {
  cursor: grab;
  display: block;
  width: auto;
  height: auto;
  max-width: none;
  max-height: none;
  min-width: 100%;
  min-height: 100%;
  flex-shrink: 0;
}

.edge-line {
  stroke: #8b7355;
  stroke-width: 2;
  opacity: 0.6;
}

.edge-selected {
  stroke: #2c1810;
  stroke-width: 3;
  opacity: 0.9;
}

.edge-unselected {
  /* 未探索的分支：提高对比度以便更清晰可见（略带虚线样式） */
  stroke: #6b8aa4;
  stroke-width: 1.6;
  opacity: 0.9;
  stroke-dasharray: 6,4;
}

.node-group {
  cursor: move;
}

.node-rect {
  fill: url(#inkGradient);
  stroke: #2c1810;
  stroke-width: 1.5;
  filter: drop-shadow(0 2px 4px rgba(44, 24, 16, 0.3));
}

.node-start .node-rect {
  fill: url(#inkGradientStart);
  stroke: #8b4513;
  stroke-width: 2;
}

.node-scene .node-rect {
  fill: url(#inkGradientScene);
  stroke: #654321;
  stroke-width: 1.5;
}

.node-choice .node-rect {
  fill: url(#inkGradientChoice);
  stroke: #8b4513;
  stroke-width: 1.5;
}

.node-choice-selected .node-rect {
  fill: url(#inkGradientSelected);
  stroke: #2c1810;
  stroke-width: 2.5;
}

.node-choice-unselected .node-rect {
  fill: url(#inkGradientChoice);
  stroke: #8b4513;
  stroke-width: 1.5;
  stroke-dasharray: 5,5;
}

.node-result .node-rect {
  fill: url(#inkGradientScene);
  stroke: #654321;
  stroke-width: 1.5;
}

.node-question .node-rect {
  fill: url(#inkGradientChoice);
  stroke: #2c1810;
  stroke-width: 1.5;
  stroke-dasharray: 3,3;
}

.node-end .node-rect {
  fill: url(#inkGradientStart);
  stroke: #8b4513;
  stroke-width: 2;
}

.node-title {
  fill: #2c1810;
  font-size: 12px;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(244, 228, 188, 0.8);
}

.node-question .node-title {
  fill: #000000;
  font-size: 16px;
  font-weight: bold;
}

.node-desc {
  fill: #654321;
  font-size: 10px;
  text-shadow: 0 1px 2px rgba(244, 228, 188, 0.6);
}

/* 个性报告 */
.personality-content {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.personality-header {
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #eee;
}

.personality-title {
  color: #d4a5a5;
  font-size: 2rem;
  margin: 0 0 0.5rem 0;
  font-weight: 700;
}

.personality-subtitle {
  color: #8B7355;
  margin: 0;
  font-size: 1.1rem;
}

.personality-description {
  margin-bottom: 2rem;
  line-height: 1.8;
  color: #555;
  font-size: 1.1rem;
}

.personality-traits {
  margin-bottom: 2rem;
}

.personality-traits h4 {
  color: #8B7355;
  margin: 0 0 1rem 0;
}

.traits-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.trait-tag {
  background: linear-gradient(135deg, #d4a5a5, #c89090);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 500;
}

.personality-scores h4 {
  color: #8B7355;
  margin: 0 0 1rem 0;
}

.scores-grid {
  display: grid;
  gap: 1rem;
}

.score-item {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.score-name {
  min-width: 80px;
  color: #8B7355;
  font-weight: 500;
}

.score-bar {
  flex: 1;
  position: relative;
  height: 20px;
  background: #f0f0f0;
  border-radius: 10px;
  overflow: hidden;
}

.score-fill {
  height: 100%;
  background: linear-gradient(90deg, #d4a5a5, #c89090);
  transition: width 0.5s ease;
}

.score-value {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.8rem;
  color: #666;
  font-weight: 500;
}

/* 底部操作栏 */
.bottom-actions {
  display: flex;
  gap: 1rem;
  padding: 1.5rem 2rem;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(212, 165, 165, 0.2);
}

.action-btn {
  flex: 1;
  padding: 1rem 2rem;
  border: none;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.action-btn.secondary {
  background: #f5f5f5;
  color: #8B7355;
}

.action-btn.secondary:hover {
  background: #e8e8e8;
  transform: translateY(-2px);
}

.action-btn.primary {
  background: linear-gradient(135deg, #d4a5a5, #c89090);
  color: white;
}

.action-btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(212, 165, 165, 0.4);
}

/* 模态框样式（复用GamePage的样式） */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.modal-panel {
  background: rgba(255, 255, 255, 0.75);
  color: #2c1810;
  padding: 1.25rem;
  border-radius: 8px;
  min-width: 300px;
  border: 1px solid rgba(212,165,165,0.3);
  box-shadow: 0 8px 24px rgba(0,0,0,0.18);
  backdrop-filter: blur(10px);
}

.attributes-panel { 
  width: min(90vw, 900px); 
  max-height: 92vh; 
  display:flex; 
  flex-direction:column; 
}

.modal-header { 
  display:flex; 
  align-items:center; 
  justify-content:space-between; 
  margin-bottom: 0.5rem; 
}

.modal-close { 
  background: transparent; 
  color:#8B7355; 
  border: none; 
  font-size: 1.25rem; 
  cursor: pointer; 
}

.attr-status-grid { 
  display:grid; 
  grid-template-columns: 1fr 1fr; 
  gap: 1rem; 
  margin-top: 0.25rem; 
  flex: 1 1 auto; 
  min-height: 78%; 
  overflow: auto; 
}

.section-title { 
  font-weight: 700; 
  color:#8B7355; 
  margin-bottom: 0.25rem; 
}

.kv-list { 
  list-style: none; 
  margin: 0; 
  padding: 0; 
}

.kv-list li { 
  display:flex; 
  align-items: baseline; 
  gap: 0.25rem; 
  padding: 0.25rem 0; 
  border-bottom: 1px dashed rgba(212,165,165,0.15); 
}

.kv-key { color:#5a4533; }
.kv-sep { color:#8B7355; }
.kv-val { color:#2c1810; }

.modal-actions { 
  display:flex; 
  gap:0.5rem; 
  justify-content:flex-end; 
  margin-top:1rem;
}

.modal-actions button { 
  padding:0.4rem 0.8rem; 
  border-radius:6px; 
  cursor:pointer;
  background: rgba(212,165,165,0.15); 
  color:#fff; 
  border:1px solid rgba(212,165,165,0.3);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .top-nav {
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }
  
  .page-title {
    font-size: 1.2rem;
  }
  
  .quick-actions {
    justify-content: center;
  }
  
  .view-tabs {
    padding: 0 1rem;
  }
  
  .tab-btn {
    padding: 0.75rem 1rem;
    font-size: 0.9rem;
  }
  
  .content-area {
    padding: 1rem;
  }
  
  .completion-stats {
    grid-template-columns: 1fr;
  }
  
  .attr-status-grid {
    grid-template-columns: 1fr;
  }
  
  .bottom-actions {
    flex-direction: column;
    padding: 1rem;
  }
}
</style>
