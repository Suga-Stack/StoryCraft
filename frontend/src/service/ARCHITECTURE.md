# StoryCraft 前端服务框架架构说明

## 概述

StoryCraft 前端服务框架是一个完整的、面向后端 API 的网络服务层,提供了统一的接口调用、错误处理、数据流管理等功能。

## 文件结构

```
frontend/src/service/
├── index.js              # 统一导出入口,提供所有服务的访问接口
├── http.js               # HTTP 客户端,基于 fetch API 封装
├── config.js             # 配置文件,管理 API 端点、环境变量等
├── types.js              # 类型定义(JSDoc),提供智能提示
├── utils.js              # 工具函数库
├── error-handler.js      # 统一错误处理
├── user.js               # 用户服务(登录、注册、个人信息)
├── story.js              # 故事服务(作品、场景、选项)
├── save.js               # 存档服务(保存、读取、管理)
├── stream.js             # 流式数据服务(SSE、WebSocket)
├── mock.js               # Mock 数据服务(开发调试用)
└── README.md             # 使用文档
```

## 核心模块

### 1. HTTP 客户端 (http.js)

**职责**:
- 封装 fetch API,提供统一的 HTTP 请求方法
- 自动处理请求头(Content-Type, Authorization)
- 统一响应处理和错误处理
- 支持查询参数构建

**主要功能**:
- `get(endpoint, params, options)` - GET 请求
- `post(endpoint, data, options)` - POST 请求
- `put(endpoint, data, options)` - PUT 请求
- `delete(endpoint, options)` - DELETE 请求
- `patch(endpoint, data, options)` - PATCH 请求

**特性**:
- 自动从 localStorage 或 window 对象获取 token
- 自动生成和管理匿名用户 ID
- 统一的错误处理机制
- 支持自定义请求头和选项

### 2. 用户服务 (user.js)

**提供的 API**:
- `login(credentials)` - 用户登录
- `register(userData)` - 用户注册
- `logout()` - 用户登出
- `getCurrentUser()` - 获取当前用户信息
- `updateUser(updates)` - 更新用户信息
- `changePassword(passwords)` - 修改密码
- `getCachedUserInfo()` - 获取缓存的用户信息
- `validateToken()` - 验证 token 有效性

**特点**:
- 自动保存 token 和用户信息到 localStorage
- 登录/注册成功后自动设置认证状态
- 登出时自动清理本地数据

### 3. 故事服务 (story.js)

**提供的 API**:
- `getWorkInfo(workId)` - 获取作品信息
- `getWorkList(params)` - 获取作品列表
- `createWork(workData)` - 创建作品
- `updateWork(workId, updates)` - 更新作品
- `deleteWork(workId)` - 删除作品
- `getInitialScenes(workId)` - 获取初始场景
- `getNextScenes(workId, afterSceneId)` - 获取后续剧情
- `submitChoice(workId, choiceId, context)` - 提交选项选择

**特点**:
- 自动处理 202/204 响应(内容生成中)
- 支持按需加载剧情
- 完整的选项交互支持

### 4. 存档服务 (save.js)

**提供的 API**:
- `saveGame(workId, slot, saveData)` - 保存游戏
- `loadGame(workId, slot)` - 读取存档
- `getSavesList(workId)` - 获取存档列表
- `deleteSave(workId, slot)` - 删除存档
- `loadAllSlots(workId, slots)` - 批量读取所有槽位

**特点**:
- 支持 6 个存档槽位
- 自动存档到 slot6
- 智能回退:批量接口不可用时自动逐个读取
- 404 错误自动处理为"无存档"

### 5. 流式数据服务 (stream.js)

**提供的 API**:
- `createSSEConnection(workId, options)` - 创建 SSE 连接
- `createWebSocketConnection(workId, options)` - 创建 WebSocket 连接
- `parseNDJSON(ndjsonText)` - 解析 NDJSON 数据

**特点**:
- 自动重连机制
- 序号恢复支持
- 完整的生命周期回调
- 错误处理和状态管理

### 6. Mock 服务 (mock.js)

**用途**:
- 在后端未就绪时提供模拟数据
- 开发阶段独立调试前端功能
- 模拟网络延迟和异步行为

**包含**:
- `MockSaveService` - 存档服务模拟(基于 localStorage)
- `MockStoryService` - 故事服务模拟

### 7. 错误处理 (error-handler.js)

**功能**:
- 统一的错误分类和处理
- 友好的错误消息展示
- 自动重试机制
- 特定错误的回调处理(认证错误、网络错误等)

**错误类型**:
- `auth` - 认证错误(401)
- `permission` - 权限错误(403)
- `not_found` - 资源不存在(404)
- `validation` - 数据验证错误(400, 422)
- `conflict` - 数据冲突(409)
- `rate_limit` - 请求限流(429)
- `server` - 服务器错误(5xx)
- `network` - 网络错误

### 8. 工具函数 (utils.js)

**提供的工具**:
- `mergeAttributes(current, delta)` - 合并属性变化
- `mergeStatuses(current, delta)` - 合并状态变化
- `formatTimestamp(timestamp, format)` - 格式化时间
- `throttle(func, wait)` - 节流
- `debounce(func, wait)` - 防抖
- `deepClone(obj)` - 深拷贝
- `generateId(prefix)` - 生成唯一 ID
- `validateRequired(obj, fields)` - 验证必需字段
- `storage` - 本地存储工具
- 更多实用函数...

### 9. 配置管理 (config.js)

