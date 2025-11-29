# 创作者/阅读者流程 API 说明（示例）

本文档汇总前端与后端在“阅读者 / 创作者”身份选择下的接口约定（示例），供前端与后端对接参考。

## 1) 创建作品（Create）

- 方法：POST
- 路径：/api/game/create/
- 描述：根据前端提供的请求创建作品；当 `modifiable=true` 时，后端返回章节大纲（chapterOutlines）用于创作者在前端编辑；当 `modifiable=false`（或不提供）时，后端可直接生成并返回首章数据或作品元信息。

- 请求体示例：
```json
{
  "tags": ["玄幻","穿越","系统"],
  "idea": "主角穿越并获得系统",
  "length": "medium",
  "modifiable": true
}
```

- 成功响应（创作者模式，返回章节大纲示例）：
```json
{
  "gameworkId": 123,
  "title": "仙途：我的系统有点坑",
  "coverUrl": "/media/covers/xxx.jpg",
  "description": "简介...",
  "initialAttributes": { "灵石": 1000 },
  "initialStatuses": { "修为": "炼气期三层" },
  "total_chapters": 5,
  "chapterOutlines": [
    { "chapterIndex": 1, "outline": "主角穿越..." },
    { "chapterIndex": 2, "outline": "坊市篇..." }
  ]
}
```

- 成功响应（阅读者模式，返回作品元信息或首章数据，行为与现有 API 保持一致）：
```json
{
  "gameworkId": 123,
  "title": "仙途：我的系统有点坑",
  "coverUrl": "/media/covers/xxx.jpg",
  "description": "简介...",
  "initialAttributes": { "灵石": 1000 },
  "initialStatuses": { "修为": "炼气期三层" },
  "total_chapters": 5
}
```

## 2) 触发章节生成（仅在创作者模式下调用）

- 方法：POST
- 路径：/api/game/chapter/generate/{gameworkId}/{chapterIndex}/
- 描述：前端在创作者编辑并确认本章大纲后，调用该接口让后端基于最终大纲与 userPrompt 生成本章剧情。

- 请求体示例：
```json
{
  "chapterOutlines": [
    { "chapterIndex": 1, "outline": "..." },
    { "chapterIndex": 2, "outline": "..." }
  ],
  "userPrompt": "在这一章加入一个傲娇但实力强的女配角"
}
```

- 成功响应示例：
```json
{ "ok": true }
```

后续前端仍通过 `GET /api/game/chapter/{gameworkId}/{chapterIndex}/` 拉取生成结果（status: generating/ready）。

## 3) 获取章节（与现有接口保持一致）

- 方法：GET
- 路径：/api/game/chapter/{gameworkId}/{chapterIndex}/
- 描述：获取指定章节的生成进度或生成后的章节内容（status: pending|generating|ready|error）。

## 4) 保存手动修改后的章节（可选）

- 方法：PUT
- 路径：/api/game/chapter/{gameworkId}/{chapterIndex}/
- 描述：将创作者在前端手动修改并确认后的章节内容持久化到后端数据库（覆盖式）。

- 请求体示例：
```json
{
  "chapterIndex": 2,
  "title": "第二章：坊市奇谋与傲娇剑仙",
  "scenes": [ /* 场景数组 */ ]
}
```

- 成功响应示例：
```json
{ "ok": true }
```

---

说明：以上为前端与后端约定示例。前端会在创建时发送 `modifiable` 字段以告知用户选择的身份：
- 阅读者（modifiable=false）：按现有流程与后端连续生成场景并直接进入阅读体验；
- 创作者（modifiable=true）：后端返回章节大纲，前端展示大纲供创作者修改；创作者确认后前端调用章节生成接口发起生成，等待后端生成并通过 GET 拉取章节内容。

如果需要我可以根据你的后端实际接口（Django 路由与认证）把示例的路径和鉴权头部调整为精确格式。