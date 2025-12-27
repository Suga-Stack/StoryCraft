<template>
  <div class="bookstore-page">
    <!-- 热门作品轮播 -->
    <div class="hot-books-carousel">
      <van-swipe :autoplay="3000" indicator-color="#d4a5a5">
        <van-swipe-item v-for="book in hotBooks" :key="book.id">
          <div
            class="carousel-item"
            :style="{ backgroundImage: `url(${book.image_url})` }"
            @click="$router.push(`/works/${book.id}`)"
          >
            <div class="book-info">
              <h3 @click="$router.push(`/works/${book.id}`)">{{ book.title }}</h3>
              <p>{{ book.author }}</p>
            </div>
          </div>
        </van-swipe-item>
      </van-swipe>
    </div>

    <!-- 功能导航栏 -->
    <div class="function-nav">
      <van-button type="info" round class="searching-btn" @click="$router.push('/search')">
        搜索
        <template v-slot:icon>
          <van-icon name="arrow-right" />
        </template>
      </van-button>

      <van-button type="info" round class="searching-btn" @click="$router.push('/tag/1')">
        分类
        <template v-slot:icon>
          <van-icon name="arrow-right" />
        </template>
      </van-button>
    </div>

    <!-- 最新作品推荐 -->
    <div class="latest-books">
      <div style="display: flex; align-items: center; justify-content: space-between">
        <h2 class="section-title" style="margin: 0">为你推荐</h2>
        <span
          @click="!loading && refreshRecommendedBooks()"
          style="
            margin-left: 10px;
            color: #888;
            cursor: pointer;
            font-size: 15px;
            user-select: none;
            display: flex;
            align-items: center;
          "
        >
          <van-icon name="replay" style="margin-right: 2px" v-if="!loading" />
          <van-loading size="16px" v-else style="margin-right: 2px" />
          刷新
        </span>
      </div>
      <div class="books-grid">
        <div class="book-card" v-for="book in recommendedBooks" :key="book.id">
          <van-image
            :src="book.image_url"
            class="book-cover"
            fit="cover"
            @click="$router.push(`/works/${book.id}`)"
          />
          <span class="book-title" @click="$router.push(`/works/${book.id}`)">
            {{ book.title }}
          </span>
          <div class="author-tags">
            <p class="book-author">{{ book.author }}</p>
            <div class="book-tags">
              <van-tag
                v-for="(tag, index) in book.processedTags.slice(0, 2)"
                :key="tag.id"
                size="small"
                :style="tag.color"
                @click="handleTagClick(tag)"
              >
                {{ tag.name }}
              </van-tag>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 签到弹窗组件 -->
    <div class="model-overlay" v-if="showModel">
      <div class="sign-model">
        <!--顶部导航栏-->
        <div class="nav">
          <span class="check-in-txt">每日签到！</span>
          <span class="close-btn" @click="handleClose">x</span>
        </div>

        <!--签到日历-->
        <div class="calendar">
          <!-- 月份导航 -->
          <div class="calendar-header">
            <div class="before-arrow" @click="changeMonth(-1)"><</div>
            <h3>{{ currentYear }}年{{ currentMonth + 1 }}月</h3>
            <div class="next-arrow" @click="changeMonth(1)">></div>
          </div>

          <!-- 星期标题 -->
          <div class="weekdays">
            <span>SUN</span>
            <span>MON</span>
            <span>TUE</span>
            <span>WED</span>
            <span>THU</span>
            <span>FRI</span>
            <span>SAT</span>
          </div>

          <!-- 日期网格 -->
          <div class="days">
            <div
              v-for="(day, index) in daysInMonth"
              :key="index"
              class="day-cell"
              :class="{
                empty: !day,
                signed: day && isSignedDate(day),
                today: day && isToday(day)
              }"
            >
              {{ day ? day.getDate() : '' }}
              <span v-if="day && isSignedDate(day)" class="signed-mark">✓</span>
            </div>
          </div>
        </div>

        <!--明细文字-->
        <span class="detail-txt" v-if="showDetail">
          签到成功！连续签到{{ continuousDays }}天，你获得了{{ reward }}积分，目前积分余额{{
            credits
          }}，明天继续！
        </span>

        <!--确认按钮-->
        <div class="btn-container">
          <button class="confirm-btn" @click="handleButtonClick">
            {{ isCheckedIn ? '谢谢' : '签到' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 底部导航栏 -->
    <van-tabbar v-model="activeTab" @change="handleTabChange" safe-area-inset-bottom>
      <van-tabbar-item icon="home-o" name="bookstore">书城</van-tabbar-item>
      <van-tabbar-item icon="edit" name="create">创作</van-tabbar-item>
      <van-tabbar-item icon="bookmark-o" name="bookshelf">书架</van-tabbar-item>
      <van-tabbar-item icon="user-o" name="profile">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { showToast } from 'vant'
import { useRouter } from 'vue-router'
import { recommendWorks, getRatingLeaderboard } from '../api/user'
import { useTags } from '../composables/useTags' // 导入标签工具函数
import { getSignInDates, userSignIn } from '../api/user'

// 初始化标签工具
const { getTagsByIds } = useTags()

// 热门作品数据
const hotBooks = ref([])

// 推荐作品数据（根据用户偏好标签）
const recommendedBooks = ref([])
const loading = ref(false)
const error = ref('')

// 刷新推荐作品，清除本地缓存并重新获取
const refreshRecommendedBooks = async () => {
  localStorage.removeItem('recommendBooksCache')
  await fetchRecommendedBooks()
}

// 状态管理
const today = new Date()

// 当前显示的年月
const currentYear = ref(today.getFullYear())
const currentMonth = ref(today.getMonth())

const continuousDays = ref(0)
const reward = ref(0)
const credits = ref(0)
const showDetail = ref(false)
const signedDates = ref([])
const showModel = ref(false)

// 今日签到状态
const isCheckedIn = ref(false)

// 底部导航
const activeTab = ref('bookstore')
const router = useRouter()

// 处理底部导航切换
const handleTabChange = (name) => {
  switch (name) {
    case 'bookstore':
      router.push('/bookstore')
      break
    case 'create':
      router.push('/create')
      break
    case 'bookshelf':
      router.push('/bookshelf')
      break
    case 'profile':
      router.push('/profile')
      break
  }
}

// 排行榜数据本地缓存（5分钟）
const HOT_BOOKS_CACHE_KEY = 'hotBooksCache'
const HOT_BOOKS_CACHE_TTL = 5 * 60 * 1000 // 5分钟

const fetchHotBooks = async () => {
  // 1. 先查缓存
  const cacheStr = localStorage.getItem(HOT_BOOKS_CACHE_KEY)
  if (cacheStr) {
    try {
      const cache = JSON.parse(cacheStr)
      if (Date.now() - cache.time < HOT_BOOKS_CACHE_TTL && Array.isArray(cache.data)) {
        hotBooks.value = cache.data
        return
      }
    } catch {}
  }
  // 2. 缓存无效，请求后端
  try {
    const response = await getRatingLeaderboard()
    const resData = response.data
    if (resData && Array.isArray(resData.data)) {
      hotBooks.value = resData.data.slice(0, 3)
      // 写入缓存
      localStorage.setItem(
        HOT_BOOKS_CACHE_KEY,
        JSON.stringify({ time: Date.now(), data: hotBooks.value })
      )
    } else {
      showToast(`获取排行榜失败: ${resData.message || '未知错误'}`)
    }
  } catch (err) {
    console.error('排行榜请求失败:', err)
    showToast({ message: '获取热门作品失败，请稍后重试', duration: 1000 })
  }
}

// 推荐作品本地缓存（5分钟）
const RECOMMEND_CACHE_KEY = 'recommendBooksCache'
const RECOMMEND_CACHE_TTL = 5 * 60 * 1000
const fetchRecommendedBooks = async () => {
  if (loading.value) return
  // 1. 先查缓存
  const cacheStr = localStorage.getItem(RECOMMEND_CACHE_KEY)
  if (cacheStr) {
    try {
      const cache = JSON.parse(cacheStr)
      if (Date.now() - cache.time < RECOMMEND_CACHE_TTL && Array.isArray(cache.data)) {
        recommendedBooks.value = cache.data
        return
      }
    } catch {}
  }
  loading.value = true
  error.value = ''
  try {
    const response = await recommendWorks(1)
    const resData = response.data
    if (resData.code === 200) {
      const books = resData.data
      for (const book of books) {
        book.processedTags = await getTagsByIds(book.tags || [])
      }
      recommendedBooks.value = books
      // 写入缓存
      localStorage.setItem(RECOMMEND_CACHE_KEY, JSON.stringify({ time: Date.now(), data: books }))
      if (books.length === 0) {
        showToast({ message: '暂无推荐作品', duration: 1000 })
      }
    } else if (resData.code === 404) {
      error.value = '您尚未设置喜欢的标签，请先去设置偏好'
      showToast(error.value)
    } else {
      throw new Error(`请求失败: ${resData.message || '未知错误'}`)
    }
  } catch (err) {
    console.error('请求详情:', err)
    error.value = '获取推荐作品失败，请稍后重试'
    showToast(error.value)
  } finally {
    loading.value = false
  }
}

// 页面加载时获取数据
onMounted(async () => {
  fetchHotBooks()
  fetchRecommendedBooks()
  try {
    const res = await getSignInDates()
    signedDates.value = res.data.dates || []

    const todayFormatted = formatDate(new Date())

    isCheckedIn.value = signedDates.value.includes(todayFormatted)

    if (!isCheckedIn.value) {
      showModel.value = true
    }
  } catch (error) {
    console.error('获取已签到日期失败:', error)
  }
})

// 格式化日期为yyyy-mm-dd
const formatDate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 切换月份
const changeMonth = (step) => {
  currentMonth.value += step
  // 处理年份切换
  if (currentMonth.value > 11) {
    currentMonth.value = 0
    currentYear.value++
  } else if (currentMonth.value < 0) {
    currentMonth.value = 11
    currentYear.value--
  }
}

// 计算当月天数数组（包含空白天数占位）
const daysInMonth = computed(() => {
  const days = []
  // 当月第一天
  const firstDay = new Date(currentYear.value, currentMonth.value, 1)
  // 当月最后一天
  const lastDay = new Date(currentYear.value, currentMonth.value + 1, 0)

  // 填充月初空白天数
  for (let i = 0; i < firstDay.getDay(); i++) {
    days.push(null)
  }

  // 填充当月日期
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(currentYear.value, currentMonth.value, i))
  }

  return days
})

