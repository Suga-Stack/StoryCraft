# 前端所需后端 API 参考（供开发使用）

本文档列出前端（`frontend/`）在游戏流程中依赖的所有后端接口：路径、方法、参数、请求体、示例响应及注意事项。针对后端存在多个返回格式的情况，说明了前端的兼容策略。

> 约定：后端返回的时间/进度相关 HTTP 202 或 204 会被视为“生成中（generating）”，前端应做相应的重试或提示。

---

## 一、故事相关接口（Story）

### 1. 获取场景（统一接口）
- 方法：GET
- 路径：/api/story/{workId}/scenes
- 描述：根据章节索引获取场景内容。章节索引从 0 开始（0 = 第一章，1 = 第二章，以此类推）。
- 请求参数：
  - workId (path) - 必须，作品 ID
  - chapter (query) - 必须，章节索引（0-based，0 表示首章）
- 请求示例：
  ```
  GET /api/story/123/scenes?chapter=0   # 获取第一章
  GET /api/story/123/scenes?chapter=1   # 获取第二章
  ```
- 成功响应（推荐格式）：
```json
{
  "end": false,
  "scenes": [
    {
      "sceneId": 1000,
      "backgroundImage": "/images/1.jpg",
      "dialogues": ["第一句", "第二句", ...],
      "choiceTriggerIndex": 3,
      "choices": [ {"id":"opt_A","text":"...","attributesDelta":{...}} ],
      "chapterEnd": false
    }
  ]
}
```
- **场景对象中的 `chapterEnd` 字段**：
  - `chapterEnd: true` - 标记该场景为本章最后一个场景
  - 当玩家播放完标记了 `chapterEnd: true` 的场景后，前端会自动增加 `currentChapterIndex` 并请求下一章内容
  - 通常在选项返回的分支场景的最后一个场景设置此标记
  - 例如：第一章选项返回 3 个场景，最后一个场景设置 `chapterEnd: true`，播放完后会自动请求第二章（`chapter=1`）

- 生成中响应：HTTP 202 或 204
  - 前端会将此识别为 `{ generating: true, end: false, scenes: [] }`
- 前端兼容策略（已在 `story.js` 中实现）：
  - 识别字段：`scenes`、`nextScenes`、`insertScenes` 或直接数组
  - 自动标准化为：`{ generating: boolean, end: boolean, scenes: Array }`
  - HTTP 202/204 状态码会被映射为 `generating: true`

**注意事项：**
- `chapterIndex` 是章节编号（非场景 ID）
- 前端通过 `getScenes(workId, chapterIndex)` 调用此接口
- `getInitialScenes(workId)` 是兼容性包装器，内部调用 `getScenes(workId, 0)`

---

### 2. 提交选项（玩家选择）
- 方法：POST
- 路径：/api/story/{workId}/choice
- 请求体（JSON）：
```json
{
  "choiceId": "opt_A",
  "context": {
    "userId": "user_123",
    "workId": 123,
    "currentSceneId": 1030,
    "currentDialogueIndex": 3,
    "attributes": { "灵石": 10, ... },
    "statuses": { ... }
  }
}
```
- 描述：前端传送选择 id 与上下文（用于后端决策、生成分支）。
- 成功响应（推荐统一化）：
```json
{
  "attributesDelta": { "灵石": 30 },
  "statusesDelta": { "小有名气的美食家": "..." },
  "nextScenes": [ 
    { "sceneId":1101, "dialogues": [...] },
    { "sceneId":1151, "dialogues": [...] },
    { "sceneId":1161, "dialogues": [...], "chapterEnd": true }
  ],
  "end": false
}
```
- **nextScenes 中的 `chapterEnd` 标记**：
  - 选项返回的场景序列中，最后一个场景应设置 `chapterEnd: true`
  - 这样前端播放完选项分支后，会自动切换到下一章
  - 例如：第一章选项 A 返回 3 个场景（1101, 1151, 1161），场景 1161 标记 `chapterEnd: true`
  - 播放完 1161 后，前端会增加 `currentChapterIndex` 并调用 `getScenes(workId, 1)` 获取第二章

- 生成中响应：HTTP 202 或 204
  - 前端会将此识别为 `{ attributesDelta: {}, statusesDelta: {}, nextScenes: [], end: false, generating: true }`
