/**
 * 服务框架使用示例
 * 展示如何在 Vue 组件中使用 StoryCraft 服务框架
 */

// ============================================
// 示例 1: 用户登录和认证
// ============================================

// LoginPage.vue
/*
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { login } from '@/service'
import { ErrorHandler } from '@/service/error-handler'

const router = useRouter()
const username = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

async function handleLogin() {
  errorMessage.value = ''
  loading.value = true
  
  try {
    const result = await login({
      username: username.value,
      password: password.value
    })
    
    console.log('登录成功:', result.user)
    router.push('/home')
  } catch (error) {
    const handled = ErrorHandler.handle(error)
    errorMessage.value = handled.message
  } finally {
    loading.value = false
  }
}
</script>
*/

// ============================================
// 示例 2: 游戏页面完整实现
// ============================================

// GamePage.vue
/*
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getWorkInfo,
  getInitialScenes,
  getNextScenes,
  submitChoice,
  saveGame,
  loadGame
} from '@/service'
import { ErrorHandler } from '@/service/error-handler'
import { mergeAttributes, mergeStatuses } from '@/service/utils'
import { AUTO_SAVE_SLOT } from '@/service/config'

const route = useRoute()
const router = useRouter()

// ===== 状态管理 =====
const workId = ref(route.params.id)
const work = ref(null)
const storyScenes = ref([])
const currentSceneIndex = ref(0)
const currentDialogueIndex = ref(0)
const attributes = ref({})
const statuses = ref({})
const loading = ref(false)
const isGenerating = ref(false)

// ===== 计算属性 =====
const currentScene = computed(() => storyScenes.value[currentSceneIndex.value])
const currentDialogue = computed(() => {
  if (!currentScene.value) return null
  return currentScene.value.dialogues[currentDialogueIndex.value]
})
const hasMoreDialogues = computed(() => {
  if (!currentScene.value) return false
  return currentDialogueIndex.value < currentScene.value.dialogues.length - 1
})
const isLastScene = computed(() => {
  return currentSceneIndex.value >= storyScenes.value.length - 1
})
const shouldShowChoices = computed(() => {
  if (!currentScene.value?.choices) return false
  const triggerIndex = currentScene.value.choiceTriggerIndex ?? currentScene.value.dialogues.length - 1
  return currentDialogueIndex.value >= triggerIndex
})

// ===== 初始化 =====
async function init() {
  try {
    loading.value = true
    
    // 加载作品信息
    work.value = await getWorkInfo(workId.value)
    
    // 尝试加载自动存档
    const autoSave = await loadGame(workId.value, AUTO_SAVE_SLOT)
    
    if (autoSave) {
      // 恢复自动存档
      restoreFromSave(autoSave.data)
      console.log('已从自动存档恢复')
    } else {
      // 开始新游戏
      await startNewGame()
    }
  } catch (error) {
    ErrorHandler.handle(error, {
      showToast: true,
      onAuthError: () => router.push('/login')
    })
  } finally {
    loading.value = false
  }
}

// ===== 开始新游戏 =====
async function startNewGame() {
  try {
    const scenes = await getInitialScenes(workId.value)
    storyScenes.value = scenes
    currentSceneIndex.value = 0
    currentDialogueIndex.value = 0
    
    // 初始化属性和状态
    attributes.value = {
      心计: 30,
      才情: 60,
      声望: 10,
      圣宠: 0,
      健康: 100
    }
    
    statuses.value = {
      姓名: '林微月',
      位份: '从七品选侍',
      年龄: 16
    }
  } catch (error) {
    console.error('开始新游戏失败:', error)
    throw error
  }
}

// ===== 下一句对话 =====
async function nextDialogue() {
  if (hasMoreDialogues.value) {
    currentDialogueIndex.value++
  } else if (!isLastScene.value) {
    // 进入下一场景
    currentSceneIndex.value++
    currentDialogueIndex.value = 0
  } else {
    // 已到达最后一个场景,尝试加载后续剧情
    await loadNextScenes()
  }
}

// ===== 加载后续剧情 =====
async function loadNextScenes() {
  try {
    isGenerating.value = true
    
    const lastSceneId = storyScenes.value[storyScenes.value.length - 1]?.id
    const result = await getNextScenes(workId.value, lastSceneId)
    
    if (result.generating) {
      alert('剧情生成中,请稍候...')
      return
    }
    
    if (result.end) {
      alert('故事已完结')
      return
    }
    
    if (result.nextScenes?.length > 0) {
      storyScenes.value.push(...result.nextScenes)
      currentSceneIndex.value++
      currentDialogueIndex.value = 0
    }
  } catch (error) {
    ErrorHandler.handle(error, { showToast: true })
  } finally {
    isGenerating.value = false
  }
}

// ===== 选择选项 =====
async function handleChoice(choice) {
  try {
    loading.value = true
    
    const result = await submitChoice(workId.value, choice.id, {
      currentSceneId: currentScene.value.id,
      currentDialogueIndex: currentDialogueIndex.value,
      attributes: attributes.value,
      statuses: statuses.value
    })
    
    // 应用属性变化
    if (result.attributesDelta) {
      attributes.value = mergeAttributes(attributes.value, result.attributesDelta)
    }
    
    // 应用状态变化
    if (result.statusesDelta) {
      statuses.value = mergeStatuses(statuses.value, result.statusesDelta)
    }
    
    // 插入分支场景
    if (result.insertScenes?.length > 0) {
      const insertIndex = currentSceneIndex.value + 1
      storyScenes.value.splice(insertIndex, 0, ...result.insertScenes)
      currentSceneIndex.value = insertIndex
      currentDialogueIndex.value = 0
    } else {
      // 如果没有插入场景,继续下一句对话
      await nextDialogue()
    }
  } catch (error) {
    ErrorHandler.handle(error, { showToast: true })
  } finally {
    loading.value = false
  }
}

// ===== 保存游戏 =====
async function handleSave(slot) {
  try {
    const saveData = {
      work: work.value,
      currentSceneIndex: currentSceneIndex.value,
      currentDialogueIndex: currentDialogueIndex.value,
      attributes: attributes.value,
      statuses: statuses.value,
      storyScenes: storyScenes.value
    }
    
    await saveGame(workId.value, slot, saveData)
    alert(`已保存到 ${slot}`)
  } catch (error) {
    ErrorHandler.handle(error, { showToast: true })
  }
}

// ===== 读取存档 =====
async function handleLoad(slot) {
  try {
    const saveData = await loadGame(workId.value, slot)
    
    if (!saveData) {
      alert('该槽位无存档')
      return
    }
    
    restoreFromSave(saveData.data)
    alert('读档成功')
  } catch (error) {
    ErrorHandler.handle(error, { showToast: true })
  }
}

// ===== 从存档恢复 =====
function restoreFromSave(saveData) {
  work.value = saveData.work
  currentSceneIndex.value = saveData.currentSceneIndex
  currentDialogueIndex.value = saveData.currentDialogueIndex
  attributes.value = saveData.attributes
  statuses.value = saveData.statuses
  storyScenes.value = saveData.storyScenes
}

// ===== 自动存档 =====
async function autoSave() {
  try {
    const saveData = {
      work: work.value,
      currentSceneIndex: currentSceneIndex.value,
      currentDialogueIndex: currentDialogueIndex.value,
      attributes: attributes.value,
      statuses: statuses.value,
      storyScenes: storyScenes.value
    }
    
    await saveGame(workId.value, AUTO_SAVE_SLOT, saveData)
    console.log('自动存档成功')
  } catch (error) {
    console.error('自动存档失败:', error)
  }
}

// ===== 生命周期 =====
onMounted(() => {
  init()
})

onUnmounted(() => {
  autoSave()
})
</script>
*/

