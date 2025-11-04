<template>
  <div class="search-page">
    <!-- 顶部搜索栏 -->
    <div class="search-bar">
      <van-search
        v-model="searchValue"
        placeholder="搜索作品或作者..."
        shape="round"
        background="#f5f5f5"
        @search="handleSearch"
      >
        <template #left>
          <van-icon name="arrow-left" @click="handleBack" />
        </template>
      </van-search>
    </div>

    <!-- 导航按钮栏 -->
    <div class="nav-buttons" v-if="searchValue === ''">
      <button 
        class="primary-btn" 
        :class="{ active: currentTab === 'total' }"
        @click="switchTab('total')"
      >
        总热榜
      </button>
      <button 
        class="primary-btn" 
        :class="{ active: currentTab === 'month' }"
        @click="switchTab('month')"
      >
        本月热榜
      </button>
      <button 
        class="primary-btn" 
        :class="{ active: currentTab === 'week' }"
        @click="switchTab('week')"
      >
        本周热榜
      </button>
      <button 
        class="primary-btn" 
        :class="{ active: currentTab === 'rating' }"
        @click="switchTab('rating')"
      >
        评分榜
      </button>
    </div>

    <!-- 搜索历史 -->
    <div class="search-history" v-if="searchValue === '' && searchHistory.length">
      <div class="history-header">
        <span>搜索历史</span>
        <van-icon name="delete" @click="clearHistory" />
      </div>
      <div class="history-tags">
        <van-tag 
          v-for="(item, index) in searchHistory" 
          :key="index"
          closeable
          @click="handleHistoryClick(item)"
          @close="deleteHistory(index)"
        >
          {{ item }}
        </van-tag>
      </div>
    </div>

    <!-- 排行榜区域 -->
    <div class="rankings" v-if="searchValue === ''">
      <div class="ranking-section">
        <div class="ranking-header">
          <van-icon 
            :name="currentTab === 'rating' ? 'grade' : 'fire'" 
            :color="currentTab === 'rating' ? '#ff7d00' : '#ff4d4f'" 
          />
          <span>{{ currentTabText }}</span>
        </div>
        
        <!-- 可滚动的排行榜列表 -->
        <div class="ranking-list-wrapper">
          <div class="ranking-list">
            <div 
              class="ranking-item" 
              v-for="(item, index) in currentRankList" 
              :key="item.id"
              @click="navigateToDetail(item.id)"
            >
              <!-- 排名标识 -->
              <div class="rank-number" :class="{ top3: index < 3 }">
                  {{ (currentPage - 1) * pageSize + index + 1 }}
              </div>
              
              <!-- 封面 -->
              <van-image 
                :src="item.cover" 
                class="item-cover" 
                fit="cover"
              />
              
              <!-- 信息区域 -->
              <div class="item-info">
                <h3 class="item-title">{{ item.title }}</h3>
                <p class="item-author">作者: {{ item.author }}</p>
                <div class="item-meta">
                  <span class="meta-tag">
                    {{ currentTab === 'rating' ? '评分: ' + item.rating.toFixed(1) : '热度: ' + formatNumber(item.hotScore) }}
                  </span>
                  <div class="tags">
                    <van-tag 
                      v-for="tag in item.tags.slice(0, 2)" 
                      :key="tag"
                      size="mini"
                      round
                    >
                      {{ tag }}
                    </van-tag>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 分页控件 -->
        <div class="pagination">
          <van-pagination
            v-model="currentPage"
            :total-items="totalItems"
            :items-per-page="pageSize"
            :show-page-size="false"
            @change="handlePageChange"
          />

          <div class="pagination-buttons">
            <van-button 
              type="primary" 
              size="small"
              class="pre-btn"
              @click="handlePrevPage"
              :disabled="currentPage === 1"
            >
              上一页
            </van-button>
            <van-button 
              type="primary" 
              size="small"
              class="next-btn"
              @click="handleNextPage"
              :disabled="currentPage >= totalPages"
            >
              下一页
            </van-button>
          </div>

          <div class="page-jump">
            <span class="page-info">
              {{ currentPage }} / {{ totalPages }}
            </span>
            <div class="jump-controls">
              <van-input
                v-model="jumpPage"
                type="number"
                placeholder="页码"
                class="page-input"
                :max="totalPages"
                :min="1"
                @keyup.enter="handleJump"
              />
              <van-button 
                type="primary" 
                size="small"
                class="jump-btn"
                @click="handleJump"
              >
                跳转
              </van-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 搜索结果区域 -->
    <div class="search-result" v-if="searchValue !== ''">
      <div class="result-header">
        <span>搜索结果: "{{ searchValue }}"</span>
      </div>
      <div class="result-list" v-if="searchResults.length">
        <div 
          class="result-item" 
          v-for="item in searchResults" 
          :key="item.id"
          @click="navigateToDetail(item.id)"
        >
          <van-image 
            :src="item.cover" 
            class="result-cover" 
            fit="cover"
          />
          <div class="result-info">
            <h3 class="result-title">{{ item.title }}</h3>
            <p class="result-author">作者: {{ item.author }}</p>
            <div class="result-tags">
              <van-tag 
                v-for="tag in item.tags" 
                :key="tag"
                size="small"
                round
              >
                {{ tag }}
              </van-tag>
            </div>
          </div>
        </div>
      </div>
      <div class="empty-result" v-else>
        <van-empty description="未找到相关作品" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'

