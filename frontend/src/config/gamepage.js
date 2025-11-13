import { ref } from 'vue'

// ---- 保存/读档后端集成配置 ----
// 开启后优先尝试调用后端 API 保存/读取；若后端不可用则回退到 localStorage。
// 关闭 mock 后，前端将直接调用后端接口以进行集成测试。
export const USE_BACKEND_SAVE = true
export const USE_MOCK_SAVE = false
// 是否启用故事内容的本地 mock（后端暂未就绪时）
export const USE_MOCK_STORY = false

// 测试开关：强制在进入游戏前以创作者身份（作品创建者）显示大纲编辑器（用于本地 AI 交互调试）
export const FORCE_CREATOR_FOR_TEST = false


// 区分两种身份相关开关：
// - isCreatorIdentity: 当前进入游戏的身份是否为作品创建者（用于自动在每一章前弹出可编辑大纲）
// - creatorMode: 菜单中的手动创作者模式开关（用户手动在菜单中切换，用于启用页面上的手动编辑功能）
export const isCreatorIdentity = ref(FORCE_CREATOR_FOR_TEST)

// 编辑器调用来源：'auto'（自动在章节前弹出，可编辑并可触发生成）或 'manual'（由浮动按钮打开，默认只读，除非菜单 creatorMode 打开）
export const editorInvocation = ref('manual')


// 是否允许创作者相关的 AI 生成功能（由 createResult.modifiable 与后端 backendWork.ai_callable 共同决定）
export const creatorFeatureEnabled = ref(false)
// 是否从 createResult/后端标记为可手动编辑（modifiable 字段），用于允许菜单手动进入创作者模式
export const modifiableFromCreate = ref(false)

