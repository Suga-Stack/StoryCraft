<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import './GamePage.css'
import { useRouter, useRoute } from 'vue-router'
import { ScreenOrientation } from '@capacitor/screen-orientation'
import { useUserStore } from '../store/index.js'
import http from '../utils/http.js'
import * as storyService from '../service/story.js'
import { getCurrentUserId, deepClone } from '../utils/auth.js'
import { USE_MOCK_STORY, USE_MOCK_SAVE, FORCE_CREATOR_FOR_TEST, isCreatorIdentity, editorInvocation, creatorFeatureEnabled, modifiableFromCreate } from '../config/gamepage.js'
import { useSaveLoad } from '../composables/useSaveLoad.js'
import { useAutoPlay } from '../composables/useAutoPlay.js'
import { useStoryAPI, work } from '../composables/useStoryAPI.js'

const router = useRouter()
const route = useRoute()

// 使用 useStoryAPI composable
const {
  // 状态
  lastSeq,
  storyEndSignaled,
  isGeneratingSettlement,
  choiceHistory,
  lastChoiceTimestamp,
  currentSceneIndex,
  currentDialogueIndex,
  currentChapterIndex,
  chaptersStatus,
  lastLoadedGeneratedChapter,
  isFetchingNext,
  isFetchingChoice,
  storyScenes,
  generationLocks,
  suppressAutoShowChoices,
  totalChapters,
  // 计算属性
  currentScene,
  currentDialogue,
  currentBackground,
  currentSpeaker,
  // 方法
  fetchNextContent,
  pushSceneFromServer,
  getChapterStatus,
  getWorkDetails,
  checkCurrentChapterSaved,
  pollWorkStatus,
  restoreChoiceFlagsFromHistory,
  getDialogueItem,
  // 服务引用
  getScenes: getGetScenes,
  setGetScenes,
  generateChapter: getGenerateChapter,
  setGenerateChapter,
  saveChapter: getSaveChapter,
  setSaveChapter
} = useStoryAPI()

// 从 route 初始化 work
work.value = {
  id: route.params.id || 1,
  title: history.state?.title || (() => { try { return JSON.parse(sessionStorage.getItem('lastWorkMeta'))?.title } catch { return null } })() || '锦瑟深宫',
  coverUrl: history.state?.coverUrl || (() => { try { return JSON.parse(sessionStorage.getItem('lastWorkMeta'))?.coverUrl } catch { return null } })() || '',
  authorId: 'author_001'
}

const {
    showSaveModal,
    showLoadModal,
    showAttributesModal,
    slotInfos,
    SLOTS,
    openSaveModal,
    openLoadModal,
    closeSaveModal,
    closeLoadModal,
    openAttributes,
    closeAttributes,
    saveGame,
    loadGame,
    deleteGame,
    refreshSlotInfos,
    autoSaveToSlot,
    quickLocalAutoSave,
    attributes,
    statuses,
    setDependencies: setSaveLoadDependencies
  } = useSaveLoad()

const {
    showSettingsModal,
    autoPlayEnabled,
    autoPlayIntervalMs,
    startAutoPlayTimer,
    stopAutoPlayTimer,
    loadAutoPlayPrefs
} = useAutoPlay()

// 游戏状态变量
const isLoading = ref(false)
const loadingProgress = ref(0)
const showText = ref(false)
const choicesVisible = ref(false)
const showMenu = ref(false)
const isLandscapeReady = ref(false)
// showSaveModal, showLoadModal, showAttributesModal 已从 useSaveLoad 导入
const readingProgress = ref(0)

// 游戏状态方法
const toggleMenu = () => {
  showMenu.value = !showMenu.value
}

const goBack = () => {
  router.back()
}

const nextDialogue = async () => {
  const scene = currentScene.value
  if (!scene || !scene.dialogues) return

  if (currentDialogueIndex.value < scene.dialogues.length - 1) {
    currentDialogueIndex.value++
  } else if (currentSceneIndex.value < storyScenes.value.length - 1) {
    currentSceneIndex.value++
    currentDialogueIndex.value = 0
  } else {
    // 已到达当前章节的最后一句对话
    console.log('[nextDialogue] 到达章节末尾，尝试加载下一章')
    // 检查是否需要加载下一章
    try {
      await requestNextIfNeeded()
    } catch (e) {
      console.warn('[nextDialogue] requestNextIfNeeded 失败:', e)
    }
  }
}

const chooseOption = (choiceId) => {
  try {
    const scene = currentScene.value
    if (!scene || !Array.isArray(scene.choices)) {
      console.warn('[chooseOption] 场景无效或无选项')
      return
    }

    // 查找选中的选项
    const choice = scene.choices.find(c => c.id === choiceId || c.choiceId === choiceId)
    if (!choice) {
      console.warn('[chooseOption] 未找到选项:', choiceId)
      choicesVisible.value = false
      return
    }

    console.log('[chooseOption] 选择了选项:', choiceId, choice)

    // 应用属性变化
    if (choice.attributesDelta && typeof choice.attributesDelta === 'object') {
      for (const [key, delta] of Object.entries(choice.attributesDelta)) {
        const currentValue = attributes.value[key] || 0
        const newValue = typeof delta === 'number' ? currentValue + delta : delta
        attributes.value[key] = newValue
        console.log(`[chooseOption] 属性更新: ${key} = ${currentValue} → ${newValue} (delta: ${delta})`)
      }
    }

    // 应用状态变化
    if (choice.statusesDelta && typeof choice.statusesDelta === 'object') {
      for (const [key, value] of Object.entries(choice.statusesDelta)) {
        statuses.value[key] = value
        console.log(`[chooseOption] 状态更新: ${key} = ${value}`)
      }
    }

    // 记录选项历史
    try {
      choiceHistory.value.push({
        sceneId: scene.id || scene.sceneId,
        choiceId: choiceId,
        timestamp: Date.now(),
        chapterIndex: currentChapterIndex.value
      })
    } catch (e) {
      console.warn('[chooseOption] 记录选项历史失败:', e)
    }

    // 标记该场景的选项已被消费
    scene.choiceConsumed = true
    scene.chosenChoiceId = choiceId
    lastChoiceTimestamp.value = Date.now()

    // 关闭选项框
    choicesVisible.value = false

    // 如果选项有后续对话,插入到当前场景
    if (Array.isArray(choice.subsequentDialogues) && choice.subsequentDialogues.length > 0) {
      console.log('[chooseOption] 插入后续对话:', choice.subsequentDialogues.length, '条')
      // 在当前对话索引后插入后续对话
      const insertIndex = currentDialogueIndex.value + 1
      scene.dialogues.splice(insertIndex, 0, ...choice.subsequentDialogues)
    }

    // 自动前进到下一句
    setTimeout(() => {
      nextDialogue()
    }, 300)

  } catch (e) {
    console.error('[chooseOption] 处理选项时出错:', e)
    choicesVisible.value = false
  }
}

const requestLandscape = async () => {
  try {
    await ScreenOrientation.lock({ type: 'landscape' })
  } catch (err) {
    console.log('请求横屏失败:', err)
  }
  
  // 设置为横屏准备就绪并初始化游戏
  isLandscapeReady.value = true
  await initializeGame()
}

const simulateLoadTo100 = async (duration = 1000) => {
  const startProgress = loadingProgress.value
  const remainingProgress = 100 - startProgress
  const steps = 20
  const stepDuration = duration / steps
  const stepIncrement = remainingProgress / steps

  for (let i = 0; i < steps; i++) {
    await new Promise(resolve => setTimeout(resolve, stepDuration))
    loadingProgress.value = Math.min(100, startProgress + stepIncrement * (i + 1))
  }
  
  loadingProgress.value = 100
  isLoading.value = false
}

const startLoading = () => {
  isLoading.value = true
  loadingProgress.value = 0
}

const stopLoading = async () => {
  if (loadingProgress.value < 100) {
    await simulateLoadTo100(500)
  }
  isLoading.value = false
}

const isLastDialogue = computed(() => {
  const scene = currentScene.value
  if (!scene || !scene.dialogues) return false
  return currentDialogueIndex.value >= scene.dialogues.length - 1 &&
         currentSceneIndex.value >= storyScenes.value.length - 1
})

// 本地引用，允许在运行时替换为 mock 实现
let getScenes = getGetScenes()
let generateChapter = getGenerateChapter()
let saveChapter = getSaveChapter()
let didLoadInitialMock = false
let creatorEditorHandled = false

// 新增初始化函数
const initializeGame = async () => {
  // 检查用户是否已登录
  const userStore = useUserStore()
  if (!userStore.isAuthenticated) {
    console.log('用户未登录，重定向到登录页面')
    // 保存当前页面，登录后可以返回
    sessionStorage.setItem('redirectAfterLogin', router.currentRoute.value.fullPath)
    router.push('/login')
    return
  }
  
  isLoading.value = true
  loadingProgress.value = 0
  
  try {
    // 若启用本地 mock，则在组件挂载时异步加载 mock 实现
    if (USE_MOCK_STORY) {
      try {
        const mock = await import('../service/story.mock.js')
        getScenes = mock.getScenes
        setGetScenes(mock.getScenes)
        try { window.__USE_MOCK_STORY__ = true } catch (e) {}
      } catch (e) {
        console.warn('加载 story.mock.js 失败，将回退到真实 service：', e)
      }
    }
    
    let initOk = false
    try {
      // 测试模式：强制在进入游戏前弹出创作者大纲编辑器（若尚未处理）
      if (FORCE_CREATOR_FOR_TEST && !creatorEditorHandled) {
        try {
          // 构造一个临时的 createResult 对象（从路由 或 session 的 lastWorkMeta 获取基础信息）
          const temp = {
            fromCreate: true,
            backendWork: { id: work.value.id, title: work.value.title },
            modifiable: true,
            total_chapters: Number(totalChapters.value) || 5,
            chapterOutlines: null
          }
          // 仅在 sessionStorage 中尚无 createResult 时写入临时对象，避免覆盖后端或创建页写入的真实数据
          try {
            const existing = sessionStorage.getItem('createResult')
            if (!existing) sessionStorage.setItem('createResult', JSON.stringify(temp))
          } catch (e) {}
          // 标记为已处理，避免重复弹窗
          creatorEditorHandled = true
        } catch (e) { console.warn('prepare FORCE_CREATOR_FOR_TEST failed', e) }
      }

      const ok = await initFromCreateResult()
      initOk = !!ok
      if (!ok) {
        // 没有来自创建页的首章，尝试获取第一章
        if (USE_MOCK_STORY && typeof getScenes === 'function') {
          try {
            const resp = await getScenes(work.value.id, 1, {
              onProgress: (progress) => {
                console.log(`[Story] 首章生成进度:`, progress)
                // 更新加载进度
                if (progress.status === 'generating' && progress.progress) {
                  loadingProgress.value = Math.min(90, (progress.progress.currentChapter / progress.progress.totalChapters) * 100)
                }
              }
            })
            const initial = (resp && resp.scenes) ? resp.scenes : (Array.isArray(resp) ? resp : [])
            if (Array.isArray(initial) && initial.length > 0) {
              storyScenes.value = []
              for (const s of initial) {
                if (s && Array.isArray(s.choices)) {
                  const seen = new Set()
                  s.choices = s.choices.filter(c => {
                    const id = c?.id ?? JSON.stringify(c)
                    if (seen.has(id)) return false
                    seen.add(id)
                    return true
                  })
                }
                storyScenes.value.push(s)
              }
              try { didLoadInitialMock = true } catch (e) {}
              currentSceneIndex.value = 0
              currentDialogueIndex.value = 0
              currentChapterIndex.value = 1
            } else {
              // mock 未返回初始场景，回退到后端请求
              console.log('[GamePage] mock未返回场景，回退到fetchNextChapter...')
              const result = await fetchNextChapter(work.value.id, 1)
              console.log('[GamePage] fetchNextChapter返回结果:', result)
            }
          } catch (e) {
            console.warn('getInitialScenes failed, fallback to fetchNextChapter', e)
            console.log('[GamePage] getInitialScenes失败，尝试fetchNextChapter...')
            const result = await fetchNextChapter(work.value.id, 1)
            console.log('[GamePage] fetchNextChapter返回结果:', result)
          }
        } else {
          console.log('[GamePage] 调用fetchNextChapter获取第一章...')
          const result = await fetchNextChapter(work.value.id, 1)
          console.log('[GamePage] fetchNextChapter返回结果:', result)
          console.log('[GamePage] 当前storyScenes数量:', storyScenes.value?.length || 0)
        }
      }
    } catch (e) { 
      console.warn('initFromCreateResult failed', e)
      // 如果 initFromCreateResult 失败，尝试直接获取第一章
      try {
        console.log('[GamePage] initFromCreateResult失败，尝试fetchNextChapter...')
        const result = await fetchNextChapter(work.value.id, 1)
        console.log('[GamePage] fetchNextChapter返回结果:', result)
      } catch (err) {
        console.warn('fetchNextChapter failed in initializeGame', err)
      }
    }

    // 绑定退出处理
    try {
      await ScreenOrientation.lock({ type: 'portrait' }).catch(() => {})
    } catch (e) {}


    
    
    // 等待场景数据加载的逻辑需要修改，因为现在getScenes是轮询的
    let retryCount = 0
    const maxRetries = 120 // 增加重试次数，因为轮询可能需要更长时间
    
    // 首先检查是否已经有场景数据（从fetchNextChapter加载的）
    if (Array.isArray(storyScenes.value) && storyScenes.value.length > 0) {
      console.log(`场景数据已加载，跳过等待循环。场景数量: ${storyScenes.value.length}`)
    } else {
      // 如果没有场景数据，才进入等待循环
      while ((!Array.isArray(storyScenes.value) || storyScenes.value.length === 0) && retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000)) // 每秒检查一次
        retryCount++
        console.log(`等待场景数据加载... 重试 ${retryCount}/${maxRetries}`)
        
        // 如果进度超过50%，显示更详细的状态
        if (loadingProgress.value > 50) {
          console.log(`生成进度: ${loadingProgress.value}%`)
        }
      }
    }

    // 如果仍然没有场景，使用一个默认场景避免黑屏
    if (!Array.isArray(storyScenes.value) || storyScenes.value.length === 0) {
      console.warn('No scenes loaded, using fallback scene')
      storyScenes.value = [{
        sceneId: 'fallback',
        backgroundImage: work.value.coverUrl || 'https://picsum.photos/1920/1080?random=1',
        dialogues: ['故事正在加载中，请稍候...']
      }]
    }

    // 现在可以安全关闭加载界面
    await simulateLoadTo100(800) // 使用平滑加载完成动画
    
  } catch (error) {
    console.error('Initialize game failed:', error)
    // 即使出错也要确保有场景显示
    if (!Array.isArray(storyScenes.value) || storyScenes.value.length === 0) {
      storyScenes.value = [{
        sceneId: 'error',
        backgroundImage: work.value.coverUrl || 'https://picsum.photos/1920/1080?random=1',
        dialogues: ['故事加载失败，请返回重试。']
      }]
    }
    await simulateLoadTo100(500)
  }
}


// 检测是否在 Capacitor 环境中
const isNativeApp = computed(() => {
  return window.Capacitor !== undefined
})

// 作品信息（从路由 state 获取，或从后端获取）
// export const work = ref({
//   id: route.params.id || 1,
//   title: history.state?.title || (() => { try { return JSON.parse(sessionStorage.getItem('lastWorkMeta'))?.title } catch { return null } })() || '锦瑟深宫',
//   // 封面图仅使用作品页传入或上次缓存，不再回退到网络站点占位图
//   coverUrl: history.state?.coverUrl || (() => { try { return JSON.parse(sessionStorage.getItem('lastWorkMeta'))?.coverUrl } catch { return null } })() || '',
//   authorId: 'author_001'
// })