// 路由实例
const router = useRouter()

// 搜索相关数据
const searchValue = ref('')
const searchHistory = ref([])
const searchResults = ref([])

// 排行榜切换相关
const currentTab = ref('total') // total, month, week, rating
const currentPage = ref(1)
const pageSize = ref(20)
const jumpPage = ref('')

// 生成模拟数据
const generateRankData = (type, count = 50) => {
  const baseCovers = [
    'https://img01.yzcdn.cn/vant/cat.jpeg',
    'https://img02.yzcdn.cn/vant/dog.jpeg',
    'https://img03.yzcdn.cn/vant/bird.jpeg',
    'https://img04.yzcdn.cn/vant/rabbit.jpeg',
    'https://img05.yzcdn.cn/vant/fox.jpeg',
    'https://img06.yzcdn.cn/vant/elephant.jpeg',
    'https://img07.yzcdn.cn/vant/tiger.jpeg',
    'https://img08.yzcdn.cn/vant/lion.jpeg',
    'https://img09.yzcdn.cn/vant/panda.jpeg',
    'https://img10.yzcdn.cn/vant/bear.jpeg',
  ]
  
  const tags = ['科幻', '文学', '历史', '科普', '小说', '哲学', '经济', '艺术', '传记', '悬疑']
  const authors = ['作者A', '作者B', '作者C', '作者D', '作者E', '作者F', '作者G', '作者H', '作者I', '作者J']
  const titles = ['作品标题', '经典名著', '畅销书籍', '精选读物', '推荐好书', '热门作品', '高分图书', '必读书目']
  
  return Array.from({ length: count }, (_, i) => {
    const id = i + 1
    const randomBase = Math.random()
    return {
      id: `${type}-${id}`,
      title: `${titles[Math.floor(Math.random() * titles.length)]} ${id}`,
      author: authors[Math.floor(Math.random() * authors.length)],
      cover: baseCovers[Math.floor(Math.random() * baseCovers.length)],
      hotScore: Math.floor(randomBase * 100000),
      rating: 3 + randomBase * 2,
      tags: [
        tags[Math.floor(Math.random() * tags.length)],
        tags[Math.floor(Math.random() * tags.length)]
      ]
    }
  }).sort((a, b) => {
    // 评分榜按评分降序，其他按热度降序
    return type === 'rating' 
      ? b.rating - a.rating 
      : b.hotScore - a.hotScore
  })
}

// 排行榜数据
const totalRank = ref(generateRankData('total'))
const monthRank = ref(generateRankData('month'))
const weekRank = ref(generateRankData('week'))
const ratingRank = ref(generateRankData('rating'))

// 计算当前显示的排行榜数据
const currentRankList = computed(() => {
  const allData = currentTab.value === 'total' ? totalRank.value :
                 currentTab.value === 'month' ? monthRank.value :
                 currentTab.value === 'week' ? weekRank.value :
                 ratingRank.value
  
  // 计算分页
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return allData.slice(start, end)
})

