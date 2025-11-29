# StoryCraft 前端服务框架使用文档

本文档介绍如何使用前端服务框架与后端 API 进行交互。

## 目录结构

```
frontend/src/service/
├── index.js            # 统一导出入口
├── http.js             # HTTP 客户端
├── config.js           # API 配置
├── user.js             # 用户服务
├── story.js            # 故事服务
├── save.js             # 存档服务
├── stream.js           # 流式数据服务 (SSE/WebSocket)
├── mock.js             # Mock 数据服务
└── error-handler.js    # 错误处理工具
```

## 快速开始

### 1. 基本导入

```javascript
// 导入所有服务
import api from '@/service'

// 或按需导入
import { login, getWorkInfo, saveGame } from '@/service'
```

### 2. 环境配置

在项目根目录创建 `.env` 文件:

```env
# 开发环境
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_BASE_URL=ws://localhost:3000
VITE_USE_MOCK=false
```

生产环境使用 `.env.production`:

```env
# 生产环境
VITE_API_BASE_URL=https://api.storycraft.com
VITE_WS_BASE_URL=wss://api.storycraft.com
VITE_USE_MOCK=false
```

## 服务模块使用

### 用户服务 (user.js)

#### 登录

```javascript
import { login } from '@/service'

async function handleLogin() {
  try {
    const result = await login({
      username: 'user@example.com',
      password: 'password123'
    })
    
    console.log('登录成功:', result.user)
    // token 会自动保存到 localStorage
  } catch (error) {
    console.error('登录失败:', error)
  }
}
```

#### 注册

```javascript
import { register } from '@/service'

async function handleRegister() {
  try {
    const result = await register({
      username: 'newuser',
      email: 'user@example.com',
      password: 'password123'
    })
    
    console.log('注册成功:', result.user)
  } catch (error) {
    console.error('注册失败:', error)
  }
}
```

#### 获取当前用户信息

```javascript
import { getCurrentUser } from '@/service'

async function loadUserInfo() {
  try {
    const user = await getCurrentUser()
    console.log('用户信息:', user)
  } catch (error) {
    console.error('获取用户信息失败:', error)
  }
}
```

#### 登出

```javascript
import { logout } from '@/service'

async function handleLogout() {
  await logout()
  // 清除本地数据后跳转到登录页
  router.push('/login')
}
```

### 故事服务 (story.js)

#### 获取作品信息

```javascript
import { getWorkInfo } from '@/service'

async function loadWork(workId) {
  try {
    const work = await getWorkInfo(workId)
    console.log('作品信息:', work)
  } catch (error) {
    console.error('获取作品失败:', error)
  }
}
```

#### 获取初始场景

```javascript
import { getInitialScenes } from '@/service'

async function startStory(workId) {
  try {
    const scenes = await getInitialScenes(workId)
    console.log('初始场景:', scenes)
    // 设置到页面状态
    storyScenes.value = scenes
  } catch (error) {
    console.error('获取初始场景失败:', error)
  }
}
```

#### 获取后续剧情

```javascript
import { getNextScenes } from '@/service'

async function loadNextScenes(workId, lastSceneId) {
  try {
    const result = await getNextScenes(workId, lastSceneId)
    
    if (result.generating) {
      // 显示生成中提示
      showMessage('剧情生成中,请稍候...')
      return
    }
    
    if (result.end) {
      // 剧情结束
      showMessage('故事已完结')
      return
    }
    
    // 追加新场景
    storyScenes.value.push(...result.nextScenes)
  } catch (error) {
    console.error('获取后续剧情失败:', error)
  }
}
```

#### 提交选项选择

```javascript
import { submitChoice } from '@/service'

async function handleChoice(workId, choiceId) {
  try {
    const result = await submitChoice(workId, choiceId, {
      currentSceneId: currentScene.value.id,
      currentDialogueIndex: currentDialogueIndex.value,
      attributes: attributes.value,
      statuses: statuses.value
    })
    
    // 应用属性变化
    applyAttributesDelta(result.attributesDelta)
    applyStatusesDelta(result.statusesDelta)
    
    // 插入分支场景
    if (result.insertScenes?.length > 0) {
      const insertIndex = currentSceneIndex.value + 1
      storyScenes.value.splice(insertIndex, 0, ...result.insertScenes)
      currentSceneIndex.value = insertIndex
      currentDialogueIndex.value = 0
    }
  } catch (error) {
    console.error('提交选择失败:', error)
  }
}
```

### 存档服务 (save.js)

#### 保存游戏

```javascript
import { saveGame } from '@/service'

async function handleSave(slot) {
  try {
    const saveData = {
      work: work.value,
      currentSceneIndex: currentSceneIndex.value,
      currentDialogueIndex: currentDialogueIndex.value,
      attributes: attributes.value,
      statuses: statuses.value,
      storyScenes: storyScenes.value,
      timestamp: Date.now()
    }
    
    await saveGame(workId, slot, saveData)
    showMessage(`已保存到 ${slot}`)
  } catch (error) {
    console.error('保存失败:', error)
    showMessage('保存失败')
  }
}
```