- 前端兼容策略（已在 `story.js` 中实现）：
  - 属性变化字段：`attributesDelta` 或 `attributes`
  - 状态变化字段：`statusesDelta` 或 `statuses`
  - 场景字段：`nextScenes`、`insertScenes`、`scenes` 或 `dialogues`（单独对话时会包装成场景）
  - 自动标准化为：`{ attributesDelta, statusesDelta, nextScenes, end, generating? }`
  - HTTP 202/204 状态码会被映射为 `generating: true`

---

## 二、作品（Works）管理接口

### 4. 获取作品信息
- 方法：GET
- 路径：/api/works/{workId}
- 返回示例：
```json
{ "id": 123, "title": "作品名", "coverUrl": "http://...", "authorId": "..." }
```

### 5. 获取作品列表
- 方法：GET
- 路径：/api/works
- 查询参数：page, pageSize, keyword
- 返回示例：
```json
{ "works": [...], "total": 123 }
```

### 6. 创建作品
- 方法：POST
- 路径：/api/works
- 描述：根据用户选择的标签、篇幅、构思等信息创建新作品，后端生成标题、封面、首章内容等。
- 请求体（完整参数）：
```json
{
  "tags": ["玄幻", "穿越", "系统", "升级流"],
  "idea": "一个现代女孩穿越到修仙世界，获得氪金系统...",
  "length": "medium",
  "title": "AI生成作品",
  "description": "根据用户偏好自动生成",
  "coverUrl": "",
  "seedText": "",
  "initialAttributes": { },
  "initialStatuses": {},
  "meta": {
    "createdBy": "user_123",
    "clientTimestamp": 1698765432000
  }
}
```
- 请求参数说明：
  - `tags` (Array, 必须) - 用户选择的标签数组（3-6个），如类型、风格、世界观等
  - `idea` (String, 可选) - 用户输入的构思文本，一句话概述或开头设定
  - `length` (String, 必须) - 篇幅类型：`"short"` (3-5章) / `"medium"` (6-10章) / `"long"` (10章以上)
  - `title` (String, 可选) - 作品标题，若为空后端可根据 tags/idea 生成
  - `description` (String, 可选) - 作品简介
  - `coverUrl` (String, 可选) - 封面图片 URL
  - `initialAttributes` (Object, 可选) - 初始属性值（如灵石、人气等）
  - `initialStatuses` (Object, 可选) - 初始状态标签
  - `meta` (Object, 可选) - 元信息（创建者、时间戳等）

- 响应字段说明：
  - `id` / `workId` - 作品唯一标识
  - `title` - 作品标题
  - `coverUrl` - 封面图片 URL
  - `description` - 作品简介
  - `authorId` - 作者 ID
  - `initialAttributes` - 初始属性值（用于游戏开始时）
  - `initialStatuses` - 初始状态标签
  - **注意**：创建接口不再返回 `firstChapter` 首章内容，首章内容将在用户点击"开始游戏"后通过 `GET /api/story/{workId}/scenes?chapter=0` 获取

- 前端处理策略（已在 `createWork.js` 中实现）：
  - 从 `CreateWork.vue` 收集用户输入：`tags`、`idea`、`length`
  - 通过 `createWorkOnBackend(payload)` 发送到后端
  - 后端返回作品元数据和初始属性
  - 前端将结果保存到 sessionStorage，供作品介绍页使用
  - 用户在作品介绍页点击"开始游戏"后，前端调用 `getScenes(workId, 0)` 获取首章内容