// 计算用于展示的封面 URL：优先使用完整 URL；若后端返回相对路径则补齐本地开发后端地址；若不存在则返回内置占位图
const effectiveCoverUrl = computed(() => {
  try {
    const raw = work.value.coverUrl || ''
    const defaultImg = 'https://images.unsplash.com/photo-1587614387466-0a72ca909e16?w=1600&h=900&fit=crop'
    if (!raw) return defaultImg
    if (/^https?:\/\//i.test(raw)) return raw
    // 如果是相对路径（例如 /media/xxx），为开发环境补齐后端地址
    return 'http://localhost:8000' + (raw.startsWith('/') ? raw : ('/' + raw))
  } catch (e) {
    return 'https://images.unsplash.com/photo-1587614387466-0a72ca909e16?w=1600&h=900&fit=crop'
  }
})

// totalChapters 已从 useStoryAPI 导入

// 如果后端返回了 streamUrl，则优先使用 SSE
let eventSource = null

// storyScenes 已从 useStoryAPI 导入

// 将后端 scene 对象（或 firstChapter）加入本地 storyScenes（保持顺序）
// 本函数会把 game-api.md 的 scene 格式（id, backgroundImage, dialogues[{narration, playerChoices}])
// 适配为前端当前使用的内部结构（保留兼容性）：
// - 为旧代码提供 .sceneId 字段
// - 将在 dialogue 内出现的 playerChoices 抽取并放到 scene.choices + scene.choiceTriggerIndex（便于现有渲染逻辑复用）

// 在页加载时从后端获取首章内容
// 章节状态与轮询支持：提前声明以便 initFromCreateResult 使用
// 章节状态列表：由 GET /api/gameworks/gameworks/{id}/ 的 chapters_status 填充

// Helper: check if current chapter status is 'saved' (required for save/creator mode/manual edit)
// 如果 modifiable=true 且 ai_callable=false(阅读者身份),不受章节状态限制,总是返回 true
// Fetch work details (作品详情),用于读取 chapters_status 等元信息
// Poll work details until target chapter reaches 'generated' (or 'saved') or timeout

const initFromCreateResult = async (opts = {}) => {
  try {
    const raw = sessionStorage.getItem('createResult')
    if (!raw) return false
    const obj = JSON.parse(raw)
    if (!obj) return false
    if (obj.backendWork) {
      work.value.id = obj.backendWork.id || work.value.id
      work.value.title = obj.backendWork.title || work.value.title
      work.value.coverUrl = obj.backendWork.coverUrl || work.value.coverUrl
      // 后端可能返回 ai_callable 字段，标识是否允许调用 AI 生成
      if (typeof obj.backendWork.ai_callable !== 'undefined') {
        work.value.ai_callable = obj.backendWork.ai_callable
      }
    }
    // 从 createResult 或 history.state 获取初始属性和状态
    // 兼容两种写法：createResult 可能直接包含 initialAttributes/initialStatuses，
    // 也可能只包含 backendWork（其中包含 initialAttributes/statuses 字段）
  // attributes/statuses: 支持多种命名与嵌套位置（camelCase / snake_case / backendWork.data）
  if (obj.initialAttributes) attributes.value = obj.initialAttributes
  else if (obj.initial_attributes) attributes.value = obj.initial_attributes
  else if (obj.backendWork && obj.backendWork.initialAttributes) attributes.value = obj.backendWork.initialAttributes
  else if (obj.backendWork && obj.backendWork.initial_attributes) attributes.value = obj.backendWork.initial_attributes
  else if (obj.backendWork && obj.backendWork.data && obj.backendWork.data.initialAttributes) attributes.value = obj.backendWork.data.initialAttributes
  else if (obj.backendWork && obj.backendWork.data && obj.backendWork.data.initial_attributes) attributes.value = obj.backendWork.data.initial_attributes

  if (obj.initialStatuses) statuses.value = obj.initialStatuses
  else if (obj.initial_statuses) statuses.value = obj.initial_statuses
  else if (obj.backendWork && obj.backendWork.initialStatuses) statuses.value = obj.backendWork.initialStatuses
  else if (obj.backendWork && obj.backendWork.initial_statuses) statuses.value = obj.backendWork.initial_statuses
  else if (obj.backendWork && obj.backendWork.data && obj.backendWork.data.initialStatuses) statuses.value = obj.backendWork.data.initialStatuses
  else if (obj.backendWork && obj.backendWork.data && obj.backendWork.data.initial_statuses) statuses.value = obj.backendWork.data.initial_statuses

    // total_chapters（若提供）
    if (obj.total_chapters) totalChapters.value = obj.total_chapters
    else if (obj.backendWork && (obj.backendWork.total_chapters || obj.backendWork.total_chapters === 0)) totalChapters.value = obj.backendWork.total_chapters || null
    
    // 根据 createResult 与 backendWork 决定是否启用创作者功能
    try {
      creatorFeatureEnabled.value = !!(obj.modifiable && !(obj.backendWork && obj.backendWork.ai_callable === false))
    } catch (e) { creatorFeatureEnabled.value = !!obj.modifiable }
    // 记录 createResult.modifiable，用于决定是否允许菜单触发的手动创作编辑（即使 ai_callable 为 false）
    try { modifiableFromCreate.value = !!obj.modifiable } catch (e) { modifiableFromCreate.value = !!obj.modifiable }

    // 尝试获取作品详情以初始化章节状态（chapters_status）
    try { 
      await getWorkDetails(work.value.id)
      console.log('[initFromCreateResult] 获取作品详情后的章节状态:', chaptersStatus.value)
    } catch (e) { 
      console.warn('[initFromCreateResult] 获取作品详情失败:', e)
    }

    // 从后端获取首章内容（chapterIndex = 1，后端为 1-based）
    try {
      const workId = work.value.id
      // 如果当前 createResult 同时表示为创作者模式且后端允许 AI 调用，先让用户编辑大纲再触发生成（即使后端尚未返回大纲）
      // 但只在第一章状态为 not_generated 时才弹出编辑器
      if (creatorFeatureEnabled.value && !(opts && opts.suppressAutoEditor)) {
        // 检查第一章的状态
        const firstChapterStatus = getChapterStatus(1)
        console.log(`[initFromCreateResult] 第一章状态: ${firstChapterStatus}，所有章节状态:`, chaptersStatus.value)
        
        // 只在状态为 not_generated 或 null (未知状态) 时才弹出编辑器
        if (!firstChapterStatus || firstChapterStatus === 'not_generated') {
          // 如果当前进入者是作品创建者身份（isCreatorIdentity），我们需要自动弹出编辑器用于生成大纲
          if (isCreatorIdentity.value && !creatorEditorHandled) {
            editorInvocation.value = 'auto'
            creatorEditorHandled = true
          } else {
            // 仅标识该作品支持创作者功能，但不自动启用菜单创作者模式
            // 菜单中的 creatorMode 由用户在页面手动切换
          }

          // 将后端可能返回的 chapterOutlines 映射为编辑器使用的格式：{ chapterIndex, outline }
          try {
            // 支持后端在多种字段位置返回大纲：优先使用 createResult.chapterOutlines，其次尝试 backendWork.outlines / data.outlines / outlines
            let rawOutlines = []
            if (Array.isArray(obj.chapterOutlines) && obj.chapterOutlines.length > 0) rawOutlines = obj.chapterOutlines
            else if (obj.backendWork && Array.isArray(obj.backendWork.outlines) && obj.backendWork.outlines.length > 0) rawOutlines = obj.backendWork.outlines
            else if (Array.isArray(obj.outlines) && obj.outlines.length > 0) rawOutlines = obj.outlines
            else if (obj.data && Array.isArray(obj.data.outlines) && obj.data.outlines.length > 0) rawOutlines = obj.data.outlines

            if (rawOutlines.length > 0) {
              outlineEdits.value = rawOutlines.map((ch, i) => ({ chapterIndex: (ch.chapterIndex || i + 1), outline: ch.outline || ch.summary || ch.title || JSON.stringify(ch) }))
            } else {
              // 不再合成本地 mock：如果后端未返回大纲，则使用空数组，让编辑器呈现空状态由用户或后端生成
              outlineEdits.value = []
            }

            // 若 createResult 中包含 userPrompt 字段，则带入编辑器供用户修改
            outlineUserPrompt.value = obj.userPrompt || ''
          } catch (mapErr) {
            console.warn('map chapterOutlines failed', mapErr)
            outlineEdits.value = []
          }

          // 记录原始大纲快照（用于取消时按原始大纲生成）
          try { originalOutlineSnapshot.value = JSON.parse(JSON.stringify(outlineEdits.value || [])) } catch(e) { originalOutlineSnapshot.value = (outlineEdits.value || []).slice() }
          // 标记 pending target 为首章（createResult 路径用于首章生成，target = 1）
          pendingOutlineTargetChapter.value = 1
          showOutlineEditor.value = true
          // 等待用户确认或取消（confirmOutlineEdits/cancelOutlineEdits 会 resolve outlineEditorResolver）
          await new Promise((resolve) => { outlineEditorResolver = resolve })
          // 如果用户确认，confirmOutlineEdits 已调用 generateChapter，后端可能仍在生成，getScenes 会轮询等待
        } else {
          // 第一章已经生成或保存，跳过编辑器直接加载
          console.log(`[initFromCreateResult] 第一章状态为 ${firstChapterStatus}，跳过编辑器直接加载`)
        }
      }
  const result = await getScenes(workId, 1, {
        onProgress: (progress) => {
          console.log(`[Story] 首章生成进度:`, progress)
          // 更新加载进度
          if (progress.status === 'generating' && progress.progress) {
            loadingProgress.value = Math.min(90, (progress.progress.currentChapter / progress.progress.totalChapters) * 100)
          }
        }
      })
      if (result && result.scenes && result.scenes.length > 0) {
        storyScenes.value = []
        for (const sc of result.scenes) {
          try { pushSceneFromServer(sc) } catch (e) { console.warn('pushSceneFromServer failed for one entry', e) }
        }
        // 尝试使用最后一个场景的 seq
        try { 
          const last = result.scenes[result.scenes.length - 1]
          if (last && last.seq) lastSeq.value = last.seq 
        } catch (e) {}
        // 重置播放索引，确保从首条对话开始
        currentSceneIndex.value = 0
        currentDialogueIndex.value = 0
        // 明确设置当前章节为首章（1-based）
        currentChapterIndex.value = 1
        
        console.log(`[Story] 从 createResult 成功加载首章，共 ${result.scenes.length} 个场景`)
        return true
      } else {
        console.warn('[Story] createResult 返回空场景数据')
        return false
      }
    } catch (e) { 
      console.warn('Failed to fetch first chapter from backend:', e)
      return false
    }
    
  } catch (e) { 
    console.warn('initFromCreateResult failed', e); 
    return false 
  }
}

// 向后端请求指定章节（使用 POST /api/game/chapter/），chapterIndex 为 1-based
// fetchNextChapter - 在创作者模式下总是替换当前章节内容，不追加
const fetchNextChapter = async (workId, chapterIndex = null, opts = { replace: true }) => {
  try {
    if (!workId) workId = work.value.id
    // 计算希望请求的章节索引（1-based）
    let idx = Number(chapterIndex) || null
    if (!idx || idx <= 0) idx = currentChapterIndex.value || 1

    console.log(`[fetchNextChapter] 开始获取第 ${idx} 章内容...`)

    // 对于创作者身份，在加载新章节前检查上一章是否已保存
    if (creatorFeatureEnabled.value && idx > 1) {
      try {
        await getWorkDetails(workId)
        const prevChapterStatus = getChapterStatus(idx - 1)
        console.log(`[fetchNextChapter] 检查上一章 ${idx - 1} 的状态:`, prevChapterStatus)
        
        if (prevChapterStatus !== 'saved') {
          console.warn(`[fetchNextChapter] 上一章 ${idx - 1} 状态为 ${prevChapterStatus}，阻止加载第 ${idx} 章`)
          showNotice(`第 ${idx - 1} 章尚未保存，请先确认并保存该章内容后再继续。`, 8000)
          // 不抛出异常，只是返回 null，让调用方知道加载被阻止
          return null
        }
      } catch (e) {
        console.warn('[fetchNextChapter] 检查上一章状态失败:', e)
      }
    }

  // 若后端/创建页标记允许创作功能（creatorFeatureEnabled），则在每一章加载前弹出大纲编辑器供创作者确认/修改后再真正请求章节内容
  // 注意：menu 中的 creatorMode 仍然负责页面内手动编辑权限；这里的 creatorFeatureEnabled 用于在进入每章前自动弹出可编辑大纲
  // 但如果调用时传递了 suppressAutoEditor: true，则跳过自动编辑器
  if (creatorFeatureEnabled.value && !(opts && opts.suppressAutoEditor)) {
      try {
        // Only auto-open outline editor when chapter is not yet generated (not_generated or unknown)
        const chapterStatus = getChapterStatus(idx)
        if (!chapterStatus || chapterStatus === 'not_generated') {
          // 尝试从 sessionStorage.createResult 获得原始大纲（若存在）
          let createRaw = null
          try { createRaw = JSON.parse(sessionStorage.getItem('createResult') || 'null') } catch (e) { createRaw = null }
            // 优先读取 createResult.chapterOutlines；若不存在则尝试使用 createResult.backendWork.outlines 或 work.value 中的 outlines
            let rawOutlines = []
            if (createRaw && Array.isArray(createRaw.chapterOutlines) && createRaw.chapterOutlines.length) {
              rawOutlines = createRaw.chapterOutlines
            } else if (createRaw && createRaw.backendWork && Array.isArray(createRaw.backendWork.outlines) && createRaw.backendWork.outlines.length) {
              rawOutlines = createRaw.backendWork.outlines
            } else if (createRaw && createRaw.data && Array.isArray(createRaw.data.outlines) && createRaw.data.outlines.length) {
              rawOutlines = createRaw.data.outlines
            } else if (work.value && Array.isArray(work.value.outlines) && work.value.outlines.length) {
              rawOutlines = work.value.outlines
            } else {
              rawOutlines = []
            }
          // 展示从当前请求章节 idx 到末章的所有大纲供编辑（若后端未返回则合成到 total_chapters）
          // 构建一个基于 chapterIndex 的映射，避免当 rawOutlines 是从某章截取或不包含完整序列时发生后移或提前的问题
          const outlinesMap = {}
          let maxIdx = 0
          if (Array.isArray(rawOutlines)) {
            for (let i = 0; i < rawOutlines.length; i++) {
              const ch = rawOutlines[i]
              let ci = null
              try {
                if (ch && (typeof ch.chapterIndex !== 'undefined')) ci = Number(ch.chapterIndex)
                else if (ch && (typeof ch.chapter_index !== 'undefined')) ci = Number(ch.chapter_index)
                else ci = i + 1
              } catch (e) { ci = i + 1 }
              outlinesMap[ci] = (ch && (ch.summary || ch.title || ch.outline)) ? (ch.summary || ch.title || ch.outline) : JSON.stringify(ch)
              if (ci > maxIdx) maxIdx = ci
            }
          }
          const total = Math.max((Number(totalChapters.value) || 5), maxIdx)
          outlineEdits.value = []
          for (let j = idx; j <= total; j++) {
            if (typeof outlinesMap[j] !== 'undefined') {
              outlineEdits.value.push({ chapterIndex: j, outline: outlinesMap[j] })
            } else {
              outlineEdits.value.push({ chapterIndex: j, outline: `第${j}章：请在此编辑/补充本章大纲以指导生成。` })
            }
          }
          outlineUserPrompt.value = (createRaw && createRaw.userPrompt) ? createRaw.userPrompt : ''
        } else {
          // chapter already generating/generated/saved => skip auto editor
          outlineEdits.value = []
          outlineUserPrompt.value = ''
        }
      } catch (e) {
        outlineEdits.value = [{ chapterIndex: idx, outline: `第${idx}章：请在此编辑/补充本章大纲以指导生成。` }]
        outlineUserPrompt.value = ''
      }

    // 自动触发的编辑器（章节前弹出）应以 auto 模式打开，允许编辑并生成（仅当章节未生成时）
    editorInvocation.value = 'auto'
    // 记录原始大纲快照（用于取消时按原始大纲生成）
    try { originalOutlineSnapshot.value = JSON.parse(JSON.stringify(outlineEdits.value || [])) } catch(e) { originalOutlineSnapshot.value = (outlineEdits.value || []).slice() }
      
    // 检查章节状态，只有 not_generated 时才弹出编辑器
    const chapterStatus = getChapterStatus(idx)
    if (!chapterStatus || chapterStatus === 'not_generated') {
      // 标记 pending target 为当前自动弹出的章节
      pendingOutlineTargetChapter.value = idx
      showOutlineEditor.value = true
      const confirmed = await new Promise((resolve) => { outlineEditorResolver = resolve })
      // 如果创作者确认，则调用生成接口（后端会基于传入大纲开始生成）
      if (confirmed) {
        try {
          const payloadOutlines = outlineEdits.value.map(o => ({ chapterIndex: o.chapterIndex, summary: o.outline }))
          await generateChapter(workId, idx, { chapterOutlines: payloadOutlines, userPrompt: outlineUserPrompt.value })
          // 允许后端/生成服务有短暂准备时间；getScenes 会处理生成中状态并轮询展示进度
        } catch (e) { console.warn('generateChapter for next chapter failed', e) }
      }
    } else {
      // 章节已经生成或正在生成中，直接跳过编辑器，只加载内容
      console.log(`[fetchNextChapter] 章节 ${idx} 状态为 ${chapterStatus}，跳过编辑器直接加载`)
    }
  }

  let data = null
  if (opts && opts.singleRequest) {
    // 只进行一次 GET 请求，避免 getScenes 的重试逻辑在已经由 generate POST 发起生成后再次触发不必要的行为
    try {
      const resp = await http.get(`/api/game/chapter/${workId}/${idx}/`)
      data = resp && resp.data ? resp.data : resp
      console.log('[fetchNextChapter] singleRequest response:', data)
      
      // 验证返回的数据格式
      if (!data) {
        console.error('[fetchNextChapter] singleRequest 返回空数据')
        throw new Error('后端返回空数据')
      }
      
      // 检查是否有场景数据
      const hasScenes = (data.chapter && Array.isArray(data.chapter.scenes) && data.chapter.scenes.length > 0) ||
                        (Array.isArray(data.scenes) && data.scenes.length > 0)
      
      if (!hasScenes) {
        console.error('[fetchNextChapter] singleRequest 返回数据中没有场景:', data)
        throw new Error('后端返回数据中没有场景内容')
      }
    } catch (e) {
      console.error('[fetchNextChapter] singleRequest http.get failed', e)
      throw e
    }
  } else {
    data = await getScenes(workId, idx, {
      onProgress: (progress) => {
        console.log(`[Story] 章节 ${idx} 生成进度:`, progress)
        // 可以在这里更新UI显示进度
        if (progress.status === 'generating' && progress.progress) {
          loadingProgress.value = Math.min(90, (progress.progress.currentChapter / progress.progress.totalChapters) * 100)
        }
      }
    })
  }

    console.log(`[fetchNextChapter] getScenes返回数据:`, data)
    console.log(`[fetchNextChapter] 数据类型检查:`, {
      data: typeof data,
      dataIsObject: data && typeof data === 'object',
      hasScenes: data && 'scenes' in data,
      scenesType: data && data.scenes ? typeof data.scenes : 'undefined',
      scenesIsArray: data && Array.isArray(data.scenes),
      scenesLength: data && data.scenes ? data.scenes.length : 'undefined'
    })

    // 支持多种后端返回格式：
    // - 传统 polling 接口返回 { status: 'generating'|'ready', chapter: { chapterIndex, title, scenes } }
    // - 旧版或兼容格式可能直接返回 { scenes: [...] } 或 { generating: true }
    if (data && (data.generating === true || data.status === 'generating' || data.status === 'pending')) {
      console.log(`[fetchNextChapter] 后端返回生成中状态`, data)
      return data
    }

    // 规范化 scenes 来源：优先使用 data.chapter.scenes（新接口），其次使用 data.scenes（兼容）
    const scenesArray = (data && data.chapter && Array.isArray(data.chapter.scenes)) ? data.chapter.scenes : (data && Array.isArray(data.scenes) ? data.scenes : null)
    console.log(`[fetchNextChapter] 检查scenes: data=${!!data}, scenesLength=${scenesArray ? scenesArray.length : 'null'}`)
    if (scenesArray && scenesArray.length > 0) {
      console.log('[fetchNextChapter] Processing scenes:', scenesArray.length, 'opts.replace=', opts && opts.replace)
      // 创作者模式：始终替换当前内容，保证 storyScenes 只包含当前章节
      // 用新章节覆盖当前 storyScenes
      storyScenes.value = []
      for (const sc of scenesArray) {
        try { pushSceneFromServer(sc) } catch (e) { console.warn('pushSceneFromServer failed for one entry', e) }
      }
      // 重置播放 / 对话索引以从新章节开始
      currentSceneIndex.value = 0
      currentDialogueIndex.value = 0

      // 重要修改：更新当前章节索引（无论覆盖或追加都要更新）
      currentChapterIndex.value = idx

      console.log(`[Story] 成功加载第 ${idx} 章，共 ${data.scenes.length} 个场景`)

      // 如果我们已请求了超出 totalChapters 的章节（totalChapters 可用），视为已到结尾并不再继续请求下一章。
      // 注意：不要在请求到等于 totalChapters 时立即标记结束 —— 只有在请求超出范围或后端显式返回 end 时才认为结束。
      if (totalChapters.value && idx > Number(totalChapters.value)) {
        storyEndSignaled.value = true
      }

      return data
    } else {
      console.error(`[Story] 第 ${idx} 章返回空场景数据`, data)
      throw new Error(`第 ${idx} 章没有可用的场景数据`)
    }
  } catch (e) {
    console.error('fetchNextChapter error', e)
    throw e // 重新抛出错误以便调用方处理
  }
}

// 在玩家阅读到场景开头（函数 nextDialogue 或进入新 scene 调用处）调用此函数以触发后端生成下一章（若后端未通过 streamUrl 自动推送）
const requestNextIfNeeded = async () => {
  try {
    // 如果已由 SSE 推送，则不需要额外请求
    if (eventSource) return
    
    // 检查是否到达当前章节末尾
    if (!currentScene.value) return
    
    const atLastScene = currentSceneIndex.value >= storyScenes.value.length - 1
    const atLastDialogue = Array.isArray(currentScene.value.dialogues) 
      ? (currentDialogueIndex.value >= (currentScene.value.dialogues.length - 1)) 
      : true
    const isChapterEndScene = currentScene.value.isChapterEnding === true || currentScene.value.chapterEnd === true
    
    // 判断是否到达章节末尾：要么场景明确标记为章节结束，要么已经是最后一个场景的最后一句对话
    const isAtChapterEnd = (isChapterEndScene && atLastDialogue) || (atLastScene && atLastDialogue)
    
    if (!isAtChapterEnd) {
      console.log('[requestNextIfNeeded] 未到章节末尾，不触发加载')
      return
    }

    console.log('[requestNextIfNeeded] 到达章节末尾，准备加载下一章')
    
    // 现在确认为章节结束，按原先逻辑请求下一章（并在需要时替换现有章节）
    const nextChapter = currentChapterIndex.value + 1
    
    // 检查是否已经读完最后一章
    const isLastChapter = totalChapters.value && Number(currentChapterIndex.value) === Number(totalChapters.value)
    
    if (isLastChapter) {
      // 已读完最后一章
      console.log('[requestNextIfNeeded] 已读完最后一章，准备跳转到结算界面')
      
      // 创作者身份：检查最后一章是否已保存
      if (creatorFeatureEnabled.value) {
        try {
          // 获取最新的章节状态
          await getWorkDetails(work.value.id)
          const lastChapterStatus = getChapterStatus(currentChapterIndex.value)
          console.log('[requestNextIfNeeded] 创作者身份，最后一章状态:', lastChapterStatus)
          
          // 如果最后一章状态是 saved，则跳转到结算
          if (lastChapterStatus === 'saved') {
            console.log('[requestNextIfNeeded] 最后一章已保存，跳转到结算界面')
            showNotice('故事已完结，即将进入结算页面...', 2000)
            setTimeout(() => {
              storyEndSignaled.value = true
              handleGameEnd()
            }, 2000)
            return
          } else {
            // 最后一章未保存，不跳转，等待创作者保存
            console.log('[requestNextIfNeeded] 最后一章未保存(状态:', lastChapterStatus, ')，等待手动保存')
            showNotice('已到达最后一章章末，请先确认并保存本章内容后再进入结算。', 5000)
            return
          }
        } catch (e) {
          console.warn('[requestNextIfNeeded] 检查最后一章状态失败:', e)
          showNotice('无法确认最后一章状态，请先确认并保存本章内容后再进入结算。', 5000)
          return
        }
      }
      
      // 阅读者身份：直接显示提示并跳转到结算
      showNotice('故事已完结，即将进入结算页面...', 2000)
      setTimeout(() => {
        storyEndSignaled.value = true
        handleGameEnd()
      }, 2000)
      return
    }
    
    // 如果下一章超出范围，则标记为结束
    if (totalChapters.value && Number(nextChapter) > Number(totalChapters.value)) {
      console.log('[requestNextIfNeeded] nextChapter exceeds totalChapters, marking story end')
      storyEndSignaled.value = true
      showNotice('故事已完结，即将进入结算页面...', 2000)
      setTimeout(() => {
        handleGameEnd()
      }, 2000)
      return
    }

    // 如果处于菜单创作者模式则不自动请求（但创作者身份仍然可以，会弹出编辑器）
    if (creatorMode.value) {
      console.log('[requestNextIfNeeded] 菜单创作者模式，不自动加载下一章')
      return
    }
    
    // 如果当前章节处于生成中或已生成但未保存（generated / generating），阻止自动请求下一章
    try {
      const curStatus = getChapterStatus(currentChapterIndex.value)
      if (curStatus === 'generating' || curStatus === 'generated') {
        console.log('[requestNextIfNeeded] current chapter in generated/generating state, auto-next blocked', curStatus)
        return
      }
    } catch (e) { /* ignore */ }

    // 请求下一章并用返回内容覆盖当前已加载的章节
    // 注意：对于创作者身份（creatorFeatureEnabled），不传递 suppressAutoEditor，让 fetchNextChapter 在章节未生成时弹出编辑器
    console.log(`[requestNextIfNeeded] 正在请求第 ${nextChapter} 章...`)
    try {
      startLoading()
      const opts = { replace: true }
      // 只有在非创作者身份时才抑制自动编辑器
      if (!creatorFeatureEnabled.value) {
        opts.suppressAutoEditor = true
      }
      const resp = await fetchNextChapter(work.value.id, nextChapter, opts)
      console.log('[requestNextIfNeeded] 成功加载下一章:', resp)
    } catch (e) {
      console.error('[requestNextIfNeeded] 加载下一章失败:', e)
    } finally {
      try { await stopLoading() } catch (e) {}
    }
  } catch (e) { console.error('[requestNextIfNeeded] requestNextIfNeeded 执行失败:', e) }
}

// 最后一章结束后,向后端请求个性化报告：POST /api/settlement/report/:workId/
const fetchReport = async (workId) => {
  try {
    const url = `/api/settlement/report/${encodeURIComponent(workId)}/`
    const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' }
    // 优先使用 window 注入的 token，其次从 localStorage 获取
    const token = localStorage.getItem('token')
    if (token) headers['Authorization'] = `Bearer ${token}`
    const body = JSON.stringify({ attributes: attributes.value || {}, statuses: statuses.value || {} })
    const res = await fetch(url, { method: 'POST', headers, body, credentials: 'include' })
    if (!res.ok) return null
    const data = await res.json()
    try { sessionStorage.setItem('settlementData', JSON.stringify(data)) } catch {}
    return data
  } catch (e) { console.warn('fetchReport failed', e); return null }
}



// 当用户开始进入页面或重新加载时，尝试从 createResult 初始化；否则请求第一章
onMounted(async () => {
  if (USE_MOCK_STORY) {
    try {
      const mock = await import('../service/story.mock.js')
      getScenes = mock.getScenes
      setGetScenes(mock.getScenes)
      try { window.__USE_MOCK_STORY__ = true } catch (e) {}
    } catch (e) {
      console.warn('加载 story.mock.js 失败，将回退到真实 service：', e)
    }
  }
  
  // 检查用户是否已登录
  const userStore = useUserStore()
  if (!userStore.isAuthenticated) {
    console.log('用户未登录，重定向到登录页面')
    router.push('/login')
    return
  }
  
  // 加载自动播放偏好并按需启动
  loadAutoPlayPrefs()
  if (autoPlayEnabled.value) startAutoPlayTimer()
  
  // 检查是否从结算页面跳回来并携带了加载数据
  if (history.state?.loadedData) {
    const loadedData = history.state.loadedData
    // 恢复游戏状态（注意：loadedData 可能不包含完整的 storyScenes）
    // 优先尝试根据 sceneId 定位到已加载的 storyScenes，否则回退到首个场景
      try {
      if (loadedData.sceneId != null && Array.isArray(storyScenes.value)) {
        // 使用字符串比较以兼容 number/string id 的差异
        const lsid = String(loadedData.sceneId)
        let idx = storyScenes.value.findIndex(s => s && (String(s.id) === lsid || String(s.sceneId) === lsid))
        // 如果没有找到，但提供了 chapterIndex，则尝试拉取该章节以恢复场景列表
        if (idx < 0 && typeof loadedData.chapterIndex === 'number') {
          try {
            const fetched = await fetchNextContent(work.value.id, loadedData.chapterIndex)
            if (fetched && Array.isArray(fetched.scenes) && fetched.scenes.length > 0) {
              for (const s of fetched.scenes) {
                try { pushSceneFromServer(s) } catch (e) { console.warn('pushSceneFromServer failed when restoring chapter (mounted):', e) }
              }
              idx = storyScenes.value.findIndex(s => s && (String(s.id) === lsid || String(s.sceneId) === lsid))
            }
          } catch (e) { console.warn('fetchNextContent failed while restoring loadedData chapter:', e) }
        }
        currentSceneIndex.value = (idx >= 0) ? idx : 0
      } else if (typeof loadedData.currentSceneIndex === 'number') {
        currentSceneIndex.value = loadedData.currentSceneIndex
      } else if (typeof loadedData.chapterIndex === 'number' && Array.isArray(storyScenes.value)) {
        const idx = storyScenes.value.findIndex(s => s && (s.chapterIndex === loadedData.chapterIndex || s.chapter === loadedData.chapterIndex))
        currentSceneIndex.value = (idx >= 0) ? idx : 0
      } else {
        currentSceneIndex.value = 0
      }
      if (typeof loadedData.currentDialogueIndex === 'number') currentDialogueIndex.value = loadedData.currentDialogueIndex
      else if (loadedData.dialogueIndex != null) currentDialogueIndex.value = loadedData.dialogueIndex
    } catch (e) { /* ignore */ }
  attributes.value = loadedData.attributes || {}
  statuses.value = loadedData.statuses || {}
  choiceHistory.value = loadedData.choiceHistory || []
  try { restoreChoiceFlagsFromHistory() } catch (e) { console.warn('restoreChoiceFlagsFromHistory error (loadedData):', e) }
    
    // 直接进入游戏
    isLandscapeReady.value = true
    // 即便数据已恢复，为了视觉一致性仍然执行一次平滑加载到 100% 的动画
    try {
      const dur = USE_MOCK_STORY ? 10000 : 900
      await simulateLoadTo100(dur)
    } catch (e) {
      isLoading.value = false
    }
    showText.value = true
    return
  }

  if (isNativeApp.value) {
    // APP 环境：直接进入横屏
    isLandscapeReady.value = true
    await requestLandscape()
    await initializeGame()
  } else {
    // 浏览器环境：在开发模式下自动进入阅读以便测试选项；生产模式仍显示进入阅读按钮
    try {
      if (import.meta.env && import.meta.env.DEV) {
        isLandscapeReady.value = true
        await initializeGame()
      } else {
        // 生产/正式环境：显示进入阅读按钮
      }
    } catch (e) {
      // 某些构建环境可能不支持 import.meta.env，这里保守处理
    }
  }
  // 页面可见性变化：隐藏→暂停自动播放并尝试自动存档；可见→如开启自动播放则恢复
  const onVisibility = () => {
    if (document.hidden) {
      // 后台：暂停自动播放，避免后台计时推进
      stopAutoPlayTimer()
      autoSaveToSlot()
    } else {
      // 回到前台：如当前设置开启自动播放且没有弹窗打开，则恢复计时器
      try {
        if (autoPlayEnabled.value && !(anyOverlayOpen && anyOverlayOpen.value)) startAutoPlayTimer()
      } catch (e) {
        if (autoPlayEnabled.value) startAutoPlayTimer()
      }
    }
  }
  document.addEventListener('visibilitychange', onVisibility)
  // 卸载/刷新前的本地快速存档
  const onBeforeUnload = () => {
    quickLocalAutoSave(AUTO_SAVE_SLOT)
  }
  window.addEventListener('beforeunload', onBeforeUnload)
  // 存储清理函数到实例上，便于卸载时移除
  ;(onMounted._cleanup = () => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('beforeunload', onBeforeUnload)
  })
})