// 判断日期是否已签到
const isSignedDate = (date) => {
  const isSigned = signedDates.value?.includes(formatDate(date))
  return isSigned
}

// 判断是否是今天
const isToday = (date) => {
  const dateString = formatDate(date)
  const todayString = formatDate(new Date())
  return dateString === todayString
}

const handleButtonClick = () => {
  if (isCheckedIn.value) {
    handleConfirm()
  } else {
    handleCheckIn()
  }
}

// 处理签到逻辑
const handleCheckIn = async () => {
  try {
    const res = await userSignIn()
    continuousDays.value = res.data.continuous_days
    reward.value = res.data.reward
    credits.value = res.data.credits
    isCheckedIn.value = true
    showDetail.value = true

    const todayFormatted = formatDate(new Date())
    signedDates.value.push(todayFormatted)

    currentMonth.value = currentMonth.value
  } catch (error) {
    console.error('签到失败:', error)
  }
}

// 确认按钮点击事件
const handleConfirm = () => {
  showModel.value = false // 关闭弹窗
  showDetail.value = false
}

// 关闭按钮事件
const handleClose = () => {
  showModel.value = false // 关闭弹窗
}

// 点击标签跳转到标签页面
const handleTagClick = (tag) => {
  if (!tag?.id) {
    showToast({ message: '标签信息不完整', duration: 1000 })
    return
  }
  router.push({
    path: `/tag/${tag.id}`, // 跳转到标签页面，路径包含标签ID
    query: { name: tag.name }
  })
}
</script>

