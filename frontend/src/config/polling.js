// 轮询与超时配置（可通过 Vite 环境变量覆盖）

// 读取数值型环境变量的工具函数
const numFromEnv = (key, fallback) => {
  const raw = import.meta?.env?.[key]
  const n = raw != null ? Number(raw) : NaN
  return Number.isFinite(n) && n > 0 ? n : fallback
}

// 创建作品后轮询作品详情（是否 ready）
export const POLL_DETAILS_INTERVAL_MS = numFromEnv('VITE_POLL_DETAILS_INTERVAL_MS', 2000)
// 默认等待 10 分钟（600000ms），原先是 120000ms（2 分钟）
export const POLL_DETAILS_TIMEOUT_MS = numFromEnv('VITE_POLL_DETAILS_TIMEOUT_MS', 600000)

// 剧情章节获取的轮询参数
// 每次重试间隔，默认 5 秒
export const STORY_RETRY_INTERVAL_MS = numFromEnv('VITE_STORY_RETRY_INTERVAL_MS', 5000)
// 最大重试次数，默认 120 次（约 10 分钟）
export const STORY_MAX_RETRIES = numFromEnv('VITE_STORY_MAX_RETRIES', 120)

// GamePage 初始化时等待场景就绪的最大重试次数（每秒一次）
// 默认 300 次（约 5 分钟），原先是 120 次（约 2 分钟）
export const INITIAL_SCENES_MAX_RETRIES = numFromEnv('VITE_INITIAL_SCENES_MAX_RETRIES', 300)

export default {
  POLL_DETAILS_INTERVAL_MS,
  POLL_DETAILS_TIMEOUT_MS,
  STORY_RETRY_INTERVAL_MS,
  STORY_MAX_RETRIES,
  INITIAL_SCENES_MAX_RETRIES,
}