onUnmounted(() => {
  // 关闭 SSE
  try { if (eventSource) eventSource.close() } catch (e) {}
  stopAutoPlayTimer()
})


// 打开菜单时暂停自动播放；关闭菜单后若开启则恢复
// 注意：需要在 showMenu 定义之后再注册（见下方）

// 以下变量已从 useStoryAPI 导入: currentSceneIndex, currentDialogueIndex, currentChapterIndex
// 创作者模式开关：必须启用后才允许编辑或替换图片
const creatorMode = ref(false)

// 创作者大纲编辑器（当从 createResult 进入且为 modifiable 时使用）
const showOutlineEditor = ref(false)
const outlineEdits = ref([]) // [{ chapterIndex, outline }]
const outlineUserPrompt = ref('')
const originalOutlineSnapshot = ref([])
let outlineEditorResolver = null
// 当自动在章节前弹出编辑器时，记录该次编辑目标章节（1-based）以便 confirm 使用。
const pendingOutlineTargetChapter = ref(null)



// 手动打开大纲编辑器（供页面按钮或其它流程调用）
const openOutlineEditorManual = async () => {
  try {
    // 手动打开编辑器仅需要 createResult.modifiable 为 true（允许作者手动编辑），不强制要求 AI 可用
    if (!modifiableFromCreate.value) {
      try { showNotice('您无权编辑本作品的大纲（非作者或未开启创作者模式）。') } catch(e){}
      return
    }
    
    // 注意：不检查章节状态，允许在章节状态为 generated 时重新编辑大纲重新生成
    // 只有进入创作者模式（toggleCreatorMode）才需要章节必须是 saved 状态
    
    let createRaw = null
    try { createRaw = JSON.parse(sessionStorage.getItem('createResult') || 'null') } catch (e) { createRaw = null }
    const rawOutlines = (createRaw && Array.isArray(createRaw.chapterOutlines)) ? createRaw.chapterOutlines : []
  const start = Number(currentChapterIndex.value) || 1
    // build chapterIndex -> outline map to avoid shifting later chapters earlier
    const outlinesMap = {}
    let maxIdx = 0
    if (Array.isArray(rawOutlines)) {
      for (let i = 0; i < rawOutlines.length; i++) {
        const ch = rawOutlines[i]
        let ci = null
        try {
          if (ch && (typeof ch.chapterIndex !== 'undefined')) ci = Number(ch.chapterIndex)
          else if (ch && (typeof ch.chapter_index !== 'undefined')) ci = Number(ch.chapter_index)
          else ci = i + 1
        } catch (e) { ci = i + 1 }
        outlinesMap[ci] = (ch && (ch.summary || ch.title || ch.outline)) ? (ch.summary || ch.title || ch.outline) : JSON.stringify(ch)
        if (ci > maxIdx) maxIdx = ci
      }
    }
    const total = Math.max((Number(totalChapters.value) || 5), maxIdx)
    outlineEdits.value = []
    for (let j = start; j <= total; j++) {
      if (typeof outlinesMap[j] !== 'undefined') {
        outlineEdits.value.push({ chapterIndex: j, outline: outlinesMap[j] })
      } else {
        outlineEdits.value.push({ chapterIndex: j, outline: `第${j}章：请在此编辑/补充本章大纲以指导生成。` })
      }
    }
    outlineUserPrompt.value = createRaw?.userPrompt || ''
    // 记录原始大纲快照（用于取消时按原始大纲生成）
    try { originalOutlineSnapshot.value = JSON.parse(JSON.stringify(outlineEdits.value || [])) } catch(e) { originalOutlineSnapshot.value = (outlineEdits.value || []).slice() }
    // 由手动按钮打开 editor，标记为 manual 调用；仅当菜单 creatorMode 为 true 时允许编辑/生成
    editorInvocation.value = 'manual'
    // 手动打开编辑器时，目标章节默认为当前章节
    pendingOutlineTargetChapter.value = start
    showOutlineEditor.value = true
  } catch (e) { console.warn('openOutlineEditorManual failed', e) }
}