<style scoped>
.bookstore-page {
  min-height: 100vh;
  background-color: #faf8f3;
  padding-bottom: 50px;
}

.hot-books-carousel {
  width: 100%;
  height: 200px;
  overflow: hidden;
}

.carousel-item {
  width: 100%;
  height: 200px;
  background-size: cover;
  background-position: center;
  position: relative;
  transition: transform 0.3s ease;
}

.carousel-item:active {
  transform: scale(0.98);
}

.carousel-image {
  width: 100%;
  height: 100%;
}

.book-info {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  color: white;
}

.book-info h3 {
  font-size: 18px;
  margin-bottom: 4px;
}

.book-info p {
  font-size: 14px;
  opacity: 0.9;
}

/* 功能导航 */
.function-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background-color: #faf8f3;
  gap: 20px;
}

.searching-btn {
  color: white;
  font-size: 16px;
  background: linear-gradient(135deg, #d4a5a5 0%, #b88484 100%);
  border: none;
  width: 100%;
}

/* 最新作品推荐 */
.latest-books {
  padding: 16px;
  height: 100%;
}

.section-title {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 16px;
  color: #333;
}

.books-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.book-card {
  background-color: #fff;
  border-radius: 8px;
  overflow: hidden;
  height: 160px;
}

.book-cover {
  width: 100%;
  height: 100px;
  border-radius: 8px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

.book-card:active {
  transform: translateY(2px);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
}

.book-title {
  font-size: 14px;
  width: 150px;
  display: inline-block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.author-tags {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
}

.book-author {
  font-size: 12px;
  color: #666;
}

.book-tags {
  display: flex;
  gap: 4px;
}

/* 底部导航栏 */
.van-tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: #faf8f3;
}

::v-deep .van-tabbar-item--active {
  background-color: transparent !important;
}

::v-deep .van-tabbar-item:not(.van-tabbar-item--active) {
  color: #999 !important;
}

::v-deep .van-tabbar-item--active {
  color: #d16e6e !important;
}

/* 签到弹窗样式 */
.model-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.3); /* 半透明黑色遮罩 */
  backdrop-filter: blur(5px); /* 背景虚化效果 */
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.sign-model {
  background-color: #faf8f3;
  height: auto;
  width: 300px;
  border: 1.5px solid #d4a5a5;
  border-radius: 15px;
  padding: 20px 10px;
}

.nav {
  padding: 0 20px 8px 10px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 30px;
}

.check-in-txt {
  font-size: 20px;
  color: #d4a5a5;
}

.close-btn {
  font-size: 22px;
  color: #d4a5a5;
  position: absolute;
  right: 10px;
  top: 30%;
  transform: translateY(-50%);
  cursor: pointer;
}

.calendar {
  width: 250px;
  margin: 0 auto;
  padding: 16px;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
}

.calendar-header button {
  padding: 4px 12px;
  cursor: pointer;
}

.next-arrow,
.before-arrow {
  color: #444444;
}

.weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  margin-bottom: 8px;
}

