<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { useRouter } from 'vue-router'
import { http } from '../service/http.js'
import { addFavorite, deleteFavorite, getComments, postComments, likeComment, unlikeComment, reportComment } from '../api/user.js'
import { sanitize } from '../utils/sensitiveFilter'
import { useTags } from '../composables/useTags'; // 导入标签工具函数

// 初始化标签工具
const { getTagsByIds } = useTags();

const router = useRouter()

// 当前用户信息（用于权限判断）
const userInfo = ref({})
try { userInfo.value = JSON.parse(localStorage.getItem('userInfo') || '{}') } catch (e) { userInfo.value = {} }
const isStaff = computed(() => !!(userInfo.value.is_staff || userInfo.value.isStaff || userInfo.value.staff))

const goBack = () => {
  router.push('/')
}
// 允许向父组件或上层逻辑发出删除/举报事件
const emit = defineEmits(['delete-comment', 'report-comment'])

// 简单 Toast 系统（替代 alert）
const toasts = ref([])
const toastIdSeq = { v: 0 }
const showToast = (message, type = 'info', duration = 3000) => {
  const id = ++toastIdSeq.v
  toasts.value.push({ id, message, type })
  if (duration > 0) {
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id)
    }, duration)
  }
}
const removeToast = (id) => { toasts.value = toasts.value.filter(t => t.id !== id) }

// 单个作品数据（从后端获取）
const route = useRoute()
const state = history.state || {}
// 若存在 createResult，则优先使用 sessionStorage.createResult 中的 backendWork
let sessionCreate = null
try { sessionCreate = JSON.parse(sessionStorage.getItem('createResult')) } catch (e) { sessionCreate = null }