// 计算总条目数
const totalItems = computed(() => {
  switch(currentTab.value) {
    case 'total': return totalRank.value.length
    case 'month': return monthRank.value.length
    case 'week': return weekRank.value.length
    case 'rating': return ratingRank.value.length
    default: return 0
  }
})

// 当前标签页文本
const currentTabText = computed(() => {
  const texts = {
    total: '总热榜',
    month: '本月热榜',
    week: '本周热榜',
    rating: '评分榜'
  }
  return texts[currentTab.value]
})

// 切换标签页
const switchTab = (tab) => {
  currentTab.value = tab
  currentPage.value = 1 // 切换标签时重置到第一页
}

// 计算总页数
const totalPages = computed(() => {
  return Math.ceil(totalItems.value / pageSize.value) || 1
})

// 上一页
const handlePrevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    scrollToTop()
  }
}

// 下一页
const handleNextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    scrollToTop()
  }
}

// 提取滚动到顶部的逻辑为共用方法
const scrollToTop = () => {
  const listWrapper = document.querySelector('.ranking-list-wrapper')
  if (listWrapper) {
    listWrapper.scrollTop = 0
  }
}

const handlePageChange = (page) => {
  currentPage.value = page
  scrollToTop()
}

// 处理页码跳转
const handleJump = () => {
  // 验证输入的页码是否有效
  const page = parseInt(jumpPage.value, 10)
  if (
    !isNaN(page) && 
    page >= 1 && 
    page <= totalPages.value && 
    page !== currentPage.value
  ) {
    currentPage.value = page
    scrollToTop()
  } else {
    showToast('请输入有效的页码')
  }
  // 清空输入框
  jumpPage.value = ''
}

// 页面挂载时加载搜索历史
onMounted(() => {
  const history = localStorage.getItem('searchHistory')
  if (history) {
    try {
      searchHistory.value = JSON.parse(history)
    } catch (e) {
      console.error('解析搜索历史失败', e)
      localStorage.removeItem('searchHistory')
    }
  }
})

// 保存搜索历史到本地存储
const saveHistory = (value) => {
  if (!value.trim()) return
  // 去重
  const newHistory = searchHistory.value.filter(item => item !== value)
  // 添加到最前面
  newHistory.unshift(value)
  // 限制最多10条历史
  if (newHistory.length > 10) newHistory.pop()
  searchHistory.value = newHistory
  localStorage.setItem('searchHistory', JSON.stringify(newHistory))
}

// 搜索处理
const handleSearch = (value) => {
  if (!value.trim()) return
  saveHistory(value)
  // 模拟搜索结果
  const allItems = [...totalRank.value, ...monthRank.value, ...weekRank.value, ...ratingRank.value]
  searchResults.value = allItems.filter(
    item => item.title.includes(value) || item.author.includes(value)
  )
}

// 点击历史记录
const handleHistoryClick = (value) => {
  searchValue.value = value
  handleSearch(value)
}

// 删除单条历史
const deleteHistory = (index) => {
  searchHistory.value.splice(index, 1)
  localStorage.setItem('searchHistory', JSON.stringify(searchHistory.value))
}

// 清空所有历史
const clearHistory = () => {
  searchHistory.value = []
  localStorage.removeItem('searchHistory')
  showToast('已清空搜索历史')
}

// 返回上一页
const handleBack = () => {
  router.back()
}

// 跳转到作品详情
const navigateToDetail = (id) => {
  router.push(`/book-detail/${id}`)
}

// 数字格式化
const formatNumber = (num) => {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万'
  }
  return num.toString()
}
</script>

<style scoped>
.search-page {
  background-color: #f5f5f5;
  min-height: 100vh;
}

/* 搜索栏样式 */
.search-bar {
  padding: 10px 16px;
  background-color: #fff;
}

/* 导航按钮样式 */
.nav-buttons {
  display: flex;
  padding: 10px 16px;
  background-color: #fff;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
}

.nav-buttons::-webkit-scrollbar {
  display: none;
}

