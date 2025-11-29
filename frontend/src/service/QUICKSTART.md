# 🚀 StoryCraft 前端服务框架 - 快速入门指南

## 5 分钟上手

### 第 1 步: 配置环境变量

复制环境变量配置文件:
```bash
# Windows PowerShell
Copy-Item .env.example .env.development
```

编辑 `.env.development`:
```env
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_BASE_URL=ws://localhost:3000
VITE_USE_MOCK=false
```

### 第 2 步: 在组件中导入服务

```javascript
// 在你的 Vue 组件中
import { getWorkInfo, saveGame, loadGame } from '@/service'
```

### 第 3 步: 调用 API

```javascript
// 获取作品信息
const work = await getWorkInfo(1)

// 保存游戏
await saveGame(1, 'slot1', {
  work,
  currentSceneIndex: 0,
  currentDialogueIndex: 0,
  attributes: { 心计: 30 },
  statuses: { 姓名: '林微月' },
  storyScenes: []
})

// 读取存档
const saveData = await loadGame(1, 'slot1')
```

完成! 🎉

## 常用场景

### 场景 1: 用户登录

```vue
<script setup>
import { ref } from 'vue'
import { login } from '@/service'
import { ErrorHandler } from '@/service/error-handler'

const username = ref('')
const password = ref('')

async function handleLogin() {
  try {
    const result = await login({
      username: username.value,
      password: password.value
    })
    
    console.log('登录成功:', result.user)
    // 跳转到首页
  } catch (error) {
    ErrorHandler.handle(error, { showToast: true })
  }
}
</script>
```

### 场景 2: 游戏主页

```vue
<script setup>
import { ref, onMounted } from 'vue'
import { getWorkInfo, getInitialScenes } from '@/service'

const work = ref(null)
const scenes = ref([])

async function init() {
  work.value = await getWorkInfo(1)
  scenes.value = await getInitialScenes(1)
}

onMounted(init)
</script>
```

### 场景 3: 存档管理

```vue
<script setup>
import { saveGame, loadGame } from '@/service'

async function save(slot) {
  await saveGame(workId, slot, {
    work: work.value,
    currentSceneIndex: 0,
    currentDialogueIndex: 0,
    attributes: {},
    statuses: {},
    storyScenes: []
  })
  alert('保存成功')
}

async function load(slot) {
  const data = await loadGame(workId, slot)
  if (data) {
    // 恢复游戏状态
  }
}
</script>
```

## 使用 Mock 数据开发

如果后端还没准备好,可以使用 Mock 服务:

```env
# .env.development
VITE_USE_MOCK=true
```

```javascript
import { mockStoryService, mockSaveService } from '@/service/mock'

// Mock 服务的 API 与真实服务完全一致
const work = await mockStoryService.getWorkInfo(1)
await mockSaveService.saveGame(1, 'slot1', data)
```

## 测试验证

在浏览器控制台运行:

```javascript
// 快速健康检查
window.StoryCraftTests.healthCheck()

// 运行完整测试
window.StoryCraftTests.runAllTests()
```

## 完整 API 列表

### 用户 API
- `login(credentials)` - 登录
- `register(userData)` - 注册
- `logout()` - 登出
- `getCurrentUser()` - 获取当前用户
- `updateUser(updates)` - 更新用户信息

### 故事 API
- `getWorkInfo(workId)` - 获取作品信息
- `getWorkList(params)` - 获取作品列表
- `getInitialScenes(workId)` - 获取初始场景
- `getNextScenes(workId, afterSceneId)` - 获取后续剧情
- `submitChoice(workId, choiceId, context)` - 提交选项

### 存档 API
- `saveGame(workId, slot, data)` - 保存游戏
- `loadGame(workId, slot)` - 读取存档
- `loadAllSlots(workId)` - 批量读取所有槽位
- `deleteSave(workId, slot)` - 删除存档

### 流式 API
- `createSSEConnection(workId, options)` - 创建 SSE 连接
- `createWebSocketConnection(workId, options)` - 创建 WebSocket 连接

## 错误处理

所有 API 调用都应该使用 try-catch:

```javascript
import { ErrorHandler } from '@/service/error-handler'

try {
  const result = await someAPI()
} catch (error) {
  ErrorHandler.handle(error, {
    showToast: true,
    onAuthError: () => router.push('/login'),
    onNetworkError: () => showRetry()
  })
}
```

## 工具函数

```javascript
import { 
  mergeAttributes, 
  mergeStatuses,
  formatTimestamp 
} from '@/service/utils'

// 合并属性
const attrs = mergeAttributes({ 心计: 30 }, { 心计: 5, 声望: 10 })

// 合并状态  
const status = mergeStatuses({ 位份: '选侍' }, { 位份: '嫔' })

// 格式化时间
const time = formatTimestamp(Date.now(), 'relative') // "刚刚"
```

## 目录结构

```
src/service/
├── index.js          ⭐ 从这里导入所有服务
├── http.js           HTTP 客户端
├── user.js           用户服务
├── story.js          故事服务
├── save.js           存档服务
├── stream.js         流式服务
├── mock.js           Mock 服务
├── utils.js          工具函数
├── error-handler.js  错误处理
├── config.js         配置文件
└── README.md         📖 详细文档
```

## 获取更多帮助

- 📖 **详细文档**: `src/service/README.md`
- 🏗️ **架构说明**: `src/service/ARCHITECTURE.md`
- 💡 **代码示例**: `src/service/examples.js`
- 📋 **文件清单**: `src/service/FILES.md`

## 常见问题

### Q: 如何切换到真实后端?
A: 修改 `.env.development` 中的 `VITE_USE_MOCK=false`

### Q: Token 存储在哪里?
A: localStorage,key 为 `auth_token`

### Q: 如何自定义 API 基础 URL?
A: 修改 `.env` 文件中的 `VITE_API_BASE_URL`

### Q: 支持哪些 HTTP 方法?
A: GET, POST, PUT, DELETE, PATCH

### Q: 如何处理网络错误?
A: 使用 `ErrorHandler.handle()` 或 `ErrorHandler.retry()`

---

**开始使用吧!** 🚀

如有问题,请查看详细文档或运行测试验证。