const cancelOutlineEdits = () => {
  try { showOutlineEditor.value = false } catch (e) {}
  // 如果是自动调用（章节前弹出），或菜单中启用了创作者模式，则取消也需要触发生成（使用原始大纲）
  (async () => {
    try {
      const workId = work.value.id
      if (editorInvocation.value === 'auto' || creatorMode.value) {
        const payloadOutlines = (originalOutlineSnapshot.value || []).map(o => ({ chapterIndex: o.chapterIndex, summary: o.outline }))
        try {
          const tChap = payloadOutlines[0]?.chapterIndex || 1
          const lockKey = `${workId}:${tChap}`
          if (generationLocks.value[lockKey]) {
            console.log('cancelOutlineEdits: generate already in progress for', lockKey)
          } else {
            generationLocks.value[lockKey] = true
            try {
              await generateChapter(workId, tChap, { chapterOutlines: payloadOutlines, userPrompt: outlineUserPrompt.value })
            } catch (e) {
              console.warn('cancelOutlineEdits generate failed', e)
            } finally {
              // 立即释放锁；实际加载由其他轮询（getScenes/pollWorkStatus）完成
              try { delete generationLocks.value[lockKey] } catch (ee) {}
            }
          }
        } catch (e) { console.warn('cancelOutlineEdits generate flow failed', e) }
      }
    } catch (e) { console.warn('cancelOutlineEdits async failed', e) }
  })()
  if (typeof outlineEditorResolver === 'function') { outlineEditorResolver(false); outlineEditorResolver = null }
  // 清除 pending 标记
  pendingOutlineTargetChapter.value = null
}

const confirmOutlineEdits = async () => {
  try {
    // 映射为后端期望格式（包含 outline 字段）
    const workId = work.value && (work.value.id || work.value.gameworkId || work.value.workId)
    if (!workId) {
      showNotice('无法识别作品 ID，无法提交生成请求')
      if (typeof outlineEditorResolver === 'function') { outlineEditorResolver(false); outlineEditorResolver = null }
      return
    }

    const payloadOutlines = (outlineEdits.value || []).map(o => ({ chapterIndex: o.chapterIndex, outline: o.outline || o.summary || '' }))

  // 优先使用 pendingOutlineTargetChapter（在章节前自动弹窗时会设置为目标章节），否则以当前章节为准，最后 fallback 到大纲列表首项
  const targetChapter = Number(pendingOutlineTargetChapter.value) || Number(currentChapterIndex.value) || payloadOutlines[0]?.chapterIndex || 1

  // 立即关闭编辑器并切换到加载界面，让用户知道请求已发出
  try { showOutlineEditor.value = false } catch (e) {}
  try { startLoading() } catch (e) { isLoading.value = true }
  isFetchingNext.value = true
  showNotice('已提交大纲，正在请求后端生成章节，请稍候...')

  // Debug log - 确保点击触发
  console.log('confirmOutlineEdits triggered', { workId, currentChapterIndex: currentChapterIndex.value })

    // 将用户编辑的最新版大纲与 prompt 写回 sessionStorage.createResult，便于下次打开时回显
    try {
      const prev = JSON.parse(sessionStorage.getItem('createResult') || '{}')
      prev.chapterOutlines = payloadOutlines
      prev.userPrompt = outlineUserPrompt.value || ''
      // 也将 backendWork.outlines 更新为最新大纲（便于介绍页/其它页面使用）
      prev.backendWork = prev.backendWork || {}
      prev.backendWork.outlines = payloadOutlines
      sessionStorage.setItem('createResult', JSON.stringify(prev))
    } catch (e) { console.warn('failed to write createResult outlines to sessionStorage', e) }

  // 清除 pending 标记（生成请求已发出）
  pendingOutlineTargetChapter.value = null

  // 触发后端生成
    const genLockKey = `${workId}:${targetChapter}`
    let genResp = null
      try {
        // 如果 AI 生成功能不可用但 createResult 表示可手动编辑，则将当前章节内容 PUT 到后端（手动覆盖保存）
        if (!creatorFeatureEnabled.value && modifiableFromCreate.value) {
          try {
            // 简化：直接使用 storyScenes 的全部内容（因为现在只包含当前章节）
            let scenesPayload = []
            if (storyScenes.value && storyScenes.value.length > 0) {
              scenesPayload = storyScenes.value.map((s, idx) => {
                let sid = Number(s.sceneId ?? s.id)
                if (!Number.isInteger(sid) || sid <= 0) sid = idx + 1
                return { id: Number(sid), backgroundImage: s.backgroundImage || '', dialogues: s.dialogues || [] }
              })
            } else if (Array.isArray(outlineEdits.value) && outlineEdits.value.length > 0) {
              // Fallback: 若没有场景，使用 outlineEdits 生成占位场景
              const o = outlineEdits.value.find(x => Number(x.chapterIndex) === Number(targetChapter)) || outlineEdits.value[0]
              scenesPayload = [{ id: 1, backgroundImage: work.value.coverUrl || '', dialogues: [{ narration: o ? (o.outline || '') : '手动编辑占位' }] }]
            }

            const getFallbackTitleForTarget = () => {
              try {
                const byOutline = (outlineEdits.value && outlineEdits.value.length) ? (outlineEdits.value.find(x => Number(x.chapterIndex) === Number(targetChapter))?.outline || '') : ''
                if (byOutline && String(byOutline).trim()) return String(byOutline).trim()
                try {
                  const prev = JSON.parse(sessionStorage.getItem('createResult') || '{}')
                  const bwOut = prev && prev.backendWork && Array.isArray(prev.backendWork.outlines) ? prev.backendWork.outlines : []
                  const found = (bwOut || []).find(x => Number(x.chapterIndex) === Number(targetChapter))
                  if (found && (found.outline || found.summary || found.title)) return String(found.outline || found.summary || found.title).trim()
                } catch (e) {}
                if (work && work.value && work.value.title) return String(work.value.title)
              } catch (e) { console.warn('getFallbackTitleForTarget failed', e) }
              return `第${Number(targetChapter)}章`
            }

            const chapterData = {
              chapterIndex: Number(targetChapter),
              title: getFallbackTitleForTarget(),
              scenes: scenesPayload
            }

            console.log('saveChapter PUT', { workId, targetChapter, chapterData })
            await saveChapter(workId, targetChapter, chapterData)
            console.log('saveChapter success')
            showNotice('手动编辑已保存到后端')
            
            // 将编辑结果写回 sessionStorage（保持一致性）
            try {
              const prev = JSON.parse(sessionStorage.getItem('createResult') || '{}')
              prev.backendWork = prev.backendWork || {}
              prev.backendWork.outlines = prev.backendWork.outlines || []
              const idx = (prev.backendWork.outlines || []).findIndex(x => Number(x.chapterIndex) === Number(targetChapter))
              if (idx >= 0) {
                prev.backendWork.outlines[idx].outline = outlineEdits.value && outlineEdits.value.length ? (outlineEdits.value.find(x => Number(x.chapterIndex) === Number(targetChapter))?.outline || '') : prev.backendWork.outlines[idx].outline
              }
              sessionStorage.setItem('createResult', JSON.stringify(prev))
            } catch (e) { console.warn('failed to update createResult after saveChapter', e) }

            // 结束编辑器并返回
            showOutlineEditor.value = false
            if (typeof outlineEditorResolver === 'function') { outlineEditorResolver(true); outlineEditorResolver = null }
            try { await stopLoading(); showText.value = true } catch (e) { isLoading.value = false; showText.value = true }
            isFetchingNext.value = false
            return
          } catch (e) {
            console.error('confirmOutlineEdits: saveChapter failed', e?.response?.data || e)
            showNotice('保存章节失败，请检查网络或稍后重试')
            if (typeof outlineEditorResolver === 'function') { outlineEditorResolver(false); outlineEditorResolver = null }
            isFetchingNext.value = false
            try { await stopLoading() } catch (err) { isLoading.value = false }
            return
          }
        }

        console.log('calling generateChapter POST', { workId, targetChapter, payloadOutlines, userPrompt: outlineUserPrompt.value, genLockKey })
        if (generationLocks.value[genLockKey]) {
          console.log('generateChapter already in progress for', genLockKey)
          // 表示已有一次由本客户端发起的生成在进行，跳过重复 POST，继续轮询作品详情
          genResp = { ok: true, note: 'already_locked' }
        } else {
          generationLocks.value[genLockKey] = true
          try {
            genResp = await generateChapter(workId, targetChapter, { chapterOutlines: payloadOutlines, userPrompt: outlineUserPrompt.value })
            console.log('generateChapter response', genResp)
          } catch (gErr) {
            // 发送失败，清除锁并抛出以供上层处理
            try { delete generationLocks.value[genLockKey] } catch (e) {}
            throw gErr
          }
        }
      } catch (e) {
        console.error('generateChapter 调用失败', e)
        showNotice('提交生成请求失败，请检查网络或稍后重试')
        if (typeof outlineEditorResolver === 'function') { outlineEditorResolver(false); outlineEditorResolver = null }
        isFetchingNext.value = false
        return
      }

    // 后端通常返回 { ok: true } 来表示已接受请求
    if (!genResp || genResp.ok !== true) {
      console.warn('generateChapter 返回非预期结果', genResp)
      showNotice('后端未接受生成请求或返回状态异常，请稍后重试')
      if (typeof outlineEditorResolver === 'function') { outlineEditorResolver(false); outlineEditorResolver = null }
      // 清除本客户端的生成锁（若有）
      try { delete generationLocks.value[genLockKey] } catch (e) {}
      isFetchingNext.value = false
      return
    }

      // 处理已提交生成请求后的加载逻辑
    try {
      showNotice('已提交生成请求，正在请求并等待生成完成...')
      if (creatorFeatureEnabled.value || editorInvocation.value === 'auto') {
        // 创作者身份：轮询作品详情直到后端将该章节标记为 generated（或 saved），然后仅做一次 GET 来加载章节内容
        const finalStatus = await pollWorkStatus(workId, targetChapter, { interval: 1500, timeout: 120000 })
        console.log('pollWorkStatus result for chapter', targetChapter, finalStatus)
        if (finalStatus === 'generated' || finalStatus === 'saved') {
          try {
            // 标记本次由客户端加载的已生成章节，确保确认按钮在加载后仍然可见，直到用户手动保存
            lastLoadedGeneratedChapter.value = targetChapter
            const res = await fetchNextChapter(workId, targetChapter, { replace: true, suppressAutoEditor: true, singleRequest: true })
            console.log('loaded generated chapter via fetchNextChapter (singleRequest)', res)
            
            // 确保关闭加载状态并显示内容
            try { await stopLoading() } catch (err) { isLoading.value = false }
            showText.value = true
            
            showNotice('章节生成完成，已加载到游戏页面', 3000)
          } catch (e) {
            console.error('fetchNextChapter after poll failed', e)
            
            // 加载失败时,尝试使用非 singleRequest 模式重试一次
            try {
              console.log('尝试使用 getScenes 重试加载章节...')
              const retryRes = await fetchNextChapter(workId, targetChapter, { replace: true, suppressAutoEditor: true, singleRequest: false })
              console.log('重试加载成功', retryRes)
              
              // 确保关闭加载状态并显示内容
              try { await stopLoading() } catch (err) { isLoading.value = false }
              showText.value = true
              
              showNotice('章节已加载成功', 3000)
            } catch (retryErr) {
              console.error('重试加载也失败', retryErr)
              showNotice('章节加载失败,请稍后重试', 5000)
              
              // 确保关闭加载状态
              try { await stopLoading() } catch (err) { isLoading.value = false }
            }
          } finally {
            // 清除本客户端的生成锁
            try { delete generationLocks.value[`${workId}:${targetChapter}`] } catch (e) {}
          }
        } else {
          console.warn('pollWorkStatus returned unexpected status', finalStatus)
          showNotice('章节生成状态异常，请稍后重试')
          // 确保关闭加载状态
          try { await stopLoading() } catch (err) { isLoading.value = false }
        }
     
      } else {
        // 非创作者身份：直接调用 fetchNextChapter（默认行为，内部会使用 getScenes 的重试逻辑来等待生成完成）
        try {
          const res = await fetchNextChapter(workId, targetChapter, { replace: true, suppressAutoEditor: true, singleRequest: false })
          console.log('loaded chapter via fetchNextChapter (non-creator path)', res)
          
          // 确保关闭加载状态并显示内容
          try { await stopLoading() } catch (err) { isLoading.value = false }
          showText.value = true
          
          showNotice('章节已加载到游戏页面', 3000)
        } catch (e) {
          console.error('fetchNextChapter (non-creator) failed', e)
          showNotice('加载章节失败，请稍后重试', 5000)
          
          // 确保关闭加载状态
          try { await stopLoading() } catch (err) { isLoading.value = false }
        }
      }
      // 清除预览快照并结束编辑器
      try { previewSnapshot.value = null } catch (e) {}
      showOutlineEditor.value = false
      if (typeof outlineEditorResolver === 'function') { outlineEditorResolver(true); outlineEditorResolver = null }
    } catch (e) {
      console.error('获取生成章节失败或超时', e)
      showNotice('获取章节内容超时或出错，请稍后重试')
      if (typeof outlineEditorResolver === 'function') { outlineEditorResolver(false); outlineEditorResolver = null }
      try { await stopLoading() } catch (err) { isLoading.value = false }
      // 清除本客户端的生成锁，防止永久阻塞
      try { delete generationLocks.value[genLockKey] } catch (ee) {}
    }

  } catch (e) {
    console.warn('confirmOutlineEdits failed', e)
    showNotice('提交大纲时发生错误，请稍后重试')
    if (typeof outlineEditorResolver === 'function') { outlineEditorResolver(false); outlineEditorResolver = null }
  } finally {
    isFetchingNext.value = false
    // 确保 loading 被关闭（防止由于异常停留）
    if (isLoading.value) {
      try { await stopLoading() } catch (e) { isLoading.value = false }
    }
  }
}

// 打开菜单时暂停自动播放；关闭菜单后若开启则恢复
watch(showMenu, (open) => {
  if (open) {
    stopAutoPlayTimer()
  } else if (autoPlayEnabled.value) {
    startAutoPlayTimer()
  }
})

// 注意：其它弹窗的监听需放在相关 ref 定义之后（见下文）

// 以下变量已从 useStoryAPI 导入: 
// currentScene, currentDialogue, currentBackground, currentSpeaker, isFetchingNext

// --------- 用户可编辑 / 图片替换支持（前端优先，本地持久化） ---------
// 存储 key：storycraft_overrides_{userId}_{workId}
const overridesKey = (userId, workId) => `storycraft_overrides_${userId}_${workId}`
const userId = getCurrentUserId()
const overrides = ref({}) // { scenes: {<sceneId>: { backgroundImage, dialogues: {<idx>: text} } } }