// 规范化后端返回的数据字段（兼容 image_url / coverUrl / cover_url 等差异）
const normalizeBackendWork = (raw) => {
  if (!raw) return null
  const coverCandidate = raw.coverUrl || raw.cover_url || raw.image_url || raw.imageUrl || raw.cover || (raw.image && raw.image.url) || ''
  let cover = coverCandidate || ''
  if (cover && /^\//.test(cover)) cover = 'http://127.0.0.1:8000/' + cover
  // 如果已经是完整 URL，保留原样
  return {
    id: raw.id,
    author: raw.author,
    title: raw.title || raw.name || raw.work_title || '',
    description: raw.description || raw.desc || raw.summary || '',
    coverUrl: cover || raw.coverUrl || raw.image_url || '',
    tags: raw.tags || raw.tag_names || raw.tag_ids || [],
    favoritesCount: raw.favorite_count || raw.favoritesCount || 0,
      publishedAt: raw.published_at || raw.publishedAt || raw.created_at || null,
    updatedAt: raw.updated_at || raw.updatedAt || raw.modified || null,
    isFavorited: raw.is_favorited || false,
    averageScore: raw.average_score || raw.averageScore || 0,
    ratingCount: raw.rating_count || raw.ratingCount || 0,
    wordCount: raw.word_count || null,
    // 兼容后端可能使用的 price 或 unlock_points_needed 字段，用于解锁/付费显示
    price: typeof raw.price !== 'undefined' ? raw.price : (typeof raw.unlock_points_needed !== 'undefined' ? raw.unlock_points_needed : undefined),
    readCount: raw.read_count || 0
  }
}

let backendWorkRaw = normalizeBackendWork(state.backendWork || sessionCreate?.backendWork || null)

const work = ref({
  id: backendWorkRaw?.id || null,
  title: backendWorkRaw?.title || '',
  coverUrl: backendWorkRaw?.coverUrl || '',
  authorId: backendWorkRaw?.authorId || '',
  tags: backendWorkRaw?.tags || [],
  description: backendWorkRaw?.description || '',
  isFavorite: backendWorkRaw?.isFavorited || false
})

// 如果首次没有传入 backendWork（直接打开 /works 或刷新），尝试在挂载时去后端拉取最新详情并规范化映射
onMounted(async () => {
  try {
    // 每次进入作品介绍页都向后端拉取最新详情，避免展示本地占位内容
    // 优先使用路由参数 / query 中的 id，其次使用 sessionStorage.createResult 中的 backendWork.id，最后回退到当前 work.value.id
    let sr = null
    try { sr = JSON.parse(sessionStorage.getItem('createResult')) } catch (e) { sr = null }
    const paramId = route.params?.id || route.query?.id || null
    const candidateId = paramId || sr?.backendWork?.id || new URLSearchParams(window.location.search).get('id') || work.value.id

    if (!candidateId) {
      console.warn('[game_introduction] no candidate id to fetch')
      return
    }

    const details = await http.get(`/api/gameworks/gameworks/${candidateId}/`)
    // 兼容不同后端返回格式，优先取 data
    const payload = details?.data || details || null
    if (!payload) {
      console.warn('[game_introduction] fetched empty payload for id', candidateId)
      return
    }

    const normalized = normalizeBackendWork(payload)
    if (normalized) {
      // 完整覆盖界面字段，优先使用后端数据（但保留 tags 若路由/导航传入 overrides）
      work.value.id = normalized.id || work.value.id
      work.value.authorId = normalized.author || work.value.authorId
      work.value.title = normalized.title || work.value.title
      work.value.coverUrl = normalized.coverUrl || work.value.coverUrl
      work.value.description = normalized.description || work.value.description
     
      const fetchedTags = await getTagsByIds(normalized.tags || []);
      work.value.tags = fetchedTags || [];
      
      work.value.isFavorite = normalized.isFavorited || work.value.isFavorite
      try { favoritesCount.value = payload.favorite_count || payload.favoritesCount || favoritesCount.value } catch (e) {}
      try { publishedAt.value = payload.published_at || payload.publishedAt || payload.created_at || publishedAt.value } catch (e) {}
      try { updatedAt.value = payload.updated_at || payload.updatedAt || payload.modified || updatedAt.value } catch (e) {}
      try { averageScore.value = payload.average_score || payload.averageScore || averageScore.value } catch (e) {}
      try { ratingCount.value = payload.rating_count || payload.ratingCount || ratingCount.value } catch (e) {}
      work.value.isFavorite = normalized.isFavorited
      
      // 更新统计数据
      favoritesCount.value = normalized.favoritesCount
      publishedAt.value = normalized.publishedAt || publishedAt.value
      updatedAt.value = normalized.updatedAt || updatedAt.value
      averageScore.value = normalized.averageScore
      ratingCount.value = normalized.ratingCount
      readCount.value = normalized.readCount
      // 如果后端返回积分相关字段，更新前端显示（兼容 price / unlock_points_needed / 嵌套 gamwork.data）
      try {
        if (typeof payload.unlock_points_needed !== 'undefined') {
          unlockPointsNeeded.value = payload.unlock_points_needed
        } else if (typeof payload.price !== 'undefined') {
          unlockPointsNeeded.value = payload.price
        } else if (payload.gamework && typeof payload.gamework.price !== 'undefined') {
          unlockPointsNeeded.value = payload.gamework.price
        } else if (payload.data && typeof payload.data.price !== 'undefined') {
          unlockPointsNeeded.value = payload.data.price
        }

        // 后端可能使用多种字段表示“当前用户已送出积分”的值：优先使用 user_reward_amount（明确表示当前用户当次/累计送出数），
        // 然后回退到 user_given_points 或嵌套对象中的同名字段。
        if (typeof payload.user_reward_amount !== 'undefined') {
          userGivenPoints.value = payload.user_reward_amount
        } else if (payload.data && typeof payload.data.user_reward_amount !== 'undefined') {
          userGivenPoints.value = payload.data.user_reward_amount
        } else if (typeof payload.user_given_points !== 'undefined') {
          userGivenPoints.value = payload.user_given_points
        } else if (payload.gamework && typeof payload.gamework.user_given_points !== 'undefined') {
          userGivenPoints.value = payload.gamework.user_given_points
        }
      } catch (e) {}
      if (normalized.wordCount !== null) {
        backendWordCount.value = normalized.wordCount
      }

      // 如果后端返回章节数，则更新 totalChapters
      try {
        if (typeof payload.total_chapters !== 'undefined') totalChapters.value = payload.total_chapters
        else if (typeof payload.totalChapters !== 'undefined') totalChapters.value = payload.totalChapters
      } catch (e) {}

      // 将获取到的后端原始数据写回 sessionStorage.createResult，方便其他页面/刷新时复用
      try {
        const prev = JSON.parse(sessionStorage.getItem('createResult') || '{}')
        // 写入后端原始数据到 backendWork，便于其它页面读取；同时保留两个重要标记：modifiable / ai_callable
        prev.backendWork = payload
        // 兼容性：将 modifiable 与 ai_callable 同时写回顶级 createResult，便于前端快速判断权限/能力
        try { prev.modifiable = !!payload.modifiable } catch (e) {}
        try { prev.ai_callable = typeof payload.ai_callable !== 'undefined' ? !!payload.ai_callable : (payload.data && typeof payload.data.ai_callable !== 'undefined' ? !!payload.data.ai_callable : undefined) } catch (e) {}
        sessionStorage.setItem('createResult', JSON.stringify(prev))
      } catch (e) { console.warn('failed to write createResult to sessionStorage', e) }
      // 如果 payload 中包含评论数据，归一化并写入 comments
      try {
        if (Array.isArray(payload.comments_by_time)) {
          rawCommentsByTime.value = payload.comments_by_time
          comments.value = normalizeComments(payload.comments_by_time)
        }
        if (Array.isArray(payload.comments_by_hot)) {
          rawCommentsByHot.value = payload.comments_by_hot
        }
        // 如果后端返回 rating_details，则用它初始化评分分页数据
        try {
          if (Array.isArray(payload.rating_details)) {
            ratings.value = payload.rating_details.map((r, idx) => {
              const created = r.created_at || r.createdAt || r.time || null
              const timestamp = created ? Date.parse(created) : Date.now() - idx
              const score10 = Number(r.score || r.score10 || 0)
              return {
                id: `${timestamp}_${idx}`,
                author: r.username || r.user || '匿名',
                profile_picture: r.profile_picture || r.profilePicture || null,
                stars: Math.round((score10 || 0) / 2),
                score10: score10,
                time: created ? new Date(created).toLocaleString() : '未知',
                timestamp: timestamp
              }
            })
            // 尝试读取当前登录用户的用户名（优先 window 注入，其次 localStorage.userInfo）
            try {
              if (!currentUsername.value) {
                if (window.__STORYCRAFT_USER__ && window.__STORYCRAFT_USER__.username) currentUsername.value = window.__STORYCRAFT_USER__.username
                else {
                  const stored = localStorage.getItem('userInfo')
                  if (stored) {
                    const u = JSON.parse(stored)
                    currentUsername.value = u?.username || u?.user || null
                  }
                }
              }
            } catch (e) {}

            // 如果当前用户已在后端评分记录中出现，标记为已评分并在星级处显示他之前的分数
            try {
              if (currentUsername.value) {
                const found = payload.rating_details.find(r => (r.username || r.user) === currentUsername.value)
                if (found) {
                  userHasRated.value = true
                  const s10 = Number(found.score || found.score10 || 0)
                  if (!isNaN(s10) && s10 > 0) selectedStars.value = Math.round(s10 / 2)
                }
              }
            } catch (e) { console.warn('check user rating failed', e) }
          }
        } catch (e) { console.warn('failed to parse rating_details from payload', e) }
      } catch (e) { console.warn('failed to parse comments from payload', e) }
    }
    // 仅在作品详情未包含任何评论时，回退到独立的 comments API 拉取（避免覆盖已加载的评论）
    if ((!rawCommentsByTime.value || rawCommentsByTime.value.length === 0) && (!rawCommentsByHot.value || rawCommentsByHot.value.length === 0)) {
      await fetchCommentsFromAPI(1)
    }

  } catch (e) {
    console.error('[game_introduction] fetch work details failed:', e)
    console.error('[game_introduction] Error details:', {
      message: e.message,
      status: e.status,
      code: e.code,
      candidateId,
      baseURL: http.baseURL || 'unknown'
    })
    // 在开发环境显示错误提示（帮助调试真机问题）
    if (import.meta.env.DEV) {
      showToast(`[调试信息] 获取作品详情失败\nID: ${candidateId}\n错误: ${e.message}\n请检查网络连接和后端服务器`, 'error', 7000)
    }
  }
})

// 切换收藏状态
const toggleFavorite = () => {
  work.value.isFavorite = !work.value.isFavorite
}
// 收藏数（示例初始值或来自后端）
const favoritesCount = ref(backendWorkRaw?.favoritesCount || 0)

// 修改切换收藏以维护收藏计数
const toggleFavoriteWithCount = async () => {
  try {
    // 如果当前是未收藏状态，调用收藏接口
    if (!work.value.isFavorite) {
      await addFavorite(work.value.id); // 这里的收藏夹可以根据实际需求修改或让用户选择
      work.value.isFavorite = true;
      favoritesCount.value += 1;
    } else {
      await deleteFavorite(work.value.id);
      work.value.isFavorite = false;
      favoritesCount.value -= 1;
    }
  } catch (e) {
    console.error('收藏操作失败:', e);
    // 操作失败时回滚状态
    work.value.isFavorite = !work.value.isFavorite;
  }
}

// 发表时间（来自后端或默认当前时间）
const publishedAt = ref(backendWorkRaw?.publishedAt || backendWorkRaw?.publishedDate || new Date().toISOString())

// 章节数（来自后端，字段名可能为 total_chapters 或 totalChapters）
const totalChapters = ref(backendWorkRaw?.totalChapters || backendWorkRaw?.total_chapters || null)

// 最后更新时间（来自后端 updated_at）
const updatedAt = ref(backendWorkRaw?.updatedAt || backendWorkRaw?.updated_at || null)

// 评分数据（从后端获取）
const averageScore = ref(backendWorkRaw?.averageScore || 0)
const ratingCount = ref(backendWorkRaw?.ratingCount || 0)
const readCount = ref(backendWorkRaw?.readCount || 0)
const backendWordCount = ref(backendWorkRaw?.wordCount || null)

// 积分/打赏相关（用于作品简介与评论评分之间的“送积分”模块）
// 优先从后端返回的 price 字段，否则使用 unlock_points_needed，默认 100
const unlockPointsNeeded = ref((backendWorkRaw?.price !== undefined) ? backendWorkRaw.price : (backendWorkRaw?.unlock_points_needed || 100)) // 解锁该作品需要的积分（后端可返回字段）
const userGivenPoints = ref(backendWorkRaw?.user_given_points || 0) // 当前用户已在该作品上送出的积分
const sendingPoints = ref(false)
// 页面内 modal 控制：改为页面内弹窗输入数量
const showPointsModal = ref(false)
const pointsAmount = ref(10)
// 预设额度（含自定义）
const presets = [30, 60, 98, 158, 268, 388, 618, 998, '自定义']
const selectedPreset = ref(presets[0])

const openPointsModal = () => {
  pointsAmount.value = 30
  selectedPreset.value = presets[0]
  showPointsModal.value = true
}

const cancelSendPoints = () => {
  showPointsModal.value = false
}

const selectPreset = (p) => {
  selectedPreset.value = p
  if (p === '自定义') {
    pointsAmount.value = ''
    // focus will be handled by user interaction
  } else {
    pointsAmount.value = p
  }
}

const confirmSendPoints = async () => {
  const amount = parseInt(pointsAmount.value)
  if (isNaN(amount) || amount <= 0) {
    showToast('请输入大于 0 的整数', 'warning')
    return
  }
  try {
    sendingPoints.value = true
    // 后端：POST /api/users/reward/  { "gamework_id": <id>, "amount": <amount> }
    const res = await http.post('/api/users/reward/', { gamework_id: work.value.id, amount })
    // 后端返回示例：{ code:200, message:'打赏成功', amount: 20, author: '作者用户名' }
    if (res && res.data && typeof res.data.amount !== 'undefined') {
      // 将用户已送出积分更新为后端返回的总数（若后端返回累计值）
      userGivenPoints.value = res.data.amount
    } else {
      userGivenPoints.value += amount
    }
    showPointsModal.value = false
    showToast('送积分成功，谢谢支持！', 'success')
  } catch (e) {
    console.error('sendPoints error', e)
    showToast('送积分失败，请稍后重试', 'error')
  } finally {
    sendingPoints.value = false
  }
}

const publicationDisplay = computed(() => {
  try {
    if (!publishedAt.value) return '—'
    const d = new Date(publishedAt.value)
    return d.toLocaleString()
  } catch (e) {
    return publishedAt.value
  }
})

const updatedDisplay = computed(() => {
  try {
    if (!updatedAt.value) return '—'
    const d = new Date(updatedAt.value)
    return d.toLocaleString()
  } catch (e) {
    return updatedAt.value
  }
})
// 标签颜色配置（低饱和度浅色）
const tagColors = [
  { bg: '#e9e5f5', text: '#5d4d7a' },   // 浅紫色
  { bg: '#dff5eb', text: '#3d7a5e' },   // 浅绿色
  { bg: '#ffe9d9', text: '#946640' },   // 浅橙色
  { bg: '#ffe5e8', text: '#945560' },   // 浅红色
  { bg: '#e3eeff', text: '#4a6b94' },   // 浅蓝色
  { bg: '#f0e7f7', text: '#6e4d87' },   // 浅紫罗兰
  { bg: '#ffeaf2', text: '#94556e' },   // 浅粉色
  { bg: '#e0f5f3', text: '#3d7a73' }    // 浅青色
]

// 根据索引获取标签颜色
const getTagColor = (index) => {
  return tagColors[index % tagColors.length]
}

// 简介展开状态
const isDescriptionExpanded = ref(false)
const newComment = ref('')
const replyingTo = ref(null) // 正在回复的评论ID
const sortBy = ref('latest') // 排序方式: 'latest' 或 'likes'
// comments will be populated from backend. rawCommentsByTime/rawCommentsByHot keep original payloads.
const comments = ref([])
const rawCommentsByTime = ref(null)
const rawCommentsByHot = ref(null)
const submitComment = async () => {
  if (!newComment.value.trim()) return
  try {
    const parent = replyingTo.value || null
    // 在提交前进行前端敏感词过滤（将敏感词替换为星号）
    const contentToPost = sanitize(newComment.value.trim())
    await postComments(contentToPost, work.value.id, parent)
    // 发布成功后刷新评论（优先尝试通过作品详情获取树状 comments）
    try {
      const details = await http.get(`/api/gameworks/gameworks/${work.value.id}/`)
      const payload = details?.data || details || null
      if (payload) {
        if (Array.isArray(payload.comments_by_time)) {
          rawCommentsByTime.value = payload.comments_by_time
          comments.value = normalizeComments(payload.comments_by_time)
        } else {
          // fallback to comments endpoint
          await fetchCommentsFromAPI(1)
        }
      } else {
        await fetchCommentsFromAPI(1)
      }
    } catch (e) {
      await fetchCommentsFromAPI(1)
    }
    // 清理输入/回复状态
    newComment.value = ''
    replyingTo.value = null
  } catch (e) {
    console.error('post comment failed', e)
    showToast('发表评论失败，请稍后重试', 'error')
  }
}

// 将后端的评论结构（comments_by_time / comments_by_hot）归一化为前端使用的格式
const normalizeComments = (list) => {
  if (!Array.isArray(list)) return []
  const mapItem = (item) => {
    const mapped = {
      id: item.id,
      author: item.user || item.author || '匿名',
      text: item.content || item.text || '',
      time: item.created_at ? new Date(item.created_at).toLocaleString() : (item.time || ''),
      timestamp: item.created_at ? Date.parse(item.created_at) : (item.timestamp || Date.now()),
      // 统一将 likes 强制为数字，避免字符串导致的显示/计算异常
      likes: Number(item.like_count ?? item.likes ?? item.like_counted ?? 0) || 0,
      // 兼容多种后端字段名并强制为布尔值，避免 "true"/1 等假值造成类绑定不生效
      isLiked: !!(item.is_liked ?? item.isLiked ?? item.liked ?? item.user_liked ?? item.liked_by_user ?? false),
      replies: []
    }
    if (Array.isArray(item.replies) && item.replies.length) {
      mapped.replies = item.replies.map(mapItem)
    }
    return mapped
  }
  return list.map(mapItem)
}


// 可见回复计数（按顶层评论 id）
const visibleReplies = ref({})

// 获取某个评论的可见回复数，默认 2
const getVisibleCount = (commentId) => {
  return visibleReplies.value[commentId] || 2
}

// 返回按 likes 降序的 replies（不修改原数据）
const topReplies = (comment) => {
  if (!comment || !Array.isArray(comment.replies)) return []
  return [...comment.replies].sort((a, b) => b.likes - a.likes)
}

// 展开更多回复：每次 +5
const expandReplies = (commentId) => {
  const cur = getVisibleCount(commentId)
  visibleReplies.value = { ...visibleReplies.value, [commentId]: cur + 5 }
}

// 收起回复（重置为 2）
const collapseReplies = (commentId) => {
  visibleReplies.value = { ...visibleReplies.value, [commentId]: 2 }
}

// 切换简介展开状态
const toggleDescription = () => {
  isDescriptionExpanded.value = !isDescriptionExpanded.value
}

// 计算属性：排序后的评论
const sortedComments = computed(() => {
  const commentsCopy = [...comments.value]
  if (sortBy.value === 'likes') {
    // 最热排序：同时考虑点赞数与被回复数（综合分 = likes + replies.length）
    return commentsCopy.sort((a, b) => (b.likes + (b.replies?.length || 0)) - (a.likes + (a.replies?.length || 0)))
  }
  return commentsCopy.sort((a, b) => b.timestamp - a.timestamp)
})

// 包含回复的评论总数（用于标签显示与空状态判断）
const totalCommentsCount = computed(() => {
  return comments.value.reduce((acc, c) => acc + 1 + (Array.isArray(c.replies) ? c.replies.length : 0), 0)
})

// 评分系统（切换评论区为评分分页）
const showingRatings = ref(false)
const ratings = ref([])
const selectedStars = ref(0)
// 当前操作用户的用户名（尝试从 window 全局或 localStorage 中读取）
const currentUsername = ref(null)
// 表示当前用户是否已对该作品评分（用于禁止重复提交并在 UI 上显示历史评分）
const userHasRated = ref(false)
const ratingPage = ref(1)
const ratingPageSize = 5

// 评论分页（顶层楼） - 每次显示 10 条，用户滚动到底部自动加载更多（下拉加载）
const commentPage = ref(1)
const commentPageSize = 10
const displayedCount = computed(() => commentPage.value * commentPageSize)
const displayedComments = computed(() => sortedComments.value.slice(0, displayedCount.value))

// Pull-to-load 手势（用于移动端）：用户在 sentinel 区域触摸并下拉/上拉超过阈值时触发加载
const loadMoreSentinel = ref(null)
const touchStartY = ref(null)
const pullDistance = ref(0)
const pullTriggered = ref(false)

const loadMoreComments = () => {
  if (displayedCount.value < sortedComments.value.length) {
    commentPage.value += 1
  }
}

const onPullStart = (e) => {
  if (!e.touches || !e.touches.length) return
  touchStartY.value = e.touches[0].clientY
  pullDistance.value = 0
  pullTriggered.value = false
}

const onPullMove = (e) => {
  if (!touchStartY.value || !e.touches || !e.touches.length) return
  const curY = e.touches[0].clientY
  pullDistance.value = Math.abs(curY - touchStartY.value)
  // 如果拉动超过 80px 且还未触发，则触发加载
  if (pullDistance.value > 80 && !pullTriggered.value) {
    pullTriggered.value = true
    loadMoreComments() // 调用新的加载更多函数
  }
}

const onPullEnd = () => {
  touchStartY.value = null
  pullDistance.value = 0
  pullTriggered.value = false
}

// 不再使用 IntersectionObserver 自动加载，用户需手动拉动或点按钮加载

const averageRating = computed(() => {
  if (!ratings.value.length) return 0
  const sum = ratings.value.reduce((s, r) => s + (r.stars || 0), 0)
  return sum / ratings.value.length
})

const pagedRatings = computed(() => {
  const start = (ratingPage.value - 1) * ratingPageSize
  return ratings.value.slice(start, start + ratingPageSize)
})

// 字数（优先使用后端返回的 word_count，否则按字符数统计）
const wordCount = computed(() => {
  if (backendWordCount.value !== null) {
    return backendWordCount.value
  }
  const d = work.value.description || ''
  return d.replace(/\n/g, '').length
})

const toggleRatings = () => {
  showingRatings.value = !showingRatings.value
}

const selectStar = (n) => {
  selectedStars.value = n
}

const handleStarClick = (n) => {
  if (userHasRated.value) return
  selectStar(n)
}

const submitRating = async () => {
  if (selectedStars.value <= 0) return
  if (userHasRated.value) {
    showToast('您已评分，无法重复提交', 'warning')
    return
  }
  const score10 = selectedStars.value * 2
  try {
    // post rating to backend
    const res = await http.post('/api/interactions/ratings/', { id: work.value.id, score: score10 })
    // 如果后端返回 average_score，直接使用
    if (res && (res.average_score || res.data?.average_score)) {
      const avg = res.average_score || res.data.average_score
      averageScore.value = Number(avg) || averageScore.value
    }

    // 刷新作品详情以获取最新的 rating_count 等统计数据
    try {
      const details = await http.get(`/api/gameworks/gameworks/${work.value.id}/`)
      const payload = details?.data || details || null
      if (payload) {
        try { ratingCount.value = payload.rating_count || payload.ratingCount || ratingCount.value } catch (e) {}
        try { averageScore.value = payload.average_score || payload.averageScore || averageScore.value } catch (e) {}
      }
    } catch (e) {
      console.warn('刷新作品详情失败，无法更新评分统计', e)
    }

    // 本地也保持一个评分记录用于立即显示
    ratings.value.unshift({
      id: Date.now(),
      author: currentUsername.value || 'current_user',
      stars: selectedStars.value,
      score10: score10,
      time: '刚刚',
      timestamp: Date.now()
    })

    // 标记为已评分，禁止再次提交
    userHasRated.value = true

    // reset
    selectedStars.value = 0
    ratingPage.value = 1
  } catch (e) {
    console.error('提交评分失败', e)
    showToast('提交评分失败，请稍后重试', 'error')
  }
}

// 平均分（10分制），优先使用后端返回的 averageScore，否则根据已有 ratings 中的 score10（若不存在则用 stars*2）
const averageRating10 = computed(() => {
  // 优先使用后端返回的评分
  if (averageScore.value > 0) {
    return averageScore.value
  }
  // 否则使用本地 ratings 计算
  if (!ratings.value.length) return 0
  const sum = ratings.value.reduce((s, r) => s + ((r.score10 !== undefined) ? r.score10 : (r.stars || 0) * 2), 0)
  return sum / ratings.value.length
})

// 评分人数（优先使用后端返回的 ratingCount）
const totalRatingCount = computed(() => {
  return ratingCount.value > 0 ? ratingCount.value : ratings.value.length
})

const prevRatingPage = () => {
  if (ratingPage.value > 1) ratingPage.value--
}

const nextRatingPage = () => {
  const maxPage = Math.max(1, Math.ceil(ratings.value.length / ratingPageSize))
  if (ratingPage.value < maxPage) ratingPage.value++
}

// 筛选下拉（替换原来的两个平铺按钮）
const showFilterDropdown = ref(false)
const toggleFilter = () => { showFilterDropdown.value = !showFilterDropdown.value }
const selectFilter = async (opt) => {
  sortBy.value = opt
  showFilterDropdown.value = false
  try {
    if (opt === 'likes') {
      if (rawCommentsByHot.value) {
        comments.value = normalizeComments(rawCommentsByHot.value)
      } else {
        // fallback to fetching from comments endpoint
        await fetchCommentsFromAPI(1)
      }
    } else {
      if (rawCommentsByTime.value) comments.value = normalizeComments(rawCommentsByTime.value)
      else await fetchCommentsFromAPI(1)
    }
  } catch (e) { console.warn('failed to apply filter', e) }
}

// 从后端的 /interactions/comments/ 接口获取（用于回退/独立调用）
const fetchCommentsFromAPI = async (page = 1) => {
  try {
    const res = await getComments(page, work.value.id)
    // 支持多种后端返回格式
    const data = res?.data || res
    let list = null
    if (Array.isArray(data.comments_by_time)) list = data.comments_by_time
    else if (Array.isArray(data.results)) list = data.results
    else if (Array.isArray(data)) list = data
    comments.value = normalizeComments(list || [])
  } catch (e) {
    console.warn('fetchCommentsFromAPI failed', e)
    comments.value = []
  }
}

// `submitComment` is implemented above to call backend and refresh comments
// 点赞评论（乐观更新，失败回滚）
const toggleLike = async (comment) => {
  if (!comment || !comment.id) return
  const prevLiked = !!comment.isLiked
  const prevLikes = typeof comment.likes === 'number' ? comment.likes : 0

  // 乐观更新
  comment.isLiked = !prevLiked
  comment.likes = prevLikes + (comment.isLiked ? 1 : -1)

  try {
    if (comment.isLiked) {
      const res = await likeComment(comment.id)
      // 后端可能返回多个格式，优先使用后端返回的 is_liked 与 like_count
      const remote = res?.data?.data ?? res?.data ?? res
      if (remote) {
        if (typeof remote.is_liked !== 'undefined') comment.isLiked = !!remote.is_liked
        if (typeof remote.like_count !== 'undefined') comment.likes = Number(remote.like_count) || comment.likes
        else if (typeof remote.likes !== 'undefined') comment.likes = Number(remote.likes) || comment.likes
      }
    } else {
      const res = await unlikeComment(comment.id)
      const remote = res?.data?.data ?? res?.data ?? res
      if (remote) {
        if (typeof remote.is_liked !== 'undefined') comment.isLiked = !!remote.is_liked
        if (typeof remote.like_count !== 'undefined') comment.likes = Number(remote.like_count) || comment.likes
        else if (typeof remote.likes !== 'undefined') comment.likes = Number(remote.likes) || comment.likes
      }
    }
  } catch (e) {
    // 回滚
    comment.isLiked = prevLiked
    comment.likes = prevLikes
    console.error('toggleLike failed', e)
  }
}

// 从本地 comments 中删除指定 id（递归）
const removeCommentById = (id, list = comments.value) => {
  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    if (item.id === id) {
      list.splice(i, 1)
      return true
    }
    if (Array.isArray(item.replies) && item.replies.length) {
      // 在 replies 中查找并删除
      const found = removeCommentById(id, item.replies)
      if (found) return true
    }
  }
  return false
}