#### 读取存档

```javascript
import { loadGame } from '@/service'

async function handleLoad(slot) {
  try {
    const saveData = await loadGame(workId, slot)
    
    if (!saveData) {
      showMessage('该槽位无存档')
      return
    }
    
    // 恢复游戏状态
    work.value = saveData.data.work
    currentSceneIndex.value = saveData.data.currentSceneIndex
    currentDialogueIndex.value = saveData.data.currentDialogueIndex
    attributes.value = saveData.data.attributes
    statuses.value = saveData.data.statuses
    storyScenes.value = saveData.data.storyScenes
    
    showMessage('读档成功')
  } catch (error) {
    console.error('读档失败:', error)
    showMessage('读档失败')
  }
}
```

#### 批量读取所有槽位

```javascript
import { loadAllSlots } from '@/service'

async function loadAllSaves() {
  try {
    const saves = await loadAllSlots(workId)
    
    // saves 格式: { slot1: {...}, slot2: {...}, ... }
    Object.keys(saves).forEach(slot => {
      if (saves[slot]) {
        console.log(`${slot}:`, saves[slot].timestamp)
      }
    })
  } catch (error) {
    console.error('批量读取失败:', error)
  }
}
```

#### 自动存档

```javascript
import { saveGame } from '@/service'
import { AUTO_SAVE_SLOT } from '@/service/config'

// 在页面离开时自动保存
onUnmounted(async () => {
  try {
    await saveGame(workId, AUTO_SAVE_SLOT, {
      work: work.value,
      currentSceneIndex: currentSceneIndex.value,
      currentDialogueIndex: currentDialogueIndex.value,
      attributes: attributes.value,
      statuses: statuses.value,
      storyScenes: storyScenes.value
    })
    console.log('自动存档成功')
  } catch (error) {
    console.error('自动存档失败:', error)
  }
})
```

### 流式数据服务 (stream.js)

#### 使用 SSE 接收流式数据

```javascript
import { createSSEConnection } from '@/service'

function setupSSE(workId) {
  const sseConnection = createSSEConnection(workId, {
    resumeAfterSeq: 0,  // 从序号 0 开始
    
    onMessage: (data) => {
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
          storyScenes.value.push(data.scene)
          break
          
        case 'end':
          showMessage('故事已完结')
          break
          
        case 'report':
          showReport(data.report)
          break
      }
    },
    
    onError: (error) => {
      console.error('SSE 错误:', error)
    },
    
    onOpen: () => {
      console.log('SSE 连接已建立')
    },
    
    onClose: () => {
      console.log('SSE 连接已关闭')
    }
  })
  
  // 组件卸载时关闭连接
  onUnmounted(() => {
    sseConnection.close()
  })
  
  return sseConnection
}
```

#### 使用 WebSocket

```javascript
import { createWebSocketConnection } from '@/service'

function setupWebSocket(workId) {
  const wsConnection = createWebSocketConnection(workId, {
    onMessage: (data) => {
      console.log('收到消息:', data)
      // 处理消息...
    },
    
    onError: (error) => {
      console.error('WebSocket 错误:', error)
    },
    
    onOpen: () => {
      console.log('WebSocket 连接已建立')
      
      // 发送心跳
      setInterval(() => {
        wsConnection.send({ type: 'ping' })
      }, 30000)
    }
  })
  
  // 发送消息
  function sendMessage(message) {
    wsConnection.send(message)
  }
  
  // 组件卸载时关闭连接
  onUnmounted(() => {
    wsConnection.close()
  })
  
  return { wsConnection, sendMessage }
}
```

### 错误处理

#### 统一错误处理

```javascript
import { ErrorHandler } from '@/service/error-handler'

async function fetchData() {
  try {
    const data = await getWorkInfo(workId)
    return data
  } catch (error) {
    const handled = ErrorHandler.handle(error, {
      showToast: true,
      onAuthError: () => {
        // 认证失败,跳转到登录页
        router.push('/login')
      },
      onNetworkError: () => {
        // 网络错误,显示重试按钮
        showRetryButton.value = true
      }
    })
    
    console.error('错误类型:', handled.type)
    console.error('错误消息:', handled.message)
  }
}
```

#### 自动重试

```javascript
import { ErrorHandler } from '@/service/error-handler'
import { getWorkInfo } from '@/service'

async function fetchWithRetry(workId) {
  try {
    const data = await ErrorHandler.retry(
      () => getWorkInfo(workId),
      3,      // 最多重试 3 次
      1000    // 初始延迟 1 秒
    )
    
    return data
  } catch (error) {
    console.error('重试失败:', error)
    throw error
  }
}
```

### Mock 数据服务

在后端未就绪时,可以使用 Mock 服务进行开发:

```javascript
import { mockSaveService, mockStoryService } from '@/service/mock'

// 使用 Mock 存档服务
const saveData = await mockSaveService.saveGame(workId, 'slot1', data)
const loadData = await mockSaveService.loadGame(workId, 'slot1')

// 使用 Mock 故事服务
const nextScenes = await mockStoryService.getNextScenes(workId, lastSceneId)
const choiceResult = await mockStoryService.submitChoice(workId, choiceId, context)
```

或在组件中根据配置自动切换:

```javascript
import { saveGame } from '@/service'
import { mockSaveService } from '@/service/mock'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

async function save(workId, slot, data) {
  if (USE_MOCK) {
    return await mockSaveService.saveGame(workId, slot, data)
  } else {
    return await saveGame(workId, slot, data)
  }
}
```

## Vue 组件中的完整示例

```vue
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getWorkInfo,
  getInitialScenes,
  getNextScenes,
  submitChoice,
  saveGame,
  loadGame,
  getUserId
} from '@/service'
import { ErrorHandler } from '@/service/error-handler'
import { AUTO_SAVE_SLOT } from '@/service/config'

const route = useRoute()
const router = useRouter()

const workId = ref(route.params.id)
const work = ref(null)
const storyScenes = ref([])
const currentSceneIndex = ref(0)
const currentDialogueIndex = ref(0)
const attributes = ref({})
const statuses = ref({})
const loading = ref(false)

// 加载作品
async function loadWork() {
  try {
    loading.value = true
    work.value = await getWorkInfo(workId.value)
    
    // 尝试加载自动存档
    const autoSave = await loadGame(workId.value, AUTO_SAVE_SLOT)
    
    if (autoSave) {
      // 恢复自动存档
      restoreFromSave(autoSave.data)
    } else {
      // 加载初始场景
      const scenes = await getInitialScenes(workId.value)
      storyScenes.value = scenes
      attributes.value = { 心计: 30, 才情: 60, 声望: 10 }
      statuses.value = { 姓名: '林微月', 位份: '从七品选侍' }
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

// 处理选择
async function handleChoice(choice) {
  try {
    const result = await submitChoice(workId.value, choice.id, {
      currentSceneId: storyScenes.value[currentSceneIndex.value].id,
      currentDialogueIndex: currentDialogueIndex.value,
      attributes: attributes.value,
      statuses: statuses.value
    })
    
    // 应用变化
    applyDeltas(result.attributesDelta, result.statusesDelta)
    
    // 插入场景
    if (result.insertScenes?.length > 0) {
      storyScenes.value.splice(
        currentSceneIndex.value + 1,
        0,
        ...result.insertScenes
      )
      currentSceneIndex.value++
      currentDialogueIndex.value = 0
    }
  } catch (error) {
    ErrorHandler.handle(error, { showToast: true })
  }
}

// 保存游戏
async function handleSave(slot) {
  try {
    await saveGame(workId.value, slot, {
      work: work.value,
      currentSceneIndex: currentSceneIndex.value,
      currentDialogueIndex: currentDialogueIndex.value,
      attributes: attributes.value,
      statuses: statuses.value,
      storyScenes: storyScenes.value
    })
    alert(`已保存到 ${slot}`)
  } catch (error) {
    ErrorHandler.handle(error, { showToast: true })
  }
}

// 自动存档
onUnmounted(async () => {
  try {
    await handleSave(AUTO_SAVE_SLOT)
    console.log('自动存档成功')
  } catch (error) {
    console.error('自动存档失败:', error)
  }
})

onMounted(() => {
  loadWork()
})
</script>
```

## 最佳实践

1. **统一使用服务模块**:不要直接使用 fetch,统一通过服务模块访问后端
2. **错误处理**:所有 API 调用都应使用 try-catch 并通过 ErrorHandler 处理
3. **自动存档**:在页面卸载时自动保存到 slot6
4. **认证失效处理**:遇到 401 错误时自动跳转到登录页
5. **加载状态**:显示加载指示器,提升用户体验
6. **网络重试**:对于网络错误,提供重试机制
7. **Mock 数据**:开发阶段使用 Mock 数据,避免依赖后端进度

## 注意事项

1. 所有 API 调用都是异步的,需要使用 async/await
2. getUserId() 会自动生成匿名 ID,但不适合生产环境跨设备共享
3. Token 存储在 localStorage,需要注意安全性
4. SSE/WebSocket 连接需要在组件卸载时手动关闭
5. 批量读取存档时,如果后端不支持批量接口,会自动降级为逐个读取

## 故障排查

### API 请求失败

1. 检查网络连接
2. 确认后端服务是否启动
3. 检查 API 基础 URL 配置是否正确
4. 查看浏览器控制台的错误信息

### 认证失败

1. 检查 token 是否过期
2. 确认是否已登录
3. 清除 localStorage 后重新登录

### SSE/WebSocket 连接失败

1. 检查后端是否支持 SSE/WebSocket
2. 确认 URL 配置是否正确
3. 查看网络防火墙设置

## 更多信息

- 后端 API 文档: `frontend/docs/GamePage-backend-data.md`
- API 规范: `api_spec/README.md`
