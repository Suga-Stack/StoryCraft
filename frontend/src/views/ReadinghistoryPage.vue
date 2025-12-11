<template>
  <div class="history-page">
    <van-nav-bar title="阅读历史" left-arrow @click-left="handleBack" />
    
    <div class="book-list">
      <div 
        class="book-item" 
        v-for="book in readingHistory" 
        :key="book.id"
        @click="navigateToBookDetail(book.id)"
      >
        <van-image 
          :src="book.image_url" 
          class="book-cover" 
          fit="cover"
        />
        <div class="book-info">
          <h3 class="book-title">{{ book.title }}</h3>
          <p class="book-author">作者: {{ book.author }}</p>
          <p class="book-desc">{{ book.description }}</p>
          <div class="book-tags">
            <van-tag 
              v-for="tag in book.processedTags.slice(0, 3)" 
              :key="tag.id"
              size="small"
              :style="tag.color"
            >
              {{ tag.name }}
            </van-tag>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast } from 'vant'
import { getReadingHistory } from '../api/user'
import { useTags } from '../composables/useTags'

// 初始化标签工具
const { getTagsByIds } = useTags();

const router = useRouter()
const readingHistory = ref([])

// 在组件挂载时获取阅读历史
onMounted(() => {
  fetchReadingHistory()
})

// 获取当前用户阅读历史的作品列表
const fetchReadingHistory = async () => {
  try {
    const response = await getReadingHistory();
    
    if (!response.data.code || response.data.code !== 200) {
      throw new Error('获取阅读历史失败')
    }
    
    const books = response.data.data;
    
    // 为每本书处理标签（转换ID为名称和颜色）
    for (const book of books) {
      book.processedTags = await getTagsByIds(book.tags || []);
    }

    readingHistory.value = books;
  } catch (error) {
    showToast(error.message || '获取数据失败，请稍后重试')
    console.error('作品列表请求失败:', error)
  }
}

// 返回上一页
const handleBack = () => {
  router.back()
}


// 导航到书籍详情页
const navigateToBookDetail = (bookId) => {
  router.push(`/works/${bookId}`)
};


</script>

<style scoped>
::v-deep .van-nav-bar {
  background: #faf8f3;
  box-shadow: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
}
::v-deep .van-nav-bar__title,
::v-deep .van-nav-bar__left .van-icon {
  color: #54494B; 
}

.history-page {
  background-color: #faf8f3;
  min-height: 100vh;
  padding-bottom: 20px;
  margin-top: 46px;
}

.book-list {
  padding: 16px;
}

.book-item {
  display: flex;
  background-color: #fff;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 16px;
  align-items: center;
}

.book-cover {
  width: 150px;
  height: 100px;
  border-radius: 4px;
  flex-shrink: 0;
  overflow: hidden;
}

.book-info {
  margin-left: 12px;
  flex-grow: 1;
  overflow: hidden;
}

.book-title {
  font-size: 15px;
  font-weight: 500;
  margin: 0 0 4px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-author {
  font-size: 12px;
  color: #666;
  margin: 0 0 6px 0;
}

.book-desc {
  font-size: 12px;
  color: #888;
  margin: 0 0 10px 0;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.book-tags {
  display: flex;
  gap: 4px;
}

.favorite-icon {
  font-size: 18px;
  color: #888;
  margin-left: 12px;
  flex-shrink: 0;
}

.favorite-icon.active {
  color: #ffcc00;
}
</style>