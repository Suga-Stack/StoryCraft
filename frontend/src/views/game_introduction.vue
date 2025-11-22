<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { useRouter } from 'vue-router'
import { http } from '../service/http.js'
import { addFavorite, deleteFavorite, getComments } from '../api/user.js'

const router = useRouter()

const goBack = () => {
  router.push('/')
}

// 单个作品数据（从后端获取）
const route = useRoute()
const state = history.state || {}
// 若存在 createResult，则优先使用 sessionStorage.createResult 中的 backendWork
let sessionCreate = null
try { sessionCreate = JSON.parse(sessionStorage.getItem('createResult')) } catch (e) { sessionCreate = null }
const incomingTags = (state.selectedTags && Array.isArray(state.selectedTags))
  ? state.selectedTags
  : (() => { try { return JSON.parse(sessionStorage.getItem('createRequest'))?.tags } catch { return null } })()

// 规范化后端返回的数据字段（兼容 image_url / coverUrl / cover_url 等差异）
const normalizeBackendWork = (raw) => {
  if (!raw) return null
  const coverCandidate = raw.coverUrl || raw.cover_url || raw.image_url || raw.imageUrl || raw.cover || (raw.image && raw.image.url) || ''
  let cover = coverCandidate || ''
  if (cover && /^\//.test(cover)) cover = 'http://localhost:8000' + cover
  // 如果已经是完整 URL，保留原样
  return {
    id: raw.id,
    author: raw.author,
    title: raw.title || raw.name || raw.work_title || '',
    description: raw.description || raw.desc || raw.summary || '',
    coverUrl: cover || raw.coverUrl || raw.image_url || '',
    tags: raw.tags || raw.tag_names || raw.tag_ids || [],
    favoritesCount: raw.favorite_count || raw.favoritesCount || 0,
    publishedAt: raw.published_at || raw.publishedAt || null,
    isFavorite: raw.is_favorited || false
  }
}

let backendWorkRaw = normalizeBackendWork(state.backendWork || sessionCreate?.backendWork || null)

const work = ref({
  id: backendWorkRaw?.id || 1,
  title: backendWorkRaw?.title || '锦瑟深宫',
  coverUrl: backendWorkRaw?.coverUrl || 'https://images.unsplash.com/photo-1587614387466-0a72ca909e16?w=800&h=500&fit=crop',
  authorId: backendWorkRaw?.authorId || 'user_12345',
  tags: incomingTags || backendWorkRaw?.tags || ['科幻', '冒险', '太空', '未来'],
  description: backendWorkRaw?.description || `柳晚晚穿越成后宫小透明，她把宫斗当成终身职业来经营。
不争宠不夺权，只求平安活到退休。
 
别人算计位份，她研究菜谱
别人争抢赏赐，她核算份例
在步步惊心的深宫里，她用一口小锅涮出温暖天地。
 
皇帝觉得她省心，妃嫔当她没威胁。直到风波来临，众人才发现——这个整天算账吃饭的鹌鹑，早把生存智慧练到满级。

当六宫争得头破血流时，
她正捧着账本慢悠悠打算盘："这个月份例还能省出两顿火锅，
至于恩宠？那是什么，能吃吗？"

在这吃人的后宫，不想争宠的干饭人，
正在悄悄苟成最后赢家。`,
  isFavorite: false
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
      work.value.tags = incomingTags || normalized.tags || work.value.tags
      work.value.isFavorite = normalized.isFavorite || work.value.isFavorite
      try { favoritesCount.value = payload.favorite_count || payload.favoritesCount || favoritesCount.value } catch (e) {}
      try { publishedAt.value = payload.published_at || payload.publishedAt || publishedAt.value } catch (e) {}

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
    }
    await fetchComments(1, true)

  } catch (e) {
    console.warn('fetch work details failed:', e)
  }
})

// 切换收藏状态
const toggleFavorite = () => {
  work.value.isFavorite = !work.value.isFavorite
}
// 收藏数（示例初始值或来自后端）
const favoritesCount = ref(backendWorkRaw?.favoritesCount || 124)

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