**配置项**:
- `API_ENDPOINTS` - 所有 API 端点定义
- `SAVE_SLOTS` - 存档槽位配置
- `AUTO_SAVE_SLOT` - 自动存档槽位
- `HTTP_CONFIG` - HTTP 请求配置
- `SSE_CONFIG` - SSE 连接配置
- `WS_CONFIG` - WebSocket 配置
- `CACHE_CONFIG` - 缓存配置
- `ENV_CONFIG` - 环境配置

## 设计原则

### 1. 单一职责
每个模块专注于特定功能领域,职责清晰,易于维护。

### 2. 统一接口
所有服务通过 `index.js` 统一导出,提供一致的调用方式。

### 3. 错误优先
完善的错误处理机制,所有 API 调用都应使用 try-catch。

### 4. 配置驱动
通过环境变量和配置文件管理,支持多环境部署。

### 5. 向后兼容
提供智能降级和回退机制,兼容后端 API 的变化。

### 6. 类型安全
使用 JSDoc 提供类型定义,无需 TypeScript 即可获得智能提示。

## 数据流

```
组件 (Vue)
    ↓ 调用
服务层 (index.js)
    ↓ 路由
具体服务 (user.js, story.js, save.js, stream.js)
    ↓ 请求
HTTP 客户端 (http.js)
    ↓ 发送
后端 API
    ↓ 响应
HTTP 客户端 (http.js)
    ↓ 处理
错误处理 (error-handler.js) / 正常返回
    ↓
组件 (Vue)
```

## 使用流程

### 标准流程

1. **导入服务**
   ```javascript
   import { getWorkInfo, saveGame } from '@/service'
   ```

2. **调用 API**
   ```javascript
   const work = await getWorkInfo(workId)
   ```

3. **错误处理**
   ```javascript
   try {
     const work = await getWorkInfo(workId)
   } catch (error) {
     ErrorHandler.handle(error, { showToast: true })
   }
   ```

### 流式数据流程

1. **创建连接**
   ```javascript
   const sse = createSSEConnection(workId, {
     onMessage: (data) => { /* 处理消息 */ }
   })
   ```

2. **处理消息**
   ```javascript
   switch (data.type) {
     case 'scene': /* 处理场景 */ break
     case 'choice_effect': /* 处理选项 */ break
   }
   ```

3. **关闭连接**
   ```javascript
   onUnmounted(() => sse.close())
   ```

## 环境配置

### 开发环境 (.env.development)
```env
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_BASE_URL=ws://localhost:3000
VITE_USE_MOCK=false
```

### 生产环境 (.env.production)
```env
VITE_API_BASE_URL=https://api.storycraft.com
VITE_WS_BASE_URL=wss://api.storycraft.com
VITE_USE_MOCK=false
```

## 扩展指南

### 添加新的 API

1. 在相应服务文件(如 `story.js`)中添加函数:
   ```javascript
   export async function newAPI(params) {
     return await http.get('/api/new-endpoint', params)
   }
   ```

2. 在 `index.js` 中导出:
   ```javascript
   export { newAPI } from './story.js'
   ```

3. 在 `config.js` 中添加端点定义(可选):
   ```javascript
   STORY: {
     NEW_ENDPOINT: '/api/new-endpoint'
   }
   ```

### 添加新的服务模块

1. 创建新文件 `newService.js`
2. 实现服务函数
3. 在 `index.js` 中导入导出
4. 更新文档

## 最佳实践

1. **始终使用服务层**:不要在组件中直接使用 fetch
2. **错误处理**:所有 API 调用都应有 try-catch
3. **类型注释**:为复杂函数添加 JSDoc 注释
4. **环境配置**:敏感信息通过环境变量管理
5. **自动存档**:在组件卸载时保存到 slot6
6. **加载状态**:显示适当的加载指示器
7. **重试机制**:对网络错误使用 ErrorHandler.retry
8. **Mock 数据**:开发阶段启用 Mock 减少对后端依赖

## 性能优化

1. **请求合并**:批量操作优于多次单独请求
2. **缓存策略**:合理使用 localStorage 缓存
3. **防抖节流**:对频繁操作使用 throttle/debounce
4. **按需加载**:只加载必要的场景数据
5. **连接复用**:SSE/WebSocket 连接在组件间共享

## 安全考虑

1. **Token 管理**:Token 存储在 localStorage,注意 XSS 防护
2. **输入验证**:使用 validateRequired 验证必需字段
3. **HTTPS**:生产环境必须使用 HTTPS/WSS
4. **敏感信息**:不要在前端暴露敏感配置
5. **错误信息**:不要在错误消息中泄露系统信息

## 故障排查

### API 请求失败
1. 检查网络连接
2. 确认后端服务运行状态
3. 验证 API_BASE_URL 配置
4. 查看浏览器控制台错误

### 认证问题
1. 检查 token 是否过期
2. 清除 localStorage 重新登录
3. 确认后端认证配置

### 流式连接失败
1. 检查 WebSocket/SSE 支持
2. 验证 URL 配置
3. 检查防火墙设置

## 总结

StoryCraft 前端服务框架提供了:
- ✅ 完整的 HTTP 客户端封装
- ✅ 模块化的服务组织
- ✅ 统一的错误处理
- ✅ 流式数据支持(SSE/WebSocket)
- ✅ Mock 数据支持
- ✅ 丰富的工具函数
- ✅ 类型定义和智能提示
- ✅ 多环境配置
- ✅ 完善的文档

这是一个生产级的、可扩展的前端服务架构,可以直接投入使用。
