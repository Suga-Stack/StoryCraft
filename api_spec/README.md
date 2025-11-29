# StoryCraft 后端流式消息规范（api_spec）

本目录包含前后端在流式（SSE / WebSocket / NDJSON-by-line）场景下交换的最小 JSON 模板、示例和说明。目标是：前端可以在收到第一章或当前章的内容后立即渲染，同时后端可以异步生成并推送后续章节或分支。

核心原则
- 每条消息都包含公共字段：`type`（消息类型）、`seq`（单调递增序号）、`workId`（作品 ID）、可选 `timestamp` 和 `note`。
- 主要消息类型：`work_meta`、`scene`、`choice_effect`、`mainline`、`special_event`、`end`、`report`。
- 选项分支必须以独立的 `scene` 消息推送（或作为 `choice_effect` 下的 `nextScenes`），但在每个选项剧情结束后，流必须回到主线（即推送 `mainline` 类型的消息来继续主线），而不是在每个选项下分别持续覆盖主线。
- 后端应保证 seq 单调递增，便于前端合并与重连。

消息类型简介
- work_meta：作品元数据，封面、标题、简介、标签。至少在前端进入作品页时推送一次。
- scene：一段场景（场景内包含多条对话 `dialogues`），可携带 `backgroundImage`、`choiceTriggerIndex`（指示在哪条对话后出现选项）。
- choice_effect：当到达选项点时推送可选项数组，每个选项带 `id`、`text`、`attributesDelta`（属性变化）、`statusesDelta`（状态变化）、`nextScenes`（可选的分支场景数组，后端可直接内嵌分支的后续 `scene` 对象以便前端立即渲染）。
- mainline：主线推进的一段 `scene`（用于“选项剧情完成后回到主线”的情形）。
- special_event：特殊剧情/判定，带条件 `condition`（基于属性/状态），后端可返回 `resultIfMet` / `resultIfNotMet` 两种分支方案。
- end：本次流的临时结点（例如本章结束或流已完成）。
- report：最终结算报告（最终属性、状态与可读的个人报告数组）。

传输建议
- SSE（EventSource）：适合单向从服务端到客户端的流式推送，支持自动重连。可将每条消息作为一个 `data:` 行或多行 NDJSON 条目。
- WebSocket：如果后端或前端需要双向低延迟交互（例如在线多人或即时选择确认），可使用 WebSocket，消息体格式同 JSON 模板。
- NDJSON：将每个 JSON 事件写为一行，适合通过简单的 HTTP 流（chunked）返回。

重连与可恢复性
- 使用 `seq` 字段与 `workId` 做重连恢复：客户端在重连时带上最后收到的 `seq`，后端应从下一个 seq 开始推送或提供补充差集。
- 可选：后端提供 `resumeAfterSeq` 查询参数或在 SSE 握手中返回当前最新 `seq`。

关于“选择分支与主线回归”的约定（重要）
1. 当用户在 `scene` 中触发选项（`choiceTriggerIndex`）时，后端推送 `choice_effect` 消息包含候选选项。
2. 用户选择后，后端应推送该选项对应的分支场景（`scene` 或内嵌在 `choice_effect.nextScenes`），分支剧情可包含若干 `scene` 消息或直接内嵌在 `choice_effect` 的 `nextScenes` 数组中。
3. 分支剧情完成后，后端必须显式推送一条 `mainline` 消息（带新的 `scene` 内容）以恢复主线。
   - 这样前端不会把主线视为在每个选项下被单独“替换”，主线仍然保持单一时间线并继续推进。

示例流程
1) work_meta
2) scene （序章）
3) scene （到达选项点）
4) choice_effect（推送多个选项）
5) scene（分支 A 的一段）
6) scene（分支 A 结束）
7) mainline（回到主线）
8) special_event（基于属性判定的突发事件）
9) end
10) report

文件说明
- `stream_schema.json`：用于验证后端发出的单条消息是否契合约定（可被后端/前端用来 debug）。
- `stream_templates.ndjson`：示例 NDJSON 流，展示一个完整的故事流（包含分支及回归主线示例）。
- 本 README：规范和说明。

若需我把 `backend/mock_server/server.js` 也生成一个配合示例（Node + express + SSE），我可以直接创建并在仓库中加入运行说明。要我继续吗？
