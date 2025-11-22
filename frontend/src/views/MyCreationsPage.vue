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
          :name="book.isPublished ? 'eye' : 'eye-o'" 
          class="visibility-icon"
          :class="{ active: book.isPublished }"
          @click.stop="handlePublish(book)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { getMyworks, publishWorks} from '../api/user'


const router = useRouter()
const myCreations = ref([])

const tagColorOptions = [
  { backgroundColor: '#e0f2fe', color: '#0284c7' },
  { backgroundColor: '#dbeafe', color: '#3b82f6' },
  { backgroundColor: '#f0fdf4', color: '#166534' },
  { backgroundColor: '#fff7ed', color: '#c2410c' },
  { backgroundColor: '#f5f3ff', color: '#6b21a8' },
  { backgroundColor: '#fee2e2', color: '#b91c1c' },
]

// 在组件挂载时获取作品列表
onMounted(() => {
  fetchMyWorks()
})

// 获取当前用户创作的作品列表
const fetchMyWorks = async () => {
  try {
    const response = await getMyworks();
    
    if (!response.data.code || response.data.code !== 200) {
      throw new Error('获取作品列表失败')
    }
    
    myCreations.value = response.data.data;
  } catch (error) {
    showToast(error.message || '获取数据失败，请稍后重试')
    console.error('作品列表请求失败:', error)
  }
}


// 返回上一页
const handleBack = () => {
  router.back()
};

// 随机获取一个颜色样式
const getRandomTagStyle = () => {
  const randomIndex = Math.floor(Math.random() * tagColorOptions.length);
  return tagColorOptions[randomIndex];
};

// 导航到书籍详情页
const navigateToBookDetail = (bookId) => {
  router.push(`/works/${bookId}`)
};


// 发布/隐藏功能
const handlePublish = async (book) => {
  try {
    // 如果当前是未发布状态，则调用发布接口
    if (!book.isPublished) {
      const response = await publishWorks(book.id);
      
      // 假设接口返回200时表示发布成功
      if (response.status === 200) {
        book.isPublished = true;
        showToast('作品已发布');
        fetchMyWorks();
      } else {
        showToast('发布失败：' + (response.data.message || '未知错误'));
      }
    } else {
      // 如果需要实现取消发布功能，这里可以调用取消发布接口
      // 假设取消发布接口为 /gameworks/unpublish/${id}
      // const response = await unpublishWorks(book.id);
      book.isPublished = false;
      showToast('作品已隐藏');
    }
  } catch (error) {
    // 处理接口调用失败的情况
    console.error('发布操作失败:', error);
    // 恢复状态（因为接口调用失败，前端状态不应该改变）
    book.isPublished = !book.isPublished;
    
    // 根据错误类型显示不同提示
    if (error.response && error.response.status === 403) {
      showToast('您没有权限发布该作品');
    } else if (error.response && error.response.status === 404) {
      showToast('作品未找到');
    } else {
      showToast('操作失败，请稍后重试');
    }
  }
};
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
  -webkit-line-clamp: 2;
  line-clamp: 2;
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


.visibility-icon {
  font-size: 20px;
  color: #888;
  margin-left: 12px;
  flex-shrink: 0;
}
</style>