// 删除评论（本地先优化 UX，随后调用后端并触发事件）
const onDeleteComment = async (comment) => {
  if (!comment || !comment.id) return
  if (!confirm('确认要删除这条评论吗？此操作不可撤销。')) return
  try {
    comment._deleting = true
    let deleted = false
    // 尝试调用后端删除接口（兼容常见路径），仅在成功时从本地删除
    try {
      // 使用相对路径让 http 实例处理 baseURL 与拦截器返回值
      await http.delete(`/api/interactions/comments/${comment.id}/`, { params: { id: comment.id } })
      // axios 请求未抛出异常，则视为成功（http 实例可能返回 data 而非原始 response）
      deleted = true
    } catch (e) {
      // 如果后端不接受 DELETE，尝试常见的 POST 删除端点（使用指定域名），并在 body 中包含 id
      try {
        await http.post(`/api/interactions/comments/${comment.id}/delete/`, { id: comment.id })
        deleted = true
      } catch (e2) {
        deleted = false
      }
    }

    if (deleted) {
      // 从本地删除以立即反映 UI
      removeCommentById(comment.id)
      // 向外部发出事件，供上层处理（例如刷新）
      try { emit('delete-comment', comment.id) } catch (e) {}
      showToast('删除成功', 'success')
    } else {
      // 删除失败，不应在前端移除评论
      showToast('删除失败，请稍后重试', 'error')
    }
  } catch (e) {
    console.error('删除评论失败', e)
  } finally {
    comment._deleting = false
  }
}