.weekdays span {
  text-align: center;
  font-weight: bold;
  color: #666;
  font-size: 11px;
}

.days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
}

.day-cell {
  aspect-ratio: 1.3;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #ffffff;
  border: 1px solid #eee;
  border-radius: 8px;
  position: relative;
  font-size: 11px;
}

.day-cell.empty {
  border: none;
}

.day-cell.signed {
  background-color: #d4a5a5;
  color: #ffffff;
}

.detail-txt {
  color: #d4a5a5;
  font-size: 16px;
  margin: 10px 8px;
  display: block;
  text-align: center;
}

.btn-container {
  background-color: rgba(212, 165, 165, 0.25);
  width: calc(100% + 20px);
  height: 80px;
  margin: 0 -10px -20px; /* 抵消父容器的padding */
  padding: 15px 10px; /* 内部间距 */
  box-sizing: border-box; /* 确保padding不影响宽度计算 */
  display: flex;
  justify-content: center;
  align-items: center;
}

.confirm-btn {
  color: white;
  font-size: 16px;
  width: 50%;
  background: linear-gradient(135deg, #d4a5a5 0%, #b88484 100%);
  border: none;
  border-radius: 16px;
  height: 35px;
}

.day-cell.signed {
  background-color: #d4a5a5;
  color: #ffffff;
  position: relative;
}

.signed-mark {
  position: absolute;
  bottom: 2px;
  right: 2px;
  font-size: 8px;
}

.detail-txt {
  color: #d4a5a5;
  font-size: 14px;
  margin: 10px 8px;
  display: block;
  text-align: center;
  min-height: 40px;
}
</style>
