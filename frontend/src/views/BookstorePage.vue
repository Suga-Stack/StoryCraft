<template>
  <div class="bookstore-page">

    <!-- 热门作品轮播 -->
    <div class="hot-books-carousel">
      <van-swipe :autoplay="3000" indicator-color="#d4a5a5">
        <van-swipe-item v-for="book in hotBooks" :key="book.id">
          <div class="carousel-item" :style="{ backgroundImage: `url(${book.cover})` }">
            <div class="book-info">
              <h3>{{ book.title }}</h3>
              <p>{{ book.author }}</p>
            </div>
          </div>
        </van-swipe-item>
      </van-swipe>
    </div>

    <!-- 功能导航栏 -->
    <div class="function-nav">
      <van-button 
        type="info" 
        round 
        class="searching-btn"
        @click="$router.push('/search')"
      >
        分类搜索
        <van-icon name="arrow-right" slot="icon" />
      </van-button>
    </div>

    <!-- 最新作品推荐 -->
    <div class="latest-books">
      <h2 class="section-title">为你推荐</h2>
      <div class="books-grid">
        <div 
          class="book-card" 
          v-for="book in recommendedBooks" 
          :key="book.id"
          @click="$router.push(`/reader/${book.id}`)"
        > 
            <van-image 
                :src="book.cover" 
                class="book-cover"
                fit="cover"
            />
            <span class="book-title">{{ book.title }}</span>
            <div class="author-tags">
                <p class="book-author">{{ book.author }}</p>
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
import { ref, onMounted } from 'vue';
import {useRouter} from 'vue-router';
import bookCover1 from '../assets/book1.jpg';  
import bookCover2 from '../assets/book2.jpg';
import bookCover3 from '../assets/book3.jpg';
import bookCover4 from '../assets/book4.jpg';
import bookCover5 from '../assets/book5.jpg';

// 模拟热门作品数据
const hotBooks = ref([
  {
    id: 1,
    title: "星辰大海",
    author: "张三",
    cover: bookCover1
  },
  {
    id: 2,
    title: "时光旅行者",
    author: "李四",
    cover: bookCover2
  },
  {
    id: 3,
    title: "城市微光",
    author: "王五",
    cover: bookCover3
  }
]);

// 模拟推荐作品数据（根据用户偏好标签）
const recommendedBooks = ref([
  {
    id: 4,
    title: "青春物语",
    author: "赵六",
    cover: bookCover4,
    tags: ["青春", "校园"]
  },
  {
    id: 5,
    title: "职场生存指南",
    author: "钱七",
    cover: bookCover5,
    tags: ["职场", "励志"]
  },
  {
    id: 6,
    title: "科幻世界",
    author: "孙八",
    cover: bookCover2,
    tags: ["科幻", "未来"]
  },
  {
    id: 7,
    title: "美食日记",
    author: "周九",
    cover: bookCover1,
    tags: ["美食", "生活"]
  }
]);

const tagColorOptions = [
  { backgroundColor: '#e0f2fe', color: '#0284c7' },
  { backgroundColor: '#dbeafe', color: '#3b82f6' },
  { backgroundColor: '#f0fdf4', color: '#166534' },
  { backgroundColor: '#fff7ed', color: '#c2410c' },
  { backgroundColor: '#f5f3ff', color: '#6b21a8' },
  { backgroundColor: '#fee2e2', color: '#b91c1c' },
];

// 随机获取一个颜色样式
const getRandomTagStyle = () => {
  const randomIndex = Math.floor(Math.random() * tagColorOptions.length);
  return tagColorOptions[randomIndex];
};

// 底部导航
const activeTab = ref('bookstore');
const router = useRouter();

// 处理底部导航切换
const handleTabChange = (name) => {
  switch(name) {
    case 'bookstore':
      router.push('/bookstore');
      break;
    case 'create':
      router.push('/create');
      break;
    case 'bookshelf':
      router.push('/bookshelf');
      break;
    case 'profile':
      router.push('/profile');
      break;
  }
};

// 页面加载时获取数据（实际项目中替换为接口请求）
onMounted(() => {
  // 示例：从接口获取热门作品和推荐作品
  // fetchHotBooks();
  // fetchRecommendedBooks();
});
</script>

<style scoped>
.bookstore-page {
  min-height: 100vh;
  background-color: #faf8f3;
  padding-bottom: 50px; /* 预留底部导航栏空间 */
}

/* 轮播样式 */
.hot-books-carousel {
  width: 100%;
  height: 200px;
  overflow: hidden;
}

.carousel-item {
  width: 390px;
  height: 200px;
  background-size: cover;
  background-position: center;
  position: relative;
  transition: transform 0.3s ease;
}

.carousel-item:active {
  transform: scale(0.98);
}

.carousel-image{
    width: 100%;
    height: 100%;
}

.book-info {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px;
  background: linear-gradient(transparent, rgba(0,0,0,0.7));
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
  padding: 16px;
  background-color: #faf8f3;
}

.searching-btn {
  color: white;
  font-size: 16px;
  width: 100%;
  background: linear-gradient(135deg, #d4a5a5 0%, #b88484 100%);
  border: none;
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
  background-color: #faf8f3;
  border-radius: 8px;
  overflow: hidden;
  height: 150px;
}

.book-cover {
  width: 100%;
  height: 100px;
  border-radius: 8px;
  background-size: contain; /* 改为contain，确保图片完整显示 */
  background-repeat: no-repeat; /* 防止图片重复平铺 */
  background-position: center; /* 图片在容器中居中 */
}

.book-card:active {
  transform: translateY(2px);
  box-shadow: 0 1px 4px rgba(0,0,0,0.03);
}

.book-title {
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.author-tags{
    display: grid;
    grid-template-columns: repeat(2,1fr);
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

::v-deep .van-tabbar-item:not(.van-tabbar-item--active){
  color: #999 !important;
}

::v-deep .van-tabbar-item--active {
  color: #d16e6e !important;
}
</style>