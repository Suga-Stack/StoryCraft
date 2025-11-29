# GamePage.vue 后端数据与接口契约

本文档梳理前端页面 `frontend/src/views/GamePage.vue` 运行所需的后端数据模型与接口规范，便于前后端对齐。文中给出字段说明、交互语义与示例负载（JSON）。

> 适用范围
> - 游戏主页面：剧情渲染、分支选择、按需加载后续剧情、存/读档、属性与特殊状态展示。
> - 作品引导页（`game_introduction.vue`）仅需要作品基本信息（见下文 Work 模型）。

---

## 1. 鉴权与用户标识

- 建议后端统一采用 Bearer Token 认证：`Authorization: Bearer <token>`。
- 用户标识 userId 获取优先级：
  1) 若后端在页面注入了 `window.__STORYCRAFT_USER__.id`，前端将优先使用；
  2) 或注入 `window.__STORYCRAFT_AUTH_TOKEN__` 由后端解析出 userId；
  3) 无注入时，前端会本地生成匿名 id（仅方便本地调试，不适合生产跨设备共享）。
- 所有用户相关接口路径都以 userId 作为资源路径的一部分，保证用户间隔离。

---

## 2. 核心数据模型

### 2.1 Work（作品）
- 用途：用于引导页与游戏页展示作品基本信息。
- 字段：
  - id: string | number（必填）
  - title: string（必填）
  - coverUrl: string（可选）封面图 URL
  - authorId: string（可选）
  - description: string（可选）简介

示例：
```json
{
  "id": 1,
  "title": "锦瑟深宫",
  "coverUrl": "https://.../cover.jpg",
  "authorId": "author_001",
  "description": "第一章·初入宫闱……"
}
```

### 2.2 Scene（场景）
- 用途：承载一段背景图与多句对白/叙述，可能在某句后出现选项。
- 字段：
  - id: string | number（必填）场景唯一标识
  - backgroundImage: string（可选）背景图 URL
  - dialogues: DialogueItem[]（必填）对白/叙述数组
  - choiceTriggerIndex: number（可选）选项出现的触发句索引（0-based），当用户阅读到该索引后展示选项
  - choices: Choice[]（可选）可选项集合
  - nextScene: string | number（可选）旧版/简单直线剧情用；通常按需加载时使用 `nextScenes`
  - nextScenes: Scene[]（可选）预置的后续场景数组；用于“内联返回分支内容”的模式

备注：
- 当 `choices` 存在时，优先以选择分支推进；若无 `choices` 且场景读完仍未收到“结束”信号，前端会调用“后续剧情”接口按需拉取。

### 2.3 DialogueItem（对白项）
- 用途：单句对白/叙述，可覆盖背景图。
- 形态：
  - 简写：string（表示 `text`）
  - 完整：
    - text: string（必填）
    - backgroundImage: string（可选）本句专属背景图（若提供将优先于场景背景图）

示例：
```json
"她轻提罗裙，步入宫门。"
```
或
```json
{ "text": "（场景描写）夜色似水，宫灯如豆……", "backgroundImage": "https://.../night.jpg" }
```

前端额外占位策略（无需后端实现）：
- 若 `text` 含“（场景描写）”，且无 `backgroundImage`，前端会选择默认/关键词占位图（夜/雪/湖/宫等）。

### 2.4 Choice（选项）
- 用途：在某句后出现，点击后向后端请求分支发展（或使用内联返回）。
- 字段：
  - id: string | number（必填）选项标识
  - text: string（必填）按钮展示文案
  - attributesDelta: Record<string, number>（可选）属性修改（累加）
  - statusesDelta: Record<string, any>（可选）特殊状态修改（见 2.6 合并规则）
  - nextScenes: Scene[]（可选）内联返回分支后续内容；如不提供则需调用接口获取

### 2.5 Attributes（玩家属性）
- 用途：数值型属性，随剧情或选项改变。
- 形态：`Record<string, number>`，例如：
```json
{
  "心计": 30,
  "才情": 60,
  "声望": 10,
  "圣宠": 0,
  "健康": 100
}
```

- 修改规则（前端实现）：`attributesDelta` 会对齐 key 做累加，缺失键视为 0。

### 2.6 Statuses（特殊状态/人物档案）
- 用途：非纯数值的状态，如“位份”“姓名”“顾景琛的怀疑”等。
- 形态：`Record<string, string | number | boolean | object | null>`
- 合并规则（前端实现）：
  - 数值：累加
  - null/false：删除该状态
  - 其他类型（字符串/对象/布尔/数组）：覆盖

示例：
```json
{
  "姓名": "林微月",
  "位份": "从七品选侍",
  "年龄": 16,
  "阵营": "无",
  "明眸善睐": "眼波流转间易获好感",
  "暗香盈袖": "体带天然冷梅香"
}
```

