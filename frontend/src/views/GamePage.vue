<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import './GamePage.css'
import { useRouter, useRoute } from 'vue-router'
import { ScreenOrientation } from '@capacitor/screen-orientation'

// ---- 保存/读档后端集成配置 ----
// 开启后优先尝试调用后端 API 保存/读取；若后端不可用则回退到 localStorage。
// 关闭 mock 后，前端将直接调用后端接口以进行集成测试。
const USE_BACKEND_SAVE = false
const USE_MOCK_SAVE = true
// 是否启用故事内容的本地 mock（后端暂未就绪时）
const USE_MOCK_STORY = false

import * as storyService from '../service/story.js'

// 本地引用，允许在运行时替换为 mock 实现
let getScenes = storyService.getScenes
// 在 onMounted 流程中，如果我们使用本地 mock 获取到了初始场景，需要强制展示加载界面一段时间
let didLoadInitialMock = false

// 在支持 top-level await 的环境下（Vite/ESM），若开启 mock，优先加载本地 mock 模块
// （注意）mock 模块的按需加载会在组件挂载时异步执行，避免在 script setup 顶层使用 await 导致 async setup

// 注意：已移除关键词占位背景映射，界面仅显示后端/场景提供的图片

// 获取当前用户 ID 的策略：
// 1. 首选 window.__STORYCRAFT_USER__?.id（由后端渲染或认证层注入）
// 2. 其次使用 window.__STORYCRAFT_AUTH_TOKEN__ 解码（如果你有 JWT，可从中解析 sub）——这里不实现 JWT 解码。
// 3. 最后回退到本地生成并保存的匿名 user id（仅用于本地测试，不适合生产跨设备共享）。
const getCurrentUserId = () => {
  try {
    if (window.__STORYCRAFT_USER__ && window.__STORYCRAFT_USER__.id) return window.__STORYCRAFT_USER__.id
  } catch (e) {}
  // 如果页面里注入了 auth token（例如：window.__STORYCRAFT_AUTH_TOKEN__），建议后端在服务端返回 userId 给前端
  const key = 'storycraft_user_id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = 'anon-' + generateUUID()
    localStorage.setItem(key, id)
  }
  return id
}

const generateUUID = () => {
  // 简单的 UUID v4 生成器（适合前端唯一标识）
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// 新增初始化函数
const initializeGame = async () => {
  isLoading.value = true
  loadingProgress.value = 0
  
  try {
    // 若启用本地 mock，则在组件挂载时异步加载 mock 实现
    if (USE_MOCK_STORY) {
      try {
        const mock = await import('../service/story.mock.js')
        getScenes = mock.getScenes
        try { window.__USE_MOCK_STORY__ = true } catch (e) {}
      } catch (e) {
        console.warn('加载 story.mock.js 失败，将回退到真实 service：', e)
      }
    }
    
    let initOk = false
    try {
      const ok = await initFromCreateResult()
      initOk = !!ok
      if (!ok) {
        // 没有来自创建页的首章，尝试获取第一章
        if (USE_MOCK_STORY && typeof getScenes === 'function') {
          try {
            const resp = await getScenes(work.value.id, 1)
            const initial = (resp && resp.scenes) ? resp.scenes : (Array.isArray(resp) ? resp : [])
            if (Array.isArray(initial) && initial.length > 0) {
              storyScenes.value = []
              for (const s of initial) {
                if (s && Array.isArray(s.choices)) {
                  const seen = new Set()
                  s.choices = s.choices.filter(c => {
                    const id = c?.id ?? JSON.stringify(c)
                    if (seen.has(id)) return false
                    seen.add(id)
                    return true
                  })
                }
                storyScenes.value.push(s)
              }
              try { didLoadInitialMock = true } catch (e) {}
              currentSceneIndex.value = 0
              currentDialogueIndex.value = 0
              currentChapterIndex.value = 1
            } else {
              // mock 未返回初始场景，回退到后端请求
              await fetchNextChapter(work.value.id, 1)
            }
          } catch (e) {
            console.warn('getInitialScenes failed, fallback to fetchNextChapter', e)
            await fetchNextChapter(work.value.id, 1)
          }
        } else {
          await fetchNextChapter(work.value.id, 1)
        }
      }
    } catch (e) { 
      console.warn('initFromCreateResult failed', e)
      // 如果 initFromCreateResult 失败，尝试直接获取第一章
      try {
        await fetchNextChapter(work.value.id, 1)
      } catch (err) {
        console.warn('fetchNextChapter failed in initializeGame', err)
      }
    }

    // 绑定退出处理
    try {
      await ScreenOrientation.lock({ type: 'portrait' }).catch(() => {})
    } catch (e) {}

    // 关键修改：确保有场景数据后再关闭加载界面
    let retryCount = 0
    const maxRetries = 10 // 最多重试10次，每次等待500ms
    
    while ((!Array.isArray(storyScenes.value) || storyScenes.value.length === 0) && retryCount < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 500))
      retryCount++
      console.log(`等待场景数据加载... 重试 ${retryCount}/${maxRetries}`)
    }

    // 如果仍然没有场景，使用一个默认场景避免黑屏
    if (!Array.isArray(storyScenes.value) || storyScenes.value.length === 0) {
      console.warn('No scenes loaded, using fallback scene')
      storyScenes.value = [{
        sceneId: 'fallback',
        backgroundImage: work.value.coverUrl || 'https://picsum.photos/1920/1080?random=1',
        dialogues: ['故事正在加载中，请稍候...']
      }]
    }

    // 现在可以安全关闭加载界面
    await simulateLoadTo100(800) // 使用平滑加载完成动画
    
  } catch (error) {
    console.error('Initialize game failed:', error)
    // 即使出错也要确保有场景显示
    if (!Array.isArray(storyScenes.value) || storyScenes.value.length === 0) {
      storyScenes.value = [{
        sceneId: 'error',
        backgroundImage: work.value.coverUrl || 'https://picsum.photos/1920/1080?random=1',
        dialogues: ['故事加载失败，请返回重试。']
      }]
    }
    await simulateLoadTo100(500)
  }
}

// 后端接口约定（前端将按下列约定调用）：
// 保存（PUT）：/api/users/{userId}/saves/{workId}/{slot}
//   Body: { workId, slot, data: {...payload...} }
//   Response: 200 OK 或 201 Created
// 读取（GET）：/api/users/{userId}/saves/{workId}/{slot}
//   Response: { data: {...payload...}, timestamp }
// 如果你的后端使用不同路径或认证，请参考下方 README 配置并告知后端。

const backendSave = async (userId, workId, slot, data) => {
  if (USE_MOCK_SAVE) return mockBackendSave(userId, workId, slot, data)
  // 如果 userId 不是数字（例如本地匿名 id 'anon-...')，后端路由可能期望整数型 userId，直接回退到 local mock 保存以避免 404
  try {
    if (!String(userId).match(/^\d+$/)) {
      console.warn('backendSave: non-numeric userId, falling back to mockBackendSave:', userId)
      return mockBackendSave(userId, workId, slot, data)
    }
  } catch (e) {}
  // 支持在开发环境通过 VITE_API_BASE 或 window 全局变量指定后端地址，避免相对路径被 vite dev server 拦截
  const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE)
    ? import.meta.env.VITE_API_BASE
    : (window.__STORYCRAFT_API_BASE__ || 'http://localhost:8000')
  const base = String(API_BASE).replace(/\/$/, '')
  const url = `${base}/api/users/${encodeURIComponent(userId)}/saves/${encodeURIComponent(workId)}/${encodeURIComponent(slot)}`
  const body = { workId, slot, data }
  const headers = { 'Content-Type': 'application/json' }
  // 如果页面注入了 token，请添加 Authorization
  if (window.__STORYCRAFT_AUTH_TOKEN__) headers['Authorization'] = `Bearer ${window.__STORYCRAFT_AUTH_TOKEN__}`
  const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(txt || res.statusText)
  }
  return res.json().catch(() => ({}))
}

const backendLoad = async (userId, workId, slot) => {
  if (USE_MOCK_SAVE) return mockBackendLoad(userId, workId, slot)
  // 与 backendSave 保持一致：如果 userId 不是数字，回退到本地 mock 读取以避免向后端发送不匹配的 URL
  try {
    if (!String(userId).match(/^\d+$/)) {
      console.warn('backendLoad: non-numeric userId, falling back to mockBackendLoad:', userId)
      return mockBackendLoad(userId, workId, slot)
    }
  } catch (e) {}
  const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE)
    ? import.meta.env.VITE_API_BASE
    : (window.__STORYCRAFT_API_BASE__ || 'http://localhost:8000')
  const base = String(API_BASE).replace(/\/$/, '')
  const url = `${base}/api/users/${encodeURIComponent(userId)}/saves/${encodeURIComponent(workId)}/${encodeURIComponent(slot)}`
  const headers = {}
  if (window.__STORYCRAFT_AUTH_TOKEN__) headers['Authorization'] = `Bearer ${window.__STORYCRAFT_AUTH_TOKEN__}`
  const res = await fetch(url, { method: 'GET', headers })
  if (res.status === 404) return null
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(txt || res.statusText)
  }
  const obj = await res.json()
  // 兼容返回格式 { data: {...}, timestamp }
  return obj && obj.data ? obj.data : obj
}

const backendDelete = async (userId, workId, slot) => {
  if (USE_MOCK_SAVE) return mockBackendDelete(userId, workId, slot)
  // 如果 userId 不是数字，回退到本地 mock 删除
  try {
    if (!String(userId).match(/^\d+$/)) {
      console.warn('backendDelete: non-numeric userId, falling back to mockBackendDelete:', userId)
      return mockBackendDelete(userId, workId, slot)
    }
  } catch (e) {}
  // 支持在开发环境通过 VITE_API_BASE 或 window 全局变量指定后端地址
  const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE)
    ? import.meta.env.VITE_API_BASE
    : (window.__STORYCRAFT_API_BASE__ || 'http://localhost:8000')
  const base = String(API_BASE).replace(/\/$/, '')
  const url = `${base}/api/users/${encodeURIComponent(userId)}/saves/${encodeURIComponent(workId)}/${encodeURIComponent(slot)}`
  const headers = { 'Content-Type': 'application/json' }
  // 如果页面注入了 token，请添加 Authorization
  if (window.__STORYCRAFT_AUTH_TOKEN__) headers['Authorization'] = `Bearer ${window.__STORYCRAFT_AUTH_TOKEN__}`
  const res = await fetch(url, { method: 'DELETE', headers })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(txt || res.statusText)
  }
  return res.json().catch(() => ({}))
}

// 简单的 mock 实现（基于 localStorage），用于后端尚未就绪时的本地联调
const mockBackendKey = (userId) => `storycraft_mock_saves_${userId}`
const mockBackendSave = async (userId, workId, slot, data) => {
  const mapRaw = localStorage.getItem(mockBackendKey(userId)) || '{}'
  const map = JSON.parse(mapRaw)
  map[`${workId}::${slot}`] = { data, timestamp: Date.now() }
  localStorage.setItem(mockBackendKey(userId), JSON.stringify(map))
  // 模拟网络延迟
  await new Promise(r => setTimeout(r, 120))
  return { ok: true }
}
const mockBackendLoad = async (userId, workId, slot) => {
  const mapRaw = localStorage.getItem(mockBackendKey(userId)) || '{}'
  const map = JSON.parse(mapRaw)
  const entry = map[`${workId}::${slot}`]
  await new Promise(r => setTimeout(r, 120))
  return entry ? entry.data : null
}

const mockBackendDelete = async (userId, workId, slot) => {
  const mapRaw = localStorage.getItem(mockBackendKey(userId)) || '{}'
  const map = JSON.parse(mapRaw)
  delete map[`${workId}::${slot}`]
  localStorage.setItem(mockBackendKey(userId), JSON.stringify(map))
  await new Promise(r => setTimeout(r, 120))
  return { ok: true }
}

const router = useRouter()
const route = useRoute()

// 加载状态
const isLoading = ref(true)
const loadingProgress = ref(0)
// 保证可控的从当前进度平滑到 100% 的视觉动画（用于内容已就绪但仍需展示加载动画的场景）
// 保证可控的从当前进度平滑到 100% 的视觉动画（用于内容已就绪但仍需展示加载动画的场景）
const simulateLoadTo100 = async (duration = 900) => {
  try {
    // 停掉任何 startLoading 的定时器，交由本函数以匀速完成
    try { if (startLoading._timer) { clearInterval(startLoading._timer); startLoading._timer = null } } catch (e) {}
    isLoading.value = true
    const start = Number(loadingProgress.value) || 0
    const remain = Math.max(0, 100 - start)
    if (remain <= 0) {
      // 立即完成
      loadingProgress.value = 100
      await new Promise(r => setTimeout(r, 120))
      isLoading.value = false
      showText.value = true
      setTimeout(() => { try { loadingProgress.value = 0 } catch (e) {} }, 120)
      return
    }
    const stepMs = 30
    const steps = Math.max(1, Math.ceil(duration / stepMs))
    const per = remain / steps
    return await new Promise(resolve => {
      let cnt = 0
      const t = setInterval(() => {
        cnt++
        loadingProgress.value = Math.min(100, +(start + per * cnt).toFixed(2))
        if (cnt >= steps || loadingProgress.value >= 100) {
          clearInterval(t)
          setTimeout(() => {
            try { loadingProgress.value = 100 } catch (e) {}
            isLoading.value = false
            showText.value = true
            setTimeout(() => { try { loadingProgress.value = 0 } catch (e) {} }, 120)
            resolve()
          }, 120)
        }
      }, stepMs)
    })
  } catch (e) { 
    console.warn('simulateLoadTo100 failed', e); 
    // 确保无论如何都关闭加载状态
    isLoading.value = false
    showText.value = true
  }
}
// 后续剧情生成/获取状态
const isFetchingNext = ref(false)
const storyEndSignaled = ref(false)
// 横屏准备状态
const isLandscapeReady = ref(false)
// 结算页面生成状态
const isGeneratingSettlement = ref(false)
// 用户选择历史，用于生成分支探索图
const choiceHistory = ref([])
// 防止选项在刚点击后立即被 watch 重新展示的时间戳（ms）
const lastChoiceTimestamp = ref(0)
// 检测是否在 Capacitor 环境中
const isNativeApp = computed(() => {
  return window.Capacitor !== undefined
})

// 作品信息（从路由 state 获取，或从后端获取）
const work = ref({
  id: route.params.id || 1,
  title: history.state?.title || (() => { try { return JSON.parse(sessionStorage.getItem('lastWorkMeta'))?.title } catch { return null } })() || '锦瑟深宫',
  // 封面图仅使用作品页传入或上次缓存，不再回退到网络站点占位图
  coverUrl: history.state?.coverUrl || (() => { try { return JSON.parse(sessionStorage.getItem('lastWorkMeta'))?.coverUrl } catch { return null } })() || '',
  authorId: 'author_001'
})