const loadOverrides = () => {
  try {
    // 为了保证每次“重进游戏”不再保留上一次的修改：
    // - 先清理遗留在 localStorage 中的旧键（向后兼容旧实现）
    // - 优先从 sessionStorage 读取（session 只在当前标签页/会话内有效，关闭标签后会自动清除）
    try { localStorage.removeItem(overridesKey(userId, work.value.id)) } catch (e) {}
    const raw = sessionStorage.getItem(overridesKey(userId, work.value.id))
    if (raw) overrides.value = JSON.parse(raw)
    else overrides.value = {}
  } catch (e) { overrides.value = {} }
}

const saveOverrides = () => {
  try {
    // 使用 sessionStorage 保持当前会话内的修改，但在关闭/重新进入时不恢复
    sessionStorage.setItem(overridesKey(userId, work.value.id), JSON.stringify(overrides.value || {}))
  } catch (e) {
    // 记录更详细信息以便排查（例如 quota 问题）
    try {
      const size = JSON.stringify(overrides.value || {}).length
      console.warn('保存 overrides 失败, size:', size, e)
    } catch (inner) { console.warn('保存 overrides 失败', e) }
  }
}

// 应用 overrides 到 storyScenes（只在前端显示，不更改后端数据）
const applyOverridesToScenes = () => {
  try {
    if (!overrides.value || !overrides.value.scenes) return
    for (const sid in overrides.value.scenes) {
      // 找到与 sid 对应的场景索引，兼容数值或字符串 sceneId/id
      let sIdx = -1
      for (let i = 0; i < storyScenes.value.length; i++) {
        const s = storyScenes.value[i]
          // 优先使用内部唯一 id (_uid)，然后尝试 sceneId 或 id，最后回退到索引键
          const key = String((s && (s._uid ?? s.sceneId ?? s.id)) != null ? (s._uid ?? s.sceneId ?? s.id) : `idx_${i}`)
        if (key === String(sid)) { sIdx = i; break }
      }
      if (sIdx === -1) continue
      const ov = overrides.value.scenes[sid]
      if (ov.backgroundImage) storyScenes.value[sIdx].backgroundImage = ov.backgroundImage
      if (ov.dialogues) {
        for (const k in ov.dialogues) {
          const idx = Number(k)
          if (!isNaN(idx) && storyScenes.value[sIdx].dialogues && idx < storyScenes.value[sIdx].dialogues.length) {
            // 如果对话项是对象，保留结构并覆盖 text；若是字符串则直接替换
            const orig = storyScenes.value[sIdx].dialogues[idx]
            if (typeof orig === 'string') storyScenes.value[sIdx].dialogues[idx] = ov.dialogues[k]
            else if (typeof orig === 'object') storyScenes.value[sIdx].dialogues[idx] = { ...orig, text: ov.dialogues[k] }
          }
        }
      }
    }
    // 强制刷新 storyScenes 引用，确保视图更新（部分嵌套修改在某些情况下未触发视图更新）
    try {
      storyScenes.value = JSON.parse(JSON.stringify(storyScenes.value || []))
      // 如果当前文字正在显示，短暂切换以触发过渡/重绘
      try { showText.value = false; setTimeout(() => { showText.value = true }, 40) } catch (e) {}
    } catch (e) { console.warn('force refresh after applyOverridesToScenes failed', e) }
  } catch (e) { console.warn('applyOverridesToScenes failed', e) }
}

// 文本编辑状态与内容
const editingDialogue = ref(false)
const editableText = ref('')
const editableDiv = ref(null)
const isComposing = ref(false)


const startEdit = async () => {
  if (!creatorMode.value) {
    // 仅在创作者模式允许编辑
    showMenu.value = true
    return
  }
  
  // 检查当前章节状态是否为 saved
  // 如果是阅读者身份（modifiable=true, ai_callable=false），不受章节状态限制
  if (work.value.ai_callable !== false) {
    const isSaved = await checkCurrentChapterSaved()
    if (!isSaved) {
      showNotice('当前章节未保存(saved)状态，无法进行手动编辑')
      return
    }
  }
  
  editableText.value = currentDialogue.value || ''
  editingDialogue.value = true
  // 允许用户聚焦到可编辑块
  setTimeout(() => {
    try {
      const el = editableDiv.value || document.querySelector('.dialogue-text[contenteditable]')
      if (el) {
        // 设置初始文本而不触发 Vue 重新渲染
        try { el.innerText = editableText.value } catch (e) {}
        el.focus()
        // 将光标放到末尾
        try { const range = document.createRange(); const sel = window.getSelection(); range.selectNodeContents(el); range.collapse(false); sel.removeAllRanges(); sel.addRange(range) } catch (e) {}
      }
    } catch (e) {}
  }, 50)
}

// contenteditable 事件处理器（使用命名函数避免模板内联表达式引起的运行时绑定问题）
const onEditableInput = (e) => {
  try {
    if (!isComposing.value) editableText.value = e.target.innerText
  } catch (err) { console.warn('onEditableInput failed', err) }
}

const onCompositionStart = () => {
  try { isComposing.value = true } catch (err) { console.warn('onCompositionStart failed', err) }
}

const onCompositionEnd = (e) => {
  try { isComposing.value = false; editableText.value = e.target.innerText } catch (err) { console.warn('onCompositionEnd failed', err) }
}

const cancelEdit = () => {
  // 放弃修改，恢复为当前对话内容
  editableText.value = currentDialogue.value || ''
  editingDialogue.value = false
}

const finishEdit = () => {
  // 将修改写入 overrides 并持久化，再应用到场景
  try {
    const scene = currentScene.value
    if (!scene) return
    // 优先使用内部唯一标识 _uid（若存在），以保证在场景数组发生插入/删减后仍能正确映射
    const sid = (scene._uid || scene.sceneId || scene.id || `idx_${currentSceneIndex.value}`)
    // 如果当前对话来源于某个选项的 subsequentDialogues，则同步修改该 choice 的 subsequentDialogues
    try {
      const sceneIdx = currentSceneIndex.value
      const curScene = storyScenes.value[sceneIdx]
      const curItem = curScene && Array.isArray(curScene.dialogues) ? curScene.dialogues[currentDialogueIndex.value] : null
      if (curItem && typeof curItem === 'object' && curItem._fromChoiceId != null) {
        try {
          const cid = curItem._fromChoiceId
          const cidx = Number(curItem._fromChoiceIndex)
          const ch = curScene.choices && curScene.choices.find(cc => String(cc.id) === String(cid))
          if (ch) {
            ch.subsequentDialogues = ch.subsequentDialogues || []
            ch.subsequentDialogues[cidx] = editableText.value
          }
        } catch (e) { console.warn('sync back to choice.subsequentDialogues failed', e) }
      }
    } catch (e) { console.warn('finishEdit sync check failed', e) }

    overrides.value.scenes = overrides.value.scenes || {}
    overrides.value.scenes[sid] = overrides.value.scenes[sid] || { dialogues: {} }
    overrides.value.scenes[sid].dialogues = overrides.value.scenes[sid].dialogues || {}
    overrides.value.scenes[sid].dialogues[currentDialogueIndex.value] = editableText.value
    saveOverrides()
    applyOverridesToScenes()
    // 确认编辑后，清除任何 creator-mode 的预览快照，避免退出创作者模式时被回滚
    try { previewSnapshot.value = null } catch (e) {}
  } catch (e) { console.warn('finishEdit failed', e) }
  console.log('dialogue edit finished', overrides.value)
  // 确认编辑后不允许自动切换，必须点击播放下一句按钮
  editingDialogue.value = false
  allowAdvance.value = false
  // 强制刷新显示（切换 showText 触发过渡），以确保替换后的文本立刻渲染
  try {
    showText.value = false
    setTimeout(() => { showText.value = true }, 60)
  } catch (e) {}
}


// 图片替换：在本地将图片读取为 dataURL，并保存在 overrides 中
const imgInput = ref(null)
const triggerImagePicker = async () => {
  // 仅在手动创作者模式下允许替换图片；如果未启用 modifiable，则提示并打开菜单
  if (!creatorMode.value) { showMenu.value = true; return }
  if (!modifiableFromCreate.value) { showNotice('您无权替换图片：非作者或未开启创作者模式'); return }
  
  // 检查当前章节状态是否为 saved
  // 如果是阅读者身份（modifiable=true, ai_callable=false），不受章节状态限制
  if (work.value.ai_callable !== false) {
    const isSaved = await checkCurrentChapterSaved()
    if (!isSaved) {
      showNotice('当前章节未保存(saved)状态，无法进行手动编辑')
      return
    }
  }
  
  try { imgInput.value && imgInput.value.click() } catch (e) {}
}