// ============================================
// 示例 3: 使用 SSE 流式接收数据
// ============================================

// StreamGamePage.vue
/*
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { createSSEConnection } from '@/service'
import { mergeAttributes, mergeStatuses } from '@/service/utils'

const route = useRoute()
const workId = ref(route.params.id)
const work = ref(null)
const storyScenes = ref([])
const currentChoices = ref([])
const attributes = ref({})
const statuses = ref({})
const isEnded = ref(false)

let sseConnection = null

function setupSSE() {
  sseConnection = createSSEConnection(workId.value, {
    onMessage: handleMessage,
    onError: (error) => console.error('SSE 错误:', error),
    onOpen: () => console.log('SSE 连接已建立'),
    onClose: () => console.log('SSE 连接已关闭')
  })
}

function handleMessage(data) {
  console.log('收到消息:', data)
  
  switch (data.type) {
    case 'work_meta':
      work.value = data.work
      break
      
    case 'scene':
      storyScenes.value.push(data.scene)
      break
      
    case 'choice_effect':
      currentChoices.value = data.choices
      break
      
    case 'mainline':
      // 回到主线
      storyScenes.value.push(data.scene)
      currentChoices.value = []
      break
      
    case 'special_event':
      handleSpecialEvent(data)
      break
      
    case 'end':
      isEnded.value = true
      alert('故事已完结')
      break
      
    case 'report':
      showFinalReport(data.report)
      break
  }
}

function handleSpecialEvent(data) {
  // 根据条件判定处理特殊事件
  console.log('特殊事件:', data)
}

function showFinalReport(report) {
  // 显示最终报告
  console.log('最终报告:', report)
}

onMounted(() => {
  setupSSE()
})

onUnmounted(() => {
  if (sseConnection) {
    sseConnection.close()
  }
})
</script>
*/

// ============================================
// 示例 4: 错误处理和重试
// ============================================

