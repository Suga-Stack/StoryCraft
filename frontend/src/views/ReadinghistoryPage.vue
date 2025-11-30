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
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast } from 'vant'
import { getReadingHistory } from '../api/user'
import { addFavorite, deleteFavorite } from '../api/user'

const router = useRouter()
const route = useRoute()
const readingHistory = ref([])

const tagColorOptions = [
  { backgroundColor: '#e0f2fe', color: '#0284c7' },
  { backgroundColor: '#dbeafe', color: '#3b82f6' },
  { backgroundColor: '#f0fdf4', color: '#166534' },
  { backgroundColor: '#fff7ed', color: '#c2410c' },
  { backgroundColor: '#f5f3ff', color: '#6b21a8' },
  { backgroundColor: '#fee2e2', color: '#b91c1c' },
]

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

// 随机获取一个颜色样式
const getRandomTagStyle = () => {
  const randomIndex = Math.floor(Math.random() * tagColorOptions.length);
  return tagColorOptions[randomIndex];
};


// 导航到书籍详情页
const navigateToBookDetail = (bookId) => {
  router.push(`/works/${bookId}`)
};

// 收藏功能
const handleFavorite = async (book) => {
  try {
    if (!book.isFavorite) {
      // 添加收藏
      await addFavorite(book.id); // 这里的文件夹名称可根据实际需求调整或从参数获取
      book.isFavorite = true;
      showToast('已收藏');
    } else {
      // 取消收藏 - 假设book对象包含收藏记录的id(favoriteId)，如果没有需要调整接口参数
      await deleteFavorite(book.favoriteId); 
      book.isFavorite = false;
      showToast('取消收藏');
    }
  } catch (error) {
    console.error('收藏操作失败:', error);
    showToast('操作失败，请稍后重试');
    // 失败时回滚状态
    book.isFavorite = !book.isFavorite;
  }
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
  font-size: 18px;
  color: #888;
  margin-left: 12px;
  flex-shrink: 0;
}

.favorite-icon.active {
  color: #ffcc00;
}
</style>