// 计算用于展示的封面 URL：优先使用完整 URL；若后端返回相对路径则补齐本地开发后端地址；若不存在则返回内置占位图
const effectiveCoverUrl = computed(() => {
  try {
    const raw = work.value.coverUrl || ''
    const defaultImg = 'https://images.unsplash.com/photo-1587614387466-0a72ca909e16?w=1600&h=900&fit=crop'
    if (!raw) return defaultImg
    if (/^https?:\/\//i.test(raw)) return raw
    // 如果是相对路径（例如 /media/xxx），为开发环境补齐后端地址
    return 'http://localhost:8000' + (raw.startsWith('/') ? raw : ('/' + raw))
  } catch (e) {
    return 'https://images.unsplash.com/photo-1587614387466-0a72ca909e16?w=1600&h=900&fit=crop'
  }
})

// 总章节数（由创建作品时后端返回的 total_chapters 或在 createResult 中传入）
const totalChapters = ref(null)

// 记录最后收到的 seq，以便向后端请求下一段或重连
const lastSeq = ref(0)
// 如果后端返回了 streamUrl，则优先使用 SSE
let eventSource = null

// 故事场景数据（后端提供：背景图 + 对应的文字段落）
// 初始不使用本地硬编码剧情，页面应在后端场景加载完毕前保持加载界面。
const storyScenes = ref([])

// NOTE: 原有硬编码示例场景已移除 to ensure we don't show local content before backend provides real scenes.

// 在后续代码中，pushSceneFromServer 会负责把后端场景规范化并推入此数组。

// 如果需要在开发时使用 mock，请启用 USE_MOCK_STORY
// 并确保 mock 的 getScenes 返回初始场景列表。
// const 
//       {
//         id: 'opt_A',
//         text: 'A. 立即叩首：“是嫔妾手笨”',
//         attributesDelta: { '心计': 5, '德妃好感': -3 },
//         statusesDelta: { '谨小慎微': '3日内行动成功率提升' },
//         nextScenes: [
//           {
//             sceneId: 1101,
//             backgroundImage: 'https://picsum.photos/1920/1080?random=1101',
//             dialogues: [
//               '【选项A后续】',
//               '你叩首时额角触及冰凉的青砖，德妃轻笑命人拾起碎瓷。当夜你在灯下抄录《女戒》，发现宣纸遇墨即晕。',
//               '次日借请安之机，你将浸染墨团的纸页呈给德妃过目。德妃指尖掠过晕染的墨痕，忽将整叠宣纸掷进炭盆。',
//               '蓝焰窜起时，她替你扶正鬓边玉簪：“内务府这般怠慢，该敲打。”三日后，送纸太监因私换贡品被杖责，你收到一匣光洁如玉的澄心堂纸。'
//             ]
//           },
//           {
//             sceneId: 1201,
//             backgroundImage: 'https://picsum.photos/1920/1080?random=1201',
//             dialogues: [
//               '————《锦瑟深宫》第二章·御园惊波————',
//               '霜降这日，众妃往御花园赏金桂。德妃扶着你的手走过九曲桥，忽指向湖心：“林选侍可见过红白锦鲤同游？”',
//               '你尚未应答，桥板突然断裂——',
//               { text: '（场景描写）', backgroundImage: 'https://picsum.photos/1920/1080?blur=2&random=7201' },
//               '冰冷湖水裹着残荷淹没口鼻，浮沉间看见德妃绣金凤纹的袖口在栏杆处纹丝不动。对岸贤妃的惊呼被风撕碎，你挣扎时抓住一截枯枝，却见明黄仪仗转过假山。',
//               '无数侍卫跃入水花的巨响中，有人托起你的后颈，龙涎香混着水汽钻进鼻腔。',
//               '【当前危机·A线】德妃俯身时鎏金护甲划过你湿透衣领：“可怜见的，连桥匠都敢怠慢妹妹。”'
//             ]
//           }
//         ]
//       },
//       {
//         id: 'opt_B',
//         text: 'B. 保持举盘姿势：“愿为娘娘重沏”',
//         attributesDelta: { '才情': 8, '健康': -5, '坚韧': 10 },
//         nextScenes: [
//           {
//             sceneId: 1102,
//             backgroundImage: 'https://picsum.photos/1920/1080?random=1102',
//             dialogues: [
//               '【选项B后续】',
//               '你举着茶盘的手纹丝不动，德妃命人续上滚水。第七日清晨你端茶时衣袖滑落，腕间水泡令贤妃惊呼。',
//               '当夜太医送来的药膏带着薄荷凉意，瓷瓶底刻着“景阳宫”小字。',
//               '月光浸透窗棂时，你发现药膏里埋着金疮药药方。院判每月初五会经过御花园采露，而贤妃的堂兄正掌管太医院文书。',
//               '檐下铁马突然叮当作响，你将药方藏进妆匣夹层。'
//             ]
//           },
//           {
//             sceneId: 1202,
//             backgroundImage: 'https://picsum.photos/1920/1080?random=1202',
//             dialogues: [
//               '————《锦瑟深宫》第二章·御园惊波————',
//               '霜降这日，众妃往御花园赏金桂。德妃扶着你的手走过九曲桥，忽指向湖心：“林选侍可见过红白锦鲤同游？”',
//               '你尚未应答，桥板突然断裂——',
//               { text: '（场景描写）', backgroundImage: 'https://picsum.photos/1920/1080?blur=2&random=7202' },
//               '冰冷湖水裹着残荷淹没口鼻，浮沉间看见德妃绣金凤纹的袖口在栏杆处纹丝不动。对岸贤妃的惊呼被风撕碎，你挣扎时抓住一截枯枝，却见明黄仪仗转过假山。',
//               '无数侍卫跃入水花的巨响中，有人托起你的后颈，龙涎香混着水汽钻进鼻腔。',
//               { text: '【当前危机·B线】贤妃递来的姜汤飘着当归气：“本宫瞧着，那桥桩断口倒是齐整。”', speaker: '贤妃' }
//             ]
//           }
//         ]
//       },
//       {
//         id: 'opt_C',
//         text: 'C. 抬眼直视德妃：“娘娘教诲如醍醐灌顶”',
//         attributesDelta: { '心计': 15, '声望': 10, '德妃好感': -10 },
//         statusesDelta: { '锋芒初露': '易被高位妃嫔注意' },
//         nextScenes: [
//           {
//             sceneId: 1103,
//             backgroundImage: 'https://picsum.photos/1920/1080?random=1103',
//             dialogues: [
//               '【选项C后续】',
//               '你抬眼时恰有晨光映在德妃的九翟冠上，她赏的雨过天青茶具当夜便被收进库房。',
//               '三日后太后召见，你跪在慈宁宫金砖上听见佛珠碰撞声。',
//               '缠枝莲香炉飘出的檀香与德妃宫中的龙涎香截然不同。太后腕间沉香木念珠垂落的流穗轻晃，突然问及江南旧事——那是你父亲曾任通判的地方。',
//               '你抬头看见屏风后露出半幅明黄衣角。'
//             ]
//           },
//           {
//             sceneId: 1203,
//             backgroundImage: 'https://picsum.photos/1920/1080?random=1203',
//             dialogues: [
//               '————《锦瑟深宫》第二章·御园惊波————',
//               '霜降这日，众妃往御花园赏金桂。德妃扶着你的手走过九曲桥，忽指向湖心：“林选侍可见过红白锦鲤同游？”',
//               '你尚未应答，桥板突然断裂——',
//               { text: '（场景描写）', backgroundImage: 'https://picsum.photos/1920/1080?blur=2&random=7203' },
//               '冰冷湖水裹着残荷淹没口鼻，浮沉间看见德妃绣金凤纹的袖口在栏杆处纹丝不动。对岸贤妃的惊呼被风撕碎，你挣扎时抓住一截枯枝，却见明黄仪仗转过假山。',
//               '无数侍卫跃入水花的巨响中，有人托起你的后颈，龙涎香混着水汽钻进鼻腔。',
//               { text: '【当前危机·C线】太后掌事宫女塞来暖玉：“皇上方才问起，会凫水的侍卫是哪宫安排的。”', speaker: '掌事宫女' }
//             ]
//           }
//         ]
//       }
//     ]
//   }
// ])

// 将后端 scene 对象（或 firstChapter）加入本地 storyScenes（保持顺序）
// 本函数会把 game-api.md 的 scene 格式（id, backgroundImage, dialogues[{narration, playerChoices}])
// 适配为前端当前使用的内部结构（保留兼容性）：
// - 为旧代码提供 .sceneId 字段
// - 将在 dialogue 内出现的 playerChoices 抽取并放到 scene.choices + scene.choiceTriggerIndex（便于现有渲染逻辑复用）
const pushSceneFromServer = (sceneObj) => {
  try {
    const raw = sceneObj.scene ? sceneObj.scene : sceneObj
    if (!raw) return

    // 标准化 id 字段（支持旧的 sceneId 和新的 id）
    const id = raw.id ?? raw.sceneId ?? (raw.seq ? `seq-${raw.seq}` : Math.floor(Math.random() * 1000000))

  // 背景图：只在 raw.backgroundImage 存在时才拼接后端地址，避免错误拼接导致无效 URL
  const backgroundImage = raw && raw.backgroundImage ? ("http://localhost:8000" + raw.backgroundImage) : (raw && (raw.bg || ''))

    // 转换 dialogues：支持三种输入形式：
    // 1) 字符串数组（旧） -> { text }
    // 2) 对象数组且带有 narration/playerChoices（game-api.md）
    // 3) 对象数组且带有 text/speaker（旧增强形式）
    const dialogues = []
    let extractedChoices = null
    for (let i = 0; i < (raw.dialogues || []).length; i++) {
      const d = raw.dialogues[i]
      if (typeof d === 'string') {
        dialogues.push(d)
      } else if (d && typeof d === 'object') {
        // prefer narration (game-api.md), fall back to text
        const narration = d.narration ?? d.text ?? ''
        // store as object for UI code paths that support object dialogues
        const item = { text: narration }
        if (d.backgroundImage) item.backgroundImage = d.backgroundImage
        if (d.speaker) item.speaker = d.speaker
        // if this dialogue has playerChoices (game-api.md), extract them
        if (Array.isArray(d.playerChoices) && d.playerChoices.length > 0) {
          // map playerChoices to frontend-friendly structure and keep original ids if provided
          const pcs = d.playerChoices.map((c, idx) => ({
            id: c.id ?? `${id}-${i}-${idx}`,
            text: c.text ?? '',
            attributesDelta: c.attributesDelta ?? {},
            statusesDelta: c.statusesDelta ?? {},
            statuses: c.statuses ?? {},
            subsequentDialogues: c.subsequentDialogues ?? []
          }))
          extractedChoices = { index: dialogues.length, choices: pcs }
        }
        dialogues.push(item)
      } else {
        dialogues.push(String(d))
      }
    }

    // assemble normalized scene object for frontend
    const scene = {
      id: id,
      sceneId: id, // 保留旧字段名以兼容旧代码
      backgroundImage,
      dialogues: dialogues,
      isChapterEnding: raw.isChapterEnding ?? raw.chapterEnd ?? false
    }

    // 如果上层响应提供了章节信息，则保留在 scene 上，便于结算页/分支图使用
    if (raw.chapterIndex || raw.chapterIndex === 0) scene.chapterIndex = raw.chapterIndex
    if (raw.chapterTitle || raw.title) scene.chapterTitle = raw.chapterTitle ?? raw.title

    // 如果在 dialogue 中发现了 playerChoices，则将其提升为 scene.choices（旧代码所需）
    if (extractedChoices) {
      scene.choiceTriggerIndex = extractedChoices.index
      scene.choices = extractedChoices.choices
    }

    // 如果后端直接在 scene 层提供 choices（旧 mock 风格），也兼容
    if (Array.isArray(raw.choices) && raw.choices.length > 0) {
      scene.choices = raw.choices.map((c, idx) => ({ id: c.id ?? `${id}-c-${idx}`, text: c.text ?? '', attributesDelta: c.attributesDelta ?? {}, statusesDelta: c.statusesDelta ?? {}, subsequentDialogues: c.subsequentDialogues ?? [] }))
      scene.choiceTriggerIndex = typeof raw.choiceTriggerIndex === 'number' ? raw.choiceTriggerIndex : (scene.dialogues.length - 1)
    }

    // 为避免后端在每章中重用从 1 开始的 sceneId 导致前端判重错误，
    // 我们在将 scene 推入本地队列前先深拷贝并赋予一个内部唯一 id（_uid）。
    // 这样可以保证每一次插入的场景在前端内部都是唯一的实例，避免引用/id 冲突。
    try {
      const toPush = deepClone(scene)
      // internal unique id: chapter-sceneId-timestamp-random
      const baseId = String(toPush.sceneId ?? toPush.id ?? Math.floor(Math.random() * 1000000))
      const chap = toPush.chapterIndex != null ? String(toPush.chapterIndex) : 'nochap'
      toPush._uid = `${chap}-${baseId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      storyScenes.value.push(toPush)
    } catch (e) {
      // fallback: push raw scene if deepClone failed
      try { storyScenes.value.push(scene) } catch (err) { console.warn('pushSceneFromServer push failed', err) }
    }
  } catch (e) { console.warn('pushSceneFromServer failed', e) }
}

// 在页加载时从后端获取首章内容
const initFromCreateResult = async () => {
  try {
    const raw = sessionStorage.getItem('createResult')
    if (!raw) return false
    const obj = JSON.parse(raw)
    if (!obj) return false
    if (obj.backendWork) {
      work.value.id = obj.backendWork.id || work.value.id
      work.value.title = obj.backendWork.title || work.value.title
      work.value.coverUrl = obj.backendWork.coverUrl || work.value.coverUrl
    }
    // 从 createResult 或 history.state 获取初始属性和状态
    // 兼容两种写法：createResult 可能直接包含 initialAttributes/initialStatuses，
    // 也可能只包含 backendWork（其中包含 initialAttributes/statuses 字段）
    if (obj.initialAttributes) attributes.value = obj.initialAttributes
    else if (obj.backendWork && obj.backendWork.initialAttributes) attributes.value = obj.backendWork.initialAttributes

    if (obj.initialStatuses) statuses.value = obj.initialStatuses
    else if (obj.backendWork && obj.backendWork.initialStatuses) statuses.value = obj.backendWork.initialStatuses

    // total_chapters（若提供）
    if (obj.total_chapters) totalChapters.value = obj.total_chapters
    else if (obj.backendWork && (obj.backendWork.total_chapters || obj.backendWork.total_chapters === 0)) totalChapters.value = obj.backendWork.total_chapters || null
    
    // 从后端获取首章内容（chapterIndex = 1，后端为 1-based）
    try {
      const workId = work.value.id
      const result = await getScenes(workId, 1)
      if (result && result.scenes && result.scenes.length > 0) {
        storyScenes.value = []
        for (const sc of result.scenes) {
          try { pushSceneFromServer(sc) } catch (e) { console.warn('pushSceneFromServer failed for one entry', e) }
        }
        // 尝试使用最后一个场景的 seq
        try { 
          const last = result.scenes[result.scenes.length - 1]
          if (last && last.seq) lastSeq.value = last.seq 
        } catch (e) {}
        // 重置播放索引，确保从首条对话开始
        currentSceneIndex.value = 0
        currentDialogueIndex.value = 0
        // 明确设置当前章节为首章（1-based）
        currentChapterIndex.value = 1
        
        console.log(`[Story] 从 createResult 成功加载首章，共 ${result.scenes.length} 个场景`)
        return true
      } else {
        console.warn('[Story] createResult 返回空场景数据')
        return false
      }
    } catch (e) { 
      console.warn('Failed to fetch first chapter from backend:', e)
      return false
    }
    
  } catch (e) { 
    console.warn('initFromCreateResult failed', e); 
    return false 
  }
}

// 打开 SSE 流（后端 streamUrl），按 seq 添加场景或其他消息
const openStream = (url) => {
  try {
    if (!url || typeof EventSource === 'undefined') return
    if (eventSource) eventSource.close()
    eventSource = new EventSource(url)
    eventSource.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (!msg || !msg.type) return
        // 更新 lastSeq
        if (typeof msg.seq === 'number') lastSeq.value = Math.max(lastSeq.value, msg.seq)
        switch (msg.type) {
          case 'work_meta':
            if (msg.title) work.value.title = msg.title
            if (msg.coverUrl) work.value.coverUrl = msg.coverUrl
            break
          case 'scene':
            pushSceneFromServer(msg.scene || msg)
            break
          case 'mainline':
            pushSceneFromServer(msg.scene)
            break
          case 'choice_effect':
            // 将可选项暂存在当前 scene 的 choices 中以便前端显示
            try {
              const curr = storyScenes.value[storyScenes.value.length - 1]
              if (curr) curr.choices = msg.choices
            } catch (e) { console.warn(e) }
            break
          case 'special_event':
            // 可把特殊事件的对话直接插入为临时 scene
            if (msg.resultIfMet && msg.resultIfMet.dialogues) pushSceneFromServer({ sceneId: `ev-${msg.eventId}-${msg.seq}`, dialogues: msg.resultIfMet.dialogues })
            break
          case 'report':
            // 保存结算报告并跳转结算页面
            try {
              // 合并后端返回的 report 与本地数据，确保包含 choiceHistory / storyScenes
              const rep = Object.assign({}, msg)
              if (!Array.isArray(rep.choiceHistory) || rep.choiceHistory.length === 0) {
                try { rep.choiceHistory = Array.isArray(choiceHistory.value) ? deepClone(choiceHistory.value) : [] } catch (e) { rep.choiceHistory = [] }
              }
              if (!rep.storyScenes || !Array.isArray(rep.storyScenes) || rep.storyScenes.length === 0) {
                try { rep.storyScenes = deepClone(storyScenes.value) } catch (e) { rep.storyScenes = [] }
              }
              if (!rep.finalAttributes) {
                try { rep.finalAttributes = deepClone(attributes.value) } catch (e) { rep.finalAttributes = {} }
              }
              if (!rep.finalStatuses) {
                try { rep.finalStatuses = deepClone(statuses.value) } catch (e) { rep.finalStatuses = {} }
              }
              sessionStorage.setItem('settlementData', JSON.stringify(rep))
            } catch (e) { console.warn('Failed to store report message to sessionStorage', e) }
            break
          default:
            console.log('unknown stream message', msg.type)
        }
      } catch (e) { console.warn('EventSource message parse failed', e) }
    }
    eventSource.onerror = (err) => {
      console.warn('EventSource error', err)
      // 不关闭，浏览器会自动重试；若需要应用级重连策略可在此实现
    }
  } catch (e) { console.warn('openStream failed', e) }
}

// 向后端请求指定章节（使用 POST /api/game/chapter/），chapterIndex 为 1-based
// 向后端请求指定章节（使用 POST /api/game/chapter/），chapterIndex 为 1-based
const fetchNextChapter = async (workId, chapterIndex = null) => {
  try {
    if (!workId) workId = work.value.id
    // 计算希望请求的章节索引（1-based）
    let idx = Number(chapterIndex) || null
    if (!idx || idx <= 0) idx = currentChapterIndex.value || 1

    console.log(`[Story] 正在获取第 ${idx} 章内容...`)
    
    const data = await getScenes(workId, idx)

    // 支持后端返回 { generating: true }
    if (data && data.generating === true) {
      return data
    }

    // 标准返回：{ chapterIndex, title, scenes: [...] }
    if (data && Array.isArray(data.scenes) && data.scenes.length > 0) {
      const startIdx = storyScenes.value.length
      for (const sc of data.scenes) {
        try { pushSceneFromServer(sc) } catch (e) { console.warn('pushSceneFromServer failed for one entry', e) }
      }
      
      // 重要修改：更新当前章节索引
      currentChapterIndex.value = idx

      console.log(`[Story] 成功加载第 ${idx} 章，共 ${data.scenes.length} 个场景`)

      // 重要修改：如果有新场景添加，并且当前处于最后一个场景，自动切换到第一个新场景
      if (startIdx > 0 && currentSceneIndex.value === storyScenes.value.length - 1 - data.scenes.length) {
        // 当前在最后一个旧场景，自动切换到第一个新场景
        showText.value = false
        setTimeout(() => {
          currentSceneIndex.value = startIdx
          currentDialogueIndex.value = 0
          showText.value = true
          choicesVisible.value = false
        }, 300)
      }

      // 如果我们已请求了超出 totalChapters 的章节（totalChapters 可用），视为已到结尾并不再继续请求下一章。
      // 注意：不要在请求到等于 totalChapters 时立即标记结束 —— 只有在请求超出范围或后端显式返回 end 时才认为结束。
      if (totalChapters.value && idx > Number(totalChapters.value)) {
        storyEndSignaled.value = true
      }

      return data
    } else {
      console.warn(`[Story] 第 ${idx} 章返回空场景数据`)
    }

    return data
  } catch (e) {
    console.warn('fetchNextChapter error', e)
    throw e // 重新抛出错误以便调用方处理
  }
}

// 在玩家阅读到场景开头（函数 nextDialogue 或进入新 scene 调用处）调用此函数以触发后端生成下一章（若后端未通过 streamUrl 自动推送）
const requestNextIfNeeded = async () => {
  try {
    // 如果已由 SSE 推送，则不需要额外请求
    if (eventSource) return
    
    // 重要修改：只在当前章节接近结束时才预加载下一章
    const currentScene = storyScenes.value[currentSceneIndex.value]
    const isNearEnd = currentSceneIndex.value >= storyScenes.value.length - 2
    
    if (isNearEnd && !storyEndSignaled.value) {
      const nextChapter = currentChapterIndex.value + 1
      // 如果已知总章节数且下一章超出范围，则标记为结束并不请求
      if (totalChapters.value && Number(nextChapter) > Number(totalChapters.value)) {
        console.log('requestNextIfNeeded: nextChapter exceeds totalChapters, marking story end')
        storyEndSignaled.value = true
        return
      }
      if (USE_MOCK_STORY) {
        await fetchNextContent(work.value.id, nextChapter)
      } else {
        await fetchNextChapter(work.value.id, nextChapter)
      }
    }
  } catch (e) { console.warn('requestNextIfNeeded failed', e) }
}

// 最后一章结束后，向后端请求个性化报告：POST /api/settlement/report/:workId/
const fetchReport = async (workId) => {
  try {
    const url = `/api/settlement/report/${encodeURIComponent(workId)}/`
    const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' }
    if (window.__STORYCRAFT_AUTH_TOKEN__) headers['Authorization'] = `Bearer ${window.__STORYCRAFT_AUTH_TOKEN__}`
    const body = JSON.stringify({ attributes: attributes.value || {}, statuses: statuses.value || {} })
    const res = await fetch(url, { method: 'POST', headers, body, credentials: 'include' })
    if (!res.ok) return null
    const data = await res.json()
    try { sessionStorage.setItem('settlementData', JSON.stringify(data)) } catch {}
    return data
  } catch (e) { console.warn('fetchReport failed', e); return null }
}

// 统一主线剧情（在任一分支后都会拼接该主线场景）
const MAINLINE_SCENE = {
  sceneId: 2000,
  isMainline: true,
  title: '当前抉择',
  backgroundImage: 'https://picsum.photos/1920/1080?random=2000',
  dialogues: [
    '【主线】',
    '你先前的抉择如同在水面投下一粒石子，涟漪终归于平。',
    '夜漏将尽，永巷尽头传来更鼓声。你披衣而起，窗纸上檐兽的影子缓缓挪动。',
    '一张未封的黄绫诏帖被人塞入门缝，烛火映出上头的朱印。新的风向，正在形成。'
  ],
  // 在主线末尾出现新一轮选择
  choiceTriggerIndex: 3,
  choices: [
    {
      id: 'main_A',
      text: 'A. 焚毁所有邀帖称病不出',
      attributesDelta: { '健康': -10, '心计': 15 },
      statusesDelta: { '闭门谢客': '称病谢客', '事件:雪地密报': '已触发' },
      nextScenes: [
        {
          sceneId: 2101,
          backgroundImage: 'https://picsum.photos/1920/1080?random=2101',
          dialogues: [
            '【选项A后续】',
            '当夜忽降大雪，您咳着煎药时，窗缝塞进沾血的字条："桥桩乃桐油所蚀"。',
            '次日太医请脉时，德妃竟亲自带着血燕来访，她指尖抚过您枕边《孙子兵法》的书页，笑问妹妹病的可巧？'
          ]
        }
      ]
    },
    {
      id: 'main_B',
      text: 'B. 赴德妃宴席并献上家传调香术',
      attributesDelta: { '圣宠': 20, '才情': 10, '贤妃好感': -30 },
      statusesDelta: { '焚香之契': '与德妃香契', '事件:香料危机': '进行中' },
      nextScenes: [
        {
          sceneId: 2201,
          backgroundImage: 'https://picsum.photos/1920/1080?random=2201',
          dialogues: [
            '【选项B后续】',
            '您在菊园调制"雪中春信"时，皇帝的目光越过众妃落在您腕间香珠。',
            '当夜司寝太监来记档，德妃却派人送来掺着麝香的胭脂。',
            '更鼓声里，您盯着妆台上并排的香珠与胭脂，听见贤妃宫中传来摔瓷声。'
          ]
        }
      ]
    },
    {
      id: 'main_C',
      text: 'C. 往太后佛堂供经时提及侍卫冤情',
      attributesDelta: { '声望': 25, '德妃阵营': -50 },
      statusesDelta: { '佛前青眼': '太后青眼相加', '事件:经书疑云': '进行中' },
      nextScenes: [
        {
          sceneId: 2301,
          backgroundImage: 'https://picsum.photos/1920/1080?random=2301',
          dialogues: [
            '【选项C后续】',
            '您抄录的《心经》被太后供在佛前，第三日却发现菩提子经匣夹层藏着巫蛊人偶。',
            '掌事宫女突然推门而入，窗外闪过德妃心腹太监的藏蓝衣角。',
            '您捏着人偶的手微微发抖，发现背面绣着太后的生辰八字。'
          ]
        }
      ]
    }
  ]
}

// 尝试在当前剧情队列末尾拼接主线（若尚未拼接）
const appendMainlineIfNeeded = () => {
  try {
    const exists = storyScenes.value.some(s => s.isMainline || s.sceneId === MAINLINE_SCENE.sceneId)
    if (!exists) {
      storyScenes.value.push(MAINLINE_SCENE)
    }
  } catch (e) {
    console.warn('appendMainlineIfNeeded failed:', e)
  }
}
// ============ 自动播放 ============
const showSettingsModal = ref(false)
const autoPlayEnabled = ref(false)
const autoPlayIntervalMs = ref(2000) // 默认2秒一段（范围：2s~10s）
let autoPlayTimer = null

const canAutoAdvance = computed(() => {
  return autoPlayEnabled.value &&
    isLandscapeReady.value &&
    !isLoading.value &&
    !isFetchingNext.value &&
    !isGeneratingSettlement.value &&
    !showMenu.value &&
    showText.value &&
    !choicesVisible.value
})

const tickAutoPlay = () => {
  if (canAutoAdvance.value) {
    try { nextDialogue() } catch (e) { console.warn('auto-play next failed', e) }
  }
}

const clampInterval = (ms) => {
  const val = Number(ms) || 2000
  return Math.min(10000, Math.max(2000, val))
}

const startAutoPlayTimer = () => {
  stopAutoPlayTimer()
  // 不在弹窗打开时才启动自动播放
  try {
    if (anyOverlayOpen && anyOverlayOpen.value) return
  } catch (e) {}
  autoPlayTimer = setInterval(tickAutoPlay, clampInterval(autoPlayIntervalMs.value))
}

const stopAutoPlayTimer = () => {
  if (autoPlayTimer) {
    clearInterval(autoPlayTimer)
    autoPlayTimer = null
  }
}

// 当用户开始进入页面或重新加载时，尝试从 createResult 初始化；否则请求第一章
onMounted(async () => {
  // 若启用本地 mock，则在组件挂载时异步加载 mock 实现，避免顶层 await 导致 async setup
  if (USE_MOCK_STORY) {
    try {
      const mock = await import('../service/story.mock.js')
      getScenes = mock.getScenes
      try { window.__USE_MOCK_STORY__ = true } catch (e) {}
    } catch (e) {
      console.warn('加载 story.mock.js 失败，将回退到真实 service：', e)
    }
  }
  
  // 加载自动播放偏好并按需启动
  loadAutoPlayPrefs()
  if (autoPlayEnabled.value) startAutoPlayTimer()
  
  // 检查是否从结算页面跳回来并携带了加载数据
  if (history.state?.loadedData) {
    const loadedData = history.state.loadedData
    // 恢复游戏状态（注意：loadedData 可能不包含完整的 storyScenes）
    // 优先尝试根据 sceneId 定位到已加载的 storyScenes，否则回退到首个场景
    try {
      if (loadedData.sceneId != null && Array.isArray(storyScenes.value)) {
        // 使用字符串比较以兼容 number/string id 的差异
        const lsid = String(loadedData.sceneId)
        let idx = storyScenes.value.findIndex(s => s && (String(s.id) === lsid || String(s.sceneId) === lsid))
        // 如果没有找到，但提供了 chapterIndex，则尝试拉取该章节以恢复场景列表
        if (idx < 0 && typeof loadedData.chapterIndex === 'number') {
          try {
            const fetched = await fetchNextContent(work.value.id, loadedData.chapterIndex)
            if (fetched && Array.isArray(fetched.scenes) && fetched.scenes.length > 0) {
              for (const s of fetched.scenes) {
                try { pushSceneFromServer(s) } catch (e) { console.warn('pushSceneFromServer failed when restoring chapter (mounted):', e) }
              }
              idx = storyScenes.value.findIndex(s => s && (String(s.id) === lsid || String(s.sceneId) === lsid))
            }
          } catch (e) { console.warn('fetchNextContent failed while restoring loadedData chapter:', e) }
        }
        currentSceneIndex.value = (idx >= 0) ? idx : 0
      } else if (typeof loadedData.currentSceneIndex === 'number') {
        currentSceneIndex.value = loadedData.currentSceneIndex
      } else if (typeof loadedData.chapterIndex === 'number' && Array.isArray(storyScenes.value)) {
        const idx = storyScenes.value.findIndex(s => s && (s.chapterIndex === loadedData.chapterIndex || s.chapter === loadedData.chapterIndex))
        currentSceneIndex.value = (idx >= 0) ? idx : 0
      } else {
        currentSceneIndex.value = 0
      }
      if (typeof loadedData.currentDialogueIndex === 'number') currentDialogueIndex.value = loadedData.currentDialogueIndex
      else if (loadedData.dialogueIndex != null) currentDialogueIndex.value = loadedData.dialogueIndex
    } catch (e) { /* ignore */ }
    attributes.value = loadedData.attributes || {}
    statuses.value = loadedData.statuses || {}
    choiceHistory.value = loadedData.choiceHistory || []
    try { restoreChoiceFlagsFromHistory() } catch (e) { console.warn('restoreChoiceFlagsFromHistory error (loadedData):', e) }
    
    // 直接进入游戏
    isLandscapeReady.value = true
    // 即便数据已恢复，为了视觉一致性仍然执行一次平滑加载到 100% 的动画
    try {
      const dur = USE_MOCK_STORY ? 10000 : 900
      await simulateLoadTo100(dur)
    } catch (e) {
      isLoading.value = false
    }
    showText.value = true
    return
  }

  // 如果不是从结算页面跳回，则进行正常初始化
  await initializeGame()

  // 页面可见性变化：隐藏→暂停自动播放并尝试自动存档；可见→如开启自动播放则恢复
  const onVisibility = () => {
    if (document.hidden) {
      // 后台：暂停自动播放，避免后台计时推进
      stopAutoPlayTimer()
      autoSaveToSlot(AUTO_SAVE_SLOT)
    } else {
      // 回到前台：如当前设置开启自动播放且没有弹窗打开，则恢复计时器
      try {
        if (autoPlayEnabled.value && !(anyOverlayOpen && anyOverlayOpen.value)) startAutoPlayTimer()
      } catch (e) {
        if (autoPlayEnabled.value) startAutoPlayTimer()
      }
    }
  }
  document.addEventListener('visibilitychange', onVisibility)
  // 卸载/刷新前的本地快速存档
  const onBeforeUnload = () => {
    quickLocalAutoSave(AUTO_SAVE_SLOT)
  }
  window.addEventListener('beforeunload', onBeforeUnload)
  // 存储清理函数到实例上，便于卸载时移除
  ;(onMounted._cleanup = () => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('beforeunload', onBeforeUnload)
  })
})

onUnmounted(() => {
  // 关闭 SSE
  try { if (eventSource) eventSource.close() } catch (e) {}
  stopAutoPlayTimer()
})

const saveAutoPlayPrefs = () => {
  try {
    localStorage.setItem('autoPlayEnabled', JSON.stringify(!!autoPlayEnabled.value))
    localStorage.setItem('autoPlayIntervalMs', JSON.stringify(clampInterval(autoPlayIntervalMs.value)))
  } catch {}
}

const loadAutoPlayPrefs = () => {
  try {
    const en = JSON.parse(localStorage.getItem('autoPlayEnabled'))
    const ms = JSON.parse(localStorage.getItem('autoPlayIntervalMs'))
    if (typeof en === 'boolean') autoPlayEnabled.value = en
    if (typeof ms === 'number' && !Number.isNaN(ms)) autoPlayIntervalMs.value = clampInterval(ms)
  } catch {}
}

// 设置变化时，动态启停计时器
watch([autoPlayEnabled, autoPlayIntervalMs], () => {
  saveAutoPlayPrefs()
  if (autoPlayEnabled.value) {
    // 如果存在任一弹窗打开，则不要启动自动播放
    try {
      if (anyOverlayOpen && anyOverlayOpen.value) return
    } catch (e) {}
    startAutoPlayTimer()
  } else {
    stopAutoPlayTimer()
  }
})
// 打开菜单时暂停自动播放；关闭菜单后若开启则恢复
// 注意：需要在 showMenu 定义之后再注册（见下方）

// 当前场景索引
const currentSceneIndex = ref(0)
// 当前对话索引
const currentDialogueIndex = ref(0)
  // 当前章节索引（1-based），用于调用统一的 getScenes(workId, chapterIndex)
const currentChapterIndex = ref(1)
// 是否显示菜单
const showMenu = ref(false)
// 是否显示文字（用于淡入效果）
const showText = ref(false)

// 打开菜单时暂停自动播放；关闭菜单后若开启则恢复
watch(showMenu, (open) => {
  if (open) {
    stopAutoPlayTimer()
  } else if (autoPlayEnabled.value) {
    startAutoPlayTimer()
  }
})

// 注意：其它弹窗的监听需放在相关 ref 定义之后（见下文）

// 获取当前场景
const currentScene = computed(() => {
  return storyScenes.value[currentSceneIndex.value] || null
})

// 对话项可能是字符串或对象：{ text, backgroundImage, speaker }
const getDialogueItem = (scene, idx) => {
  if (!scene) return null
  const item = scene.dialogues?.[idx]
  if (item == null) return null
  if (typeof item === 'string') return { text: item }
  if (typeof item === 'object') return { text: item.text ?? '', backgroundImage: item.backgroundImage, speaker: item.speaker }
  return null
}

// 获取当前对话文字
const currentDialogue = computed(() => {
  const scene = currentScene.value
  const item = getDialogueItem(scene, currentDialogueIndex.value)
  return item?.text || ''
})

// 获取当前背景图：若当前对话项提供了 backgroundImage，则优先展示该图，否则回退到场景背景
const currentBackground = computed(() => {
  const scene = currentScene.value
  const item = getDialogueItem(scene, currentDialogueIndex.value)
  // 仅使用服务端/场景或对话项提供的背景图
  if (item?.backgroundImage) return item.backgroundImage
  return scene?.backgroundImage || ''
})

// 当前说话人（仅当对白带有 speaker 时显示；叙述性文字不显示）
const currentSpeaker = computed(() => {
  const scene = currentScene.value
  const item = getDialogueItem(scene, currentDialogueIndex.value)
  return (item && typeof item.speaker === 'string' && item.speaker.trim()) ? item.speaker.trim() : ''
})

// Ensure first sentence shows when we have scenes and are ready (entering landscape & not loading).
watch([isLandscapeReady, isLoading, () => storyScenes.value.length], (values) => {
  try {
    const [land, loading, len] = values
    if (land && !loading && Array.isArray(storyScenes.value) && storyScenes.value.length > 0) {
      // clamp scene index
      if (typeof currentSceneIndex.value !== 'number' || currentSceneIndex.value >= storyScenes.value.length) currentSceneIndex.value = 0
      const s = storyScenes.value[currentSceneIndex.value]
      if (!s || !Array.isArray(s.dialogues) || s.dialogues.length === 0) {
        // nothing to show
        showText.value = false
        return
      }
      // clamp dialogue index
      if (typeof currentDialogueIndex.value !== 'number' || currentDialogueIndex.value >= s.dialogues.length) currentDialogueIndex.value = 0
      // show first dialogue immediately
      showText.value = true
    }
  } catch (e) { console.warn('auto-show first dialogue watch failed', e) }
}, { immediate: true })

// 计算阅读进度
const readingProgress = computed(() => {
  let totalDialogues = 0
  let currentDialogues = 0
  
  storyScenes.value.forEach((scene, index) => {
    totalDialogues += scene.dialogues.length
    if (index < currentSceneIndex.value) {
      currentDialogues += scene.dialogues.length
    } else if (index === currentSceneIndex.value) {
      currentDialogues += currentDialogueIndex.value + 1
    }
  })
  
  return (currentDialogues / totalDialogues) * 100
})

// 是否是最后一句对话
const isLastDialogue = computed(() => {
  const scene = currentScene.value
  if (!scene || !Array.isArray(scene.dialogues)) return false
  return currentSceneIndex.value === storyScenes.value.length - 1 &&
         currentDialogueIndex.value === scene.dialogues.length - 1
})

// 点击屏幕进入下一段对话
const nextDialogue = async () => {
  console.log('nextDialogue called, showMenu:', showMenu.value)
  
  if (showMenu.value) {
    // 如果菜单显示，点击不做任何事
    return
  }

  // 如果当前显示选项，必须选择后才能继续
  if (choicesVisible.value) {
    console.log('Choices are visible, must select an option to continue')
    return
  }
  
  const scene = currentScene.value
  console.log('Current scene:', scene, 'dialogue index:', currentDialogueIndex.value)

  // Guard against missing/undefined current scene
  if (!scene) {
    console.warn('nextDialogue: currentScene is null or undefined — attempting recovery')
    // 如果尚未加载任何场景，尝试拉取首章并恢复播放位置（仅尝试一次）
    try {
      if (Array.isArray(storyScenes.value) && storyScenes.value.length === 0 && !isFetchingNext.value) {
        startLoading()
        try {
          await fetchNextChapter(work.value.id, 1)
        } catch (e) {
          console.warn('fetchNextChapter recovery attempt failed', e)
        }
        await stopLoading()
        // 若已成功加载场景，则重置索引并展示第一句
        if (Array.isArray(storyScenes.value) && storyScenes.value.length > 0) {
          currentSceneIndex.value = 0
          currentDialogueIndex.value = 0
          showText.value = true
          return
        }
      }
    } catch (e) { console.warn('recovery from missing scene failed', e) }
    return
  }
  
  // 如果当前场景还有下一段对话
  if (currentDialogueIndex.value < scene.dialogues.length - 1) {
    showText.value = false
    setTimeout(() => {
      currentDialogueIndex.value++
      showText.value = true
      console.log('Next dialogue:', currentDialogueIndex.value)
    }, 200)
  } else {
    // 当前场景对话结束，检查是否是章节结束
    const isChapterEnd = (scene?.isChapterEnding === true) || (scene?.chapterEnd === true)
    
    // 切换到下一个场景
    if (currentSceneIndex.value < storyScenes.value.length - 1) {
      showText.value = false
      setTimeout(async () => {
        // 如果当前场景标记为章节结束，增加章节索引
        if (isChapterEnd) {
          currentChapterIndex.value++
          console.log('Chapter ended, moving to chapter:', currentChapterIndex.value)
        }
        
        // 切换场景时重置选项显示
        choicesVisible.value = false
        currentSceneIndex.value++
        currentDialogueIndex.value = 0
        showText.value = true
        console.log('Next scene:', currentSceneIndex.value)
        
        // 重要修改：检查是否需要预加载下一章
        const remainingScenes = storyScenes.value.length - (currentSceneIndex.value + 1)
        console.log('Remaining scenes:', remainingScenes, 'storyEndSignaled:', storyEndSignaled.value)
        
        // 当剩余场景少于2个且故事未结束时预加载下一章
        if (remainingScenes <= 2 && !eventSource && !storyEndSignaled.value) {
          console.log('Preloading next chapter...')
          startLoading()
          try {
            const nextChapter = isChapterEnd ? currentChapterIndex.value : (currentChapterIndex.value + 1)
            // 如果我们已知总章节数且下一章索引超出范围，则标记为故事结束，停止预取
            if (totalChapters.value && Number(nextChapter) > Number(totalChapters.value)) {
              console.log('Next chapter exceeds totalChapters, marking story end (preload skipped)')
              storyEndSignaled.value = true
            } else {
              if (USE_MOCK_STORY) {
                await fetchNextContent(work.value.id, nextChapter)
              } else {
                const result = await fetchNextChapter(work.value.id, nextChapter)
                console.log('Preloaded next chapter result:', result)
              }
            }
          } catch (error) {
            console.warn('Preload next chapter failed:', error)
          } finally {
            await stopLoading()
          }
        } else {
          // 非阻塞预取
          try { 
            requestNextIfNeeded() 
          } catch (e) { 
            console.warn('requestNextIfNeeded failed', e) 
          }
        }
      }, 300)
    } else {
      // 已到当前已加载内容的末尾
      // 如果当前场景标记为章节结束，增加章节索引
      if (isChapterEnd) {
        currentChapterIndex.value++
        console.log('Chapter ended at last scene, moving to chapter:', currentChapterIndex.value)
      }
      
      if (storyEndSignaled.value) {
        console.log('故事结束，跳转结算页面')
        // 开始生成结算页面，而不是直接弹出结束提示
        handleGameEnd()
        return
      }
      
      // 尚未收到结束信号，则尝试拉取下一段剧情（阻塞式），并在后端仍在生成时轮询等待
      try {
        startLoading()
        let data
        if (USE_MOCK_STORY) {
          // 计算希望请求的章节索引
          const nextChapter = isChapterEnd ? currentChapterIndex.value : (currentChapterIndex.value + 1)
          console.log('Fetching next content for chapter:', nextChapter)
          // 若已知 totalChapters 且下一章超出范围，直接进入结算
          if (totalChapters.value && Number(nextChapter) > Number(totalChapters.value)) {
            console.log('Next chapter exceeds totalChapters (blocking fetch), marking end and handling game end')
            storyEndSignaled.value = true
            await stopLoading()
            handleGameEnd()
            return
          }
          // 首次请求，后端可能返回 { generating: true }
          data = await fetchNextContent(work.value.id, nextChapter)
          console.log('Mock fetch result:', data)
          // 如果后端正在生成（或返回空场景但未标记结束），轮询等待生成完成
          const maxWaitMs = 60 * 1000 // 最多等 60s
          const pollInterval = 1000
          let waited = 0
          while (data && data.generating === true && waited < maxWaitMs) {
            await new Promise(r => setTimeout(r, pollInterval))
            waited += pollInterval
            data = await fetchNextContent(work.value.id, nextChapter)
            console.log('Polling result:', data, 'waited:', waited)
          }
        } else {
          // 请求下一章（使用 chapterIndex）
          const nextChapter = isChapterEnd ? currentChapterIndex.value : (currentChapterIndex.value + 1)
          console.log('Fetching next chapter:', nextChapter)
          // 若已知 totalChapters 且下一章超出范围，直接进入结算
          if (totalChapters.value && Number(nextChapter) > Number(totalChapters.value)) {
            console.log('Next chapter exceeds totalChapters (blocking fetch), marking end and handling game end')
            storyEndSignaled.value = true
            await stopLoading()
            handleGameEnd()
            return
          }
          data = await fetchNextChapter(work.value.id, nextChapter)
          console.log('Backend fetch result:', data)
        }

        await stopLoading()

        // 如果后端最终标记结束，跳转结算
        if (!data || data.end === true) {
          console.log('Story ended based on backend response')
          storyEndSignaled.value = true
          handleGameEnd()
          return
        }

        // 如果后端返回了场景数组，插入并从第一个新场景开始阅读
        if (data && Array.isArray(data.scenes) && data.scenes.length > 0) {
          const startIdx = storyScenes.value.length
          console.log('Adding new scenes, starting at index:', startIdx, 'scenes count:', data.scenes.length)
          
          // 逐条添加场景以确保正确规范化
          for (const sceneData of data.scenes) {
            pushSceneFromServer(sceneData)
          }
          
          choicesVisible.value = false
          showText.value = false
          setTimeout(() => {
            // 切换到新插入的第一场景
            currentSceneIndex.value = startIdx
            currentDialogueIndex.value = 0
            showText.value = true
            console.log('Switched to new scene:', currentSceneIndex.value)
          }, 300)
          return
        }

        // 没有拿到内容且未标记结束，提示等待
        console.warn('No content received from backend')
        // 如果已知 totalChapters 且下一章超出范围，进入结算流程
        const nextChapter = isChapterEnd ? currentChapterIndex.value : (currentChapterIndex.value + 1)
        if (totalChapters.value && Number(nextChapter) > Number(totalChapters.value)) {
          console.log('No content and nextChapter exceeds totalChapters, handling game end')
          storyEndSignaled.value = true
          handleGameEnd()
          return
        }
        alert('后续剧情正在生成，请稍候再试')
      } catch (e) {
        console.warn('fetching next content failed', e)
        await stopLoading()
        // 同样在网络/请求错误时，若已知没有后续章节则跳转结算
        const nextChapterErr = isChapterEnd ? currentChapterIndex.value : (currentChapterIndex.value + 1)
        if (totalChapters.value && Number(nextChapterErr) > Number(totalChapters.value)) {
          console.log('Fetch error and nextChapter exceeds totalChapters, handling game end')
          storyEndSignaled.value = true
          handleGameEnd()
          return
        }
        alert('后续剧情正在生成，请稍候再试')
      }
    }
  }
}

// 切换菜单显示
const toggleMenu = () => {
  showMenu.value = !showMenu.value
}

// 返回作品介绍页
const goBack = async () => {
  try {
    // 退出前自动存档到六号位
    await autoSaveToSlot(AUTO_SAVE_SLOT)
    // 退出横屏，恢复竖屏
    if (isNativeApp.value) {
      console.log('恢复竖屏')
      await ScreenOrientation.unlock()
    } else {
      // 浏览器环境：退出全屏
      if (document.exitFullscreen) {
        await document.exitFullscreen()
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen()
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen()
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen()
      }
      
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock()
      }
    }
  } catch (err) {
    console.log('退出横屏失败:', err)
  }
  
  router.push('/works')
}

// 处理游戏结束，生成结算页面
const handleGameEnd = async () => {
  isGeneratingSettlement.value = true
  isLoading.value = true
  loadingProgress.value = 0
  
  // 模拟结算页面生成过程
  const generateSettlement = async () => {
    for (let i = 0; i <= 100; i += 5) {
      loadingProgress.value = i
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    
    // 生成完成后跳转到结算页面
    // 优先尝试从后端获取个性化结算报告（若后端返回则使用），否则回退到本地快照
    let settlementData = null
    try {
      const remote = await fetchReport(work.value.id)
      if (remote) {
        // 保留后端返回的结算数据，但确保包含本地的 choiceHistory / storyScenes / attributes/statuses
        settlementData = Object.assign({}, remote)
        if (!Array.isArray(settlementData.choiceHistory) || settlementData.choiceHistory.length === 0) {
          try { settlementData.choiceHistory = Array.isArray(choiceHistory.value) ? deepClone(choiceHistory.value) : [] } catch (e) { settlementData.choiceHistory = [] }
        }
        if (!settlementData.storyScenes || !Array.isArray(settlementData.storyScenes) || settlementData.storyScenes.length === 0) {
          try { settlementData.storyScenes = deepClone(storyScenes.value) } catch (e) { settlementData.storyScenes = [] }
        }
        if (!settlementData.finalAttributes) {
          try { settlementData.finalAttributes = deepClone(attributes.value) } catch (e) { settlementData.finalAttributes = {} }
        }
        if (!settlementData.finalStatuses) {
          try { settlementData.finalStatuses = deepClone(statuses.value) } catch (e) { settlementData.finalStatuses = {} }
        }
      }
    } catch (e) { console.warn('fetchReport failed in handleGameEnd:', e) }

    if (!settlementData) {
      settlementData = {
        work: work.value,
        choiceHistory: choiceHistory.value,
        finalAttributes: attributes.value,
        finalStatuses: statuses.value,
        storyScenes: storyScenes.value,
        currentSceneIndex: currentSceneIndex.value,
        currentDialogueIndex: currentDialogueIndex.value
      }
    }

    try { sessionStorage.setItem('settlementData', JSON.stringify(settlementData)) } catch (e) { console.warn('set settlementData failed', e) }
    router.push('/settlement')
  }
  
  generateSettlement()
}

// 尝试从后端拉取下一段剧情并在成功后自动推进
const ensureNextContentAndAdvance = async () => {
  if (isFetchingNext.value) return
  isFetchingNext.value = true
  try {
    const lastScene = storyScenes.value[storyScenes.value.length - 1]
    const afterSceneId = lastScene?.sceneId
    const data = await fetchNextContent(work.value.id, afterSceneId)
    if (!data) throw new Error('无返回')
    if (data.end === true || (Array.isArray(data.scenes) && data.scenes.length === 0)) {
      // 如果后端标记整部作品/章节结束，触发结算页面
      storyEndSignaled.value = true
      // 使用统一的结算生成流程
      handleGameEnd()
      return
    }
    if (Array.isArray(data.scenes) && data.scenes.length > 0) {
      const startIdx = storyScenes.value.length
      storyScenes.value.push(...data.scenes)
      // 自动前进到新插入的第一幕
      showText.value = false
      setTimeout(() => {
        choicesVisible.value = false
        currentSceneIndex.value = startIdx
        currentDialogueIndex.value = 0
        showText.value = true
      }, 150)
    }
  } catch (e) {
    console.warn('获取后续剧情失败：', e)
    alert('后续剧情生成中，请稍后再试…')
  } finally {
    isFetchingNext.value = false
  }
}

// 后端：获取指定章节的剧情（按章节索引） — 使用运行时的 getScenes(workId, chapterIndex)
const fetchNextContent = async (workId, chapterIndex) => {
  try {
    console.log('[Story] fetchNextContent chapter =', chapterIndex)
    const resp = await getScenes(workId, chapterIndex)
    if (!resp) return null
    if (resp.generating) return { generating: true, end: false, scenes: [] }
    
    const isEnd = (resp.end === true) || (resp.isGameEnding === true) || (resp.isGameEnd === true)
    const scenes = Array.isArray(resp.scenes) ? resp.scenes : (Array.isArray(resp) ? resp : [])
    
    if (scenes.length > 0) {
      const startIdx = storyScenes.value.length
      for (const sc of scenes) {
        try {
          if (resp.chapterIndex || resp.chapterIndex === 0) sc.chapterIndex = resp.chapterIndex
          if (resp.title) sc.chapterTitle = resp.title
          pushSceneFromServer(sc)
        } catch (e) { console.warn('pushSceneFromServer failed while fetching next content', e) }
      }
      
      // 重要修改：更新章节索引
      if (resp.chapterIndex) {
        currentChapterIndex.value = resp.chapterIndex
      }
      
      if (resp.lastSeq) lastSeq.value = Math.max(lastSeq.value, resp.lastSeq)
    }

    return { generating: false, end: !!isEnd, scenes }
  } catch (err) {
    console.warn('fetchNextContent error', err)
    return { generating: false, end: false, scenes: [] }
  }
}

// Mock：根据当前最后一个 sceneId 简单返回一段占位剧情，或模拟结束
const mockFetchNextContent = async (workId, afterSceneId) => {
  await new Promise(r => setTimeout(r, 1200))
  // 简单规则：到了 1203 后不再生成（视为结束）
  if (afterSceneId >= 1203) {
    return { end: true, nextScenes: [] }
  }
  const nextId = (afterSceneId || 1000) + 10
  return {
    end: false,
    nextScenes: [
      {
        sceneId: nextId,
        backgroundImage: 'https://picsum.photos/1920/1080?random=' + (nextId % 9999),
        dialogues: [
          '（场景描写）',
          '后续剧情占位段落：系统正在为您生成更精彩的内容…',
          '请继续点击屏幕，稍后将进入新的篇章。'
        ]
      }
    ]
  }
}

// 存档 / 读档 / 属性 模态与逻辑
const showAttributesModal = ref(false)
const saveToast = ref('')
const loadToast = ref('')
const lastSaveInfo = ref(null)
// 新增：存/读档弹窗及槽位信息
const showSaveModal = ref(false)
const showLoadModal = ref(false)
const SLOTS = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6']
const slotInfos = ref({ slot1: null, slot2: null, slot3: null, slot4: null, slot5: null, slot6: null })

// 玩家属性与“特殊状态”（由 AI/后端生成并随剧情变化）
// 属性示例：好感度、善良值等；特殊状态示例：『顾景琛的怀疑』『负伤』等
const attributes = ref(history.state?.attributes || {
  '心计': 30,
  '才情': 60,
  '声望': 10,
  '圣宠': 0,
  '健康': 100
})
const statuses = ref(history.state?.statuses || {
  '姓名': '林微月',
  '位份': '从七品选侍',
  '年龄': 16,
  '阵营': '无',
  '明眸善睐': '眼波流转间易获好感',
  '暗香盈袖': '体带天然冷梅香'
})

// 选项交互状态
const isFetchingChoice = ref(false)


// 本地回退存档 key（包含 userId，避免不同用户冲突）
const localSaveKey = (userId, workId, slot = 'default') => `storycraft_save_${userId}_${workId}_${slot}`

// 简单深拷贝（避免引用被后续修改影响到存档/展示）
const deepClone = (obj) => JSON.parse(JSON.stringify(obj))

// 尝试生成缩略图的 base64 dataURL（小尺寸），用于在不依赖后端存储图片时随存档携带
const generateThumbnailDataURL = async (imageUrl, maxW = 360, maxH = 200) => {
  if (!imageUrl) return null
  try {
    // 如果已经是 data: URL，则直接返回
    if (String(imageUrl).startsWith('data:')) return imageUrl
    const img = new Image()
    // 尝试允许跨域加载（若后端支持 CORS）
    img.crossOrigin = 'anonymous'
    const loaded = await new Promise((resolve, reject) => {
      img.onload = () => resolve(true)
      img.onerror = () => reject(new Error('thumbnail load error'))
      img.src = imageUrl
    })
    if (!loaded) return null
    const w = img.naturalWidth || img.width
    const h = img.naturalHeight || img.height
    if (!w || !h) return null
    let tw = w, th = h
    const ratio = Math.min(maxW / w, maxH / h, 1)
    tw = Math.floor(w * ratio)
    th = Math.floor(h * ratio)
    const canvas = document.createElement('canvas')
    canvas.width = tw
    canvas.height = th
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, tw, th)
    // 输出为 jpeg 以减小体积
    const dataUrl = canvas.toDataURL('image/jpeg', 0.75)
    return dataUrl
  } catch (e) {
    // 若跨域导致画布污染或其它错误，则返回 null（不阻塞保存流程）
    return null
  }
}

// 自动存档槽位（退出时写入）
const AUTO_SAVE_SLOT = 'slot6'

// 其它弹窗（存档/读档/属性/设置）打开时同样应暂停自动播放
const anyOverlayOpen = computed(() =>
  showMenu.value ||
  showSaveModal.value ||
  showLoadModal.value ||
  showAttributesModal.value ||
  showSettingsModal.value
)

watch(anyOverlayOpen, (open) => {
  if (open) {
    stopAutoPlayTimer()
  } else if (autoPlayEnabled.value) {
    startAutoPlayTimer()
  }
})

// 构建当前存档快照（不再在 payload 中包含完整的 storyScenes）
const buildSavePayload = () => ({
  work: work.value,
  // 明确传递定位信息（后端/存档使用这三项来定位进度）
  chapterIndex: currentChapterIndex.value,
  // 直接保存当前在前端队列中的索引，便于恢复时无需依赖后端 sceneId 匹配
  currentSceneIndex: currentSceneIndex.value,
  sceneId: (currentScene.value && (currentScene.value.id || currentScene.value.sceneId)) ? String(currentScene.value.id ?? currentScene.value.sceneId) : String(currentSceneIndex.value),
  dialogueIndex: currentDialogueIndex.value,
  attributes: deepClone(attributes.value),
  statuses: deepClone(statuses.value),
  choiceHistory: deepClone(choiceHistory.value),
  // 缩略图：优先使用当前对话或场景提供的背景图，回退到作品封面
  thumbnail: (currentBackground && currentBackground.value) ? currentBackground.value : (effectiveCoverUrl && effectiveCoverUrl.value) ? effectiveCoverUrl.value : (work.value && work.value.coverUrl) ? work.value.coverUrl : null,
  timestamp: Date.now(),
  // 兼容后端 GameStateSerializer
  game_state: {
    gameworkId: Number(work.value && work.value.id) || null,
    userId: (typeof window !== 'undefined' && window.__STORYCRAFT_USER__ && Number(window.__STORYCRAFT_USER__.id)) ? Number(window.__STORYCRAFT_USER__.id) : null,
    currentChapterIndex: currentChapterIndex.value,
    currentSceneId: (currentScene.value && (currentScene.value.id || currentScene.value.sceneId)) ? String(currentScene.value.id ?? currentScene.value.sceneId) : null,
    history: Array.isArray(choiceHistory.value) ? deepClone(choiceHistory.value) : [],
    // 将缩略图也放入 game_state，以便后端/后续使用 game_state 时能访问到
    thumbnail: (currentBackground && currentBackground.value) ? currentBackground.value : (effectiveCoverUrl && effectiveCoverUrl.value) ? effectiveCoverUrl.value : (work.value && work.value.coverUrl) ? work.value.coverUrl : null,
    character: { attributes: deepClone(attributes.value) || {}, statuses: deepClone(statuses.value) || {} },
    inventory: [],
    relationships: {},
    flags: {},
    branch_exploration: { choiceHistory: deepClone(choiceHistory.value) || [] }
  }
})

const saveGame = async (slot = 'default') => {
  const payload = buildSavePayload()

  const userId = getCurrentUserId()
  const workId = work.value.id

  // 生成缩略图的 base64 版本（非必须），以便在后端/本地都可直接显示小图而无需额外 fetch
  try {
    const thumbUrl = payload.thumbnail || (payload.game_state && payload.game_state.thumbnail)
    const dataUrl = await generateThumbnailDataURL(thumbUrl, 360, 160)
    if (dataUrl) {
      payload.thumbnailData = dataUrl
      if (payload.game_state) payload.game_state.thumbnailData = dataUrl
    }
  } catch (e) {
    // 不影响保存流程
  }

  // 优先使用后端存储（如果开启）
  if (USE_BACKEND_SAVE) {
    try {
      // 如果 userId 不是纯数字（即匿名用户），后端路由通常期望整数 id，直接使用前端的 mock 保存（localStorage）并给出明确提示
      if (!String(userId).match(/^\d+$/)) {
        console.warn('saveGame: anonymous/non-numeric userId detected, using mock/local save instead of backend API:', userId)
        await mockBackendSave(userId, workId, slot, payload.game_state ?? payload)
        lastSaveInfo.value = deepClone(payload)
        saveToast.value = `已本地保存（未登录用户）`
        setTimeout(() => (saveToast.value = ''), 2000)
        console.log('saved to mockBackend (localStorage)', { userId, workId, slot, payload })
        return
      }
      // 否则尝试真实后端保存
      await backendSave(userId, workId, slot, payload.game_state ?? payload)
      lastSaveInfo.value = deepClone(payload)
      saveToast.value = `已上传存档（${new Date(payload.timestamp).toLocaleString()}）`
      setTimeout(() => (saveToast.value = ''), 2000)
      console.log('saved to backend', { userId, workId, slot, payload })
      return
    } catch (err) {
      console.warn('后端存档失败，回落到 localStorage：', err)
      // fallthrough to localStorage save
    }
  }

  // fallback: localStorage（包含 userId 以避免不同用户冲突）
  try {
    const key = localSaveKey(userId, workId, slot)
    localStorage.setItem(key, JSON.stringify(payload))
  lastSaveInfo.value = deepClone(payload)
    saveToast.value = `已本地存档（${new Date(payload.timestamp).toLocaleString()}）`
    setTimeout(() => (saveToast.value = ''), 2000)
    console.log('saved to localStorage', key, payload)
  } catch (err) {
    console.error('保存失败', err)
    alert('保存失败：' + err.message)
  }
}

// 静默自动存档（退出时使用，不弹 toast）
const autoSaveToSlot = async (slot = AUTO_SAVE_SLOT) => {
  try {
    const payload = buildSavePayload()
    const userId = getCurrentUserId()
    const workId = work.value.id
    if (USE_BACKEND_SAVE) {
        try {
        await backendSave(userId, workId, slot, payload.game_state ?? payload)
        return
      } catch (e) {
        // 忽略错误，回落到本地
      }
    }
    const key = localSaveKey(userId, workId, slot)
    localStorage.setItem(key, JSON.stringify(payload))
  } catch (e) {
    // 保底失败忽略
  }
}

// 快速本地存档（用于 beforeunload 场景，不进行网络请求）
const quickLocalAutoSave = (slot = AUTO_SAVE_SLOT) => {
  try {
    const payload = buildSavePayload()
    const userId = getCurrentUserId()
    const workId = work.value.id
    const key = localSaveKey(userId, workId, slot)
    localStorage.setItem(key, JSON.stringify(payload))
  } catch (e) {}
}

const loadGame = async (slot = 'default') => {
  const userId = getCurrentUserId()
  const workId = work.value.id

  // 尝试后端读取
  if (USE_BACKEND_SAVE) {
    try {
      const remote = await backendLoad(userId, workId, slot)
      if (remote) {
        // Note: 存档 payload 不再包含完整的 storyScenes。若后端仍返回 scenes，可在后端和前端协商后再恢复。
        // 支持新存档格式：chapterIndex / sceneId / dialogueIndex
        const deriveIndexFromPayload = (p) => {
          try {
            if (!p) return null
            // 优先使用 sceneId 来定位
            if (p.sceneId != null && Array.isArray(storyScenes.value)) {
              // 强制字符串比较，避免后端/前端存储的 id 类型（number/string）不一致导致匹配失败
              const pid = String(p.sceneId)
              const idx = storyScenes.value.findIndex(s => s && (String(s.id) === pid || String(s.sceneId) === pid))
              if (idx >= 0) return idx
              // 如果没有在当前已加载的 storyScenes 中找到对应 sceneId，回退到起始场景（0）
              return 0
            }
            // 兼容老字段 currentSceneIndex
            if (typeof p.currentSceneIndex === 'number') return p.currentSceneIndex
            if (typeof p.chapterIndex === 'number') {
              // 尝试使用 chapterIndex 映射到第一条该章节的场景
              const idx = storyScenes.value.findIndex(s => s && (s.chapterIndex === p.chapterIndex || s.chapter === p.chapterIndex))
              if (idx >= 0) return idx
            }
          } catch (e) {}
          return null
        }

        let derived = deriveIndexFromPayload(remote)
        if (derived != null) {
          currentSceneIndex.value = derived
        } else if (remote.sceneId != null && typeof remote.chapterIndex === 'number') {
          // 若当前 storyScenes 中没有该 sceneId，则尝试按 chapterIndex 拉取该章节的场景并拼接，再定位
          try {
            const fetched = await fetchNextContent(workId, remote.chapterIndex)
            if (fetched && Array.isArray(fetched.scenes) && fetched.scenes.length > 0) {
              // 将获取到的 scenes 推入本地队列（使用 pushSceneFromServer 以保留兼容处理）
              for (const s of fetched.scenes) {
                try { pushSceneFromServer(s) } catch (e) { console.warn('pushSceneFromServer failed when restoring chapter', e) }
              }
              // 重新尝试定位
              derived = deriveIndexFromPayload(remote)
              if (derived != null) currentSceneIndex.value = derived
            }
          } catch (e) { console.warn('fetchNextContent failed while restoring saved chapter:', e) }
        }
        if (typeof currentSceneIndex.value !== 'number') {
          if (typeof remote.currentSceneIndex === 'number') currentSceneIndex.value = remote.currentSceneIndex
          else currentSceneIndex.value = 0
        }
        if (typeof remote.currentDialogueIndex === 'number') currentDialogueIndex.value = remote.currentDialogueIndex
        else if (remote.dialogueIndex != null) currentDialogueIndex.value = remote.dialogueIndex
        // attributes/statuses 使用存档快照完整覆盖，缺省则置空，避免选项后的变化残留
        attributes.value = deepClone(remote.attributes || {})
        statuses.value = deepClone(remote.statuses || {})
  // 恢复选择历史
  choiceHistory.value = deepClone(remote.choiceHistory || [])
  // 根据选择历史恢复场景的已选标记与解锁后续选项
  try { restoreChoiceFlagsFromHistory() } catch (e) { console.warn('restoreChoiceFlagsFromHistory error (remote):', e) }
        // 恢复文字显示状态，并让选项由 watch 重新判断
        showText.value = true
        choicesVisible.value = false
        lastSaveInfo.value = deepClone(remote)
        loadToast.value = `已从服务器读档（${new Date(remote.timestamp || Date.now()).toLocaleString()}）`
        setTimeout(() => (loadToast.value = ''), 2000)
        console.log('loaded from backend', { userId, workId, slot, remote })
        // 读档成功后自动关闭读档弹窗
        showLoadModal.value = false
        return
      }
      // 如果后端返回 null/404，则回退到本地
    } catch (err) {
      console.warn('后端读档失败，回退到 localStorage：', err)
      // fallback to localStorage below
    }
  }

  // fallback: localStorage（包含 userId 以避免不同用户冲突）
  try {
    const key = localSaveKey(userId, workId, slot)
    const raw = localStorage.getItem(key)
    if (!raw) {
      loadToast.value = '未找到本地存档'
      setTimeout(() => (loadToast.value = ''), 1500)
      return
    }
    const payload = JSON.parse(raw)
    // 存档不再包含 storyScenes；若本地存档含 scenes，可按需手动恢复（默认这里忽略）
    // 支持新的保存字段 sceneId / chapterIndex / dialogueIndex，同时兼容旧字段 currentSceneIndex
    const deriveIndexFromPayloadLocal = (p) => {
      try {
        if (!p) return null
        if (p.sceneId != null && Array.isArray(storyScenes.value)) {
              const pid = String(p.sceneId)
              const idx = storyScenes.value.findIndex(s => s && (String(s.id) === pid || String(s.sceneId) === pid))
              if (idx >= 0) return idx
              return 0
            }
        if (typeof p.currentSceneIndex === 'number') return p.currentSceneIndex
        if (typeof p.chapterIndex === 'number') {
          const idx = storyScenes.value.findIndex(s => s && (s.chapterIndex === p.chapterIndex || s.chapter === p.chapterIndex))
          if (idx >= 0) return idx
        }
      } catch (e) {}
      return null
    }
    let derivedLocal = deriveIndexFromPayloadLocal(payload)
    if (derivedLocal != null) {
      currentSceneIndex.value = derivedLocal
    } else if (payload.sceneId != null && typeof payload.chapterIndex === 'number') {
      try {
        const fetched = await fetchNextContent(workId, payload.chapterIndex)
        if (fetched && Array.isArray(fetched.scenes) && fetched.scenes.length > 0) {
          for (const s of fetched.scenes) {
            try { pushSceneFromServer(s) } catch (e) { console.warn('pushSceneFromServer failed when restoring chapter (local):', e) }
          }
          derivedLocal = deriveIndexFromPayloadLocal(payload)
          if (derivedLocal != null) currentSceneIndex.value = derivedLocal
        }
      } catch (e) { console.warn('fetchNextContent failed while restoring saved chapter (local):', e) }
    }
    if (typeof currentSceneIndex.value !== 'number') {
      currentSceneIndex.value = 0
    }
    if (typeof payload.currentDialogueIndex === 'number') currentDialogueIndex.value = payload.currentDialogueIndex
    else if (payload.dialogueIndex != null) currentDialogueIndex.value = payload.dialogueIndex
    // attributes/statuses 使用存档快照完整覆盖，缺省则置空
    attributes.value = deepClone(payload.attributes || {})
    statuses.value = deepClone(payload.statuses || {})
  // 恢复选择历史
  choiceHistory.value = deepClone(payload.choiceHistory || [])
  // 根据选择历史恢复场景的已选标记与解锁后续选项
  try { restoreChoiceFlagsFromHistory() } catch (e) { console.warn('restoreChoiceFlagsFromHistory error (local):', e) }
    showText.value = true
    choicesVisible.value = false
    lastSaveInfo.value = deepClone(payload)
    loadToast.value = `本地读档成功（${new Date(payload.timestamp).toLocaleString()}）`
    setTimeout(() => (loadToast.value = ''), 2000)
    console.log('loaded from localStorage', key, payload)
    // 读档成功后自动关闭读档弹窗
    showLoadModal.value = false
  } catch (err) {
    console.error('读档失败', err)
    alert('读档失败：' + err.message)
  }
}

const deleteGame = async (slot = 'default') => {
  if (!confirm(`确定要删除 ${slot.toUpperCase()} 的存档吗？此操作不可撤销。`)) {
    return
  }

  const userId = getCurrentUserId()
  const workId = work.value.id

  try {
    // 优先使用后端删除
    if (USE_BACKEND_SAVE) {
      try {
        if (!String(userId).match(/^\d+$/)) {
          console.warn('deleteGame: anonymous/non-numeric userId detected, using mock/local delete instead of backend API:', userId)
          await mockBackendDelete(userId, workId, slot)
          saveToast.value = `本地存档已删除`
          setTimeout(() => (saveToast.value = ''), 2000)
          console.log('deleted from mockBackend (localStorage)', { userId, workId, slot })
          // 刷新槽位信息
          await refreshSlotInfos()
          return
        }
        // 否则尝试真实后端删除
        await backendDelete(userId, workId, slot)
        saveToast.value = `存档已删除`
        setTimeout(() => (saveToast.value = ''), 2000)
        console.log('deleted from backend', { userId, workId, slot })
        // 刷新槽位信息
        await refreshSlotInfos()
        return
      } catch (err) {
        console.error('后端删除失败，回退到本地删除:', err)
        // 回退到本地删除
        await mockBackendDelete(userId, workId, slot)
        saveToast.value = `本地存档已删除`
        setTimeout(() => (saveToast.value = ''), 2000)
        console.log('deleted from mockBackend (localStorage)', { userId, workId, slot })
        // 刷新槽位信息
        await refreshSlotInfos()
      }
    } else {
      // 仅本地删除
      await mockBackendDelete(userId, workId, slot)
      saveToast.value = `本地存档已删除`
      setTimeout(() => (saveToast.value = ''), 2000)
      console.log('deleted from mockBackend (localStorage)', { userId, workId, slot })
      // 刷新槽位信息
      await refreshSlotInfos()
    }
  } catch (err) {
    console.error('删除存档失败', err)
    alert('删除存档失败：' + err.message)
  }
}

// 如果选项对象本身包含分支数据（后端已经把每个选项的后续剧情一并返回）
const applyChoiceBranch = (choiceObj) => {
  try {
    if (!choiceObj) return
  // 属性变更
  if (choiceObj.attributesDelta) applyAttributesDelta(choiceObj.attributesDelta)
  // 特殊状态变更
  if (choiceObj.statusesDelta) applyStatusesDelta(choiceObj.statusesDelta)
  if (choiceObj.statuses) applyStatusesDelta(choiceObj.statuses)

    if (choiceObj.nextScene) {
      storyScenes.value.push(choiceObj.nextScene)
  // 标记上一个场景的已选选项（保留 choices 数据供分支图使用）
  try { const prev = storyScenes.value[storyScenes.value.length - 2]; if (prev) prev.chosenChoiceId = choiceObj?.id || choiceObj?.choiceId || null } catch (e) {}
      currentSceneIndex.value = storyScenes.value.length - 1
      currentDialogueIndex.value = 0
      showText.value = true
      if (autoPlayEnabled.value) startAutoPlayTimer()
      return
    }

    if (choiceObj.nextScenes && Array.isArray(choiceObj.nextScenes)) {
      const startIdx = storyScenes.value.length
      storyScenes.value.push(...choiceObj.nextScenes)
  // 标记上一个场景的已选选项（保留 choices 数据供分支图使用）
  try { const prev = storyScenes.value[startIdx - 1]; if (prev) prev.chosenChoiceId = choiceObj?.id || choiceObj?.choiceId || null } catch (e) {}
      currentSceneIndex.value = startIdx
      currentDialogueIndex.value = 0
      showText.value = true
      if (autoPlayEnabled.value) startAutoPlayTimer()
      return
    }

    if (choiceObj.dialogues) {
      const idx = currentSceneIndex.value
      const newScene = Object.assign({}, storyScenes.value[idx], {
        backgroundImage: choiceObj.backgroundImage || storyScenes.value[idx].backgroundImage,
        dialogues: choiceObj.dialogues
      })
      storyScenes.value.splice(idx, 1, newScene)
      currentDialogueIndex.value = 0
      showText.value = true
      if (autoPlayEnabled.value) startAutoPlayTimer()
      return
    }
  } catch (err) {
    console.error('applyChoiceBranch 失败', err)
  }
}

// 控制选项展示（在某句阅读结束后出现）
const choicesVisible = ref(false)

// 当场景或对话索引变动，检查是否应该显示选项
watch([currentSceneIndex, currentDialogueIndex], () => {
  // 如果刚刚处理过一次选项，短时间内不要重新显示选项（防止选项被重复展示）
  try {
    if (Date.now() - (lastChoiceTimestamp.value || 0) < 600) return
  } catch (e) {}
  const scene = currentScene.value
  // 如果该场景的选项已被消费过（用户已经选择过），不要再次显示
  try { if (scene && scene.choiceConsumed) return } catch (e) {}
  if (!scene) return
  // 如果场景有 choices 且指定了触发句索引
  if (Array.isArray(scene.choices) && typeof scene.choiceTriggerIndex === 'number') {
    // 当阅读到触发句的索引（即等于或超过）时显示选项
    if (currentDialogueIndex.value >= scene.choiceTriggerIndex && showText.value) {
      choicesVisible.value = true
      // 自动播放遇到选项时暂停
      stopAutoPlayTimer()
    }
  }
})

const openAttributes = () => {
  showAttributesModal.value = true
  // 打开属性面板时暂停自动播放
  stopAutoPlayTimer()
}

const closeAttributes = () => {
  showAttributesModal.value = false
  // 关闭后在没有其它弹窗且用户开启自动播放时恢复
  try { if (autoPlayEnabled.value && !(anyOverlayOpen && anyOverlayOpen.value)) startAutoPlayTimer() } catch (e) {}
}

// 打开存档弹窗 / 读档弹窗，并刷新槽位信息
const openSaveModal = async () => {
  showSaveModal.value = true
  stopAutoPlayTimer()
  await refreshSlotInfos()
}
const openLoadModal = async () => {
  showLoadModal.value = true
  stopAutoPlayTimer()
  await refreshSlotInfos()
}
const closeSaveModal = () => { showSaveModal.value = false; try { if (autoPlayEnabled.value && !(anyOverlayOpen && anyOverlayOpen.value)) startAutoPlayTimer() } catch (e) {} }
const closeLoadModal = () => { showLoadModal.value = false; try { if (autoPlayEnabled.value && !(anyOverlayOpen && anyOverlayOpen.value)) startAutoPlayTimer() } catch (e) {} }

const refreshSlotInfos = async () => {
  try {
    const userId = getCurrentUserId()
    const workId = work.value.id
    const results = await Promise.all(SLOTS.map(async (slot) => {
      // 优先尝试后端或 mock 后端
      if (USE_BACKEND_SAVE) {
        try {
          const data = await backendLoad(userId, workId, slot)
          if (data) return { slot, data: deepClone(data) }
        } catch (e) {
          // 忽略错误，回退到本地
        }
      }
      // 回退到本地
      const key = localSaveKey(userId, workId, slot)
      const raw = localStorage.getItem(key)
      if (raw) {
  const data = JSON.parse(raw)
  return { slot, data: deepClone(data) }
      }
      return { slot, data: null }
    }))
  const info = {}
  SLOTS.forEach(s => (info[s] = null))
  results.forEach(r => { if (r && r.slot) info[r.slot] = r.data })
    slotInfos.value = info
  } catch (e) {
    console.warn('刷新槽位信息失败：', e)
  }
}

// 请求横屏
const requestLandscape = async () => {
  const element = document.documentElement
  
    // 横屏准备完成，开始加载（先显示 loading 屏，再尝试全屏）
  isLandscapeReady.value = true
  // 直接进入第二阶段的 loading 屏：显示加载进度并保持，直到后端场景到达或 stopLoading 被调用。
  try { showText.value = false; startLoading() } catch (e) { console.warn('startLoading failed', e) }
  
  try {
    // 在原生 APP 中，使用 Capacitor 插件锁定横屏
      if (isNativeApp.value) {
      console.log('检测到 APP 环境，使用 ScreenOrientation 插件')
      // 使用 Capacitor 插件锁定为横屏
      await ScreenOrientation.lock({ orientation: 'landscape' })
      console.log('✅ 成功锁定为横屏')
      
      // APP 中也尝试全屏（提供更沉浸的体验）
      if (element.requestFullscreen) {
        await element.requestFullscreen().catch(err => {
          console.log('全屏请求失败（APP 中可选）:', err)
        })
      }
    } else {
      console.log('检测到浏览器环境，使用标准 API')
      // 在浏览器中，先请求全屏再锁定方向
      if (element.requestFullscreen) {
        await element.requestFullscreen()
      } else if (element.mozRequestFullScreen) {
        await element.mozRequestFullScreen()
      } else if (element.webkitRequestFullscreen) {
        await element.webkitRequestFullscreen()
      } else if (element.msRequestFullscreen) {
        await element.msRequestFullscreen()
      }
      
      // 锁定屏幕方向为横屏
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape').catch(err => {
          console.log('屏幕方向锁定失败:', err)
        })
      }
    }
    } catch (err) {
    console.log('进入横屏失败:', err)
    // 开发环境降级处理：依赖 CSS 媒体查询实现横屏布局
  }
}

const applyAttributesDelta = (delta) => {
  if (!delta) return
  Object.keys(delta).forEach(k => {
    const v = delta[k]
    if (typeof v === 'number') {
      attributes.value[k] = (attributes.value[k] || 0) + v
    } else {
      // 非数值类型直接覆盖
      attributes.value[k] = v
    }
  })
}

// 应用“特殊状态”变化
// 规则：
// - 数值：累加（用于『怀疑 +10』）
// - null/false：移除该状态
// - 其他类型（字符串/对象/布尔）：覆盖
const applyStatusesDelta = (delta) => {
  if (!delta) return
  const target = statuses.value
  if (Array.isArray(delta)) {
    delta.forEach(entry => {
      if (!entry) return
      const key = entry.name || entry.key
      if (!key) return
      const v = entry.value ?? entry.level ?? entry.state ?? entry.description ?? entry
      if (v === null || v === false || entry.remove === true) {
        delete target[key]
      } else if (typeof v === 'number') {
        const cur = target[key]
        const curNum = typeof cur === 'number' ? cur : (cur?.value ?? cur?.level ?? 0)
        target[key] = (curNum || 0) + v
      } else {
        target[key] = v
      }
    })
    return
  }
  if (typeof delta === 'object') {
    Object.keys(delta).forEach(key => {
      const v = delta[key]
      if (v === null || v === false) {
        delete target[key]
      } else if (typeof v === 'number') {
        const cur = target[key]
        const curNum = typeof cur === 'number' ? cur : (cur?.value ?? cur?.level ?? 0)
        target[key] = (curNum || 0) + v
      } else {
        target[key] = v
      }
    })
  }
}

// 根据已保存的 choiceHistory 恢复场景的已选标记，并解锁后续场景的选项
const restoreChoiceFlagsFromHistory = () => {
  try {
    // 先重置所有场景的标记
    if (Array.isArray(storyScenes.value)) {
      storyScenes.value.forEach(s => {
        try { if (s) { s.choiceConsumed = false; s.chosenChoiceId = null } } catch (e) {}
      })
    }
    // 根据历史还原已选择的项（标记为已消耗）
    if (Array.isArray(choiceHistory.value)) {
      choiceHistory.value.forEach(h => {
        try {
          const sid = h.sceneId || h.sceneId
          const psid = String(sid)
          const idx = Array.isArray(storyScenes.value) ? storyScenes.value.findIndex(s => s && (String(s.id) === psid || String(s.sceneId) === psid)) : -1
          if (idx >= 0 && storyScenes.value[idx]) {
            try { storyScenes.value[idx].chosenChoiceId = h.choiceId || h.choiceId } catch (e) {}
            try { storyScenes.value[idx].choiceConsumed = true } catch (e) {}
          }
        } catch (e) {}
      })
    }
    // 确保当前场景（如果在可选择位置）不要被错误地标记为已消费，允许用户继续选择后续选项
    try {
      const cur = storyScenes.value && storyScenes.value[currentSceneIndex.value]
      if (cur && cur.choiceConsumed && typeof cur.choiceTriggerIndex === 'number') {
        // 如果当前对话尚未到触发选项的索引，则允许显示选项（取消已消费标记）
        if (typeof currentDialogueIndex.value === 'number' && currentDialogueIndex.value < cur.choiceTriggerIndex) {
          try { cur.choiceConsumed = false; cur.chosenChoiceId = null } catch (e) {}
        }
      }
    } catch (e) {}
  } catch (e) {
    console.warn('restoreChoiceFlagsFromHistory failed', e)
  }
}

// 处理选项点击：向后端请求选项后续剧情并应用返回结果
const chooseOption = async (choiceId) => {
  if (isFetchingChoice.value) return
  
  // 记录用户选择历史
  const scene = currentScene.value
  const choiceObj = scene?.choices?.find(c => c.id === choiceId)
  if (choiceObj) {
    choiceHistory.value.push({
      sceneId: scene.id || scene.sceneId,
      sceneTitle: scene.title || `场景 ${currentSceneIndex.value + 1}`,
      _uid: scene._uid || null,
      choiceId: choiceId,
      choiceText: choiceObj.text,
      timestamp: Date.now(),
      sceneIndex: currentSceneIndex.value,
      dialogueIndex: currentDialogueIndex.value
    })
  }
  
  // 用户点击选项后立即隐藏选项，直到后端返回或 mock 完成
  choicesVisible.value = false
  // 记录点击时间，短时间内抑制选项重新弹出
  try { lastChoiceTimestamp.value = Date.now() } catch (e) {}
  isFetchingChoice.value = true
  try {
    const scene = currentScene.value
    const localChoice = scene?.choices?.find(c => c.id === choiceId)

    // 优先使用本地选项自带的后续剧情（subsequentDialogues / nextScenes / nextScene）
    if (localChoice) {
      // 属性/状态变化直接应用
      if (localChoice.attributesDelta) applyAttributesDelta(localChoice.attributesDelta)
      if (localChoice.statusesDelta) applyStatusesDelta(localChoice.statusesDelta)
      if (localChoice.statuses) applyStatusesDelta(localChoice.statuses)

      // 若选项自带 subsequentDialogues（插入到当前场景）
      if (Array.isArray(localChoice.subsequentDialogues) && localChoice.subsequentDialogues.length > 0) {
        const idx = currentSceneIndex.value
        // 标记当前场景选项已被消费，防止后续重复弹出
        try { storyScenes.value[idx].choiceConsumed = true } catch (e) {}
        const insertAt = currentDialogueIndex.value + 1
        // 规范化为前端对话项（字符串或对象）
        const toInsert = localChoice.subsequentDialogues.map(d => (typeof d === 'string') ? d : (d.narration ?? d.text ?? String(d)))
        const currentDialogues = Array.isArray(storyScenes.value[idx].dialogues) ? storyScenes.value[idx].dialogues.slice() : []
        currentDialogues.splice(insertAt, 0, ...toInsert)
        storyScenes.value.splice(idx, 1, Object.assign({}, storyScenes.value[idx], { dialogues: currentDialogues }))
        // 移动到第一条插入的对话
        currentDialogueIndex.value = insertAt
        showText.value = true
        try { const prev = storyScenes.value[idx]; if (prev) prev.chosenChoiceId = choiceId } catch (e) {}
        if (autoPlayEnabled.value) startAutoPlayTimer()
        return
      }

      // 若选项自带 nextScenes（跳转到新场景序列）
      if (Array.isArray(localChoice.nextScenes) && localChoice.nextScenes.length > 0) {
        const startIdx = storyScenes.value.length
        for (const sc of localChoice.nextScenes) {
          try { pushSceneFromServer(sc) } catch (e) { console.warn('pushSceneFromServer failed for choice nextScenes entry', e) }
        }
        // 标记上一个场景选项已被消费（避免回到上一场景时再次弹出）
        try { const prev = storyScenes.value[startIdx - 1]; if (prev) prev.choiceConsumed = true } catch (e) {}
        currentSceneIndex.value = startIdx
        currentDialogueIndex.value = 0
        showText.value = true
        try { const prev = storyScenes.value[startIdx - 1]; if (prev) prev.chosenChoiceId = choiceId } catch (e) {}
        if (autoPlayEnabled.value) startAutoPlayTimer()
        return
      }

      // 若选项携带单条 nextScene
      if (localChoice.nextScene) {
        const startIdx = storyScenes.value.length
        try { pushSceneFromServer(localChoice.nextScene) } catch (e) { console.warn('pushSceneFromServer failed for choice nextScene', e) }
        // 标记上一个场景选项已被消费
        try { const prev = storyScenes.value[startIdx - 1]; if (prev) prev.choiceConsumed = true } catch (e) {}
        currentSceneIndex.value = startIdx
        currentDialogueIndex.value = 0
        showText.value = true
        try { const prev = storyScenes.value[startIdx - 1]; if (prev) prev.chosenChoiceId = choiceId } catch (e) {}
        if (autoPlayEnabled.value) startAutoPlayTimer()
        return
      }

      // 如果本地选项没有后续剧情，只标记选择并尝试推进到下一个场景
      try { const prev = storyScenes.value[currentSceneIndex.value]; if (prev) prev.chosenChoiceId = choiceId } catch (e) {}
      if (currentSceneIndex.value < storyScenes.value.length - 1) {
        // 标记当前场景选项已被消费（用户已选择，即使没有插入后续剧情）
        try { const prev = storyScenes.value[currentSceneIndex.value]; if (prev) prev.choiceConsumed = true } catch (e) {}
        currentSceneIndex.value++
        currentDialogueIndex.value = 0
        showText.value = true
      } else {
        try { requestNextIfNeeded() } catch (e) { console.warn('requestNextIfNeeded failed after localChoice', e) }
      }
      return
    }

    // 没有本地选项数据的情况：尝试推进到下一个已有场景或触发预取下一章
    if (currentSceneIndex.value < storyScenes.value.length - 1) {
      currentSceneIndex.value++
      currentDialogueIndex.value = 0
      showText.value = true
    } else {
      try { await requestNextIfNeeded() } catch (e) { console.warn('requestNextIfNeeded failed', e) }
    }
  } catch (err) {
    console.error('选择处理失败', err)
    // 为保持“锦瑟深宫”剧情纯净，移除与主题无关的离线回退
    alert('获取选项后续剧情失败：' + (err?.message || '网络异常'))
  } finally {
    isFetchingChoice.value = false
  }
}

// 加载过程：加载页背景直接使用封面；进度条缓慢推进，便于可视化
const startLoading = () => {
  isLoading.value = true
  loadingProgress.value = 0

  // 如果存在封面，先展示启动进度
  try { if (work.value.coverUrl) loadingProgress.value = Math.max(loadingProgress.value, 8) } catch (e) {}

  // 清理已有计时器（若有）并启动新的平滑计时器
  if (startLoading._timer) {
    clearInterval(startLoading._timer)
    startLoading._timer = null
  }
  // 以 200ms 步进，平滑推进到 90% 的目标，真实完成时调用 stopLoading
  startLoading._timer = setInterval(() => {
    try {
      const target = 90
      const delta = Math.max(0.4, (target - loadingProgress.value) * 0.06)
      loadingProgress.value = Math.min(target, +(loadingProgress.value + delta).toFixed(2))
    } catch (e) { console.warn('startLoading timer err', e) }
  }, 200)
}

// 停止 loading 并显示完成状态（可选短延迟以显示 100%），并清理计时器
const stopLoading = async (opts = { delay: 200 }) => {
  try { if (startLoading._timer) { clearInterval(startLoading._timer); startLoading._timer = null } } catch (e) {}
  try { loadingProgress.value = 100 } catch (e) {}
  if (opts && opts.delay) await new Promise(r => setTimeout(r, opts.delay))
  isLoading.value = false
  showText.value = true
  // 延迟清零进度，避免视觉闪烁
  setTimeout(() => { try { loadingProgress.value = 0 } catch (e) {} }, 120)
}


// 页面加载时请求横屏并开始加载
onMounted(async () => {
  // 加载自动播放偏好并按需启动
  loadAutoPlayPrefs()
  if (autoPlayEnabled.value) startAutoPlayTimer()
  // 检查是否从结算页面跳回来并携带了加载数据
  if (history.state?.loadedData) {
    const loadedData = history.state.loadedData
    // 恢复游戏状态（注意：loadedData 可能不包含完整的 storyScenes）
    // 优先尝试根据 sceneId 定位到已加载的 storyScenes，否则回退到首个场景
      try {
      if (loadedData.sceneId != null && Array.isArray(storyScenes.value)) {
        // 使用字符串比较以兼容 number/string id 的差异
        const lsid = String(loadedData.sceneId)
        let idx = storyScenes.value.findIndex(s => s && (String(s.id) === lsid || String(s.sceneId) === lsid))
        // 如果没有找到，但提供了 chapterIndex，则尝试拉取该章节以恢复场景列表
        if (idx < 0 && typeof loadedData.chapterIndex === 'number') {
          try {
            const fetched = await fetchNextContent(work.value.id, loadedData.chapterIndex)
            if (fetched && Array.isArray(fetched.scenes) && fetched.scenes.length > 0) {
              for (const s of fetched.scenes) {
                try { pushSceneFromServer(s) } catch (e) { console.warn('pushSceneFromServer failed when restoring chapter (mounted):', e) }
              }
              idx = storyScenes.value.findIndex(s => s && (String(s.id) === lsid || String(s.sceneId) === lsid))
            }
          } catch (e) { console.warn('fetchNextContent failed while restoring loadedData chapter:', e) }
        }
        currentSceneIndex.value = (idx >= 0) ? idx : 0
      } else if (typeof loadedData.currentSceneIndex === 'number') {
        currentSceneIndex.value = loadedData.currentSceneIndex
      } else if (typeof loadedData.chapterIndex === 'number' && Array.isArray(storyScenes.value)) {
        const idx = storyScenes.value.findIndex(s => s && (s.chapterIndex === loadedData.chapterIndex || s.chapter === loadedData.chapterIndex))
        currentSceneIndex.value = (idx >= 0) ? idx : 0
      } else {
        currentSceneIndex.value = 0
      }
      if (typeof loadedData.currentDialogueIndex === 'number') currentDialogueIndex.value = loadedData.currentDialogueIndex
      else if (loadedData.dialogueIndex != null) currentDialogueIndex.value = loadedData.dialogueIndex
    } catch (e) { /* ignore */ }
  attributes.value = loadedData.attributes || {}
  statuses.value = loadedData.statuses || {}
  choiceHistory.value = loadedData.choiceHistory || []
  try { restoreChoiceFlagsFromHistory() } catch (e) { console.warn('restoreChoiceFlagsFromHistory error (loadedData):', e) }
    
    // 直接进入游戏
    isLandscapeReady.value = true
    // 即便数据已恢复，为了视觉一致性仍然执行一次平滑加载到 100% 的动画
    try {
      const dur = USE_MOCK_STORY ? 10000 : 900
      await simulateLoadTo100(dur)
    } catch (e) {
      isLoading.value = false
    }
    showText.value = true
    return
  }

  if (isNativeApp.value) {
    // APP 环境：直接进入横屏
    isLandscapeReady.value = true
    requestLandscape()
  } else {
    // 浏览器环境：在开发模式下自动进入阅读以便测试选项；生产模式仍显示进入阅读按钮
    try {
      if (import.meta.env && import.meta.env.DEV) {
        isLandscapeReady.value = true
        try { const dur = USE_MOCK_STORY ? 10000 : 900; simulateLoadTo100(dur) } catch (e) {}
      } else {
        // 生产/正式环境：显示进入阅读按钮
      }
    } catch (e) {
      // 某些构建环境可能不支持 import.meta.env，这里保守处理
    }
  }
  // 页面可见性变化：隐藏→暂停自动播放并尝试自动存档；可见→如开启自动播放则恢复
  const onVisibility = () => {
    if (document.hidden) {
      // 后台：暂停自动播放，避免后台计时推进
      stopAutoPlayTimer()
      autoSaveToSlot(AUTO_SAVE_SLOT)
    } else {
      // 回到前台：如当前设置开启自动播放且没有弹窗打开，则恢复计时器
      try {
        if (autoPlayEnabled.value && !(anyOverlayOpen && anyOverlayOpen.value)) startAutoPlayTimer()
      } catch (e) {
        if (autoPlayEnabled.value) startAutoPlayTimer()
      }
    }
  }
  document.addEventListener('visibilitychange', onVisibility)
  // 卸载/刷新前的本地快速存档
  const onBeforeUnload = () => {
    quickLocalAutoSave(AUTO_SAVE_SLOT)
  }
  window.addEventListener('beforeunload', onBeforeUnload)
  // 存储清理函数到实例上，便于卸载时移除
  ;(onMounted._cleanup = () => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('beforeunload', onBeforeUnload)
  })
})

// 页面卸载时解锁屏幕方向
onUnmounted(async () => {
  // 停止自动播放计时器
  stopAutoPlayTimer()
  try {
    // 卸载前自动存档
    await autoSaveToSlot(AUTO_SAVE_SLOT)
    if (isNativeApp.value) {
      await ScreenOrientation.unlock()
      console.log('组件卸载，已解锁屏幕方向')
    } else if (screen.orientation && screen.orientation.unlock) {
      screen.orientation.unlock()
    }
  } catch (err) {
    console.log('解锁屏幕方向失败:', err)
  }
  // 清理挂载时添加的侦听
  if (onMounted._cleanup) try { onMounted._cleanup() } catch {}
})
</script>

<template>
  <div class="game-page">
    <!-- 横屏准备界面 -->
    <div v-if="!isLandscapeReady" class="landscape-prompt">
      <div class="prompt-content">
        <h2 class="prompt-title">{{ work.title }}</h2>
        <p class="prompt-text">即将进入横屏阅读模式</p>
        <p class="prompt-hint">为获得最佳阅读体验，请横置您的设备</p>
        <button class="enter-button" @click="requestLandscape">
          <span>进入阅读</span>
        </button>
      </div>
    </div>

    <!-- 加载界面 -->
    <transition name="fade">
      <div v-if="isLandscapeReady && isLoading" class="loading-screen">
        <!-- 封面背景图 -->
  <div class="loading-cover-bg" :style="{ backgroundImage: `url(${effectiveCoverUrl})` }"></div>
        
        <div class="loading-content">
          <!-- 游戏标题（使用作品名） -->
          <h1 class="game-title">{{ work.title }}</h1>
          
          <!-- 进度条与毛笔（毛笔跟随进度条滑动） -->
          <div class="loading-progress-container">
            <!-- 毛笔：使用 left 绑定使其跟随进度条的 thumb（通过 translateX(-50%) 居中） -->
            <div class="brush-container" :style="{ left: loadingProgress + '%' }">
              <svg class="brush-icon" viewBox="0 0 64 64" fill="none">
                <!-- 毛笔笔杆 -->
                <path 
                  d="M32 8 L32 40" 
                  stroke="#8B4513" 
                  stroke-width="3" 
                  stroke-linecap="round"
                />
                <!-- 毛笔笔头 -->
                <path 
                  d="M32 40 L28 52 L32 56 L36 52 Z" 
                  fill="#2C2C2C"
                  stroke="#1C1C1C"
                  stroke-width="1"
                />
                <!-- 毛笔尖 -->
                <path 
                  d="M32 56 L30 60 L32 62 L34 60 Z" 
                  fill="#1C1C1C"
                />
                <!-- 笔杆装饰 -->
                <circle cx="32" cy="12" r="2" fill="#D4A574"/>
                <circle cx="32" cy="20" r="2" fill="#D4A574"/>
                <circle cx="32" cy="28" r="2" fill="#D4A574"/>
              </svg>
            </div>

            <div class="loading-progress-bg">
              <div class="loading-progress-fill" :style="{ width: loadingProgress + '%' }">
                <div class="progress-shine"></div>
              </div>
            </div>
            <div class="loading-text">{{ Math.floor(loadingProgress) }}%</div>
          </div>
          
          <!-- 加载提示 -->
          <div class="loading-tips">
            <p class="tip-text">{{ isGeneratingSettlement ? '结算页面生成中...' : '正在准备故事...' }}</p>
          </div>
        </div>
        
        <!-- 背景装饰 -->
        <div class="bg-decoration">
          <div class="decoration-circle"></div>
          <div class="decoration-circle"></div>
          <div class="decoration-circle"></div>
        </div>
      </div>
    </transition>
    
    <!-- 游戏内容（橙光风格） -->
    <div v-show="isLandscapeReady && !isLoading" class="game-content">
      <!-- 中心加载指示：获取后续剧情时显示（非阻塞） -->
      <div v-if="isFetchingNext" class="center-loading" aria-live="polite" aria-label="后续剧情生成中">
        <div class="center-spinner"></div>
      </div>

      <!-- 背景图层 -->
      <div class="background-layer" :style="{ backgroundImage: `url(${currentBackground})` }"></div>
      
      <!-- 遮罩层（让文字更清晰） -->
      <div class="overlay-layer"></div>
      
      <!-- 点击区域（点击进入下一句） -->
      <div class="click-area" @click="nextDialogue"></div>

      <!-- 选项区域（如果当前场景包含 choices） - 放在 text-box 之外，避免被裁剪 -->
      <div 
        v-if="currentScene && currentScene.choices && choicesVisible" 
        class="choices-container" 
        :class="{ disabled: showMenu }"
        @click.stop>
        <div class="choice" v-for="choice in currentScene.choices" :key="choice.id">
          <button 
            class="choice-btn" 
            :disabled="isFetchingChoice || showMenu" 
            @click="chooseOption(choice.id)">
            {{ choice.text }}
          </button>
        </div>
      </div>
      
      <!-- 文字栏 -->
      <div class="text-box" @click="nextDialogue">
        <!-- 说话人标签（可选） -->
        <div v-if="currentSpeaker" class="speaker-badge">{{ currentSpeaker }}</div>
        <transition name="text-fade">
          <p v-show="showText" class="dialogue-text">{{ currentDialogue }}</p>
        </transition>
        
        <!-- 继续提示箭头 -->
        <div v-if="showText && !isLastDialogue" class="continue-hint">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
          </svg>
        </div>
      </div>
      
      <!-- 顶部进度条 -->
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: readingProgress + '%' }"></div>
      </div>
      
      <!-- 菜单按钮 -->
      <button class="menu-button" @click.stop="toggleMenu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <line x1="3" y1="12" x2="21" y2="12" stroke-width="2"/>
          <line x1="3" y1="6" x2="21" y2="6" stroke-width="2"/>
          <line x1="3" y1="18" x2="21" y2="18" stroke-width="2"/>
        </svg>
      </button>

      <!-- 顶部不再显示快速操作，相关功能移动到菜单中 -->
      
      <!-- 菜单面板 -->
      <transition name="slide-down">
        <div v-if="showMenu" class="menu-panel" @click.stop>
          <button class="menu-item" @click="goBack">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M19 12H5M12 19l-7-7 7-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>返回作品页</span>
          </button>
          
          <button class="menu-item" @click="toggleMenu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M18 6L6 18M6 6l12 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>继续阅读</span>
          </button>

          <!-- 整合功能入口：存档 / 读档 / 属性 / 设置（并列网格） -->
          <div class="menu-grid">
            <button class="menu-item" @click="showMenu = false; openSaveModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M5 20h14a1 1 0 0 0 1-1V7l-4-4H6a1 1 0 0 0-1 1v16zM8 8h8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>存档</span>
            </button>
            <button class="menu-item" @click="showMenu = false; openLoadModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 9l5 5 5-5M12 14V3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>读档</span>
            </button>
            <button class="menu-item" @click="showMenu = false; openAttributes()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="3" stroke-width="2"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V22a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0A1.65 1.65 0 0 0 9 2.09V2a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0A1.65 1.65 0 0 0 21.91 11H22a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>属性</span>
            </button>
            <button class="menu-item" @click="showMenu = false; showSettingsModal = true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" stroke-width="2"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.27.27a2 2 0 1 1-2.83 2.83l-.27-.27a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V22a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.27.27a2 2 0 1 1-2.83-2.83l.27-.27a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.27-.27a2 2 0 1 1 2.83-2.83l.27.27a1.65 1.65 0 0 0 1.82.33h0A1.65 1.65 0 0 0 9 2.09V2a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.27-.27a2 2 0 1 1 2.83 2.83l-.27.27a1.65 1.65 0 0 0-.33 1.82v0A1.65 1.65 0 0 0 21.91 11H22a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>设置</span>
            </button>
          </div>
          
          <div class="menu-progress">
            <span>阅读进度：{{ Math.floor(readingProgress) }}%</span>
            <span>场景 {{ currentSceneIndex + 1 }} / {{ storyScenes.length }}</span>
          </div>
        </div>
      </transition>
    </div>

    <!-- 存档弹窗（3个槽位） -->
    <div v-if="showSaveModal" class="modal-backdrop" @click.self="closeSaveModal">
      <div class="modal-panel save-load-modal">
        <div class="modal-header">
          <h3>选择存档槽位</h3>
          <button class="modal-close" @click="closeSaveModal">×</button>
        </div>
        <div class="slot-list">
          <div v-for="slot in SLOTS" :key="slot" class="slot-card">
            <div class="slot-title">{{ slot.toUpperCase() }}</div>
            <div v-if="slotInfos[slot]">
                <div class="slot-thumb" v-if="(slotInfos[slot].thumbnailData || slotInfos[slot].thumbnail || (slotInfos[slot].game_state && (slotInfos[slot].game_state.thumbnailData || slotInfos[slot].game_state.thumbnail)))">
                  <img :src="slotInfos[slot].thumbnailData || slotInfos[slot].thumbnail || (slotInfos[slot].game_state && (slotInfos[slot].game_state.thumbnailData || slotInfos[slot].game_state.thumbnail))" alt="thumb" />
                  <div class="thumb-meta">
                    <div class="meta-time">{{ new Date(slotInfos[slot].timestamp || Date.now()).toLocaleString() }}</div>
                  </div>
                </div>
                <div class="slot-meta" v-else>
                  <div>时间：{{ new Date(slotInfos[slot].timestamp || Date.now()).toLocaleString() }}</div>
                </div>
            </div>
            <div class="slot-meta empty" v-else>空槽位</div>
            <div class="slot-actions">
              <button @click="saveGame(slot).then(() => refreshSlotInfos())">保存到 {{ slot.toUpperCase() }}</button>
              <button v-if="slotInfos[slot]" @click="deleteGame(slot)" class="delete-btn">删除</button>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button @click="closeSaveModal">关闭</button>
        </div>
      </div>
    </div>

    <!-- 设置弹窗：自动播放 -->
    <div v-if="showSettingsModal" class="modal-backdrop" @click.self="showSettingsModal = false">
      <div class="modal-panel settings-modal">
        <div class="modal-header">
          <h3>设置</h3>
          <button class="modal-close" @click="showSettingsModal = false">×</button>
        </div>
        <div class="settings-body">
          <label class="row">
            <input type="checkbox" v-model="autoPlayEnabled" />
            <span>自动播放（遇到选项自动暂停）</span>
          </label>
          <label class="row">
            <span>每段间隔（毫秒）：</span>
            <input type="number" min="2000" max="10000" step="500" v-model.number="autoPlayIntervalMs" style="width:140px" />
          </label>
          <p class="hint">范围 2000ms–10000ms（即 2–10 秒）；开启后系统将按间隔自动播放，遇到选项暂停，选择后继续。</p>
        </div>
        <div class="modal-actions">
          <button @click="showSettingsModal = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 读档弹窗（3个槽位） -->
    <div v-if="showLoadModal" class="modal-backdrop" @click.self="closeLoadModal">
      <div class="modal-panel save-load-modal">
        <div class="modal-header">
          <h3>选择读档槽位</h3>
          <button class="modal-close" @click="closeLoadModal">×</button>
        </div>
        <div class="slot-list">
          <div v-for="slot in SLOTS" :key="slot" class="slot-card">
            <div class="slot-title">{{ slot.toUpperCase() }}</div>
            <div v-if="slotInfos[slot]">
              <div class="slot-thumb" v-if="(slotInfos[slot].thumbnailData || slotInfos[slot].thumbnail || (slotInfos[slot].game_state && (slotInfos[slot].game_state.thumbnailData || slotInfos[slot].game_state.thumbnail)))">
                <img :src="slotInfos[slot].thumbnailData || slotInfos[slot].thumbnail || (slotInfos[slot].game_state && (slotInfos[slot].game_state.thumbnailData || slotInfos[slot].game_state.thumbnail))" alt="thumb" />
                <div class="thumb-meta">
                  <div class="meta-time">{{ new Date(slotInfos[slot].timestamp || Date.now()).toLocaleString() }}</div>
                </div>
              </div>
              <div class="slot-meta" v-else>
                <div>时间：{{ new Date(slotInfos[slot].timestamp || Date.now()).toLocaleString() }}</div>
              </div>
            </div>
            <div class="slot-meta empty" v-else>空槽位</div>
            <div class="slot-actions">
              <button :disabled="!slotInfos[slot]" @click="loadGame(slot)">读取 {{ slot.toUpperCase() }}</button>
              <button v-if="slotInfos[slot]" @click="deleteGame(slot)" class="delete-btn">删除</button>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button @click="closeLoadModal">关闭</button>
        </div>
      </div>
    </div>

    <!-- 属性模态：左（属性）右（特殊状态） -->
    <div v-if="showAttributesModal" class="modal-backdrop" @click.self="closeAttributes">
      <div class="modal-panel attributes-panel">
  <h3>角色信息</h3>

        <div class="attr-status-grid">
          <!-- 左：属性 -->
          <div class="attr-col">
            <div class="section-title">属性</div>
            <div v-if="Object.keys(attributes).length === 0" class="empty-text">暂无属性</div>
            <ul v-else class="kv-list">
              <li v-for="(val, key) in attributes" :key="key">
                <span class="kv-key">{{ key }}</span>
                <span class="kv-sep">：</span>
                <span class="kv-val">{{ val }}</span>
              </li>
            </ul>
          </div>
          <!-- 右：特殊状态 -->
          <div class="status-col">
            <div class="section-title">特殊状态</div>
            <div v-if="Object.keys(statuses).length === 0" class="empty-text">暂无特殊状态</div>
            <ul v-else class="kv-list">
              <li v-for="(val, key) in statuses" :key="key">
                <span class="kv-key">{{ key }}</span>
                <span class="kv-sep">：</span>
                <span class="kv-val">{{ typeof val === 'object' ? (val.value ?? val.level ?? val.state ?? JSON.stringify(val)) : val }}</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- 预留空白区（用于后续“角色信息变更为：...”等动态指令显示/扩展），按设计需要可调高 -->
        <div class="attr-blank-space"></div>

        <!-- 底部区：将按钮与元信息一起固定在面板底部，元信息保持为最后一行 -->
        <div class="attributes-bottom">
          <div class="modal-row" v-if="isFetchingChoice"><em>正在获取选项后续剧情...</em></div>
          <div class="modal-actions">
            <button @click="saveGame('slot1')">存档到槽1</button>
            <button @click="loadGame('slot1')">从槽1读档</button>
            <button @click="closeAttributes">关闭</button>
          </div>
          <div class="attributes-meta">
            <div class="modal-row meta-small"><strong>作品：</strong> {{ work.title }}</div>
            <div class="modal-row meta-small"><strong>作者ID：</strong> {{ work.authorId }}</div>
            <div class="modal-row meta-small" v-if="lastSaveInfo"><strong>最后存档：</strong> {{ new Date(lastSaveInfo.timestamp).toLocaleString() }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 临时提示（存档/读档） -->
    <div class="toast save-toast" v-if="saveToast">{{ saveToast }}</div>
    <div class="toast load-toast" v-if="loadToast">{{ loadToast }}</div>
  </div>
</template>
