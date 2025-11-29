## 2. 存档（Save）接口

### 保存存档（PUT）
- 路径：PUT /api/users/:userId/saves/:workId/:slot
- 描述：将当前游戏进度保存到指定用户与作品的槽位（slot）。
- 参数：
  - `userId`（path） 用户 ID
  - `workId`（path） 作品 ID

请求体（JSON）示例（完整示例）：

  ```json
  {
    "workId": 123,
    "slot": "slot1",
    "data": {
      "work": {"title": "存档_锦瑟深宫", "coverUrl": "/images/cover.jpg" },
      "chapterIndex": 2,
      "sceneId": 123,
      "dialogueIndex": 1,
      "attributes": { "灵石": 150, "心计": 30, "才情": 60 },
      "statuses": { "修为": "炼气期三层", "线人网络": true },
      "choiceHistory": [
        {"chapterIndex":1, "sceneId": 122, "choiceId": "c_123", "choiceText": "应允" }
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
      "work": { "title": "存档_锦瑟深宫" },
      "chapterIndex": 2,
      "sceneId": 123,
      "dialogueIndex": 1,
      "attributes": { "灵石": 150, "心计": 30, "才情": 60 },
      "statuses": { "修为": "炼气期三层", "线人网络": true },
      "choiceHistory": [ /* ... */ ],
      "timestamp": 1690500000000
    }
  }
  ```

  如果不存在，请返回 HTTP 404（前端将把该槽视为空位）。

  ### 2.3 批量列出存档

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
        "sceneId": 123,
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

  - 路径：POST /api/settlement/report/:workId
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




  ## 6. 调试与验证建议（详细步骤）

  1. 在后端实现并启动路由后，使用 curl 或 Postman 发送示例请求：

  ```bash
  curl -X POST "http://localhost:3000/api/settlement/report" \
    -H "Content-Type: application/json" \
    -d '{ "attributes": { "灵石": 120, "心计": 45 }, "statuses": { "线人网络": true } }'
  ```