const publicationDisplay = computed(() => {
  try {
    const d = new Date(publishedAt.value)
    return d.toLocaleDateString()
  } catch (e) {
    return publishedAt.value
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
const comments = ref([
  { id: 1, author: 'user_001', text: '这个作品太棒了！期待后续更新！', time: '2小时前', timestamp: Date.now() - 2 * 60 * 60 * 1000, likes: 15, isLiked: false,
    replies: [
      { id: 101, author: 'user_004', text: '同感！已经追更好几天了', time: '1小时前', timestamp: Date.now() - 1 * 60 * 60 * 1000, likes: 3, isLiked: false },
      { id: 102, author: 'user_005', text: '我更喜欢主角的设定，希望加强世界观', time: '50分钟前', timestamp: Date.now() - 50 * 60 * 1000, likes: 6, isLiked: false },
      { id: 103, author: 'user_006', text: '情节推进有点慢，但人物刻画不错', time: '30分钟前', timestamp: Date.now() - 30 * 60 * 1000, likes: 1, isLiked: false },
      { id: 104, author: 'user_007', text: '怎么没有番外？', time: '10分钟前', timestamp: Date.now() - 10 * 60 * 1000, likes: 0, isLiked: false }
    ] },
  { id: 2, author: 'user_002', text: '故事情节很吸引人，写得很不错。', time: '5小时前', timestamp: Date.now() - 5 * 60 * 60 * 1000, likes: 8, isLiked: false,
    replies: [ { id: 201, author: 'user_008', text: '我觉得第二章高潮部分很精彩', time: '4小时前', timestamp: Date.now() - 4 * 60 * 60 * 1000, likes: 2, isLiked: false } ] },
  { id: 3, author: 'user_003', text: '设定很有创意，支持作者！', time: '1天前', timestamp: Date.now() - 24 * 60 * 60 * 1000, likes: 23, isLiked: false,
    replies: [ { id: 301, author: 'user_009', text: '这个设定让我想到了某部经典作品', time: '23小时前', timestamp: Date.now() - 23 * 60 * 60 * 1000, likes: 10, isLiked: false },
               { id: 302, author: 'user_010', text: '完全同意，期待下一章', time: '22小时前', timestamp: Date.now() - 22 * 60 * 60 * 1000, likes: 5, isLiked: false },
               { id: 303, author: 'user_011', text: '作者大大加油！', time: '20小时前', timestamp: Date.now() - 20 * 60 * 60 * 1000, likes: 2, isLiked: false } ] },
  { id: 4, author: 'user_012', text: '节奏感很好，人物关系把握得当。', time: '3天前', timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000, likes: 5, isLiked: false, replies: [] },
  { id: 5, author: 'user_013', text: '不太懂为什么某个设定会存在，希望出设定说明。', time: '6天前', timestamp: Date.now() - 6 * 24 * 60 * 60 * 1000, likes: 2, isLiked: false,
    replies: [ { id: 501, author: 'user_014', text: '可以去看作者之前的笔记，有些线索在里面', time: '5天前', timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000, likes: 1, isLiked: false } ] },
  { id: 6, author: 'user_015', text: '文笔细腻，氛围感抓得很好。', time: '1周前', timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000, likes: 12, isLiked: false,
    replies: [ { id: 601, author: 'user_016', text: '确实，这段描写很打动我', time: '6天前', timestamp: Date.now() - 6 * 24 * 60 * 60 * 1000, likes: 4, isLiked: false },
               { id: 602, author: 'user_017', text: '学习了文笔写法', time: '5天前', timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000, likes: 3, isLiked: false } ] },
  { id: 7, author: 'user_018', text: '喜欢人物的反转设定，期待后续发展。', time: '8天前', timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000, likes: 20, isLiked: false,
    replies: [ { id: 701, author: 'user_019', text: '反转太精彩了！', time: '7天前', timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000, likes: 8, isLiked: false },
               { id: 702, author: 'user_020', text: '这一点真的出乎我意料', time: '6天前', timestamp: Date.now() - 6 * 24 * 60 * 60 * 1000, likes: 6, isLiked: false },
               { id: 703, author: 'user_021', text: '作者就是这样留悬念', time: '5天前', timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000, likes: 2, isLiked: false } ] },
  { id: 8, author: 'user_022', text: '有些设定逻辑上不通，但总体还不错。', time: '9天前', timestamp: Date.now() - 9 * 24 * 60 * 60 * 1000, likes: 1, isLiked: false, replies: [] },
  { id: 9, author: 'user_023', text: '最喜欢主角的成长线！', time: '10天前', timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000, likes: 30, isLiked: false,
    replies: [ { id: 901, author: 'user_024', text: '成长线写得太好了', time: '9天前', timestamp: Date.now() - 9 * 24 * 60 * 60 * 1000, likes: 12, isLiked: false } ] },
  { id: 10, author: 'user_025', text: '配角塑造也很成功。', time: '11天前', timestamp: Date.now() - 11 * 24 * 60 * 60 * 1000, likes: 4, isLiked: false, replies: [] },
  { id: 11, author: 'user_026', text: '期待番外和设定集。', time: '12天前', timestamp: Date.now() - 12 * 24 * 60 * 60 * 1000, likes: 7, isLiked: false,
    replies: [ { id: 1101, author: 'user_027', text: '番外要来！', time: '11天前', timestamp: Date.now() - 11 * 24 * 60 * 60 * 1000, likes: 3, isLiked: false } ] },
  { id: 12, author: 'user_028', text: '节奏稍慢，希望加快。', time: '13天前', timestamp: Date.now() - 13 * 24 * 60 * 60 * 1000, likes: 2, isLiked: false, replies: [] },
  { id: 13, author: 'user_029', text: '画面感很强，细节很喜欢。', time: '14天前', timestamp: Date.now() - 14 * 24 * 60 * 60 * 1000, likes: 9, isLiked: false,
    replies: [ { id: 1301, author: 'user_030', text: '细节控表示满意', time: '13天前', timestamp: Date.now() - 13 * 24 * 60 * 60 * 1000, likes: 2, isLiked: false },
               { id: 1302, author: 'user_031', text: '画面感太强了', time: '12天前', timestamp: Date.now() - 12 * 24 * 60 * 60 * 1000, likes: 1, isLiked: false } ] },
  { id: 14, author: 'user_032', text: '没看懂第三章的伏笔。', time: '15天前', timestamp: Date.now() - 15 * 24 * 60 * 60 * 1000, likes: 0, isLiked: false, replies: [] },
  { id: 15, author: 'user_033', text: '人物对白太生动了。', time: '16天前', timestamp: Date.now() - 16 * 24 * 60 * 60 * 1000, likes: 11, isLiked: false, replies: [] },
  { id: 16, author: 'user_034', text: '背景设定能否详细说明一下？', time: '17天前', timestamp: Date.now() - 17 * 24 * 60 * 60 * 1000, likes: 3, isLiked: false,
    replies: [ { id: 1601, author: 'user_035', text: '后台资料见作者置顶', time: '16天前', timestamp: Date.now() - 16 * 24 * 60 * 60 * 1000, likes: 1, isLiked: false } ] },
  { id: 17, author: 'user_036', text: '伏笔很多，希望结局不要崩。', time: '18天前', timestamp: Date.now() - 18 * 24 * 60 * 60 * 1000, likes: 6, isLiked: false, replies: [] },
  { id: 18, author: 'user_037', text: '配乐好像也很适合这个故事，想要BGM', time: '19天前', timestamp: Date.now() - 19 * 24 * 60 * 60 * 1000, likes: 8, isLiked: false, replies: [] },
  { id: 19, author: 'user_038', text: '翻译质量也不错（若有外文）', time: '20天前', timestamp: Date.now() - 20 * 24 * 60 * 60 * 1000, likes: 1, isLiked: false, replies: [] },
  { id: 20, author: 'user_039', text: '感谢作者，支持番外！', time: '21天前', timestamp: Date.now() - 21 * 24 * 60 * 60 * 1000, likes: 14, isLiked: false,
    replies: [ { id: 2001, author: 'user_040', text: '支持！', time: '20天前', timestamp: Date.now() - 20 * 24 * 60 * 60 * 1000, likes: 5, isLiked: false },
               { id: 2002, author: 'user_041', text: '同求番外～', time: '19天前', timestamp: Date.now() - 19 * 24 * 60 * 60 * 1000, likes: 3, isLiked: false } ] }
])


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
const ratings = ref([
  // sample ratings can be empty; kept for initial demo
  // { id: 1, author: 'user_010', stars: 5, time: '1天前', timestamp: Date.now() - 24 * 60 * 60 * 1000 }
])
const selectedStars = ref(0)
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

// 字数（按字符数统计，去除换行）
const wordCount = computed(() => {
  const d = work.value.description || ''
  return d.replace(/\n/g, '').length
})

const toggleRatings = () => {
  showingRatings.value = !showingRatings.value
}

const selectStar = (n) => {
  selectedStars.value = n
}

const submitRating = () => {
  if (selectedStars.value <= 0) return
  ratings.value.unshift({
    id: Date.now(),
    author: 'current_user',
    stars: selectedStars.value,
    score10: selectedStars.value * 2,
    time: '刚刚',
    timestamp: Date.now()
  })
  // reset
  selectedStars.value = 0
  ratingPage.value = 1
}

// 平均分（10分制），根据已有 ratings 中的 score10（若不存在则用 stars*2）
const averageRating10 = computed(() => {
  if (!ratings.value.length) return 0
  const sum = ratings.value.reduce((s, r) => s + ((r.score10 !== undefined) ? r.score10 : (r.stars || 0) * 2), 0)
  return sum / ratings.value.length
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
const selectFilter = (opt) => { sortBy.value = opt; showFilterDropdown.value = false }

// 提交评论
const submitComment = () => {
  if (newComment.value.trim()) {
    if (replyingTo.value) {
      // 回复评论（支持回复顶层评论或回复下的回复）
      let parentComment = comments.value.find(c => c.id === replyingTo.value)
      if (!parentComment) {
        // 在每个 comment.replies 中查找 id，找到所属的顶层 parent
        for (const c of comments.value) {
          if (Array.isArray(c.replies) && c.replies.some(r => r.id === replyingTo.value)) {
            parentComment = c
            break
          }
        }
      }
      if (parentComment) {
        parentComment.replies.push({
          id: Date.now(),
          author: 'current_user',
          text: newComment.value,
          time: '刚刚',
          timestamp: Date.now(),
          likes: 0,
          isLiked: false
        })
      }
      replyingTo.value = null
    } else {
      // 发表新评论
      comments.value.unshift({
        id: Date.now(),
        author: 'current_user',
        text: newComment.value,
        time: '刚刚',
        timestamp: Date.now(),
        likes: 0,
        isLiked: false,
        replies: []
      })
    }
    newComment.value = ''
  }
}
// 点赞评论
const toggleLike = (comment) => {
  comment.isLiked = !comment.isLiked
  comment.likes += comment.isLiked ? 1 : -1
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

// 开始阅读
const startReading = () => {
  // 跳转到阅读页面，通过路由 state 传递作品信息和初始属性
  try {
    // 从 createResult 中获取初始属性和状态
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
    console.error('Failed to read createResult:', e)
    // 降级处理，使用默认值
    router.push({
      path: `/game/${work.value.id}`,
      state: {
        title: work.value.title,
        coverUrl: work.value.coverUrl,
        workId: work.value.id
      }
    })
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
          <button 
            class="favorite-btn" 
            :class="{ active: work.isFavorite }"
            @click="toggleFavoriteWithCount"
          >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </button>
      </div>
      
      <!-- 作者ID -->
      <div class="author-info">
        <span class="author-label">作者：</span>
        <span class="author-id">{{ work.authorId }}</span>
      </div>

        <!-- 元数据：字数、收藏数、评分（位于作者与标签之间） -->
        <div class="meta-stats">
          <div class="meta-item">
            <div class="meta-label">字数</div>
            <div class="meta-value">{{ wordCount }}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">收藏</div>
            <div class="meta-value">{{ favoritesCount }}</div>
          </div>
          <div class="meta-item">
              <div class="meta-label">{{ ratings.length ? (ratings.length + ' 人已评分') : '0 人已评分' }}</div>
              <div class="meta-value rating-inline">
                <span class="rating-text">{{ averageRating10 > 0 ? (averageRating10).toFixed(1) : '—' }}</span>
              </div>
            </div>
          <!-- 发表时间 -->
          <div class="meta-item">
            <div class="meta-label">发表</div>
            <div class="meta-value">{{ publicationDisplay }}</div>
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
          {{ tag }}
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
                <div class="tab-count">{{ ratings.length }} <span class="tab-unit">人</span></div>
              </button>
            </div>

            <!-- 平铺的平均评分显示（仅在评分 tab 激活时显示） -->
            <div class="avg-rating" v-if="showingRatings && ratings.length > 0" style="display:flex;align-items:center;gap:0.5rem;">
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
                  :class="{ filled: n <= selectedStars }"
                  @click="selectStar(n)">
                  ★
                </span>
              </div>
              <div style="margin-left:auto;">
                <button class="submit-comment-btn" @click="submitRating">提交评分</button>
              </div>
            </div>

            <!-- 分页显示评分列表 -->
            <div class="ratings-list" style="width:100%;margin-top:0.5rem;">
              <div v-if="ratings.length === 0" class="empty-comments">
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