/*
import { getWorkInfo } from '@/service'
import { ErrorHandler } from '@/service/error-handler'

// 基本错误处理
async function loadWork(workId) {
  try {
    const work = await getWorkInfo(workId)
    return work
  } catch (error) {
    const handled = ErrorHandler.handle(error, {
      showToast: true,
      onAuthError: () => {
        console.log('需要重新登录')
        router.push('/login')
      },
      onNetworkError: () => {
        console.log('网络错误,可以显示重试按钮')
      }
    })
    
    console.error('错误类型:', handled.type)
    console.error('错误消息:', handled.message)
  }
}

// 自动重试
async function loadWorkWithRetry(workId) {
  try {
    const work = await ErrorHandler.retry(
      () => getWorkInfo(workId),
      3,      // 最多重试 3 次
      1000    // 初始延迟 1 秒,后续指数退避
    )
    return work
  } catch (error) {
    console.error('重试 3 次后仍然失败:', error)
    throw error
  }
}
*/

// ============================================
// 示例 5: Mock 数据开发
// ============================================

/*
// 开发环境配置 (.env.development)
VITE_USE_MOCK=true

// 在组件中使用
import { mockStoryService, mockSaveService } from '@/service/mock'

async function developWithMock() {
  // 使用 Mock 服务
  const scenes = await mockStoryService.getInitialScenes(1)
  const work = await mockStoryService.getWorkInfo(1)
  
  // 存档也使用 Mock
  await mockSaveService.saveGame(1, 'slot1', saveData)
  const loaded = await mockSaveService.loadGame(1, 'slot1')
}
*/

// ============================================
// 示例 6: 工具函数使用
// ============================================

/*
import {
  mergeAttributes,
  mergeStatuses,
  formatTimestamp,
  throttle,
  debounce,
  storage
} from '@/service/utils'

// 合并属性
const newAttributes = mergeAttributes(
  { 心计: 30, 才情: 60 },
  { 心计: 5, 声望: 10 }
)
// 结果: { 心计: 35, 才情: 60, 声望: 10 }

// 合并状态
const newStatuses = mergeStatuses(
  { 姓名: '林微月', 位份: '选侍', 好感度: 50 },
  { 位份: '嫔', 好感度: 10, 敌意: null }
)
// 结果: { 姓名: '林微月', 位份: '嫔', 好感度: 60 }

// 格式化时间
const dateStr = formatTimestamp(Date.now(), 'datetime')
const relativeStr = formatTimestamp(Date.now() - 3600000, 'relative')
// relativeStr: "1小时前"

// 节流(适用于滚动、窗口调整等)
const handleScroll = throttle(() => {
  console.log('滚动处理')
}, 300)

// 防抖(适用于搜索输入等)
const handleSearch = debounce((keyword) => {
  console.log('搜索:', keyword)
}, 500)

// 本地存储
storage.set('user_preferences', { theme: 'dark', language: 'zh-CN' })
const preferences = storage.get('user_preferences')
*/

// ============================================
// 示例 7: 完整的存档管理
// ============================================

/*
<script setup>
import { ref, onMounted } from 'vue'
import { loadAllSlots, saveGame, deleteSave } from '@/service'
import { formatTimestamp } from '@/service/utils'

const workId = ref(1)
const saves = ref({})
const loading = ref(false)

async function loadSaves() {
  loading.value = true
  try {
    const allSaves = await loadAllSlots(workId.value)
    saves.value = allSaves
  } catch (error) {
    console.error('加载存档列表失败:', error)
  } finally {
    loading.value = false
  }
}

function getSaveInfo(slot) {
  const save = saves.value[slot]
  if (!save) return { exists: false }
  
  return {
    exists: true,
    time: formatTimestamp(save.timestamp, 'relative'),
    progress: `第 ${save.data.currentSceneIndex + 1} 章`
  }
}

async function handleDelete(slot) {
  if (!confirm('确定要删除这个存档吗?')) return
  
  try {
    await deleteSave(workId.value, slot)
    delete saves.value[slot]
    alert('删除成功')
  } catch (error) {
    console.error('删除失败:', error)
  }
}

onMounted(() => {
  loadSaves()
})
</script>

<template>
  <div class="saves-manager">
    <div v-for="slot in ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6']" :key="slot">
      <div v-if="getSaveInfo(slot).exists" class="save-item">
        <span>{{ slot }}</span>
        <span>{{ getSaveInfo(slot).time }}</span>
        <span>{{ getSaveInfo(slot).progress }}</span>
        <button @click="handleDelete(slot)">删除</button>
      </div>
      <div v-else class="save-item empty">
        <span>{{ slot }}</span>
        <span>空</span>
      </div>
    </div>
  </div>
</template>
*/

// ============================================
// 更多示例请参考:
// - frontend/src/service/README.md
// - frontend/src/service/ARCHITECTURE.md
// ============================================
