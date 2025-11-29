<template>
  <div class="creations-page">
    <van-nav-bar title="我的创作" left-arrow @click-left="handleBack" />
    
    <div class="book-list">
      <div 
        class="book-item" 
        v-for="book in myCreations" 
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
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import bookCover3 from '../assets/book3.jpg';  
import bookCover4 from '../assets/book4.jpg';
import bookCover1 from '../assets/book1.jpg';
import bookCover2 from '../assets/book2.jpg';

const router = useRouter()

// 模拟我的创作数据
const myCreations = ref([
  {
    id: 101,
    title: '科幻世界',
    cover: bookCover3,
    author: '张三', // 当前用户
    description: '探索未来科技与人类社会的交互，描绘了一个充满想象力的世界...',
    tags: ['科幻', '未来', '想象']
  },
  {
    id: 102,
    title: '美食日记',
    cover: bookCover4,
    author: '张三', // 当前用户
    description: '记录各地美食体验和自制美食的 recipe，分享美食带来的快乐...',
    tags: ['美食', '生活', '食谱']
  },
  {
    id: 103,
    title: '山间小屋',
    cover: bookCover1,
    author: '张三', // 当前用户
    description: '远离城市喧嚣，在山间小屋的宁静生活记录...',
    tags: ['生活', '自然', '散文']
  },
  {
    id: 104,
    title: '编程入门指南',
    cover: bookCover2,
    author: '张三', // 当前用户
    description: '面向初学者的编程入门教程，从基础到实践...',
    tags: ['编程', '技术', '教程']
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
}
</script>

<style scoped>
/* 与阅读历史页面样式相同 */
.creations-page {
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
  -webkit-line-clamp: 2;
  line-clamp: 2;
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