const onImageSelected = async (ev) => {
  try {
    const f = ev?.target?.files?.[0]
    if (!f) return
    // 只允许图片
    if (!/^image\//.test(f.type)) return
    const reader = new FileReader()
    reader.onload = async () => {
      const data = reader.result
      const scene = currentScene.value
      if (!scene) return
      const sid = (scene._uid || scene.sceneId || scene.id || `idx_${currentSceneIndex.value}`)
      overrides.value.scenes = overrides.value.scenes || {}
      overrides.value.scenes[sid] = overrides.value.scenes[sid] || { dialogues: {} }
      // 先把本地 preview 用 dataURL 显示
      overrides.value.scenes[sid].backgroundImage = data
      saveOverrides()
      applyOverridesToScenes()
      // 上传图片到后端，获取 imageUrl 后替换本地 preview
      try {
        const form = new FormData()
        form.append('file', f)
        // axios http instance is imported as `http` (utils/http.js)
        try {
          const resp = await http.post('/game/upload-image/', form, { headers: { 'Content-Type': 'multipart/form-data' } })
          // axios response data is in resp.data
          const imageUrl = (resp && resp.data && (resp.data.imageUrl || resp.data.imageUrl)) || (resp && resp.imageUrl) || null
          if (imageUrl) {
            overrides.value.scenes[sid].backgroundImage = imageUrl
            saveOverrides()
            applyOverridesToScenes()
            showNotice('图片已上传并替换为服务器 URL')
          } else {
            console.warn('upload returned no imageUrl', resp)
            showNotice('图片已本地替换，但上传未返回 URL')
          }
        } catch (uploadErr) {
          console.error('upload image failed', uploadErr)
          showNotice('图片上传失败，请稍后重试（已保留本地预览）')
        }
      } catch (e) { console.warn('image upload flow failed', e) }

      // 确认图片替换后，清除预览快照，避免退出创作者模式时被回滚
      try { previewSnapshot.value = null } catch (e) {}
      // 强制重绘以确保背景图立即生效
      try { showText.value = false; setTimeout(() => { showText.value = true }, 40) } catch (e) {}
    }
    reader.readAsDataURL(f)
  } catch (e) { console.warn('onImageSelected failed', e) }
}

// 点击播放下一句：允许 advance 并直接尝试切换到下一句
const playNextAfterEdit = () => {
  try {
    allowAdvance.value = true
    // 关闭菜单（若菜单还打开），以便 nextDialogue 不会被 showMenu 阻止
    try { showMenu.value = false } catch (e) {}
    // 等一个短时钟再触发 nextDialogue，确保菜单已关闭并 UI 能聚焦
    setTimeout(() => { nextDialogue() }, 60)
  } catch (e) { console.warn('playNextAfterEdit failed', e) }
}

// 将当前章节（currentChapterIndex）中前端当前 scenes 的修改持久化到后端（PUT /api/game/chapter/{id}/{chapterIndex}/）
// opts:
//  - auto: boolean (默认 true) 表示调用是否为自动保存（卸载/切换/退出创作者模式），自动保存不应把已生成但未确认的章节标记为 saved
//  - allowSaveGenerated: boolean 手动确认时应传 true，以允许将 generated -> saved
//  - chapterIndex: number 可选，指定要保存的章节
const persistCurrentChapterEdits = async (opts = {}) => {
  try {
    if (!modifiableFromCreate.value) {
      console.log('persistCurrentChapterEdits skipped: not modifiableFromCreate')
      return
    }
    const workId = work.value && (work.value.id || work.value.gameworkId || work.value.workId)
    if (!workId) return
    
    const auto = (typeof opts.auto === 'undefined') ? true : !!opts.auto
    const allowSaveGenerated = !!opts.allowSaveGenerated
    const chapterIndex = Number(opts.chapterIndex || currentChapterIndex.value) || 1

    // 如果是自动保存且当前章节处于 generated（未确认）状态，则跳过自动保存
    try {
      const st = getChapterStatus(chapterIndex)
      if (auto && st === 'generated') {
        console.log('persistCurrentChapterEdits: skipping auto-save for generated chapter', { chapterIndex })
        return
      }
    } catch (e) { /* ignore errors from getChapterStatus */ }

    // 简化逻辑：storyScenes 现在只包含当前章节，直接使用全部内容
    if (!storyScenes.value || storyScenes.value.length === 0) {
      console.log('persistCurrentChapterEdits: no scenes to persist')
      return
    }

    // 构建对话数据的规范化函数
    const normalizeDialogue = (d, scene, dIdx) => {
      try {
        // 如果是字符串，包装为 narration
        if (typeof d === 'string') {
          const playerChoicesFromScene = (scene && Array.isArray(scene.choices) && Number(scene.choiceTriggerIndex) === Number(dIdx)) ? scene.choices.map((c, idx) => {
            const pc = { text: c.text ?? c.label ?? '', attributesDelta: c.attributesDelta || c.delta || {}, statusesDelta: c.statusesDelta || c.statuses || {}, subsequentDialogues: c.subsequentDialogues || c.nextLines || [] }
            const maybeId = Number(c.choiceId ?? c.id)
            pc.choiceId = Number.isInteger(maybeId) ? maybeId : (idx + 1)
            return pc
          }) : []
          return { narration: d, playerChoices: playerChoicesFromScene }
        }
        // 如果是对象，规范化 playerChoices
        if (d && typeof d === 'object') {
          const narration = (typeof d.narration === 'string') ? d.narration : (d.text || d.content || '')
          let playerChoices = []
          if (Array.isArray(d.playerChoices) && d.playerChoices.length > 0) {
            playerChoices = d.playerChoices.map((c, idx) => {
              const pc = { text: c.text ?? c.label ?? '', attributesDelta: c.attributesDelta || c.delta || {}, statusesDelta: c.statusesDelta || c.statuses || {}, subsequentDialogues: c.subsequentDialogues || c.nextLines || [] }
              const maybeId = Number(c.choiceId ?? c.id)
              pc.choiceId = Number.isInteger(maybeId) ? maybeId : (idx + 1)
              return pc
            })
          } else if (Array.isArray(d.choices) && d.choices.length > 0) {
            playerChoices = d.choices.map((c, idx) => {
              const pc = { text: c.text ?? c.label ?? '', attributesDelta: c.attributesDelta || c.delta || {}, statusesDelta: c.statusesDelta || c.statuses || {}, subsequentDialogues: c.subsequentDialogues || c.nextLines || [] }
              const maybeId = Number(c.choiceId ?? c.id)
              pc.choiceId = Number.isInteger(maybeId) ? maybeId : (idx + 1)
              return pc
            })
          } else if (scene && Array.isArray(scene.choices) && Number(scene.choiceTriggerIndex) === Number(dIdx)) {
            playerChoices = scene.choices.map((c, idx) => {
              const pc = { text: c.text ?? c.label ?? '', attributesDelta: c.attributesDelta || c.delta || {}, statusesDelta: c.statusesDelta || c.statuses || {}, subsequentDialogues: c.subsequentDialogues || c.nextLines || [] }
              const maybeId = Number(c.choiceId ?? c.id)
              pc.choiceId = Number.isInteger(maybeId) ? maybeId : (idx + 1)
              return pc
            })
          }
          return { narration: narration || '', playerChoices }
        }
      } catch (e) { console.warn('normalizeDialogue failed', e) }
      return { narration: '', playerChoices: [] }
    }

    // 构建场景数据
    const scenesPayload = storyScenes.value.map((s, idx) => {
      let sid = Number(s.sceneId ?? s.id)
      if (!Number.isInteger(sid) || sid <= 0) sid = idx + 1
      const bg = (s.backgroundImage || s.background_image || s.background || '')
      const rawDialogues = Array.isArray(s.dialogues) ? s.dialogues : []
      const dialogues = rawDialogues.map((d, dIdx) => normalizeDialogue(d, s, dIdx))
      return { id: Number(sid), backgroundImage: bg || '', dialogues }
    })

    // 获取章节标题
    const getFallbackTitle = () => {
      try {
        const byOutline = (outlineEdits.value && outlineEdits.value.length) ? (outlineEdits.value.find(x => Number(x.chapterIndex) === Number(chapterIndex))?.outline || '') : ''
        if (byOutline && String(byOutline).trim()) return String(byOutline).trim()
        
        try {
          const prev = JSON.parse(sessionStorage.getItem('createResult') || '{}')
          const bwOut = prev && prev.backendWork && Array.isArray(prev.backendWork.outlines) ? prev.backendWork.outlines : []
          const found = (bwOut || []).find(x => Number(x.chapterIndex) === Number(chapterIndex))
          if (found && (found.outline || found.summary || found.title)) return String(found.outline || found.summary || found.title).trim()
        } catch (e) {}
        
        if (work && work.value && work.value.title) return String(work.value.title)
      } catch (e) { console.warn('getFallbackTitle failed', e) }
      return `第${Number(chapterIndex)}章`
    }

    const chapterData = {
      chapterIndex: Number(chapterIndex),
      title: getFallbackTitle(),
      scenes: scenesPayload
    }

    console.log('persistCurrentChapterEdits: saving chapter', { workId, chapterIndex, scenesCount: scenesPayload.length })
    
    try {
      // 特殊处理：创作者身份下，手动确认已生成章节（allowSaveGenerated）
      // 需要调用后端 API 将章节状态更新为 saved
  if (allowSaveGenerated && (creatorFeatureEnabled.value || isCreatorIdentity.value || modifiableFromCreate.value)) {
        // 1) 调用后端 API 保存章节并更新状态为 saved
        try {
          console.log('persistCurrentChapterEdits: calling saveChapter API to mark as saved', { workId, chapterIndex })
          await saveChapter(workId, chapterIndex, chapterData)
          console.log('persistCurrentChapterEdits: saveChapter API succeeded')
          showNotice('已将本章保存并标记为 saved')
        } catch (saveErr) {
          console.error('persistCurrentChapterEdits: saveChapter API failed', saveErr)
          showNotice('保存章节失败: ' + (saveErr.message || '未知错误'), 5000)
          throw saveErr
        }
        
        // 2) 刷新作品详情以获取最新章节状态
        try {
          await getWorkDetails(workId)
          console.log('persistCurrentChapterEdits: refreshed work details, chapter status:', getChapterStatus(chapterIndex))
        } catch (e) {
          console.warn('persistCurrentChapterEdits: failed to refresh work details', e)
        }

        // 2) 清除已生成但未保存标记
        try { lastLoadedGeneratedChapter.value = null } catch (e) {}

        // 3) 如果用户已经阅读到本章末尾，则立即准备并弹出下一章的大纲编辑器；
        //    否则仅将下一章标记为 pending（不弹窗），用户继续阅读到章末时会触发后续流程。
        try {
          const nextChap = Number(chapterIndex) + 1

          const isAtChapterEnd = (currentSceneIndex.value >= (storyScenes.value.length - 1)) &&
                                 (currentDialogueIndex.value >= ((storyScenes.value[currentSceneIndex.value]?.dialogues?.length || 1) - 1))

          if (!isAtChapterEnd) {
            // 不在章末：设置 pendingNextChapter，使后续到达章末时能正常触发加载/编辑器流程
            try {
              pendingNextChapter.value = nextChap
            } catch (e) { console.warn('set pendingNextChapter failed', e) }
            showNotice('已保存本章，阅读至本章末尾后将弹出下一章大纲编辑器')
            try { await stopLoading() } catch (e) {}
            return
          }

          // 在章末的情况：准备并弹出下一章的大纲编辑器（复用原有逻辑）
          // 构建下一章的大纲占位（尽量复用已有 createResult 或 outlineEdits）
          let createRaw = null
          try { createRaw = JSON.parse(sessionStorage.getItem('createResult') || 'null') } catch (e) { createRaw = null }
          let rawOutlines = []
          if (createRaw && Array.isArray(createRaw.chapterOutlines) && createRaw.chapterOutlines.length) rawOutlines = createRaw.chapterOutlines
          else if (createRaw && createRaw.backendWork && Array.isArray(createRaw.backendWork.outlines) && createRaw.backendWork.outlines.length) rawOutlines = createRaw.backendWork.outlines
          else rawOutlines = []

          // 尝试找到 nextChap 对应的大纲，否则使用占位文本
          let nextOutlineText = `第${nextChap}章：请在此编辑/补充本章大纲以指导生成。`
          try {
            if (Array.isArray(rawOutlines) && rawOutlines.length) {
              const found = rawOutlines.find(x => Number(x.chapterIndex) === Number(nextChap)) || rawOutlines[nextChap - 1]
              if (found && (found.outline || found.summary || found.title)) nextOutlineText = found.outline || found.summary || found.title
            }
          } catch (e) { console.warn('prepare next outline failed', e) }

          // 构建 nextChap 以及其后的所有章节大纲（若 totalChapters 不可用则至少包含 nextChap）
          const outlinesToShow = []
          const total = Math.max((Number(totalChapters.value) || 5), nextChap)
          for (let c = nextChap; c <= total; c++) {
            let text = `第${c}章：请在此编辑/补充本章大纲以指导生成。`
            try {
              if (Array.isArray(rawOutlines) && rawOutlines.length) {
                const foundC = rawOutlines.find(x => Number(x.chapterIndex) === Number(c)) || rawOutlines[c - 1]
                if (foundC && (foundC.outline || foundC.summary || foundC.title)) text = foundC.outline || foundC.summary || foundC.title
              }
            } catch (e) { console.warn('prepare outline for chapter', c, 'failed', e) }
            outlinesToShow.push({ chapterIndex: c, outline: text })
          }

          // 将多个章节的大纲写入编辑器，默认聚焦到 nextChap
          outlineEdits.value = outlinesToShow
          outlineUserPrompt.value = (createRaw && createRaw.userPrompt) ? createRaw.userPrompt : ''
          originalOutlineSnapshot.value = JSON.parse(JSON.stringify(outlineEdits.value || []))
          pendingOutlineTargetChapter.value = nextChap
          editorInvocation.value = 'auto'
          // 直接弹出编辑器，不进行 fetchNextChapter（避免前端 PUT 或 GET）
          showOutlineEditor.value = true
          console.log('persistCurrentChapterEdits: opened outline editor for next chapter range', nextChap, '->', total)
        } catch (openErr) {
          console.warn('打开下一章大纲编辑器失败', openErr)
        }

        // 结束该分支：已经向后端保存并更新了章节状态
        try { await stopLoading() } catch (e) {}
        return
      }

      // 默认行为：非创作者确认或允许向后端保存的情况，仍然走原先的 PUT 流程
      console.log('persistCurrentChapterEdits: outbound chapterData:', chapterData)
      await saveChapter(workId, chapterIndex, chapterData)
      console.log('persistCurrentChapterEdits: saveChapter succeeded')
      
      showNotice('已将本章修改保存到后端')
      
      // 刷新作品详情以获取最新章节状态
      await getWorkDetails(workId).catch(() => {})
      
      // 如果这是手动确认保存，则清除已生成但未保存标记
      if (allowSaveGenerated) lastLoadedGeneratedChapter.value = null
      
      // 更新 sessionStorage.createResult 中的大纲
      try {
        const prev = JSON.parse(sessionStorage.getItem('createResult') || '{}')
        prev.backendWork = prev.backendWork || {}
        prev.backendWork.outlines = prev.backendWork.outlines || []
        const idx = (prev.backendWork.outlines || []).findIndex(x => Number(x.chapterIndex) === Number(chapterIndex))
        if (idx >= 0 && outlineEdits.value && outlineEdits.value.length) {
          prev.backendWork.outlines[idx].outline = outlineEdits.value.find(x => Number(x.chapterIndex) === Number(chapterIndex))?.outline || prev.backendWork.outlines[idx].outline
        }
        sessionStorage.setItem('createResult', JSON.stringify(prev))
      } catch (e) { console.warn('persistCurrentChapterEdits: update createResult failed', e) }

      // 如果是手动确认保存（allowSaveGenerated为true），检查是否已读完当前章，如果已读完且不是末章，则弹出下一章编辑器
  if (allowSaveGenerated && (creatorFeatureEnabled.value || isCreatorIdentity.value || modifiableFromCreate.value)) {
        try {
          // 检查是否已读到当前章的末尾
          const isAtChapterEnd = currentSceneIndex.value >= storyScenes.value.length - 1 && 
                                 currentDialogueIndex.value >= (storyScenes.value[currentSceneIndex.value]?.dialogues?.length - 1 || 0)
          
          console.log('保存后检查章节状态 - 已读到章末:', isAtChapterEnd, '当前场景:', currentSceneIndex.value, '总场景数:', storyScenes.value.length)
          
          if (isAtChapterEnd) {
            // 检查当前章是否为末章
            const isLastChapter = totalChapters.value && Number(chapterIndex) === Number(totalChapters.value)
            console.log('保存后检查是否为末章 - 当前章:', chapterIndex, '总章数:', totalChapters.value, '是否末章:', isLastChapter)
            
            if (isLastChapter) {
              // 是末章，跳转到结算页面
              console.log('已完成末章并保存，准备进入结算')
              showNotice('作品已完结，即将进入结算页面', 3000)
              setTimeout(() => {
                storyEndSignaled.value = true
                handleGameEnd()
              }, 3000)
            } else {
              // 不是末章，弹出下一章的大纲编辑器（通过 fetchNextChapter 的自动编辑器流程）
              console.log('非末章已保存并读完，准备弹出下一章大纲编辑器 - 下一章:', chapterIndex + 1)
              showNotice('即将进入下一章的大纲编辑', 2000)
              
              setTimeout(async () => {
                try {
                  // 章节索引+1，准备加载下一章
                  currentChapterIndex.value = chapterIndex + 1
                  startLoading()
                  
                  // 调用 fetchNextChapter 来处理下一章的大纲编辑和生成
                  // fetchNextChapter 会自动检查章节状态，如果是 not_generated 则弹出大纲编辑器
                  await fetchNextChapter(workId, currentChapterIndex.value, { replace: true, suppressAutoEditor: false })
                  await stopLoading()
                  
                  // 加载成功后，重置场景和对话索引
                  currentSceneIndex.value = 0
                  currentDialogueIndex.value = 0
                  choicesVisible.value = false
                  showText.value = false
                  setTimeout(() => {
                    showText.value = true
                    console.log('已切换到下一章:', currentChapterIndex.value)
                  }, 300)
                } catch (e) {
                  console.error('加载下一章失败:', e)
                  showNotice('加载下一章时出错，请刷新页面重试。')
                  await stopLoading()
                }
              }, 2000)
            }
          }
        } catch (e) {
          console.warn('保存后检查章节状态失败:', e)
        }
      }
      
    } catch (e) {
      console.error('persistCurrentChapterEdits: saveChapter failed', e?.response?.data || e)
      showNotice('保存失败，请检查网络或稍后重试')
      throw e
    }
  } catch (e) {
    console.warn('persistCurrentChapterEdits failed', e)
    throw e
  }
}

// 在组件挂载时加载 overrides
onMounted(() => {
  loadOverrides()
  applyOverridesToScenes()
})

// 在组件卸载时自动持久化当前章节（如果可手动编辑）
onUnmounted(() => {
  try {
    (async () => {
      try {
        await persistCurrentChapterEdits()
      } catch (e) { console.warn('persistCurrentChapterEdits onUnmount failed', e) }
    })()
  } catch (e) { console.warn('onUnmounted persist failed', e) }
})



// 控制在创作者模式下是否允许切换到下一句（进入创作者模式时禁用，需点击播放按钮开启）
const allowAdvance = ref(true)
// 记录进入创作者模式时的场景起点，用于退出时回跳
const creatorEntry = { sceneIndex: null, dialogueIndex: null }
// 在创作者模式下阻止自动加载下一章，并保存待加载的章节索引，退出创作者模式后再去加载
const pendingNextChapter = ref(null)
// 预览快照：用于在创作者模式下预览选项后的剧情，退出创作者模式时恢复
const previewSnapshot = ref(null)

// 页面内短时提醒（代替浏览器 alert）
const noticeToast = ref('')
let noticeTimer = null
const showNotice = (msg, ms = 5000) => {
  try {
    noticeToast.value = msg
    if (noticeTimer) clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => { noticeToast.value = ''; noticeTimer = null }, ms)
  } catch (e) { console.warn('showNotice failed', e) }
}

// 切换创作者模式（受 creatorFeatureEnabled 控制）
const toggleCreatorMode = async () => {
  try {
    // 检查 modifiable 权限：如果 modifiable=false，完全不允许进入创作者模式
    if (!modifiableFromCreate.value) {
      showNotice('创作者功能当前不可用：您不是本作品作者或创建时未开启创作者模式。')
      return
    }
    
    // 如果要进入创作者模式，需要检查当前章节状态
    // 但如果是阅读者身份（modifiable=true, ai_callable=false），不受章节状态限制
    if (!creatorMode.value) {
      // 如果有AI权限（ai_callable=true），需要检查章节状态
      if (work.value.ai_callable !== false) {
        const isSaved = await checkCurrentChapterSaved()
        if (!isSaved) {
          showNotice('当前章节未保存(saved)状态，无法进入创作者模式')
          return
        }
      }
      
      if (!creatorFeatureEnabled.value) {
        // 即将进入手动创作模式，但 AI 生成功能被后端禁用，提示用户当前为纯手动编辑模式
        showNotice('注意：作品设置不允许 AI 自动生成，进入后为手动编辑模式，确认后保存会直接覆盖章节内容。')
      }
    }
    
    creatorMode.value = !creatorMode.value
  } catch (e) { console.warn('toggleCreatorMode failed', e) }
}

// 观察 creatorMode：进入记录位置并禁用 advance；退出回到 entry 的第一幕并恢复播放权限
watch(creatorMode, (val) => {
  if (val) {
    try {
      creatorEntry.sceneIndex = currentSceneIndex.value
      creatorEntry.dialogueIndex = 0
      allowAdvance.value = false
      // 暂停自动播放
      try { stopAutoPlayTimer() } catch (e) {}
    } catch (e) { console.warn('enter creatorMode failed', e) }
  } else {
    try {
      // 在退出创作者模式前尝试将当前章节的本地修改持久化到后端（仅当 createResult 标记为 modifiable 时）
      try {
        (async () => {
          try {
            // When exiting menu creatorMode (manual editing from menu), persist current chapter edits
            // and force sending the edited content to backend (PUT). This SHOULD be independent of
            // AI outline generation flows, so we set allowSaveGenerated=false to take the default
            // PUT path in persistCurrentChapterEdits instead of the "local mark as saved" branch.
            await persistCurrentChapterEdits({ auto: false, allowSaveGenerated: false, chapterIndex: currentChapterIndex.value })
          } catch (e) { console.warn('persistCurrentChapterEdits on exit creatorMode failed', e) }
        })()
      } catch (e) { console.warn('trigger persist on exit creatorMode failed', e) }
      if (creatorEntry.sceneIndex != null) {
        currentSceneIndex.value = creatorEntry.sceneIndex
        currentDialogueIndex.value = creatorEntry.dialogueIndex || 0
        showText.value = true
      }
      allowAdvance.value = true
      // 恢复自动播放（如果之前开启）
      try { if (autoPlayEnabled.value) startAutoPlayTimer() } catch (e) {}
      // 如果之前在创作者模式中到达了本章末并保存了待加载章节，则在退出创作者模式后触发加载
      try {
        if (pendingNextChapter.value != null) {
          const chap = pendingNextChapter.value
          pendingNextChapter.value = null
          // 异步触发加载下一章（与原逻辑一致）
          (async () => {
            try {
              startLoading()
              await fetchNextChapter(workId, chap)
            } catch (e) { console.warn('load pending next chapter failed', e) }
            try { await stopLoading() } catch (e) {}
          })()
        }
      } catch (e) { console.warn('trigger pending next chapter failed', e) }
      // 如果存在预览快照，退出创作者模式时需要恢复到快照状态（移除预览）
      try {
        if (previewSnapshot.value) {
          console.log('Restoring previewSnapshot on exit creatorMode')
          try { storyScenes.value = deepClone(previewSnapshot.value.storyScenes || []) } catch(e) { storyScenes.value = previewSnapshot.value.storyScenes || [] }
          currentSceneIndex.value = previewSnapshot.value.currentSceneIndex || 0
          currentDialogueIndex.value = previewSnapshot.value.currentDialogueIndex || 0
          try { attributes.value = deepClone(previewSnapshot.value.attributes || {}) } catch(e) { attributes.value = previewSnapshot.value.attributes || {} }
          try { statuses.value = deepClone(previewSnapshot.value.statuses || {}) } catch(e) { statuses.value = previewSnapshot.value.statuses || {} }
          try { choiceHistory.value = deepClone(previewSnapshot.value.choiceHistory || []) } catch(e) { choiceHistory.value = previewSnapshot.value.choiceHistory || [] }
          previewSnapshot.value = null
          try { restoreChoiceFlagsFromHistory() } catch(e) {}
        }
      } catch(e) { console.warn('restore previewSnapshot failed', e) }
    } catch (e) { console.warn('exit creatorMode failed', e) }
  }
})

