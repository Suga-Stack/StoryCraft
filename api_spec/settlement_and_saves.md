# 存档（Save/Load）与结算个性报告 API 说明

此文档描述前后端之间关于“存读档（save/load）”与“结算个性报告（personality report）”相关的 HTTP 接口约定与示例请求/响应。内容基于当前前端实现（`frontend/src/service/*.js`、`frontend/src/views/SettlementPage.vue`）整理。

注：文档侧重示例与前端契约（字段名与数据形态），便于后端实现或 mock 对接。

---

## 1. 通用数据约定

- `attributes`：属性对象，键为属性名（字符串），值为整数。
  例如：{ "灵石": 150, "心计": 30 }

- `statuses`：状态对象，扁平键值对，键为状态名（字符串），值可以是字符串、布尔或数值。
  例如：{ "修为": "炼气期三层", "线人网络": true, "美食家称号": "新晋美食家" }

> 说明：`statuses` 在本项目中**不是**嵌套的属性阈值对象（即不是 { "状态名": { ...阈值... } }），而是当前玩家的状态集合（参照 `frontend/src/service/story.mock.js`）。

---

## 2. 存档（Save）接口

### 保存存档（PUT）
- 路径：PUT /api/users/:userId/saves/:workId/:slot
- 描述：将当前游戏进度保存到指定用户与作品的槽位（slot）。
- 参数：
  - `userId`（path） 用户 ID
  - `workId`（path） 作品 ID
  # 存档（Save/Load）与结算个性报告（Variants）API 规范

  本文件详细规范前后端之间关于“存读档（save/load）”与“结算个性报告（personality/settlement report）”的接口契约。

  要点：
  - 存档 payload 使用新的、明确的字段：`chapterIndex`（章节序号）、`sceneId`（场景唯一 id）与 `dialogueIndex`（对话索引）。不再兼容旧的 numeric-only 索引字段。后端实现可按此格式读写并在需要时存储完整故事片段（`storyScenes`）。
  - 个性报告接口采用“后端返回所有候选报告（variants），前端在客户端根据最终 `attributes` 与 `statuses` 选择最合适的报告”的契约。后端仅负责返回候选集与每个候选的匹配条件元数据（用于前端快速筛选或展示候选列表），而不负责最终的显示决策。

  ---

  ## 1. 通用数据约定

  - attributes: { [attrName: string]: number }
    - 示例：

  ```json
  {
    "灵石": 150,
    "心计": 30,
    "才情": 60
  }
  ```

  - statuses: { [statusName: string]: string | boolean | number }
    - 示例：

  ```json
  {
    "修为": "炼气期三层",
    "线人网络": true,
    "美食家称号": "新晋美食家"
  }
  ```

  语义说明：
  - `attributes` 为数值属性；`statuses` 为扁平的状态集合（不是状态模板或阈值定义）。
  - 存档 payload 不再携带完整的 `storyScenes`。前端与后端仅需约定用于定位的 `chapterIndex`、`sceneId` 与 `dialogueIndex`。如果需要回放完整场景内容，应通过单独的场景同步或按需请求获取。

  ---

  ## 2. 存档 API（明确使用新字段）

  ### 2.1 保存存档（PUT）

  - 路径：PUT /api/users/:userId/saves/:workId/:slot
  - 描述：保存指定用户/作品/槽位的完整存档（payload 内包含新的 `chapterIndex` / `sceneId` / `dialogueIndex`）。

  请求体（JSON）示例（完整示例）：

  ```json
  {
    "workId": "work_001",
    "slot": "slot1",
    "data": {
      "work": { "id": "work_001", "title": "锦瑟深宫", "coverUrl": "/images/cover.jpg" },
     "chapterIndex": 2,
     "sceneId": "1003",
     "dialogueIndex": 1,
      "attributes": { "灵石": 150, "心计": 30, "才情": 60 },
      "statuses": { "修为": "炼气期三层", "线人网络": true },
      "choiceHistory": [
        { "sceneId": "1002", "choiceId": "c_123", "choiceText": "应允" }
      ],
      "timestamp": 1690500000000
    }
  }
  ```

  响应示例（成功）

  ```json
  { "ok": true }
  ```

  说明：后端只需把外层 `data` 原样持久化（可做校验），并返回成功指示即可。前端会把保存结果展示给用户。

  ### 2.2 读取存档（GET）

  - 路径：GET /api/users/:userId/saves/:workId/:slot
  - 描述：返回指定槽位的完整存档（如果存在）。

  响应示例（存在存档）

  ```json
  {
    "data": {
      "work": { "id": "work_001", "title": "锦瑟深宫" },
      "chapterIndex": 2,
      "sceneId": "1003",
      "dialogueIndex": 1,
      "attributes": { "灵石": 150, "心计": 30, "才情": 60 },
      "statuses": { "修为": "炼气期三层", "线人网络": true },
      "choiceHistory": [ /* ... */ ],
      "timestamp": 1690500000000
    }
  }
  ```

  如果不存在，请返回 HTTP 404（前端将把该槽视为空位）。

  注意：本规范不再要求后端返回旧的 `currentSceneIndex/currentDialogueIndex` 字段。前端已经按 `sceneId` 与 `dialogueIndex` 进行定位并恢复阅读位置。

  ### 2.3 批量列出存档（可选）

  - 路径建议：GET /api/users/:userId/saves/:workId
  - 作用：返回该作品下所有槽位的摘要（用于存档列表/预览）。

  建议响应示例：

  ```json
  {
    "saves": [
      {
        "slot": "slot1",
        "timestamp": 1690500000000,
        "chapterIndex": 2,
        "sceneId": "1003",
        "dialogueIndex": 1
      },
      { "slot": "slot2", "timestamp": 1690400000000 }
    ]
  }
  ```

  ### 2.4 删除存档（DELETE）

  - 路径：DELETE /api/users/:userId/saves/:workId/:slot
  - 响应示例：

  ```json
  { "ok": true }
  ```

  ---

  ## 3. 结算个性报告（Personality / Settlement Report）—— 后端返回候选 variants

  设计要点：

  - 后端不直接选择最终展示哪一个报告；后端只返回满足业务需要的所有候选报告（variants）以及每个 variant 的元数据（便于前端进行快速筛选、调试或展示候选列表）。
  - 前端负责在收到 variants 后，根据最终 `attributes` 与 `statuses` 在客户端完成匹配并决定展示哪个报告（或在多个匹配时选择优先级最高的）。

  ### 3.1 路径与请求

  - 路径：POST /api/settlement/report
  - 请求体（JSON）示例：

  ```json
  {
    "attributes": { "灵石": 150, "心计": 30, "才情": 60 },
    "statuses": { "修为": "炼气期三层", "线人网络": true }
  }
  ```

  说明：后端可以接受额外参数（例如 model、lang、debug），但最小契约仅需 `attributes` 与 `statuses`。

  ### 3.2 响应契约（variants 列表）

  后端应返回如下结构：

  ```json
  {
    "success": true,
    "reports": [
      {
        "id": "v_royalist_mastermind",
        "title": "深宫谋士",
        "summary": "善于谋略与人际运作",
        "minAttributes": { "心计": 40 },
        "requiredStatuses": ["线人网络"],
        "report": {
          "title": "深宫谋士",
          "content": "你行事缜密，擅长通过蛛丝马迹改变局势...",
          "traits": ["善于谋划","察言观色"],
          "scores": { "智谋": 92 }
        }
      },
      {
        "id": "v_merchant_entrepreneur",
        "title": "商海奇才",
        "summary": "擅长经商与资源运作",
        "minAttributes": { "灵石": 100, "商业头脑": 15 },
        "requiredStatuses": [],
        "report": { "title": "商海奇才", "content": "你在利益面前如鱼得水..." }
      },
      {
        "id": "v_default",
        "title": "平凡之路",
        "summary": "通用回退报告",
        "report": { "title": "平凡之路", "content": "你的结局平静而踏实..." }
      }
    ]
  }
  ```

  字段说明：

  - `reports`：候选报告数组（由后端生成并返回）。
  - 每个 candidate（variant）包含：
    - `id`：唯一标识符（字符串），便于前端日志/调试；
    - `title` / `summary`：供前端展示候选摘要；
    - `minAttributes`（可选）：若存在，则表示该 variant 需要满足若干属性阈值（所有列举的键均需满足）；
    - `requiredStatuses`（可选）：若存在，表示玩家必须拥有这些状态（状态名数组）之一或全部，具体语义在双方约定；建议语义为“所有列出的 requiredStatuses 都必须存在且为真/非空”；
    - `report`：实际要展示的报告对象（title/content/traits/scores 等任意字段），前端最终将展示该对象的 `title` 与 `content`。

  匹配策略（前端）：

  - 前端会按 `reports` 数组的顺序（或使用 `priority` 字段）遍历并选取第一个满足条件的 variant。默认匹配规则：
    1. 若 variant 含 `minAttributes`，则对照请求体 `attributes`，要求所有键满足 >= 指定数值；
    2. 若 variant 含 `requiredStatuses`，则要求请求体 `statuses` 包含所有列出的键且其值为真/非空（或与 variant 约定的具体值相等）；
    3. 当同时存在 `minAttributes` 与 `requiredStatuses` 时，两者都必须满足；
    4. 若没有任何 variant 匹配，则选择 id 为 `v_default`（或数组最后一个作为回退）。

  示例：当属性为 { 心计: 50, 灵石: 120 } 且 statuses 包含 `线人网络` 时，上面例子中的 `v_royalist_mastermind` 与 `v_merchant_entrepreneur` 都可能满足；前端会按后端返回的顺序或显式 `priority` 决定最终呈现哪个。

  ### 3.3 错误与调试输出

  - 如果后端在生成 variants 时发生错误，请返回 HTTP 500 或 `{"success": false, "error": "..."}`。
  - 建议在开发阶段返回 `debug` 字段（可选），列出每个 variant 的匹配布尔值，便于前端调试。例如：

  ```json
  {
    "success": true,
    "reports": [ ... ],
    "debug": {
      "checked": [
        { "id": "v_royalist_mastermind", "matched": false, "reason": "心计(30) < 40" }
      ]
    }
  }
  ```

  ---

  ## 4. 推荐的后端示例（Express）

  下面给出一个最小的示例：当后端尚未实现完整规则引擎时，可以先返回固定的 `reports` 数组（variants），前端负责匹配。把这个文件放置于 `backend/src/routes/settlement.js` 并在主 app 中挂载。

  示例实现（Express，Node.js）：

  ```js
  // backend/src/routes/settlement.js
  const express = require('express')
  const router = express.Router()

  // 简单的候选集（生产中请替换为更完善的规则引擎或数据库定义）
  const VARIANTS = [
    {
      id: 'v_royalist_mastermind',
      title: '深宫谋士',
      summary: '善于谋略与人际运作',
      minAttributes: { '心计': 40 },
      requiredStatuses: ['线人网络'],
      report: { title: '深宫谋士', content: '你行事缜密，擅长通过蛛丝马迹改变局势...' }
    },
    {
      id: 'v_merchant_entrepreneur',
      title: '商海奇才',
      summary: '擅长经商与资源运作',
      minAttributes: { '灵石': 100, '商业头脑': 15 },
      requiredStatuses: [],
      report: { title: '商海奇才', content: '你在利益面前如鱼得水...' }
    },
    {
      id: 'v_default',
      title: '平凡之路',
      summary: '通用回退报告',
      report: { title: '平凡之路', content: '你的结局平静而踏实...' }
    }
  ]

  router.post('/report', (req, res) => {
    try {
      const { attributes = {}, statuses = {} } = req.body || {}
      // 这里示例返回所有 variants；前端负责匹配
      return res.json({ success: true, reports: VARIANTS })
    } catch (err) {
      console.error('settlement report error', err)
      return res.status(500).json({ success: false, error: err.message })
    }
  })

  module.exports = router
  ```

  如何挂载：在主程序（例如 `backend/src/app.js`）中：

  ```js
  const settlement = require('./routes/settlement')
  app.use('/api/settlement', settlement)
  ```

  说明：上例将 `/api/settlement/report` 映射到此路由。

  ---

  ## 5. 前端行为说明（基于现有实现）

  - 前端会在结算页组装一个最小请求体 `{ attributes, statuses }` 并 POST 到 `/api/settlement/report`。
  - 若后端返回 `{ success: true, reports: [...] }`，前端会在本地按约定匹配规则（参见第 3.2 节）从 `reports` 中选出第一个匹配的 variant，并展示其 `report` 内容。
  - 若网络失败或后端响应不可用，前端会回退到内置的 `personality.mock.js`（mock 同样返回 variants 并使用相同的匹配逻辑）。

  ---

  ## 6. 调试与验证建议（详细步骤）

  1. 在后端实现并启动路由后，使用 curl 或 Postman 发送示例请求：

  ```bash
  curl -X POST "http://localhost:3000/api/settlement/report" \
    -H "Content-Type: application/json" \
    -d '{ "attributes": { "灵石": 120, "心计": 45 }, "statuses": { "线人网络": true } }'
  ```

  预期：返回包含 `reports` 的 JSON，至少包含 `v_default`。

  2. 在前端结算页（`/settlement`）打开 Browser Console：观察前端打印的请求参数与最终选中的 report（SettlementPage.vue 在开发时会记录 debug 日志）。

  3. 如需调试匹配行为，在后端响应中加入 `debug` 字段（如第 3.3 节所示），或在前端打印每个 variant 的匹配结果以定位规则不匹配的原因。

  ---

  ## 7. 代码位置参考

  - 前端：
    - `frontend/src/utils/saveLoad.js` —— 存档读写封装（新格式）
    - `frontend/src/service/save.js` —— HTTP 层调用（PUT/GET/DELETE）
    - `frontend/src/service/personality.js` —— 请求 `/api/settlement/report` 并回退 mock
    - `frontend/src/service/personality.mock.js` —— 内置 variants 与匹配逻辑（用于离线或后端未就绪场景）
    - `frontend/src/views/SettlementPage.vue` —— 发起请求并展示最终 report

  - 后端：
    - 推荐增加：`backend/src/routes/settlement.js`（或 `personality.js`），提供 `/api/settlement/report`。

  ---

  如需我代写一个更完整的后端规则引擎（例如使用 JSON 配置的 template + 优先级/权重），我可以继续实现并附带单元测试；或者我可立即在 `backend/src/routes/settlement.js` 中提交上面的示例实现。请选择下一步（例如："生成后端示例路由并运行简单测试" 或 "仅保存文档"）。