// 举报评论（提交到后端并发出事件）
const onReportComment = async (comment) => {
  // 打开举报理由弹窗（可填写可跳过）
  if (!comment || !comment.id) return
  reportTargetComment.value = comment
  reportReason.value = ''
  reportType.value = ''
  reportModalVisible.value = true
}

// 开始回复
const startReply = (commentId, author) => {
  replyingTo.value = commentId
  newComment.value = `@${author} `
}

// 取消回复
const cancelReply = () => {
  replyingTo.value = null
  newComment.value = ''
}

// 关闭弹窗
const closeModal = () => {
  isDescriptionExpanded.value = false
}

// 举报弹窗状态与操作
const reportModalVisible = ref(false)
const reportReason = ref('')
const reportTargetComment = ref(null)

// 评论举报必选类型（分组单选）
const reportType = ref('')
const reportTypeGroups = [
  {
    title: '违法违规',
    items: [
      { value: 'porn', label: '色情低俗' },
      { value: 'violence', label: '暴力恐怖' },
      { value: 'gamble', label: '赌博诈骗' },
      { value: 'sensitive', label: '敏感信息或危害国家安全' }
    ]
  },
  {
    title: '侵犯个人',
    items: [
      { value: 'attack', label: '人身攻击' },
      { value: 'privacy', label: '泄露隐私' },
      { value: 'rumor', label: '造谣传谣' }
    ]
  },
  {
    title: '有害社区环境',
    items: [
      { value: 'ad', label: '垃圾广告' },
      { value: 'spam', label: '恶意刷屏' },
      { value: 'flame', label: '引战' },
      { value: 'other', label: '其他' }
    ]
  }
]

// 根据选中的 value 查找对应的中文 label（优先从 groups 中查找）
const findLabelByValue = (value, groups) => {
  if (!value) return ''
  for (const g of groups) {
    if (!g.items) continue
    for (const it of g.items) {
      if (it.value === value) return it.label || value
    }
  }
  return value
}

const cancelReport = () => {
  reportModalVisible.value = false
  reportTargetComment.value = null
  reportReason.value = ''
  reportType.value = ''
}

// 作品举报（与评论举报流程一致）
const workReportModalVisible = ref(false)
const workReportReason = ref('')
const workReportSubmitting = ref(false)
// 必选的违规类型（作品举报）
const workReportType = ref('')
const workReportTypes = [
  { value: 'copyright', label: '侵犯版权和肖像权' },
  { value: 'violence_sex', label: '暴力、色情、恐怖内容' },
  { value: 'sensitive', label: '敏感信息或危害国家安全的内容' },
  { value: 'privacy', label: '泄露他人身份信息' },
  { value: 'ad', label: '恶意插入广告' },
  { value: 'paid', label: '作品恶意收费' }
]

const openWorkReportModal = () => {
  workReportReason.value = ''
  workReportType.value = ''
  workReportModalVisible.value = true
}

const cancelWorkReport = () => {
  workReportModalVisible.value = false
  workReportReason.value = ''
  workReportType.value = ''
}

const confirmWorkReport = async () => {
  if (!work.value || !work.value.id) {
    cancelWorkReport()
    return
  }
  try {
    workReportSubmitting.value = true
    // 验证必须选择违规类型
    if (!workReportType.value) {
      showToast('请先选择违规类型', 'warning')
      workReportSubmitting.value = false
      return
    }

    // 将要发送的标签使用前端显示的中文 label
    const workTagLabel = findLabelByValue(workReportType.value, workReportTypes.map(t => ({ items: [t] })))

    // 新接口要求的字段名：gamework (id), tag (string), remark (string)
    const payload = {
      gamework: work.value.id,
      tag: workTagLabel,
      remark: workReportReason.value && workReportReason.value.trim() ? workReportReason.value.trim() : ''
    }

    // 直接调用新的固定接口（不再兼容旧接口）
    await http.post('/api/users/report/gamework/', payload)

    alert('举报已提交，我们会尽快处理')
    try { emit('report-work', work.value.id) } catch (e) {}
  } catch (e) {
    console.error('作品举报失败', e)
    showToast('举报失败，请稍后重试', 'error')
  } finally {
    workReportSubmitting.value = false
    cancelWorkReport()
  }
}

// 删除作品（与 MyCreationsPage.vue 使用相同的删除端点尝试逻辑）
const deletingWork = ref(false)
const deleteWork = async () => {
  if (!work.value || !work.value.id) return
  if (!confirm('确认要删除此作品吗？此操作不可恢复。')) return
  if (deletingWork.value) return
  deletingWork.value = true
  try {
    const endpoints = [
      `/api/gameworks/gameworks/${work.value.id}/`,
      `/gameworks/gameworks/${work.value.id}/`,
      `/api/interactions/gameworks/${work.value.id}/`
    ]
    let deleted = false
    for (const ep of endpoints) {
      try {
        await http.delete(ep)
        deleted = true
        break
      } catch (err) {
        const status = err?.status || err?.response?.status
        if (status === 405) {
          console.warn(`DELETE ${ep} returned 405 Method Not Allowed.`, err?.response?.headers)
          showToast('删除操作被服务器拒绝（405）。请检查权限或联系后端。', 'warning')
          continue
        }
        console.warn(`DELETE ${ep} failed`, err)
        continue
      }
    }

    if (deleted) {
      showToast('作品已删除', 'success')
      try { router.back() } catch (e) { router.push('/') }
    } else {
      showToast('删除失败，请稍后重试', 'error')
    }
  } catch (e) {
    console.error('deleteWork failed', e)
    showToast('删除失败，请稍后重试', 'error')
  } finally {
    deletingWork.value = false
  }
}

const confirmReport = async () => {
  const comment = reportTargetComment.value
  if (!comment || !comment.id) {
    cancelReport()
    return
  }
    try {
      // 必须选择举报类型
      if (!reportType.value) {
        showToast('请先选择举报类型', 'warning')
        return
      }
      comment._reporting = true
      // 后端期望 body 中 comment 为被举报评论的主键（integer）
      const commentId = comment.id
      // 将要发送的标签使用前端显示的中文 label
      const tag = findLabelByValue(reportType.value, reportTypeGroups)
      const remark = (reportReason.value && reportReason.value.trim()) ? reportReason.value.trim() : ''
      try {
        await reportComment(commentId, tag, remark)
      } catch (e) {
        // fallback to common endpoints if the dedicated one fails
        try { await http.post('/api/interactions/reports/', { comment: commentId, tag, remark }) } catch (e2) { /* ignore */ }
      }
      showToast('举报已提交，我们会尽快处理', 'success')
      try { emit('report-comment', comment.id) } catch (e) {}
  } catch (e) {
    console.error('举报失败', e)
    showToast('举报失败，请稍后重试', 'error')
  } finally {
    comment._reporting = false
    cancelReport()
  }
}

// 开始阅读：记录阅读行为后再跳转到阅读页
const startReading = async () => {
  try {
    // 首先尝试向后端记录阅读（若用户已记录则会更新 read_at）
    try {
      await http.post('/api/users/read/', { gamework_id: work.value.id })
    } catch (e) {
      // 不阻塞跳转：记录阅读失败时仅打印警告
      console.warn('记录阅读行为失败：', e)
    }

    // 尝试刷新作品详情以获取最新的阅读统计
    try {
      const details = await http.get(`/api/gameworks/gameworks/${work.value.id}/`)
      const payload = details?.data || details || null
      if (payload) {
        try { readCount.value = payload.read_count || payload.readCount || readCount.value } catch (e) {}
      }
    } catch (e) {
      console.warn('刷新作品详情失败，无法更新阅读量', e)
    }

    // 从 createResult 中获取初始属性和状态（非必需，仅用于传递给阅读页）
    const createResult = JSON.parse(sessionStorage.getItem('createResult') || '{}')
    const initialAttributes = createResult?.initialAttributes || {}
    const initialStatuses = createResult?.initialStatuses || {}

    // 同步缓存，确保 GamePage 与加载页统一使用本次选择的封面/标题
    sessionStorage.setItem('lastWorkMeta', JSON.stringify({
      title: work.value.title,
      coverUrl: work.value.coverUrl
    }))

    router.push({
      path: `/game/${work.value.id}`,
      state: {
        title: work.value.title,
        coverUrl: work.value.coverUrl,
        attributes: initialAttributes,
        statuses: initialStatuses,
        workId: work.value.id
      }
    })
  } catch (e) {
    console.error('startReading 跳转失败:', e)
    // 最后兜底跳转
    router.push({ path: `/game/${work.value.id}` })
  }
}
</script>