// Ensure first sentence shows when we have scenes and are ready (entering landscape & not loading).
watch([isLandscapeReady, isLoading, () => storyScenes.value.length], (values) => {
  try {
    const [land, loading, len] = values
    if (land && !loading && Array.isArray(storyScenes.value) && storyScenes.value.length > 0) {
      // clamp scene index
      if (typeof currentSceneIndex.value !== 'number' || currentSceneIndex.value >= storyScenes.value.length) currentSceneIndex.value = 0
      const s = storyScenes.value[currentSceneIndex.value]
      if (!s || !Array.isArray(s.dialogues) || s.dialogues.length === 0) {
        // nothing to show
        showText.value = false
        return
      }
      // clamp dialogue index
      if (typeof currentDialogueIndex.value !== 'number' || currentDialogueIndex.value >= s.dialogues.length) currentDialogueIndex.value = 0
      // show first dialogue immediately
      showText.value = true
    }
  } catch (e) { console.warn('auto-show first dialogue watch failed', e) }
}, { immediate: true })


// 处理游戏结束，生成结算页面
const handleGameEnd = async () => {
  console.log('handleGameEnd 被调用 - creatorFeatureEnabled:', creatorFeatureEnabled.value, 'currentChapter:', currentChapterIndex.value)
  
  // 对于创作者身份，在进入结算前进行最终检查
  if (creatorFeatureEnabled.value) {
    try {
      console.log('开始获取作品详情以检查章节状态...')
      await getWorkDetails(work.value.id)
      
      // 检查当前章节的状态
      const currentStatus = getChapterStatus(currentChapterIndex.value)
      console.log('handleGameEnd 检查当前章节:', currentChapterIndex.value, '状态:', currentStatus)
      
      // 如果当前章节未保存，阻止进入结算
      if (currentStatus !== 'saved') {
        console.warn('handleGameEnd 阻止结算 - 当前章节未保存')
        showNotice('当前章节（第' + currentChapterIndex.value + '章）尚未保存，请先确认并保存本章内容后再进入结算页面。', 10000)
        // 重置加载状态
        isGeneratingSettlement.value = false
        isLoading.value = false
        return
      }
      
      // 另外也检查一下前一章（以防万一）
      if (currentChapterIndex.value > 1) {
        const prevStatus = getChapterStatus(currentChapterIndex.value - 1)
        console.log('handleGameEnd 检查前一章节:', currentChapterIndex.value - 1, '状态:', prevStatus)
        
        if (prevStatus !== 'saved') {
          console.warn('handleGameEnd 阻止结算 - 前一章节未保存')
          showNotice('第' + (currentChapterIndex.value - 1) + '章尚未保存，请先确认并保存该章内容后再进入结算页面。', 10000)
          isGeneratingSettlement.value = false
          isLoading.value = false
          return
        }
      }
      
      console.log('handleGameEnd 所有章节检查通过，允许进入结算')
    } catch (e) {
      console.error('handleGameEnd 检查创作者章节状态失败:', e)
      // 如果检查失败，也阻止跳转，让创作者手动处理
      showNotice('无法确认章节保存状态，请先确认并保存本章内容后再进入结算。', 10000)
      isGeneratingSettlement.value = false
      isLoading.value = false
      return
    }
  }
  
  isGeneratingSettlement.value = true
  isLoading.value = true
  loadingProgress.value = 0
  
  // 模拟结算页面生成过程
  const generateSettlement = async () => {
    for (let i = 0; i <= 100; i += 5) {
      loadingProgress.value = i
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    
    // 生成完成后跳转到结算页面
    // 优先尝试从后端获取个性化结算报告（若后端返回则使用），否则回退到本地快照
    let settlementData = null
    try {
      const remote = await fetchReport(work.value.id)
      if (remote) {
        // 保留后端返回的结算数据，但确保包含本地的 choiceHistory / storyScenes / attributes/statuses
        settlementData = Object.assign({}, remote)
        if (!Array.isArray(settlementData.choiceHistory) || settlementData.choiceHistory.length === 0) {
          try { settlementData.choiceHistory = Array.isArray(choiceHistory.value) ? deepClone(choiceHistory.value) : [] } catch (e) { settlementData.choiceHistory = [] }
        }
        if (!settlementData.storyScenes || !Array.isArray(settlementData.storyScenes) || settlementData.storyScenes.length === 0) {
          try { settlementData.storyScenes = deepClone(storyScenes.value) } catch (e) { settlementData.storyScenes = [] }
        }
        if (!settlementData.finalAttributes) {
          try { settlementData.finalAttributes = deepClone(attributes.value) } catch (e) { settlementData.finalAttributes = {} }
        }
        if (!settlementData.finalStatuses) {
          try { settlementData.finalStatuses = deepClone(statuses.value) } catch (e) { settlementData.finalStatuses = {} }
        }
      }
    } catch (e) { console.warn('fetchReport failed in handleGameEnd:', e) }

    if (!settlementData) {
      settlementData = {
        work: work.value,
        choiceHistory: choiceHistory.value,
        finalAttributes: attributes.value,
        finalStatuses: statuses.value,
        storyScenes: storyScenes.value,
        currentSceneIndex: currentSceneIndex.value,
        currentDialogueIndex: currentDialogueIndex.value
      }
    }

    try { sessionStorage.setItem('settlementData', JSON.stringify(settlementData)) } catch (e) { console.warn('set settlementData failed', e) }
    router.push('/settlement')
  }
  
  generateSettlement()
}


// 存档 / 读档 / 属性 模态与逻辑
const saveToast = ref('')
const loadToast = ref('')
const lastSaveInfo = ref(null)




// 其它弹窗（存档/读档/属性/设置）打开时同样应暂停自动播放
const anyOverlayOpen = computed(() =>
  showMenu.value ||
  showSaveModal.value ||
  showLoadModal.value ||
  showAttributesModal.value ||
  showSettingsModal.value
)

// 设置 useSaveLoad 的依赖
setSaveLoadDependencies({
  checkCurrentChapterSaved,
  getChapterStatus,
  currentChapterIndex,
  creatorFeatureEnabled,
  showNotice,
  stopAutoPlayTimer,
  autoPlayEnabled,
  anyOverlayOpen,
  startAutoPlayTimer,
  currentScene,
  currentSceneIndex,
  currentDialogueIndex,
  storyScenes,
  choiceHistory,
  fetchNextChapter,
  pushSceneFromServer,
  deepClone,
  currentBackground,
  effectiveCoverUrl
})

watch(anyOverlayOpen, (open) => {
  if (open) {
    stopAutoPlayTimer()
  } else if (autoPlayEnabled.value) {
    startAutoPlayTimer()
  }
})


// 控制选项展示（在某句阅读结束后出现）

// 当从存档/读档恢复到某句带有 playerChoices 的话时，避免立即自动展示选项。

// 当场景或对话索引变动，检查是否应该显示选项
watch([currentSceneIndex, currentDialogueIndex], () => {
  // 如果刚刚处理过一次选项，短时间内不要重新显示选项（防止选项被重复展示）
  try {
    const timeSinceLastChoice = Date.now() - (lastChoiceTimestamp.value || 0)
    if (timeSinceLastChoice < 600) {
      console.log('[watch] 选项刚被处理,抑制重复显示,距上次:', timeSinceLastChoice, 'ms')
      return
    }
  } catch (e) {}
  
  const scene = currentScene.value
  if (!scene) return
  
  // 如果该场景的选项已被消费过（用户已经选择过），不要再次显示
  if (scene.choiceConsumed) {
    console.log('[watch] 场景选项已消费,不显示选项:', currentSceneIndex.value, 'chosenId:', scene.chosenChoiceId)
    return
  }
  
  // 如果场景有 choices 且指定了触发句索引
  if (Array.isArray(scene.choices) && scene.choices.length > 0 && typeof scene.choiceTriggerIndex === 'number') {
    // 当阅读到触发句的索引（即等于或超过）时显示选项
    // 但如果我们处于从存档/读档刚恢复的抑制状态，则先不自动显示，等用户点击一次再显示（见 nextDialogue 处理）
    if (!suppressAutoShowChoices.value && currentDialogueIndex.value >= scene.choiceTriggerIndex && showText.value) {
      console.log('[watch] 显示选项 - 场景:', currentSceneIndex.value, '对话:', currentDialogueIndex.value, '触发索引:', scene.choiceTriggerIndex)
      choicesVisible.value = true
      // 自动播放遇到选项时暂停
      stopAutoPlayTimer()
    } else {
      console.log('[watch] 选项未触发 - suppressAuto:', suppressAutoShowChoices.value, 'dialogueIdx:', currentDialogueIndex.value, 'triggerIdx:', scene.choiceTriggerIndex, 'showText:', showText.value)
    }
  }
})



// 页面加载时请求横屏并开始加载
onMounted(async () => {
  // 加载自动播放偏好并按需启动
  loadAutoPlayPrefs()
  if (autoPlayEnabled.value) startAutoPlayTimer()
  // 检查是否从结算页面跳回来并携带了加载数据
  if (history.state?.loadedData) {
    const loadedData = history.state.loadedData
    // 恢复游戏状态（注意：loadedData 可能不包含完整的 storyScenes）
    // 优先尝试根据 sceneId 定位到已加载的 storyScenes，否则回退到首个场景
      try {
      if (loadedData.sceneId != null && Array.isArray(storyScenes.value)) {
        // 使用字符串比较以兼容 number/string id 的差异
        const lsid = String(loadedData.sceneId)
        let idx = storyScenes.value.findIndex(s => s && (String(s.id) === lsid || String(s.sceneId) === lsid))
        // 如果没有找到，但提供了 chapterIndex，则尝试拉取该章节以恢复场景列表
        if (idx < 0 && typeof loadedData.chapterIndex === 'number') {
          try {
            const fetched = await fetchNextContent(work.value.id, loadedData.chapterIndex)
            if (fetched && Array.isArray(fetched.scenes) && fetched.scenes.length > 0) {
              for (const s of fetched.scenes) {
                try { pushSceneFromServer(s) } catch (e) { console.warn('pushSceneFromServer failed when restoring chapter (mounted):', e) }
              }
              idx = storyScenes.value.findIndex(s => s && (String(s.id) === lsid || String(s.sceneId) === lsid))
            }
          } catch (e) { console.warn('fetchNextContent failed while restoring loadedData chapter:', e) }
        }
        currentSceneIndex.value = (idx >= 0) ? idx : 0
      } else if (typeof loadedData.currentSceneIndex === 'number') {
        currentSceneIndex.value = loadedData.currentSceneIndex
      } else if (typeof loadedData.chapterIndex === 'number' && Array.isArray(storyScenes.value)) {
        const idx = storyScenes.value.findIndex(s => s && (s.chapterIndex === loadedData.chapterIndex || s.chapter === loadedData.chapterIndex))
        currentSceneIndex.value = (idx >= 0) ? idx : 0
      } else {
        currentSceneIndex.value = 0
      }
      if (typeof loadedData.currentDialogueIndex === 'number') currentDialogueIndex.value = loadedData.currentDialogueIndex
      else if (loadedData.dialogueIndex != null) currentDialogueIndex.value = loadedData.dialogueIndex
    } catch (e) { /* ignore */ }
  attributes.value = loadedData.attributes || {}
  statuses.value = loadedData.statuses || {}
  choiceHistory.value = loadedData.choiceHistory || []
  try { restoreChoiceFlagsFromHistory() } catch (e) { console.warn('restoreChoiceFlagsFromHistory error (loadedData):', e) }
    
    // 直接进入游戏
    isLandscapeReady.value = true
    // 即便数据已恢复，为了视觉一致性仍然执行一次平滑加载到 100% 的动画
    try {
      const dur = USE_MOCK_STORY ? 10000 : 900
      await simulateLoadTo100(dur)
    } catch (e) {
      isLoading.value = false
    }
    showText.value = true
    return
  }

  if (isNativeApp.value) {
    // APP 环境：直接进入横屏
    isLandscapeReady.value = true
    requestLandscape()
  } else {
    // 浏览器环境：在开发模式下自动进入阅读以便测试选项；生产模式仍显示进入阅读按钮
    try {
      if (import.meta.env && import.meta.env.DEV) {
        isLandscapeReady.value = true
        try { const dur = USE_MOCK_STORY ? 10000 : 900; simulateLoadTo100(dur) } catch (e) {}
      } else {
        // 生产/正式环境：显示进入阅读按钮
      }
    } catch (e) {
      // 某些构建环境可能不支持 import.meta.env，这里保守处理
    }
  }
  // 页面可见性变化：隐藏→暂停自动播放并尝试自动存档；可见→如开启自动播放则恢复
  const onVisibility = () => {
    if (document.hidden) {
      // 后台：暂停自动播放，避免后台计时推进
      stopAutoPlayTimer()
      autoSaveToSlot()
    } else {
      // 回到前台：如当前设置开启自动播放且没有弹窗打开，则恢复计时器
      try {
        if (autoPlayEnabled.value && !(anyOverlayOpen && anyOverlayOpen.value)) startAutoPlayTimer()
      } catch (e) {
        if (autoPlayEnabled.value) startAutoPlayTimer()
      }
    }
  }
  document.addEventListener('visibilitychange', onVisibility)
  // 卸载/刷新前的本地快速存档
  const onBeforeUnload = () => {
    quickLocalAutoSave(AUTO_SAVE_SLOT)
  }
  window.addEventListener('beforeunload', onBeforeUnload)
  // 存储清理函数到实例上，便于卸载时移除
  ;(onMounted._cleanup = () => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('beforeunload', onBeforeUnload)
  })
})

// 页面卸载时解锁屏幕方向
onUnmounted(async () => {
  // 停止自动播放计时器
  stopAutoPlayTimer()
  try {
    // 卸载前自动存档
    await autoSaveToSlot(AUTO_SAVE_SLOT)
    if (isNativeApp.value) {
      await ScreenOrientation.unlock()
      console.log('组件卸载，已解锁屏幕方向')
    } else if (screen.orientation && screen.orientation.unlock) {
      screen.orientation.unlock()
    }
  } catch (err) {
    console.log('解锁屏幕方向失败:', err)
  }
  // 清理挂载时添加的侦听
  if (onMounted._cleanup) try { onMounted._cleanup() } catch {}
})
</script>