.primary-btn {
  flex: 1;
  min-width: 80px;
  padding: 8px 0;
  color: white;
  background: linear-gradient(135deg, #d4a5a5 0%, #b88484 100%);
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(212, 165, 165, 0.3);
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.primary-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(212, 165, 165, 0.4);
}

.primary-btn:active {
  transform: translateY(0);
}

.primary-btn.active {
  opacity: 0.9;
  box-shadow: 0 2px 8px rgba(212, 165, 165, 0.5);
}

/* 搜索历史样式 */
.search-history {
  padding: 16px;
  background-color: #fff;
  margin-bottom: 10px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 14px;
  color: #666;
}

.history-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

/* 排行榜通用样式 */

.ranking-section {
  background-color: #fff;
  margin-bottom: 10px;
  padding: 16px;
}

.ranking-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
  color: #333;
}

/* 可滚动的排行榜列表容器 */
.ranking-list-wrapper {
  max-height: 610px;
  overflow-y: auto;
  margin-bottom: 16px;
  scrollbar-width: thin;
}

.ranking-list-wrapper::-webkit-scrollbar {
  width: 4px;
}

.ranking-list-wrapper::-webkit-scrollbar-thumb {
  background-color: #ddd;
  border-radius: 2px;
}

.ranking-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 排行榜项样式 */
.ranking-item {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f5f5f5;
}

.ranking-item:last-child {
  border-bottom: none;
}

.rank-number {
  width: 24px;
  height: 24px;
  line-height: 24px;
  text-align: center;
  font-size: 14px;
  color: #999;
  margin-right: 12px;
}

.rank-number.top3 {
  color: #fff;
  border-radius: 50%;
}

.item-cover {
  width: 120px;
  height: 80px;
  border-radius: 4px;
  flex-shrink: 0;
}

.item-info {
  margin-left: 12px;
  flex-grow: 1;
  overflow: hidden;
}

.item-title {
  font-size: 15px;
  font-weight: 500;
  margin: 0 0 4px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-author {
  font-size: 12px;
  color: #666;
  margin: 0 0 6px 0;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.meta-tag {
  font-size: 12px;
  color: #888;
}

.tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

/* 分页样式 */
.pagination-buttons {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 10px;
}

.van-button_content{
  color: white;
  font-size: 14px;
  width: 100%;
  background: linear-gradient(135deg, #d4a5a5 0%, #b88484 100%);
  border: none;
}

.pagination {
  padding: 0 0 10px 0;
}

::v-deep .pre-btn,
::v-deep .next-btn {
  color: white;
  font-size: 14px;
  width: 20%;
  background: linear-gradient(135deg, #d4a5a5 0%, #b88484 100%);
  border: none;
}

::v-deep .pre-btn:disabled,
::v-deep .next-btn:disabled {
  background: linear-gradient(135deg, #d4a5a5 0%, #b88484 100%);
  opacity: 0.6;
  cursor: not-allowed;
}


/* 页码跳转区域样式 */
.page-jump {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  margin-top: 10px;
  padding: 5px 0;
}

.page-info {
  font-size: 14px;
  color: #666;
}

.jump-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.page-input {
  width: 80px;
  min-height: 32px; 
}

.jump-btn{
  color: white;
  font-size: 14px;
  width: 50px;
  background: linear-gradient(135deg, #d4a5a5 0%, #b88484 100%);
  border: none;
}

.page-input {
  width: 80px;
}

/* 搜索结果样式 */
.search-result {
  padding: 16px;
}

.result-header {
  font-size: 14px;
  color: #666;
  margin-bottom: 16px;
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.result-item {
  display: flex;
  background-color: #fff;
  border-radius: 8px;
  padding: 12px;
  align-items: center;
}

.result-cover {
  width: 70px;
  height: 100px;
  border-radius: 6px;
  flex-shrink: 0;
}

.result-info {
  margin-left: 12px;
  flex-grow: 1;
  overflow: hidden;
}

.result-title {
  font-size: 16px;
  font-weight: 500;
  margin: 0 0 6px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-author {
  font-size: 13px;
  color: #666;
  margin: 0 0 8px 0;
}

.result-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.empty-result {
  padding: 40px 0;
  text-align: center;
}
</style>