<template>
  <div class="works-page">
    <!-- AI生成的封面（顶部全宽） -->
    <div class="cover-container">
      <img :src="work.coverUrl" :alt="work.title" class="cover-image" />
    </div>
    
    <!-- 作品信息 -->
    <div class="content">
      <!-- 作品名和收藏按钮 -->
      <div class="title-row">
        <h1 class="work-title">{{ work.title }}</h1>
        <div class="title-actions">
          <button 
            class="favorite-btn" 
            :class="{ active: work.isFavorite }"
            @click="toggleFavoriteWithCount"
            title="收藏"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </button>
          <button
            class="report-work-btn"
            :disabled="workReportSubmitting"
            @click="openWorkReportModal"
            title="举报作品"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 9v2m0 4h.01M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button
            v-if="isStaff"
            class="delete-work-btn"
            :disabled="deletingWork"
            @click="deleteWork"
            title="删除作品"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M3 6h18M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      
      <!-- 作者ID -->
      <div class="author-info">
        <span class="author-label">作者：</span>
        <span class="author-id">{{ work.authorId }}</span>
      </div>

        <!-- 元数据：字数、收藏数、评分（位于作者与标签之间） -->
        <div class="meta-stats">
          <div class="meta-item">
            <div class="meta-label">章节数</div>
            <div class="meta-value">{{ totalChapters !== null ? totalChapters : '—' }}</div>
          </div>
            <div class="meta-item">
              <div class="meta-label">阅读量</div>
              <div class="meta-value">{{ readCount || 0 }}</div>
            </div>
          <div class="meta-item">
            <div class="meta-label">收藏</div>
            <div class="meta-value">{{ favoritesCount }}</div>
          </div>
          <div class="meta-item">
              <div class="meta-label">{{ totalRatingCount > 0 ? (totalRatingCount + ' 人已评分') : '0 人已评分' }}</div>
              <div class="meta-value rating-inline">
                <span class="rating-text">{{ averageRating10 > 0 ? (averageRating10).toFixed(1) : '—' }}</span>
              </div>
            </div>
          <!-- 发表时间 -->
          <div class="meta-item">
            <div class="meta-label">发表</div>
            <div class="meta-value">{{ publicationDisplay }}</div>
          </div>
          <!-- 更新时间 -->
          <div class="meta-item">
            <div class="meta-label">更新时间</div>
            <div class="meta-value">{{ updatedDisplay }}</div>
          </div>
        </div>
      
      <!-- 标签 -->
      <div class="tags-container">
        <span 
          v-for="(tag, index) in work.tags" 
          :key="index" 
          class="tag"
          :style="{
            backgroundColor: getTagColor(index).bg,
            color: getTagColor(index).text
          }"
        >
          {{ tag.name }}
        </span>
      </div>
      
      <!-- 作品简介（限高35%） -->
      <div class="description-container">
        <h2 class="description-title">作品简介</h2>
        <div class="description">
          <p v-for="(paragraph, index) in work.description.split('\n')" :key="index">
            {{ paragraph }}
          </p>
        </div>
        
        <!-- 展开按钮 -->
        <button class="expand-btn" @click="toggleDescription">
          <span>展开</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M19 9l-7 7-7-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      
      <!-- 送积分模块：显示解锁所需积分与用户已送出的积分 -->
      <div class="points-box">
        <div class="points-info">
          <div class="points-row">
            <div class="points-label">解锁本篇需</div>
            <div class="points-value">{{ unlockPointsNeeded }} 积分</div>
          </div>
          <div class="points-row">
            <div class="points-label">你已送出</div>
            <div class="points-value">{{ userGivenPoints }} 积分</div>
          </div>
        </div>
        <div class="points-actions">
          <button :disabled="sendingPoints" class="submit-comment-btn" @click="openPointsModal">
            {{ sendingPoints ? '发送中...' : '送积分' }}
          </button>
        </div>
      </div>
      
      <!-- 页面内送积分弹窗 -->
      <div v-if="showPointsModal" class="modal-overlay" @click="cancelSendPoints">
        <div class="modal-content" @click.stop>
          <h2 class="modal-title">送出积分</h2>
          <p style="color:#555;margin-top:0.5rem;">向作者送出积分以支持创作。请输入送出的积分数量（整数）。</p>
          <div style="margin-top:1rem;">
            <div class="preset-grid">
              <button
                v-for="(p, idx) in presets"
                :key="idx"
                :class="['preset-btn', { active: selectedPreset === p || selectedPreset === p } ]"
                @click="selectPreset(p)">
                {{ p }}
              </button>
            </div>

            <div v-if="selectedPreset === '自定义'" style="margin-top:0.75rem;display:flex;gap:0.5rem;align-items:center;">
              <input type="number" v-model.number="pointsAmount" min="1" style="flex:1;padding:0.6rem;border:1px solid #e0e0e0;border-radius:8px;font-size:1rem;" />
              <div style="color:#999;font-size:0.95rem;">积分</div>
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:0.75rem;margin-top:1.25rem;">
            <button class="close-btn" @click="cancelSendPoints" aria-label="关闭" title="关闭" style="background:#f0f0f0;color:#333;padding:0.5rem 0.9rem;border-radius:8px;border:none">×</button>
            <button class="submit-comment-btn" @click="confirmSendPoints">确认送出</button>
          </div>
        </div>
      </div>
      
      <!-- 评论区域 -->
      <div class="comments-section">
        <div class="comments-header">
          <!-- tabs: 评论 / 评分 在同一水平线 -->
          <div style="display:flex;flex-direction:column;gap:0.5rem;width:100%">
            <!-- tabs 平分宽度 -->
            <div style="display:flex;width:100%">
              <button class="tab-btn" :class="{ active: !showingRatings }" @click="showingRatings = false" style="flex:1;justify-content:center;">
                <div class="tab-label">评论</div>
                <div class="tab-count">{{ totalCommentsCount }} <span class="tab-unit">条</span></div>
              </button>
              <button class="tab-btn" :class="{ active: showingRatings }" @click="showingRatings = true" style="flex:1;justify-content:center;">
                <div class="tab-label">评分</div>
                <div class="tab-count">{{ totalRatingCount }} <span class="tab-unit">人</span></div>
              </button>
            </div>

            <!-- 平铺的平均评分显示（仅在评分 tab 激活时显示） -->
            <div class="avg-rating" v-if="showingRatings && totalRatingCount > 0" style="display:flex;align-items:center;gap:0.5rem;">
              <div class="avg-stars">
                <span v-for="n in 5" :key="n" class="star" :class="{ filled: n <= Math.round(averageRating) }">★</span>
              </div>
              <div class="avg-text">{{ averageRating10.toFixed(1) }} </div>
            </div>

            <!-- 排序按钮（已移动到评论输入区下方） -->
          </div>
        </div>
        
        <!-- 评论输入或评分输入 -->
        <div v-if="!showingRatings" class="comment-input-container">
          <div v-if="replyingTo" class="replying-to">
            <span>回复评论中...</span>
            <button class="cancel-reply-btn" @click="cancelReply">取消</button>
          </div>
          <textarea 
            v-model="newComment" 
            class="comment-input" 
            :placeholder="replyingTo ? '写下你的回复...' : '说说你的看法...'"
            rows="3"
          ></textarea>
          <button class="submit-comment-btn" @click="submitComment">
            {{ replyingTo ? '发表回复' : '发表评论' }}
          </button>
        </div>

  <!-- 用筛选图标替换原来的两个排序按钮（仅在评论视图显示） -->
  <div v-if="!showingRatings" class="sort-buttons-row" style="position:relative;width:100%;margin-top:0.5rem;display:flex;justify-content:flex-end;align-items:center;">
    <!-- 合并文本与图标为单一可点击框：在框内显示评论总数及图标 -->
    <div class="filter-box" role="button" tabindex="0" @click="toggleFilter" :aria-expanded="showFilterDropdown" aria-label="筛选排序">
      <span class="filter-text">共 {{ totalCommentsCount }} 条评论</span>
      <span class="filter-icon-wrap" aria-hidden="true">
        <!-- 三条横线（从上到下逐渐变短） -->
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M3 6h18" />
          <path d="M6 12h12" />
          <path d="M9 18h6" />
        </svg>
      </span>
    </div>

    <transition name="fade">
      <div v-if="showFilterDropdown" class="filter-dropdown">
        <button class="filter-item" :class="{ active: sortBy === 'latest' }" @click="selectFilter('latest')">最新</button>
        <button class="filter-item" :class="{ active: sortBy === 'likes' }" @click="selectFilter('likes')">最热</button>
      </div>
    </transition>
  </div>

        <div v-else class="comment-input-container" style="align-items:flex-start;">
          <div style="display:flex;flex-direction:column;gap:0.75rem;width:100%">
            <div style="display:flex;align-items:center;gap:0.5rem;">
              <div class="star-selector">
                <span
                  v-for="n in 5"
                  :key="n"
                  class="star"
                  :class="{ filled: n <= selectedStars, disabled: userHasRated }"
                  @click="handleStarClick(n)">
                  ★
                </span>
              </div>
              <div style="margin-left:auto;">
                <button class="submit-comment-btn" :disabled="userHasRated" @click="submitRating">{{ userHasRated ? '已评分' : '提交评分' }}</button>
              </div>
            </div>

            <!-- 分页显示评分列表 -->
            <div class="ratings-list" style="width:100%;margin-top:0.5rem;">
              <div v-if="totalRatingCount === 0" class="empty-comments">
                <p>还没有评分，快来评分吧！</p>
              </div>
              <div v-else>
                <div v-for="r in pagedRatings" :key="r.id" class="rating-item" style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem 0;border-bottom:1px solid #f0f0f0;">
                  <div class="comment-avatar">{{ r.author.charAt(0) }}</div>
                  <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:0.5rem;">
                      <div style="color:#333;font-weight:600;">{{ r.author }}</div>
                      <div class="rating-stars">
                        <span v-for="n in 5" :key="n" class="star" :class="{ filled: n <= r.stars }">★</span>
                      </div>
                      <div style="margin-left:auto;color:#999;font-size:0.9rem;">{{ r.time }}</div>
                    </div>
                  </div>
                </div>

                <div style="display:flex;justify-content:center;gap:0.5rem;padding:0.75rem;align-items:center;">
                  <button class="sort-btn" @click="prevRatingPage">上一页</button>
                  <div style="padding:0 0.5rem;color:#666;">{{ ratingPage }} / {{ Math.max(1, Math.ceil(ratings.length / ratingPageSize)) }}</div>
                  <button class="sort-btn" @click="nextRatingPage">下一页</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 评论列表 -->
        <div v-if="!showingRatings" class="comments-list">
          <div 
            v-for="comment in displayedComments" 
            :key="comment.id" 
            class="comment-item"
          >
            <div class="top-right-actions">
              <button
                class="action-btn delete-btn"
                :disabled="comment._deleting"
                @click="onDeleteComment(comment)"
                title="删除评论">
                <span class="delete-x">×</span>
              </button>
              <button
                class="action-btn report-btn"
                :disabled="comment._reporting"
                @click="onReportComment(comment)"
                title="举报评论">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M12 9v2m0 4h.01M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <div class="comment-avatar">
              {{ comment.author.charAt(0) }}
            </div>
            <div class="comment-content">
              <div class="comment-header">
                <span class="comment-author">{{ comment.author }}</span>
                <span class="comment-time">{{ comment.time }}</span>
              </div>
              <p class="comment-text">{{ comment.text }}</p>
              
              <!-- 评论操作按钮 -->
              <div class="comment-actions">
                <button 
                  class="action-btn like-btn" 
                  :class="{ active: comment.isLiked }"
                  @click="toggleLike(comment)"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span>{{ comment.likes }}</span>
                </button>
                <button class="action-btn reply-btn" @click="startReply(comment.id, comment.author)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span>回复</span>
                </button>
              </div>
              
              <!-- 回复列表（仅显示点赞最多的若干条，默认两条，点击展开每次 +5） -->
              <div v-if="comment.replies.length > 0" class="replies-list">
                <div 
                  v-for="reply in topReplies(comment).slice(0, getVisibleCount(comment.id))" 
                  :key="reply.id" 
                  class="reply-item"
                >
                  <div class="top-right-actions reply-top-actions">
                    <button
                      class="action-btn delete-btn"
                      :disabled="reply._deleting"
                      @click="onDeleteComment(reply)"
                      title="删除回复">
                      <span class="delete-x">×</span>
                    </button>
                    <button
                      class="action-btn report-btn"
                      :disabled="reply._reporting"
                      @click="onReportComment(reply)"
                      title="举报回复">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M12 9v2m0 4h.01M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </button>
                  </div>
                  <div class="comment-avatar reply-avatar">
                    {{ reply.author.charAt(0) }}
                  </div>
                  <div class="comment-content">
                    <div class="comment-header">
                      <span class="comment-author">{{ reply.author }}</span>
                      <span class="comment-time">{{ reply.time }}</span>
                    </div>
                    <p class="comment-text">{{ reply.text }}</p>
                    
                    <!-- 回复操作按钮 -->
                    <div class="comment-actions">
                      <button 
                        class="action-btn like-btn" 
                        :class="{ active: reply.isLiked }"
                        @click="toggleLike(reply)"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span>{{ reply.likes }}</span>
                      </button>
                      <button class="action-btn reply-btn" @click="startReply(reply.id, reply.author)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span>回复</span>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- 展开 / 收起 控制 -->
                <div class="replies-controls" style="padding:0.5rem 0 0 0;">
                  <button
                    v-if="topReplies(comment).length > getVisibleCount(comment.id)"
                    class="replies-toggle"
                    @click="expandReplies(comment.id)">
                    展开更多回复（剩余 {{ topReplies(comment).length - getVisibleCount(comment.id) }} 条）
                  </button>
                  <button
                    v-else-if="topReplies(comment).length > 2 && getVisibleCount(comment.id) > 2"
                    class="replies-toggle"
                    @click="collapseReplies(comment.id)">
                    收起回复
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <!-- sentinel 与手动加载更多 -->
          <div style="text-align:center;margin-top:1rem;">
            <div v-if="displayedCount < sortedComments.length">
              <div ref="loadMoreSentinel" style="height:8px;"></div>
              <button class="replies-toggle" @click="loadMoreComments">点击或下拉以加载更多评论</button>
            </div>
            <div v-else-if="sortedComments.length === 0" class="empty-comments">
              <span class="empty-icon">💬</span>
              <p>还没有评论，快来抢沙发吧！</p>
            </div>
            <div v-else style="color:#999;margin-top:0.5rem;">你看到了我的底线</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 完整简介弹窗 -->
    <div v-if="isDescriptionExpanded" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <button class="close-btn" @click="closeModal">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M18 6L6 18M6 6l12 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        
        <h2 class="modal-title">作品简介</h2>
        
        <div class="modal-description">
          <p v-for="(paragraph, index) in work.description.split('\n')" :key="index">
            {{ paragraph }}
          </p>
        </div>
      </div>
    </div>
    
    <!-- 作品举报弹窗（可填写或跳过） -->
    <div v-if="workReportModalVisible" class="modal-overlay" @click="cancelWorkReport">
      <div class="modal-content" @click.stop>
        <button class="close-btn" @click="cancelWorkReport">×</button>
        <h2 class="modal-title">举报作品</h2>
        <p style="color:#555;margin-top:0.25rem;">请选择违规类型（必选），下面的补充备注为可选项。</p>
        <div class="report-type-list" style="margin-top:0.6rem;">
          <label v-for="opt in workReportTypes" :key="opt.value" class="report-type-item">
            <input type="radio" name="workReportType" :value="opt.value" v-model="workReportType" />
            <span class="report-type-label">{{ opt.label }}</span>
          </label>
        </div>
        <textarea v-model="workReportReason" placeholder="补充备注（可选）" rows="4" style="width:100%;margin-top:0.8rem;padding:0.8rem;border-radius:8px;border:1px solid #eee;resize:vertical;font-size:1rem;"></textarea>
        <div style="display:flex;justify-content:flex-end;gap:0.75rem;margin-top:1rem;">
          <button class="close-btn" @click="cancelWorkReport" style="background:#f0f0f0;color:#333;padding:0.5rem 0.9rem;border-radius:8px;border:none">取消</button>
          <button class="submit-comment-btn" :disabled="workReportSubmitting" @click="confirmWorkReport">提交举报</button>
        </div>
      </div>
    </div>
    <!-- 举报评论弹窗（需选择违规类型，单选） -->
    <div v-if="reportModalVisible" class="modal-overlay" @click="cancelReport">
      <div class="modal-content" @click.stop>
        <button class="close-btn" @click="cancelReport">×</button>
        <h2 class="modal-title">举报评论</h2>
        <p style="color:#555;margin-top:0.25rem;">请选择举报类型（必选），下面为补充备注（可选）。</p>
        <div class="report-group-list" style="margin-top:0.6rem;">
          <div v-for="group in reportTypeGroups" :key="group.title" style="margin-bottom:0.6rem;">
            <div style="font-weight:700;color:#444;margin-bottom:0.35rem;">{{ group.title }}</div>
            <div class="report-type-list">
              <label v-for="opt in group.items" :key="opt.value" class="report-type-item">
                <input type="radio" name="reportType" :value="opt.value" v-model="reportType" />
                <span class="report-type-label">{{ opt.label }}</span>
              </label>
            </div>
          </div>
        </div>
        <textarea v-model="reportReason" placeholder="补充备注（可选）" rows="4" style="width:100%;margin-top:0.6rem;padding:0.8rem;border-radius:8px;border:1px solid #eee;resize:vertical;font-size:1rem;"></textarea>
        <div style="display:flex;justify-content:flex-end;gap:0.75rem;margin-top:1rem;">
          <button class="close-btn" @click="cancelReport" style="background:#f0f0f0;color:#333;padding:0.5rem 0.9rem;border-radius:8px;border:none">取消</button>
          <button class="submit-comment-btn" @click="confirmReport">提交举报</button>
        </div>
      </div>
    </div>
    
    <!-- 固定在底部的按钮栏 -->
    <div class="bottom-bar">
      <button class="back-button" @click="goBack">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M19 12H5M12 19l-7-7 7-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      
      <button class="read-button" @click="startReading">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="read-text">开始阅读</span>
      </button>
    </div>
    <!-- Toast 容器 -->
    <div class="toast-container">
      <div v-for="t in toasts" :key="t.id" :class="['toast', t.type]">
        <div class="toast-message">{{ t.message }}</div>
        <button class="toast-close" @click="removeToast(t.id)">×</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.works-page {
  min-height: 100vh;
  background-color: #faf8f3; /* 米白色背景 */
  position: relative;
  padding-bottom: 100px; /* 给固定按钮留空间 */
}