<template>
  <div class="game-page">
    <!-- 横屏准备界面 -->
    <div v-if="!isLandscapeReady" class="landscape-prompt">
      <div class="prompt-content">
        <h2 class="prompt-title">{{ work.title }}</h2>
        <p class="prompt-text">即将进入横屏阅读模式</p>
        <p class="prompt-hint">为获得最佳阅读体验，请横置您的设备</p>
        <button class="enter-button" @click="requestLandscape">
          <span>进入阅读</span>
        </button>
      </div>
    </div>

    <!-- 加载界面 -->
    <transition name="fade">
      <div v-if="isLandscapeReady && isLoading" class="loading-screen">
        <!-- 封面背景图 -->
  <div class="loading-cover-bg" :style="{ backgroundImage: `url(${effectiveCoverUrl})` }"></div>
        
        <div class="loading-content">
          <!-- 游戏标题（使用作品名） -->
          <h1 class="game-title">{{ work.title }}</h1>
          
          <!-- 进度条与毛笔（毛笔跟随进度条滑动） -->
          <div class="loading-progress-container">
            <!-- 毛笔：使用 left 绑定使其跟随进度条的 thumb（通过 translateX(-50%) 居中） -->
            <div class="brush-container" :style="{ left: loadingProgress + '%' }">
              <svg class="brush-icon" viewBox="0 0 64 64" fill="none">
                <!-- 毛笔笔杆 -->
                <path 
                  d="M32 8 L32 40" 
                  stroke="#8B4513" 
                  stroke-width="3" 
                  stroke-linecap="round"
                />
                <!-- 毛笔笔头 -->
                <path 
                  d="M32 40 L28 52 L32 56 L36 52 Z" 
                  fill="#2C2C2C"
                  stroke="#1C1C1C"
                  stroke-width="1"
                />
                <!-- 毛笔尖 -->
                <path 
                  d="M32 56 L30 60 L32 62 L34 60 Z" 
                  fill="#1C1C1C"
                />
                <!-- 笔杆装饰 -->
                <circle cx="32" cy="12" r="2" fill="#D4A574"/>
                <circle cx="32" cy="20" r="2" fill="#D4A574"/>
                <circle cx="32" cy="28" r="2" fill="#D4A574"/>
              </svg>
            </div>

            <div class="loading-progress-bg">
              <div class="loading-progress-fill" :style="{ width: loadingProgress + '%' }">
                <div class="progress-shine"></div>
              </div>
            </div>
            <div class="loading-text">{{ Math.floor(loadingProgress) }}%</div>
          </div>
          
          <!-- 加载提示 -->
          <div class="loading-tips">
            <p class="tip-text">{{ isGeneratingSettlement ? '结算页面生成中...' : '正在准备故事...' }}</p>
          </div>
        </div>
        
        <!-- 背景装饰 -->
        <div class="bg-decoration">
          <div class="decoration-circle"></div>
          <div class="decoration-circle"></div>
          <div class="decoration-circle"></div>
        </div>
      </div>
    </transition>
    
    <!-- 游戏内容（橙光风格） -->
    <div v-show="isLandscapeReady && !isLoading" class="game-content">
      <!-- 中心加载指示：获取后续剧情时显示（非阻塞） -->
      <div v-if="isFetchingNext" class="center-loading" aria-live="polite" aria-label="后续剧情生成中">
        <div class="center-spinner"></div>
      </div>

      <!-- 背景图层 -->
      <div class="background-layer" :style="{ backgroundImage: `url(${currentBackground})` }"></div>
      
      <!-- 遮罩层（让文字更清晰） -->
      <div class="overlay-layer"></div>
      
      <!-- 点击区域（点击进入下一句） -->
      <div class="click-area" @click="nextDialogue"></div>

      <!-- 选项区域（如果当前场景包含 choices） - 放在 text-box 之外，避免被裁剪 -->
      <div 
        v-if="currentScene && currentScene.choices && choicesVisible" 
        class="choices-container" 
        :class="{ disabled: showMenu }"
        @click.stop>
        <div class="choice" v-for="choice in currentScene.choices" :key="choice.id">
          <button 
            class="choice-btn" 
            :disabled="isFetchingChoice || showMenu" 
            @click="chooseOption(choice.id)">
            {{ choice.text }}
          </button>
        </div>
      </div>
      
      <!-- 文字栏 -->
      <div class="text-box" :class="{ editing: editingDialogue, 'creator-mode': creatorMode }" @click="nextDialogue">
        <!-- 说话人标签（可选） -->
        <div v-if="currentSpeaker" class="speaker-badge">{{ currentSpeaker }}</div>
        <transition name="text-fade">
          <!-- 非编辑态显示当前对话 -->
          <p v-if="!editingDialogue && showText" class="dialogue-text">{{ currentDialogue }}</p>
          <!-- 编辑态：contenteditable，编辑内容保存在 editableText -->
    <div v-else-if="editingDialogue" ref="editableDiv" class="dialogue-text" contenteditable="true"
      @input="onEditableInput"
      @compositionstart="onCompositionStart"
      @compositionend="onCompositionEnd"
      @keydown.enter.prevent="finishEdit"
      @blur="finishEdit"></div>
        </transition>

        <!-- 编辑与替换图片按钮：仅在创作者模式可见 -->
        <div v-if="creatorMode" class="edit-controls" aria-hidden="false">
          <template v-if="!editingDialogue">
            <button class="edit-btn" title="编辑文本" @click.stop="startEdit()">编辑</button>
            <button class="edit-btn" title="替换当前背景" @click.stop="triggerImagePicker">替换图片</button>
            <button class="edit-btn" title="播放下一句" @click.stop="playNextAfterEdit">播放下一句</button>
          </template>
          <template v-else>
            <button class="edit-btn" title="确认编辑" @click.stop="finishEdit()">确认</button>
            <button class="edit-btn" title="取消编辑" @click.stop="cancelEdit()">取消</button>
          </template>
        </div>

        <!-- 继续提示箭头 -->
        <div v-if="showText && !isLastDialogue" class="continue-hint">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
          </svg>
        </div>
      </div>
      
      <!-- 顶部进度条 -->
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: readingProgress + '%' }"></div>
      </div>
      
      <!-- 菜单按钮 -->
      <button class="menu-button" @click.stop="toggleMenu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <line x1="3" y1="12" x2="21" y2="12" stroke-width="2"/>
          <line x1="3" y1="6" x2="21" y2="6" stroke-width="2"/>
          <line x1="3" y1="18" x2="21" y2="18" stroke-width="2"/>
        </svg>
      </button>

      <!-- 创作者模式指示器 -->
      <div v-if="creatorMode" class="creator-badge">创作者模式</div>

      <!-- 顶部不再显示快速操作，相关功能移动到菜单中 -->
      
      <!-- 菜单面板 -->
      <transition name="slide-down">
        <div v-if="showMenu" class="menu-panel" @click.stop>
          <button class="menu-item" @click="goBack">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M19 12H5M12 19l-7-7 7-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>返回作品页</span>
          </button>
          
          <button class="menu-item" @click="toggleMenu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M18 6L6 18M6 6l12 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>继续阅读</span>
          </button>

          <!-- 整合功能入口：存档 / 读档 / 属性 / 设置（并列网格） -->
          <div class="menu-grid">
            <button class="menu-item" @click="showMenu = false; openSaveModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M5 20h14a1 1 0 0 0 1-1V7l-4-4H6a1 1 0 0 0-1 1v16zM8 8h8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>存档</span>
            </button>
            <button class="menu-item" @click="showMenu = false; openLoadModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 9l5 5 5-5M12 14V3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>读档</span>
            </button>
            <button class="menu-item" @click="showMenu = false; triggerImagePicker()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14" stroke-width="2"/>
                <path d="M3 7h18M8 11l2.5 3L13 11l4 6H7l1-2z" stroke-width="2"/>
              </svg>
              <span>替换当前背景</span>
            </button>
            <button class="menu-item" @click="showMenu = false; openAttributes()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="3" stroke-width="2"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V22a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0A1.65 1.65 0 0 0 9 2.09V2a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0A1.65 1.65 0 0 0 21.91 11H22a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>属性</span>
            </button>
            <button class="menu-item" @click="showMenu = false; showSettingsModal = true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" stroke-width="2"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.27.27a2 2 0 1 1-2.83 2.83l-.27-.27a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V22a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.27.27a2 2 0 1 1-2.83-2.83l.27-.27a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.27-.27a2 2 0 1 1 2.83-2.83l.27.27a1.65 1.65 0 0 0 1.82.33h0A1.65 1.65 0 0 0 9 2.09V2a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.27-.27a2 2 0 1 1 2.83 2.83l-.27.27a1.65 1.65 0 0 0-.33 1.82v0A1.65 1.65 0 0 0 21.91 11H22a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>设置</span>
            </button>
            <!-- 创作者模式开关 -->
            <button class="menu-item" @click="toggleCreatorMode(); showMenu = false">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" stroke-width="1.5"/>
                <circle cx="12" cy="12" r="3" stroke-width="1.5"/>
              </svg>
              <span>{{ creatorMode ? '退出手动编辑模式' : '进入手动编辑模式' }}</span>
            </button>
          </div>
          
          <div class="menu-progress">
            <span>阅读进度：{{ Math.floor(readingProgress) }}%</span>
            <span>场景 {{ currentSceneIndex + 1 }} / {{ storyScenes.length }}</span>
          </div>
        </div>
      </transition>
    </div>

    <!-- 存档弹窗（3个槽位） -->
    <div v-if="showSaveModal" class="modal-backdrop" @click.self="closeSaveModal">
      <div class="modal-panel save-load-modal">
        <div class="modal-header">
          <h3>选择存档槽位</h3>
          <button class="modal-close" @click="closeSaveModal">×</button>
        </div>
        <div class="slot-list">
          <div v-for="slot in SLOTS" :key="slot" class="slot-card">
            <div class="slot-title">{{ slot.toUpperCase() }}</div>
            <div v-if="slotInfos[slot]">
                <div class="slot-thumb" v-if="(slotInfos[slot].thumbnailData || slotInfos[slot].thumbnail || (slotInfos[slot].game_state && (slotInfos[slot].game_state.thumbnailData || slotInfos[slot].game_state.thumbnail)))">
                  <img :src="slotInfos[slot].thumbnailData || slotInfos[slot].thumbnail || (slotInfos[slot].game_state && (slotInfos[slot].game_state.thumbnailData || slotInfos[slot].game_state.thumbnail))" alt="thumb" />
                  <div class="thumb-meta">
                    <div class="meta-time">{{ new Date(slotInfos[slot].timestamp || Date.now()).toLocaleString() }}</div>
                  </div>
                </div>
                <div class="slot-meta" v-else>
                  <div>时间：{{ new Date(slotInfos[slot].timestamp || Date.now()).toLocaleString() }}</div>
                </div>
            </div>
            <div class="slot-meta empty" v-else>空槽位</div>
            <div class="slot-actions">
              <button @click="saveGame(slot).then(() => refreshSlotInfos())">保存到 {{ slot.toUpperCase() }}</button>
              <button v-if="slotInfos[slot]" @click="deleteGame(slot)" class="delete-btn">删除</button>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button @click="closeSaveModal">关闭</button>
        </div>
      </div>
    </div>

    <!-- 设置弹窗：自动播放 -->
    <div v-if="showSettingsModal" class="modal-backdrop" @click.self="showSettingsModal = false">
      <div class="modal-panel settings-modal">
        <div class="modal-header">
          <h3>设置</h3>
          <button class="modal-close" @click="showSettingsModal = false">×</button>
        </div>
        <div class="settings-body">
          <label class="row">
            <input type="checkbox" v-model="autoPlayEnabled" />
            <span>自动播放（遇到选项自动暂停）</span>
          </label>
          <label class="row">
            <span>每段间隔（毫秒）：</span>
            <input type="number" min="2000" max="10000" step="500" v-model.number="autoPlayIntervalMs" style="width:140px" />
          </label>
          <p class="hint">范围 2000ms–10000ms（即 2–10 秒）；开启后系统将按间隔自动播放，遇到选项暂停，选择后继续。</p>
        </div>
        <div class="modal-actions">
          <button @click="showSettingsModal = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 读档弹窗（3个槽位） -->
    <div v-if="showLoadModal" class="modal-backdrop" @click.self="closeLoadModal">
      <div class="modal-panel save-load-modal">
        <div class="modal-header">
          <h3>选择读档槽位</h3>
          <button class="modal-close" @click="closeLoadModal">×</button>
        </div>
        <div class="slot-list">
          <div v-for="slot in SLOTS" :key="slot" class="slot-card">
            <div class="slot-title">{{ slot.toUpperCase() }}</div>
            <div v-if="slotInfos[slot]">
              <div class="slot-thumb" v-if="(slotInfos[slot].thumbnailData || slotInfos[slot].thumbnail || (slotInfos[slot].game_state && (slotInfos[slot].game_state.thumbnailData || slotInfos[slot].game_state.thumbnail)))">
                <img :src="slotInfos[slot].thumbnailData || slotInfos[slot].thumbnail || (slotInfos[slot].game_state && (slotInfos[slot].game_state.thumbnailData || slotInfos[slot].game_state.thumbnail))" alt="thumb" />
                <div class="thumb-meta">
                  <div class="meta-time">{{ new Date(slotInfos[slot].timestamp || Date.now()).toLocaleString() }}</div>
                </div>
              </div>
              <div class="slot-meta" v-else>
                <div>时间：{{ new Date(slotInfos[slot].timestamp || Date.now()).toLocaleString() }}</div>
              </div>
            </div>
            <div class="slot-meta empty" v-else>空槽位</div>
            <div class="slot-actions">
              <button :disabled="!slotInfos[slot]" @click="loadGame(slot)">读取 {{ slot.toUpperCase() }}</button>
              <button v-if="slotInfos[slot]" @click="deleteGame(slot)" class="delete-btn">删除</button>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button @click="closeLoadModal">关闭</button>
        </div>
      </div>
    </div>

    <!-- 属性模态：左（属性）右（特殊状态） -->
    <div v-if="showAttributesModal" class="modal-backdrop" @click.self="closeAttributes">
      <div class="modal-panel attributes-panel">
  <h3>角色信息</h3>

        <div class="attr-status-grid">
          <!-- 左：属性 -->
          <div class="attr-col">
            <div class="section-title">属性</div>
            <div v-if="Object.keys(attributes).length === 0" class="empty-text">暂无属性</div>
            <ul v-else class="kv-list">
              <li v-for="(val, key) in attributes" :key="key">
                <span class="kv-key">{{ key }}</span>
                <span class="kv-sep">：</span>
                <span class="kv-val">{{ val }}</span>
              </li>
            </ul>
          </div>
          <!-- 右：特殊状态 -->
          <div class="status-col">
            <div class="section-title">特殊状态</div>
            <div v-if="Object.keys(statuses).length === 0" class="empty-text">暂无特殊状态</div>
            <ul v-else class="kv-list">
              <li v-for="(val, key) in statuses" :key="key">
                <span class="kv-key">{{ key }}</span>
                <span class="kv-sep">：</span>
                <span class="kv-val">{{ typeof val === 'object' ? (val.value ?? val.level ?? val.state ?? JSON.stringify(val)) : val }}</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- 预留空白区（用于后续“角色信息变更为：...”等动态指令显示/扩展），按设计需要可调高 -->
        <div class="attr-blank-space"></div>

        <!-- 底部区：将按钮与元信息一起固定在面板底部，元信息保持为最后一行 -->
        <div class="attributes-bottom">
          <div class="modal-row" v-if="isFetchingChoice"><em>正在获取选项后续剧情...</em></div>
          <div class="modal-actions">
            <button @click="saveGame('slot1')">存档到槽1</button>
            <button @click="loadGame('slot1')">从槽1读档</button>
            <button @click="closeAttributes">关闭</button>
          </div>
          <div class="attributes-meta">
            <div class="modal-row meta-small"><strong>作品：</strong> {{ work.title }}</div>
            <div class="modal-row meta-small"><strong>作者ID：</strong> {{ work.authorId }}</div>
            <div class="modal-row meta-small" v-if="lastSaveInfo"><strong>最后存档：</strong> {{ new Date(lastSaveInfo.timestamp).toLocaleString() }}</div>
          </div>
        </div>
      </div>
    </div>

  <!-- 临时提示（存档/读档/notice） -->
  <div class="toast save-toast" v-if="saveToast">{{ saveToast }}</div>
  <div class="toast load-toast" v-if="loadToast">{{ loadToast }}</div>
  <div class="toast notice-toast" v-if="noticeToast">{{ noticeToast }}</div>
  <!-- 创作者专用：手动打开大纲编辑器按钮（浮动） -->
  <!--
    改动说明：将按钮从仅在 isCreatorIdentity 下显示改为在 creatorFeatureEnabled 下显示，
    使得当 createResult.modifiable 且 后端 ai_callable 可用时，阅读界面始终显示该按钮，方便在章节内随时触发 AI 生成/编辑。
  -->
  <button v-if="creatorFeatureEnabled && getChapterStatus(currentChapterIndex) !== 'saved'" @click="openOutlineEditorManual" class="creator-outline-btn" title="编辑/生成章节大纲" style="position:fixed; right:1rem; bottom:6.4rem; z-index:1200; background:#ff8c42; color:#fff; border:none; padding:0.5rem 0.75rem; border-radius:6px; box-shadow:0 2px 6px rgba(0,0,0,0.2)">编辑/生成章节大纲</button>

  <!-- 创作者专用：当当前章节已由 AI 生成（generated）时，可确认并保存本章，标记为 saved -->
  <button v-if="creatorFeatureEnabled && (getChapterStatus(currentChapterIndex) === 'generated' || lastLoadedGeneratedChapter === currentChapterIndex)" @click="persistCurrentChapterEdits({ auto: false, allowSaveGenerated: true })" class="creator-confirm-btn" title="确认并保存本章" style="position:fixed; right:1rem; bottom:10.4rem; z-index:1200; background:#3bbf6a; color:#fff; border:none; padding:0.5rem 0.75rem; border-radius:6px; box-shadow:0 2px 6px rgba(0,0,0,0.2)">确认并保存本章</button>

  <!-- 创作者大纲编辑器模态（当 createResult.modifiable 且有 chapterOutlines 时显示） -->
  <div v-if="showOutlineEditor" class="modal-backdrop">
      <div class="modal-panel">
        <h3 style="margin-top:0;">编辑章节大纲（创作者模式）</h3>
  <p style="color:#666;">后端返回的章节大纲可在此处微调。编辑完成后点击“确认”以让后端基于此大纲生成章节内容；若取消，则按原始大纲继续生成或按默认流程加载章节。</p>
        <div style="max-height: 50vh; overflow:auto; margin-top:0.5rem;">
            <div v-for="(ch, idx) in outlineEdits" :key="ch.chapterIndex" style="margin-bottom:0.6rem;">
            <div style="font-weight:700; margin-bottom:0.25rem">第 {{ ch.chapterIndex }} 章 大纲</div>
            <textarea v-model="outlineEdits[idx].outline" rows="2" style="width:100%; background: var(--textarea-bg, white);"></textarea>
          </div>
        </div>
        <div style="margin-top:0.6rem">
          <div style="font-weight:700; margin-bottom:0.25rem">（可选）为本章生成提供额外指令（userPrompt）</div>
          <textarea v-model="outlineUserPrompt" rows="2" style="width:100%;"></textarea>
        </div>
        <div style="display:flex; gap:0.5rem; justify-content:flex-end; margin-top:0.75rem">
          <!-- 取消按钮仅在手动打开时显示，章节前自动弹出的编辑器不允许取消 -->
          <button v-if="editorInvocation !== 'auto'" class="edit-btn" @click="cancelOutlineEdits">取消</button>
          <!-- 允许 manual 或 auto 调用确认生成（creatorMode 也允许） -->
          <button class="edit-btn" :disabled="!(editorInvocation === 'auto' || editorInvocation === 'manual' || creatorMode)" @click="confirmOutlineEdits">确认</button>
        </div>
      </div>
    </div>
    <!-- 隐藏的文件输入：用于用户替换当前背景图 -->
    <input ref="imgInput" type="file" accept="image/*" style="display:none" @change="onImageSelected" />
  </div>
</template>