返回：
export async function createWorkOnBackend(payload = {}) {
  const userId = getUserId()
  const body = {
    // 用户输入的核心参数
    tags: payload.tags || [],
    idea: payload.idea || '',
    length: payload.length || 'medium',
    // 可选的作品元信息
    title: payload.title || '',
    description: payload.description || '',
    coverUrl: payload.coverUrl || '',
    // 初始游戏属性
    initialAttributes: payload.initialAttributes || {},
    initialStatuses: payload.initialStatuses || {},
    // 元信息
    meta: {
      createdBy: userId,
      clientTimestamp: Date.now()
    }
  }


**注意事项：**
- `tags` 数组应包含 3-6 个标签，涵盖类型、风格、世界观等维度
- `length` 影响后端生成的章节数量和故事长度规划
- `idea` 会作为提示词注入到 AI 生成过程中
- 若后端需要较长时间生成，建议返回 202 + `streamUrl`，前端可显示进度并通过 SSE 接收实时更新

### 7. 更新作品
- 方法：PATCH
- 路径：/api/works/{workId}
- 请求体：仅包含要更新的字段

### 8. 删除作品
- 方法：DELETE
- 路径：/api/works/{workId}

---

## 三、存档 / 读取 接口（Save）
> 前端在 `GamePage.vue` 使用了两套策略：优先调用后端保存（若配置开启），否则 fallback 到 localStorage。

### 9. 保存存档
- 方法：PUT
- 路径：/api/users/{userId}/saves/{workId}/{slot}
- 请求体：
```json
{ "workId": 123, "slot": "slot1", "data": { /* 保存的快照 payload */ } }
```
- 返回：200 或 201

### 10. 读取存档
- 方法：GET
- 路径：/api/users/{userId}/saves/{workId}/{slot}
- 返回示例：
```json
{ "data": { /* 保存的快照 payload */ }, "timestamp": 169... }
```
- 若无存档返回 404。

---

## 四、结算/报告接口
### 11. 获取个性化结算报告（可选）
- 方法：GET
- 路径：/api/works/{workId}/report
- 描述：当故事结束时，前端会请求生成/拉取结算页面的数据（成绩、分支统计等）。
- 返回：任意自定义结构，前端按约定渲染。

---

## 五、实时推送（SSE / Stream，可选）
### 12. 后端流（EventSource）
- 路径：由后端返回（create/next 等接口可能返回 `streamUrl`）
- 描述：当后端支持生成任务并通过 SSE 推送场景/进度时，前端订阅该 URL，并按 `seq` 或事件顺序 append 场景。
- 事件示例（JSON）：
```json
{ "type": "scene", "seq": 123, "scene": { "sceneId": 1111, "dialogues": [...] } }
```
- 注意：若使用 SSE，getNextScenes 的轮询/202 逻辑可改为依赖推送，避免重复请求。

---

## 六、请求/响应数据模型（前端期望）
下面给出前端内部使用的标准化数据结构，后端尽量按此契约返回或在 service 层做适配。

### Scene 对象（场景）
```json
{
  "sceneId": 1000,
  "backgroundImage": "/images/1.jpg",
  "dialogues": [
    "简单字符串形式的段落",
    { "text": "带说话人或图片的段落", "speaker": "NPC 名称", "backgroundImage": "/img/..." }
  ],
  "choiceTriggerIndex": 3, // 可选，0-based
  "choices": [
    { "id": "opt_A", "text": "A. ...", "attributesDelta": {...}, "statusesDelta": {...}, "nextScenes": [...] }
  ]
}
```

### getScenes 返回（统一化）
```json
{ "generating": false, "end": false, "scenes": [ /* Scene[] */ ] }
```
- 其中 `generating: true` 表示服务器仍在生成（HTTP 202/204）。
- 字段 `scenes` 是标准化后的场景数组（原始可能是 `nextScenes`/`insertScenes`/`scenes`）。

### submitChoice 返回（统一化）
```json
{
  "attributesDelta": { /* 属性变化 */ },
  "statusesDelta": { /* 状态变化 */ },
  "nextScenes": [ /* 可选：插入的新 scenes */ ],
  "end": false,
  "generating": false
}
```

---

## 七、前端特殊约定与兼容策略（重要）
1. choiceTriggerIndex 是 0-based。若后端给出的 index 超出当前场景 `dialogues.length - 1`，前端应把触发位置视为最后一句，以避免选项无法出现。
2. submitChoice 的 `context` 应包含当前 sceneId、currentDialogueIndex、attributes、statuses 以便后端能做上下文感知生成。
3. 后端在返回 `nextScenes` 时应保证每个 scene 至少包含 `sceneId` 与 `dialogues`，以便前端能正确 append 并显示背景图或对话。
4. 若后端返回 `dialogues`（用于替换当前场景的对话），前端会把该字段替换当前 scene 的 `dialogues`。
5. 对于生成中（202/204），建议后端同时返回 `Retry-After` 或提供 `streamUrl`，以便前端更友好地轮询或订阅。

---

## 八、示例流程（端到端交互示例）
1. **页面初始化加载**：
   - 前端调用 `getScenes(workId, 0)` 
   - 实际请求：`GET /api/story/{workId}/scenes?chapter=0`
   - 将返回的 scenes append 到 `storyScenes`

2. **章节推进**：
   - 当玩家完成当前章节，前端调用 `getScenes(workId, nextChapterIndex)`
   - 实际请求：`GET /api/story/{workId}/scenes?chapter=1`（第二章）
   - 将返回的 scenes append 到现有场景列表

3. **玩家选择分支**：
   - 前端调用 `submitChoice(workId, choiceId, context)` 
   - 实际请求：`POST /api/story/{workId}/choice`，携带 context
   - 后端返回 `attributesDelta`、`statusesDelta` 和 `nextScenes`
   - 前端应用属性/状态变更，并插入/追加返回的场景

4. **故事结束**：
   - 后端返回 `end: true` 或前端检测无后续
   - 跳转结算页并调用 `GET /api/works/{workId}/report` 获取结算数据

**前端函数映射关系：**
- `getScenes(workId, chapterIndex)` → `GET /api/story/{workId}/scenes?chapter={chapterIndex}`
- `getInitialScenes(workId)` → 内部调用 `getScenes(workId, 0)`（兼容性包装器）
- `submitChoice(workId, choiceId, context)` → `POST /api/story/{workId}/choice`

---

## 九、调试与验证建议
- 在开发时把后端返回内容打印到控制台（或在 service 层加临时日志），确认字段名是否匹配 `scenes` / `nextScenes` / `insertScenes`。
- 使用 Postman 或 curl 模拟：
```powershell
# 获取第一章
curl -i "http://localhost:3000/api/story/123/scenes?chapter=0"

# 获取第二章
curl -i "http://localhost:3000/api/story/123/scenes?chapter=1"

# 提交选择
curl -X POST "http://localhost:3000/api/story/123/choice" `
  -H "Content-Type: application/json" `
  -d '{\"choiceId\":\"opt_A\",\"context\":{\"userId\":\"user_123\",\"workId\":123}}'
```
- 若后端返回 202，请检查是否同时提供 `streamUrl`，或在前端用短轮询（几秒一次）来重试。
- **重要**：`chapterIndex` 是章节编号（0-based），不要与 `sceneId` 混淆。

---

## 十、story.js 中的实际实现

前端 `frontend/src/service/story.js` 中的主要函数：

### getScenes(workId, chapterIndex)
```javascript
// 实际 HTTP 请求
GET /api/story/${workId}/scenes?chapter=${chapterIndex}

// 返回标准化格式
{ generating: boolean, end: boolean, scenes: Array }
```

### getInitialScenes(workId)
```javascript
// 兼容性包装器，内部调用：
return getScenes(workId, 0).scenes
```

### submitChoice(workId, choiceId, context)
```javascript
// 实际 HTTP 请求
POST /api/story/${workId}/choice
Body: { choiceId, context: { userId, workId, ...context } }

// 返回标准化格式
{ attributesDelta, statusesDelta, nextScenes, end, generating? }
```

---

## 十一、createWork.js 中的实际实现

前端 `frontend/src/service/createWork.js` 中的创建作品函数：

### createWorkOnBackend(payload)
```javascript
// 实际 HTTP 请求
POST /api/works
Body: {
  tags: ['玄幻', '穿越', '系统'],      // 用户选择的标签（3-6个）
  idea: '用户输入的构思文本',          // 可选
  length: 'medium',                     // 'short' | 'medium' | 'long'
  title: '',                            // 可选，后端可生成
  description: '',                      // 可选
  coverUrl: '',                         // 可选
  seedText: '',                         // 可选
  initialAttributes: {},                // 初始属性
  initialStatuses: {},                  // 初始状态
  meta: {
    createdBy: userId,
    clientTimestamp: Date.now()
  }
}

// 返回格式
{
  backendWork: {
    id: 123,
    title: '云舒的修仙商业帝国',
    coverUrl: 'https://...',
    description: '...',
    authorId: 'user_123',
    tags: ['玄幻', '穿越', '系统']
  },
  firstChapter: [ /* Scene[] */ ],
  initialAttributes: { '灵石': 50, ... },
  initialStatuses: { '修为': '炼气期三层' },
  streamUrl: 'https://...' (可选),
  generationComplete: true/false
}
```

**前端使用流程（CreateWork.vue）：**
1. 用户在创建页面选择标签、篇幅、填写构思
2. 点击"一键生成"调用 `createWorkOnBackend({ tags, idea, length })`
3. 显示加载进度条，等待后端生成
4. 收到响应后，将 `createResult` 保存到 sessionStorage
5. 跳转到作品列表页或游戏页面

**注意**：`story.js` 中还有一个 bug - 导出的 `default` 对象引用了不存在的 `getNextScenes`，应该改为 `getScenes`。

---

如果你需要进一步调整或有其他问题，请随时告知。

**重要提示**：请注意 `story.js` 的 export default 中仍引用了 `getNextScenes`（已不存在），建议修复为 `getScenes`。