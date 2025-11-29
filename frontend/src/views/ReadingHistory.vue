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
          :src="book.cover" 
          class="book-cover" 
          fit="cover"
        />
        <div class="book-info">
          <h3 class="book-title">{{ book.title }}</h3>
          <p class="book-author">作者: {{ book.author }}</p>
          <p class="book-desc">{{ book.description }}</p>
          <div class="book-tags">
            <van-tag 
              v-for="tag in book.tags" 
              :key="tag"
              type="primary"
              round
              size="small"
            >
              {{ tag }}
            </van-tag>
          </div>
        </div>
        <van-icon 
          name="star-o" 
          class="favorite-icon"
          @click.stop="handleFavorite(book.id)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast } from 'vant'
import bookCover1 from '../assets/book1.jpg';  
import bookCover2 from '../assets/book2.jpg';
import bookCover3 from '../assets/book3.jpg';
import bookCover4 from '../assets/book4.jpg';

const router = useRouter()
const route = useRoute()

// 模拟阅读历史数据（实际项目中可能从API获取）
const readingHistory = ref([
  {
    id: 1,
    title: '青春物语',
    cover: bookCover1,
    author: '李明',
    description: '这是一本关于青春成长的小说，讲述了主人公在高中时期的点点滴滴...',
    tags: ['青春', '校园', '成长']
  },
  {
    id: 2,
    title: '职场生存指南',
    cover: bookCover2,
    author: '张华',
    description: '实用的职场技巧分享，帮助新人快速适应职场环境...',
    tags: ['职场', '技能', '励志']
  },
  {
    id: 3,
    title: '人工智能简史',
    cover: bookCover3,
    author: '王教授',
    description: '从起源到未来，全面解析人工智能的发展历程...',
    tags: ['科技', 'AI', '科普']
  },
  {
    id: 4,
    title: '旅行日记',
    cover: bookCover4,
    author: '旅行者',
    description: '记录了环游世界的奇妙经历和所见所闻...',
    tags: ['旅行', '生活', '随笔']
  }
])

// 返回上一页
const handleBack = () => {
  router.back()
}

// 导航到书籍详情页
const navigateToBookDetail = (bookId) => {
  router.push(`/book-detail/${bookId}`)
}

// 收藏功能
const handleFavorite = (bookId) => {
  showToast('收藏功能已触发')
  // 实际项目中这里会调用API进行收藏操作
}
</script>

<style scoped>
.history-page {
  background-color: #f5f5f5;
  min-height: 100vh;
  padding-bottom: 20px;
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
  width: 80px;
  height: 120px;
  border-radius: 8px;
  flex-shrink: 0;
}

.book-info {
  margin-left: 16px;
  flex-grow: 1;
  overflow: hidden;
}

.book-title {
  font-size: 16px;
  font-weight: 500;
  margin: 0 0 8px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-author {
  font-size: 14px;
  color: #666;
  margin: 0 0 8px 0;
}

.book-desc {
  font-size: 13px;
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
  gap: 8px;
  flex-wrap: wrap;
}

.favorite-icon {
  font-size: 22px;
  color: #888;
  margin-left: 12px;
  flex-shrink: 0;
}

.favorite-icon.active {
  color: #ff4d4f;
}
</style>