/* 封面容器（顶部全宽） */
.cover-container {
  width: 100%;
  height: 30vh; /* 屏幕高度的30% */
  min-height: 200px;
  max-height: 350px;
  overflow: hidden;
  background-color: #faf8f3;
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 内容区域 */
.content {
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

/* 标题行 */
.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  gap: 1rem;
}

.work-title {
  font-size: 2rem;
  font-weight: 700;
  color: #2c3e50;
  margin: 0;
  flex: 1;
  line-height: 1.3;
}

/* 作者信息 */
.author-info {
  font-size: 0.9rem;
  color: #999;
  margin-bottom: 1.5rem;
}

.author-label {
  color: #999;
}

.author-id {
  color: #999;
  font-weight: 500;
}

/* 收藏按钮 */
.favorite-btn {
  width: 48px;
  height: 48px;
  border: none;
  background-color: rgba(128, 128, 128, 0.15);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.favorite-btn svg {
  width: 24px;
  height: 24px;
  color: rgba(128, 128, 128, 0.5);
  transition: color 0.3s ease;
}

.favorite-btn:hover {
  background-color:rgba(218, 217, 217, 0.5);
  transform: scale(1.1);
}

.favorite-btn:hover svg {
  color: rgba(15, 15, 15, 0.15);
}

.favorite-btn.active {
  background-color: rgba(255, 217, 0, 0.123);
}

.favorite-btn.active svg {
  color: #ffd900e7;
}

.title-actions { display:flex; align-items:center; gap:0.6rem }
.report-work-btn { width:48px; height:48px; border:none; background: rgba(128,128,128,0.08); border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer }
.report-work-btn svg { width:20px; height:20px; color:#666 }
.report-work-btn:disabled { opacity:0.5; cursor:not-allowed }

.delete-work-btn { width:48px; height:48px; border:none; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; background: linear-gradient(180deg,#ff6b6b,#e63946); color:#fff }
.delete-work-btn svg { width:20px; height:20px; color:#fff }
.delete-work-btn:disabled { opacity:0.5; cursor:not-allowed }

/* 标签容器 */
.tags-container {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.tag {
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 1.05rem;
  font-weight: 500;
  white-space: nowrap;
  transition: all 0.3s ease;
}

.tag:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 元数据（字数、收藏、评分） */
.meta-stats {
  display: flex;
  gap: 0.75rem;
  margin: 0.5rem 0 1.25rem 0;
  align-items: center;
  overflow-x: auto; /* 当宽度不足时横向滑动 */
  -webkit-overflow-scrolling: touch; /* iOS 顺滑滚动 */
}
.meta-item {
  display:flex;
  flex-direction:column;
  align-items:flex-start;
  padding: 0.45rem 0.75rem;
  background: white;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  min-width: 72px;
  flex: 0 0 auto; /* 防止项被压缩，保持可横向滚动 */
}
.meta-label {
  font-size: 0.75rem;
  color: #999;
}
.meta-value {
  font-weight: 700;
  color: #333;
  margin-top: 0.15rem;
}
.rating-inline { display:flex; align-items:center; gap:0.5rem; }
.rating-stars-inline .star { font-size:14px; color:#ddd }
.rating-stars-inline .star.filled { color: #ffcc33 }
/* 将评分数字样式与收藏数一致（深色、加粗），不要使用灰色 */
.rating-text { color: #333; font-weight: 700 }
.rating-count { color: #333; font-size:0.85rem; font-weight:700 }

/* 隐藏横向滚动条（视觉上） */
.meta-stats::-webkit-scrollbar { height: 6px; display: none }
.meta-stats { scrollbar-width: none; -ms-overflow-style: none }

/* 作品描述容器 */
.description-container {
  margin-top: 2rem;
  position: relative;
}

/* 作品简介标题 */
.description-title {
  font-size: 1.5rem;
  font-weight: 900;
  color: #000;
  margin: 0 0 1rem 0;
}

/* 作品描述（限高35vh） */
.description {
  padding: 2rem;
  background-color: white;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  max-height: 35vh;
  overflow: hidden;
  position: relative;
}

.description::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 80px;
  background: linear-gradient(to bottom, transparent, white);
  pointer-events: none;
}

.description p {
  color: #2c3e50;
  line-height: 2;
  margin: 0.25rem 0;
  font-size: 1rem;
}

.description br {
  display: block;
  content: "";
  margin: 0.5rem 0;
}

/* 展开按钮 */
.expand-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  margin-top: 1rem;
  padding: 0.875rem 1.5rem;
  background-color: white;
  border: 2px solid #d4a5a5;
  border-radius: 12px;
  color: #d4a5a5;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.expand-btn:hover {
  background-color: #d4a5a5;
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(212, 165, 165, 0.3);
}

.expand-btn svg {
  width: 20px;
  height: 20px;
  transition: transform 0.3s ease;
}

.expand-btn:hover svg {
  transform: translateY(2px);
}

/* 弹窗遮罩 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* 弹窗内容 */
.modal-content {
  background-color: white;
  border-radius: 20px;
  padding: 2.5rem;
  max-width: 1000px;
  width: 95%;
  max-height: 55vh;
  overflow-y: auto;
  position: relative;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(50px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* 关闭按钮 */
.close-btn {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  width: 36px;
  height: 36px;
  border: none;
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.close-btn:hover {
  background-color: rgba(0, 0, 0, 0.1);
  transform: rotate(90deg);
}

.close-btn svg {
  width: 20px;
  height: 20px;
  color: #666;
}

/* 弹窗标题 */
.modal-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #2c3e50;
  margin: 0 0 1.5rem 0;
  padding-right: 2rem;
}

/* 弹窗简介内容 */
.modal-description {
  color: #2c3e50;
}

.modal-description p {
  line-height: 2;
  margin: 0.25rem 0;
  font-size: 1rem;
}

.modal-description br {
  display: block;
  content: "";
  margin: 0.5rem 0;
}

/* 固定底部按钮栏 */
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 80px;
  background: white;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0 1.5rem;
  z-index: 100;
}

/* 返回按钮 */
.back-button {
  width: 56px;
  height: 56px;
  border: 2px solid #d4a5a5;
  background: #faf8f3;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(212, 165, 165, 0.2);
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.back-button svg {
  width: 24px;
  height: 24px;
  color: #d4a5a5;
  stroke-width: 2.5;
}

.back-button:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(212, 165, 165, 0.4);
  border-color: #c89090;
}

.back-button:hover svg {
  color: #c89090;
}

.back-button:active {
  transform: scale(0.98);
}

/* 开始阅读按钮 */
.read-button {
  flex: 1;
  height: 56px;
  border: none;
  background: linear-gradient(135deg, #d4a5a5 0%, #c89090 100%);
  border-radius: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(212, 165, 165, 0.3);
  transition: all 0.3s ease;
}

.read-button svg {
  width: 24px;
  height: 24px;
  color: white;
  stroke-width: 2.5;
}

.read-text {
  color: white;
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.read-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(212, 165, 165, 0.5);
}

.read-button:active {
  transform: translateY(0);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .cover-container {
    height: 25vh;
    min-height: 180px;
  }
  
  .content {
    padding: 1.5rem 1rem;
  }
  
  .work-title {
    font-size: 1.5rem;
  }
  
  .author-info {
    font-size: 0.85rem;
    margin-bottom: 1rem;
  }
  
  .favorite-btn {
    width: 40px;
    height: 40px;
  }
  
  .favorite-btn svg {
    width: 20px;
    height: 20px;
  }
  
  .tags-container {
    gap: 0.5rem;
  }
  
  .tag {
    font-size: 0.85rem;
    padding: 0.4rem 0.8rem;
  }
  
  .description-title {
    font-size: 1.25rem;
  }
  
  .description {
    max-height: 30vh;
    padding: 1.5rem;
  }
  
  .expand-btn {
    font-size: 0.9rem;
    padding: 0.75rem 1.25rem;
  }
  
  .modal-content {
    padding: 2rem;
    margin: 1rem;
  }
  
  .modal-title {
    font-size: 1.5rem;
  }
  
  .bottom-bar {
    height: 70px;
    padding: 0 1rem;
    gap: 0.75rem;
  }
  
  .back-button {
    width: 48px;
    height: 48px;
  }
  
  .back-button svg {
    width: 20px;
    height: 20px;
  }
  
  .read-button {
    height: 48px;
    border-radius: 24px;
  }
  
  .read-text {
    font-size: 1rem;
  }
}

/* 评论区域样式 */
.comments-section {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.comments-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.comments-title {
  font-size: 1.5rem;
  color: #333;
  margin: 0;
  font-weight: 600;
}

/* 排序选择器 */
.sort-selector {
  display: flex;
  gap: 0.5rem;
  background: #faf8f3;
  padding: 0.25rem;
  border-radius: 8px;
}

.sort-btn {
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  color: #666;
  font-size: 0.9rem;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.sort-btn.wide {
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 0.7rem 0.6rem;
  font-size: 1rem;
  min-height: 48px;
}

/* filter dropdown */
.filter-btn {
  background: linear-gradient(135deg,#ffffff,#fffaf8);
  border: 1px solid rgba(200,200,200,0.35);
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display:flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
  transition: all 0.18s ease;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.filter-btn svg { color: #6b6b6b }
.filter-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,0.12); }
.filter-dropdown {
  position: absolute;
  right: 0;
  top: 44px;
  display:flex;
  flex-direction:column;
  background: white;
  border: 1px solid #eee;
  box-shadow: 0 10px 30px rgba(0,0,0,0.12);
  border-radius: 8px;
  overflow: hidden;
  z-index: 60;
}
.filter-item {
  padding: 0.5rem 1rem;
  min-width: 120px;
  text-align: left;
  background: transparent;
  border: none;
  cursor: pointer;
  font-weight: 600;
}
.filter-item + .filter-item { border-top: 1px solid #f2f2f2 }
.filter-item.active {
  background: #fff4f2;
  color: #c86969;
}
.fade-enter-active, .fade-leave-active { transition: opacity .15s ease }
.fade-enter-from, .fade-leave-to { opacity: 0 }

/* 合并文本与图标的筛选框样式 */
.filter-box {
  display:flex;
  align-items:center;
  gap:0.6rem;
  padding: 0.45rem 0.75rem;
  background: linear-gradient(135deg,#ffffff,#fffaf8);
  border: 1px solid rgba(200,200,200,0.35);
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  user-select: none;
}
.filter-box:focus { outline: none; box-shadow: 0 4px 14px rgba(0,0,0,0.08); }
.filter-text { color: #6b6b6b; font-weight:600; font-size:0.95rem; }
.filter-icon-wrap { display:flex; align-items:center; justify-content:center; width:20px; height:20px; color:#6b6b6b; }
.filter-box:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,0.12); }

.sort-btn.active {
  background: white;
  color: #d4a5a5;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.sort-btn:hover:not(.active) {
  color: #333;
}

/* 回复提示 */
.replying-to {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: #f0e7f7;
  border-radius: 6px;
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
  color: #6e4d87;
}

.cancel-reply-btn {
  background: none;
  border: none;
  color: #d4a5a5;
  font-size: 0.9rem;
  cursor: pointer;
  font-weight: 500;
  transition: color 0.3s ease;
}

.cancel-reply-btn:hover {
  color: #c89090;
}

/* 送积分模块 */
.points-box {
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:1rem;
  background: white;
  border-radius: 12px;
  padding: 1rem;
  margin: 1rem 0 1.5rem 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.points-info {
  display:flex;
  flex-direction:column;
  gap:0.5rem;
}
.points-row {
  display:flex;
  gap:0.75rem;
  align-items:center;
}
.points-label {
  color:#777;
  font-size:0.95rem;
}
.points-value {
  color:#2c3e50;
  font-weight:700;
}
.points-actions {
  display:flex;
  align-items:center;
}

/* 预设额度按钮 */
.preset-grid {
  display:flex;
  flex-wrap:wrap;
  gap:0.5rem;
}
.preset-btn {
  padding:0.5rem 0.9rem;
  border-radius:8px;
  border:1px solid #eee;
  background:#fff;
  cursor:pointer;
  font-weight:600;
  color: #999; /* 未选中时字体浅灰 */
}
.preset-btn.active {
  background:#d4a5a5; /* 与 submit-comment-btn 一致的肉粉色 */
  color:#fff;
  border-color:transparent;
  box-shadow:0 4px 12px rgba(212,165,165,0.28);
}

/* 评论输入区 */
.comment-input-container {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
}

.comment-input {
  width: 100%;
  padding: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  font-family: inherit;
  resize: vertical;
  min-height: 80px;
  transition: border-color 0.3s ease;
  background-color: #faf8f3;
}

.comment-input:focus {
  outline: none;
  border-color: #d4a5a5;
}

.comment-input::placeholder {
  color: #999;
}

.submit-comment-btn {
  margin-top: 1rem;
  padding: 0.6rem 1.4rem;
  background: #d4a5a5; /* 肉粉色 */
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 500;
  align-self: flex-end; /* 靠右 */
}

.submit-comment-btn:hover {
  background: #c89090;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(212, 165, 165, 0.3);
}

.submit-comment-btn:active {
  transform: translateY(0);
}

/* 评论列表 */
.comment-item, .reply-item { position: relative; }
.top-right-actions { position: absolute; top: 8px; right: 8px; display:flex; gap:0.35rem; z-index: 10; }
.reply-top-actions { top: 6px; }
.top-right-actions .action-btn { background: #fff; border:1px solid #f0f0f0; padding:0; border-radius:6px; width:34px; height:34px; display:flex; align-items:center; justify-content:center; }
.delete-x { font-size:16px; line-height:1; color: #666; background: transparent; display:inline-flex; width:18px; height:18px; align-items:center; justify-content:center; text-align:center; border-radius:50%; }
.top-right-actions .delete-btn { padding:0; }
.top-right-actions .report-btn svg { width:16px; height:16px; }
.modal-content textarea { min-height: 100px; border-radius: 8px; border: 1px solid #eee; padding: 0.7rem; font-size:1rem }
.report-type-list { display:flex; flex-direction:column; gap:0.5rem }
.report-type-item { display:flex; align-items:center; gap:0.6rem; padding:0.5rem 0.6rem; border-radius:8px; cursor:pointer; background:#fff; border:1px solid #f3f3f3 }
.report-type-item input { appearance:auto; width:16px; height:16px }
.report-type-item .report-type-label { color:#333 }
.report-type-item:hover { background:#fbfbfb }
.report-group-list { margin-bottom: 0.6rem }
.report-type-item input[type="radio"] { accent-color: #c89090 }

/* Toast 样式 */
.toast-container {
  position: fixed;
  top: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  z-index: 1200;
}
.toast {
  min-width: 200px;
  max-width: 360px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.12);
  padding: 0.6rem 0.8rem;
  display:flex;
  align-items:center;
  gap:0.6rem;
  border-left: 4px solid transparent;
}
.toast .toast-message { flex:1; color:#222; font-size:0.95rem; }
.toast .toast-close { background:transparent;border:none;cursor:pointer;color:#666;font-size:16px }
.toast.success { border-left-color: #2ecc71 }
.toast.error { border-left-color: #e74c3c }
.toast.warning { border-left-color: #f1c40f }
.toast.info { border-left-color: #3498db }
/* 评论操作按钮统一样式 */
.action-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: #666;
  padding: 0.35rem;
  border-radius: 6px;
}
.action-btn svg { width: 16px; height: 16px; }
.action-btn.delete-btn, .action-btn.report-btn, .action-btn.reply-btn { color: #666; }
.action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.comments-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.comment-item {
  display: flex;
  gap: 1rem;
  padding: 1.5rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: box-shadow 0.3s ease;
}

.comment-item:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.comment-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1.1rem;
  flex-shrink: 0;
}

.comment-content {
  flex: 1;
  min-width: 0;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  gap: 1rem;
}

.comment-author {
  font-weight: 600;
  color: #333;
  font-size: 0.95rem;
}

.comment-time {
  color: #999;
  font-size: 0.85rem;
  white-space: nowrap;
}

.comment-text {
  color: #555;
  line-height: 1.6;
  font-size: 0.95rem;
  word-wrap: break-word;
  margin-bottom: 0.75rem;
}

/* 评论操作按钮 */
.comment-actions {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.75rem;
  background: transparent;
  border: 1px solid #e0e0e0;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.85rem;
  color: #666;
  transition: all 0.3s ease;
}

.action-btn svg {
  width: 16px;
  height: 16px;
  stroke-width: 2;
}

.action-btn:hover {
  border-color: #e0e0e0;
  color: #666;
  background: rgba(212, 165, 165, 0.05);
}

.action-btn.active {
  border-color: #d4a5a5;
  color: #d4a5a5;
  background: rgba(212, 165, 165, 0.1);
}

.like-btn.active svg {
  fill: #d4a5a5;
}

/* 回复列表 */
.replies-list {
  margin-top: 1rem;
  padding-left: 1rem;
  border-left: 2px solid #f0f0f0;
}

.reply-item {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
  padding: 1rem;
  background: #fafafa;
  border-radius: 8px;
}

.reply-avatar {
  width: 32px;
  height: 32px;
  font-size: 0.9rem;
  background: linear-gradient(135deg, #d4a5a5 0%, #c89090 100%);
}

/* 展开/收起回复按钮 */
.replies-toggle {
  background: transparent;
  border: none;
  color: #d4a5a5;
  font-weight: 600;
  cursor: pointer;
  padding: 0.35rem 0.5rem;
}
.replies-toggle:hover { text-decoration: underline; }

/* 评分星星样式 */
.star {
  font-size: 18px;
  color: #ddd;
  cursor: pointer;
}
.star.filled {
  color: #ffcc33;
}
.avg-stars .star {
  font-size: 16px;
}
.rating-stars .star {
  font-size: 14px;
}
.rating-item .comment-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display:flex;
  align-items:center;
  justify-content:center;
  background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
  color:#fff;
}

/* tabs */
.tab-btn {
  padding: 0.8rem 1.2rem;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  font-weight: 700;
  font-size: 1.05rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column; /* 支持上下排列标签与数字 */
  min-height: 56px;
}
.tab-btn.active {
  background: white;
  border-color: #e0e0e0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

/* tabs 下方计数样式 */
.tab-count {
  font-size: 0.78rem; /* 更小的数字字体 */
  color: #999; /* 与单位一致的浅灰色 */
  margin-top: 0.18rem;
  font-weight: 600;
}
.tab-unit {
  font-weight: 600;
  color: #999; /* 与数字颜色一致 */
  margin-left: 4px;
  font-size: 0.78rem;
}

/* 排序按钮与评论区分隔 */
.sort-buttons-row {
  margin: 0.6rem 0 1.2rem; /* 上间距和下间距，分开按钮与评论区 */
  padding-top: 0.6rem;
  border-top: 1px solid rgba(0,0,0,0.04);
}

/* 空状态 */
.empty-comments {
  text-align: center;
  padding: 3rem 1rem;
  color: #999;
}

.empty-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 1rem;
}

.empty-comments p {
  font-size: 1rem;
  margin: 0;
}

/* 超小屏幕 */
@media (max-width: 480px) {
  .work-title {
    font-size: 1.25rem;
  }
  
  .bottom-bar {
    height: 65px;
    padding: 0 0.75rem;
    gap: 0.5rem;
  }
  
  .back-button {
    width: 44px;
    height: 44px;
  }
  
  .read-button {
    height: 44px;
  }
  
  .read-text {
    font-size: 0.95rem;
  }
  
  .comments-section {
    padding: 1.5rem 1rem;
  }
  
  .comments-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .comments-title {
    font-size: 1.25rem;
  }
  
  .sort-selector {
    width: 100%;
  }
  
  .sort-btn {
    flex: 1;
  }
  
  .comment-input-container {
    padding: 1rem;
  }
  
  .comment-item {
    padding: 1rem;
    gap: 0.75rem;
  }
  
  .comment-avatar {
    width: 36px;
    height: 36px;
    font-size: 1rem;
  }
  
  .comment-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
  
  .comment-actions {
    gap: 0.5rem;
  }
  
  .action-btn {
    font-size: 0.8rem;
    padding: 0.35rem 0.6rem;
  }
  
  .replies-list {
    padding-left: 0.5rem;
  }
  
  .reply-item {
    padding: 0.75rem;
    gap: 0.5rem;
  }
}
</style>