### 2.7 SavePayload（存档快照）
- 用途：保存/读取存档使用的统一数据载体。
- 字段：
```ts
{
  work: Work,
  currentSceneIndex: number,
  currentDialogueIndex: number,
  attributes: Record<string, number>,
  statuses: Record<string, any>,
  storyScenes: Scene[],      // 当前已加载的所有场景（含分支/按需加载的增量）
  timestamp: number          // 毫秒时间戳
}
```

---

## 3. 接口契约

### 3.1 保存存档
- Method: PUT
- URL: `/api/users/{userId}/saves/{workId}/{slot}`
- Request Headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>`（建议）
- Request Body：
```json
{
  "workId": "1",
  "slot": "slot1",
  "data": { /* SavePayload */ }
}
```
- Responses：
  - 200 OK | 201 Created
  - Body（可选）：`{ ok: true }` 或保存后的元数据

备注：前端会在退出/隐藏页面时自动将快照写入 `slot6`（系统自动存档槽）。

### 3.2 读取存档
- Method: GET
- URL: `/api/users/{userId}/saves/{workId}/{slot}`
- Responses：
  - 200 OK
  - Body：
```json
{
  "data": { /* SavePayload */ },
  "timestamp": 1730000000000
}
```
  - 404 Not Found（该槽无存档）

> 提示：为提升刷新六个槽位的效率，可选提供列表接口：
> - GET `/api/users/{userId}/saves/{workId}` → 返回各槽位摘要（slot、timestamp、excerpt 等），但前端当前实现兼容逐槽读取。

### 3.3 选择分支（点击选项）
- 触发时机：场景 `choiceTriggerIndex` 对应的对白阅读后，用户点击对应 `choices[i]`。
- Method: POST
- URL: `/api/story/{workId}/choice`
- Request Body：
```json
{
  "choiceId": "c1",
  "context": {
    "userId": "u_123",
    "workId": "1",
    "currentSceneId": 1200,
    "currentDialogueIndex": 7,
    "attributes": { /* 当前属性 */ },
    "statuses": { /* 当前状态 */ }
  }
}
```
- Response Body（两种模式其一或并存）：
```json
{
  "attributesDelta": { "圣宠": 5 },
  "statusesDelta": { "顾景琛的怀疑": 10 },
  "insertScenes": [ /* Scene[]：要插入到当前场景之后的连续场景，前端会自动跳转到第一段 */ ],
  "end": false
}
```
或（“内联返回”已在选项体上提供）
```json
{
  "attributesDelta": { },
  "statusesDelta": { },
  "insertScenes": []
}
```

语义：
- 前端会将 `insertScenes` 追加到当前场景之后，并导航到追加的第一段场景继续播放。
- 若返回 `end: true`，前端会视为结尾，不再拉取后续剧情。

### 3.4 按需获取后续剧情（无显式结束信号时）
- 触发时机：读完当前已加载的最后一个场景且未收到 `end:true`。
- Method: GET
- URL: `/api/story/{workId}/next?after={sceneId}`
  - `after` 为当前已加载的最后一个场景 id；首段可为空或约定值
- Response Body：
```json
{
  "end": false,
  "nextScenes": [ /* Scene[]：应连续可播的后续片段 */ ]
}
```
- 若所有剧情已完结：
```json
{ "end": true }
```

语义：
- 前端会显示非阻塞的中心加载指示；
- 若返回 `nextScenes`，将其追加至 `storyScenes` 并自动进入下一段；
- 若返回 `end:true`，标记剧情结束；
- 若短期无内容可供（例如“正在生成”），建议返回 204 No Content 或 202 Accepted，前端会提示“后续剧情生成中”。

---

## 4. 字段与交互细节约定

- choiceTriggerIndex：为 0-based 索引，表示“读完该索引对应对白后展示选项”。
- 背景图优先级：`DialogueItem.backgroundImage` > `Scene.backgroundImage` > 前端占位图策略（仅当文本包含“（场景描写）”或关键词）。
- `insertScenes`/`nextScenes` 合并：
  - 由后端保证返回的场景片段在逻辑上可连续播放；
  - 每个场景须有唯一 `id`，避免重复插入；
  - 前端将把这些场景插入在“当前场景之后”的位置，并跳转到第一段。
- 属性/状态合并：
  - `attributesDelta`：数值累加，未出现的键视为 0；
  - `statusesDelta`：数值累加；`null/false` 删除；其他类型覆盖。
- 存档语义：
  - 存档包含完整 `storyScenes` 快照，可准确恢复至“选项之前”的属性与状态；
  - 自动存档固定写入 `slot6`，用于离开/异常退出后的快速恢复。

---

## 5. 示例负载

### 5.1 初始场景（含场景描写与选项）
```json
{
  "id": 1200,
  "backgroundImage": "https://.../palace-hall.jpg",
  "dialogues": [
    { "text": "（场景描写）夜色如水，宫灯如豆，檐角风铃轻响。" },
    "新入宫的林微月步入丹墀之上，屏风后隐约龙涎香。",
    "德妃端坐，抬手示意——奉茶。",
    "你该如何行事？"
  ],
  "choiceTriggerIndex": 3,
  "choices": [
    {
      "id": "c1",
      "text": "稳重守礼，规制不差",
      "attributesDelta": { "声望": 2 },
      "statusesDelta": { "德妃印象": 5 }
    },
    {
      "id": "c2",
      "text": "机敏变通，巧言承欢",
      "attributesDelta": { "心计": 3 },
      "statusesDelta": { "德妃印象": 3, "顾景琛的怀疑": 5 }
    }
  ]
}
```

### 5.2 选择分支响应
```json
{
  "attributesDelta": { "圣宠": 1 },
  "statusesDelta": { "德妃印象": 2 },
  "insertScenes": [
    {
      "id": 1210,
      "backgroundImage": "https://.../side-hall.jpg",
      "dialogues": [
        "茶汤微苦，回甘绵长。德妃垂眸，似有所思。",
        { "text": "（场景描写）殿外小雨初歇，檐滴未止。" }
      ]
    },
    {
      "id": 1211,
      "dialogues": [
        "一名内侍匆匆来报：顾景琛请见。",
        "你抬眸，心绪微动。"
      ]
    }
  ],
  "end": false
}
```

### 5.3 按需获取后续剧情响应
```json
{
  "end": false,
  "nextScenes": [
    {
      "id": 1220,
      "dialogues": [
        "御花园内，九曲桥旁锦鲤翻涌。",
        { "text": "（场景描写）湖面风起，涟漪层叠。" }
      ]
    }
  ]
}
```

### 5.4 保存/读取存档
- 保存请求体：
```json
{
  "workId": "1",
  "slot": "slot1",
  "data": {
    "work": { "id": 1, "title": "锦瑟深宫", "authorId": "author_001" },
    "currentSceneIndex": 3,
    "currentDialogueIndex": 1,
    "attributes": { "心计": 33, "才情": 60, "声望": 12, "圣宠": 1, "健康": 100 },
    "statuses": { "姓名": "林微月", "位份": "从七品选侍", "德妃印象": 7 },
    "storyScenes": [ /* 已加载场景（含分支） */ ],
    "timestamp": 1730000123456
  }
}
```
- 读取响应体：
```json
{
  "data": { /* SavePayload 同上 */ },
  "timestamp": 1730000123456
}
```

---

## 6. 错误处理与状态码建议
- 401 Unauthorized：未认证或 token 失效；前端可提示重新登录。
- 403 Forbidden：无权限访问目标资源。
- 404 Not Found：存档槽无数据（读档接口）；或 after 场景不存在（next 接口）。
- 409 Conflict：并发写入冲突（可选；保存时用于保护一致性）。
- 422 Unprocessable Entity：请求体字段缺失/类型错误。
- 5xx：服务端错误；前端会提示“稍后再试”。
- 202/204（next 接口可选）：内容生成中或暂无增量，前端会提示并稍后重试。

---

## 7. 其他实现建议（可选）
- CORS：允许前端域名，携带 `Authorization` 头；
- 压缩：建议开启 gzip/br；
- 日志与追踪：选择分支时记录 `choiceId`、userId 与上下文以便数据回溯；
- 存档索引：提供批量列出槽位的接口以优化弹窗刷新性能；
- 幂等性：保存接口可基于 `{userId, workId, slot}` 幂等覆盖；
- 版本兼容：为 `Scene` 预留 `version` 字段，便于将来剧情结构升级。

---

## 8. 最小集成清单（后端需提供）
- [x] GET `/api/users/{userId}/saves/{workId}/{slot}`（404 表示无存档）
- [x] PUT `/api/users/{userId}/saves/{workId}/{slot}`
- [x] POST `/api/story/{workId}/choice`
- [x] GET `/api/story/{workId}/next?after={sceneId}`
- [ ]（可选）GET `/api/users/{userId}/saves/{workId}` 返回各槽位摘要

满足以上四个接口，即可驱动当前前端页面的所有核心流程：
- 选项嵌入剧情并点击后请求分支；
- 无结束信号时按需拉取后续剧情，显示中心加载指示；
- 存/读档六个槽位，支持退出自动存入 `slot6`；
- 读档能准确恢复到“选项之前”的属性、状态与剧情位置。
