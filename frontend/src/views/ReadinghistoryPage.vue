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
              size="small"
              :style="getRandomTagStyle()"
            >
              {{ tag }}
            </van-tag>
          </div>
        </div>
        <van-icon 
          :name="book.isFavorite ? 'star' : 'star-o'" 
          class="favorite-icon"
          :class="{ active: book.isFavorite }"
          @click.stop="handleFavorite(book)"
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
import bookCover5 from '../assets/book5.jpg';
import bookCover6 from '../assets/book6.jpg';
import bookCover7 from '../assets/book7.jpg';
import bookCover8 from '../assets/book8.jpg';

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
    tags: ['青春', '校园', '成长'],
    isFavorite: false
  },
  {
    id: 2,
    title: '职场生存指南',
    cover: bookCover2,
    author: '张华',
    description: '实用的职场技巧分享，帮助新人快速适应职场环境...',
    tags: ['职场', '技能', '励志'],
    isFavorite: false
  },
  {
    id: 3,
    title: '人工智能简史',
    cover: bookCover3,
    author: '王教授',
    description: '从起源到未来，全面解析人工智能的发展历程...',
    tags: ['科技', 'AI', '科普'],
    isFavorite: false
  },
  {
    id: 4,
    title: '旅行日记',
    cover: bookCover4,
    author: '旅行者',
    description: '记录了环游世界的奇妙经历和所见所闻...',
    tags: ['旅行', '生活', '随笔'],
    isFavorite: false
  },
  {
    id: 105,
    title: '星空观测手记',
    cover: bookCover5,
    author: '张三', 
    description: '记录不同季节的星空变化，分享观测技巧与星座故事，带你领略宇宙的浩瀚与浪漫...',
    tags: ['星空', '天文', '科普'],
    isFavorite: false
  },
  {
    id: 106,
    title: '城市漫步指南',
    cover: bookCover6,
    author: '王二', 
    description: '探访城市里的小众角落，记录老街巷的烟火气与人文故事，发现日常中的不寻常...',
    tags: ['旅行', '城市', '人文'],
    isFavorite: false
  },
  {
    id: 107,
    title: '极简手账术',
    cover: bookCover7,
    author: '麻子', // 当前用户
    description: '分享高效实用的手账记录方法，用简单的笔触留住生活点滴，让手账成为生活的调味剂...',
    tags: ['手账', '生活', '技巧'],
    isFavorite: false
  },
  {
    id: 108,
    title: '绿植养护大全',
    cover: bookCover8,
    author: '柱子', // 当前用户
    description: '从入门到精通的绿植养护指南，涵盖常见绿植的浇水、光照、施肥技巧，打造专属绿意空间...',
    tags: ['绿植', '园艺', '生活'],
    isFavorite: false
  }
])

const tagColorOptions = [
  { backgroundColor: '#e0f2fe', color: '#0284c7' },
  { backgroundColor: '#dbeafe', color: '#3b82f6' },
  { backgroundColor: '#f0fdf4', color: '#166534' },
  { backgroundColor: '#fff7ed', color: '#c2410c' },
  { backgroundColor: '#f5f3ff', color: '#6b21a8' },
  { backgroundColor: '#fee2e2', color: '#b91c1c' },
];


// 返回上一页
const handleBack = () => {
  router.back()
}

// 随机获取一个颜色样式
const getRandomTagStyle = () => {
  const randomIndex = Math.floor(Math.random() * tagColorOptions.length);
  return tagColorOptions[randomIndex];
};


// 导航到书籍详情页
const navigateToBookDetail = (bookId) => {
  router.push(`/book-detail/${bookId}`)
};

// 收藏功能
const handleFavorite = (book) => {
  // 切换收藏状态
  book.isFavorite = !book.isFavorite;
  // 显示相应提示
  showToast(book.isFavorite ? '已收藏' : '取消收藏');
};
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
  width: 150px;
  height: 100px;
  border-radius: 4px;
  flex-shrink: 0;
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
  font-size: 22px;
  color: #888;
  margin-left: 12px;
  flex-shrink: 0;
}

.favorite-icon.active {
  color: #ffcc00;
}
</style>