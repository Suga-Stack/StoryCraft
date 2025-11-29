<template>
  <div class="profile-page">
    <!-- 顶部用户信息区域 -->
    <div class="user-header">
      <van-image 
        class="avatar" 
        :src="userAvatar" 
        round 
        fit="cover"
        @click="handleAvatarClick"
      />
      <div class="username-container">
        <span class="username">{{ username }}</span>
        <van-icon 
          name="edit" 
          size="16" 
          class="edit-icon"
          @click="showUsernameDialog = true"
        />
      </div>
    </div>

    <!-- 用户信息列表 -->
    <van-cell-group inset>
      <!-- 剩余积分 -->
      <van-cell 
        title="剩余积分" 
        :value="`${userPoints} 积分`"
        icon="points"
        value-class="points-value"
      />

      <!-- 性别信息 -->
      <van-cell 
        title="性别" 
        :value="userGender"
        icon="user"
        is-link
        @click="navigateToPreferences"
      />

      <!-- 偏好标签 -->
      <van-cell 
        title="偏好标签" 
        value="查看偏好"
        icon="tag"
        is-link
        @click="navigateToPreferences"
      />
    </van-cell-group>

    <!-- 阅读历史区域 -->
    <div class="section-container">
      <van-cell 
        title="阅读历史" 
        value="查看全部"
        icon="clock-o"
        is-link
        @click="navigateToReadingHistory"
        class="section-title-cell"
      />
      
      <div class="books-grid">
        <div 
          class="book-item" 
          v-for="(book, index) in readingHistory" 
          :key="index"
          @click="navigateToBookDetail(book.id)"
        >
          <van-image 
            :src="book.cover" 
            class="book-cover" 
            fit="cover"
          />
          <span class="book-title">{{ book.title }}</span>
        </div>
      </div>
    </div>

    <!-- 我的创作区域 -->
    <div class="section-container">
      <van-cell 
        title="我的创作" 
        value="查看全部"
        icon="pen"
        is-link
        @click="navigateToMyCreations"
        class="section-title-cell"
      />
      
      <div class="books-grid">
        <div 
          class="book-item" 
          v-for="(book, index) in myCreations" 
          :key="index"
          @click="navigateToBookDetail(book.id)"
        >
          <van-image 
            :src="book.cover" 
            class="book-cover" 
            fit="cover"
          />
          <span class="book-title">{{ book.title }}</span>
        </div>
      </div>
    </div>

    <!-- 退出登录按钮 -->
    <van-button 
      class="logout-btn" 
      round 
      @click="handleLogout"
    >
      退出登录
    </van-button>

    <!-- 修改用户名弹窗 -->
    <van-dialog 
      v-model:show="showUsernameDialog" 
      title="修改用户名"
      @confirm="handleUsernameChange"
    >
      <van-field 
        v-model="newUsername" 
        placeholder="请输入新用户名"
        maxlength="12"
      />
    </van-dialog>

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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import bookCover1 from '../assets/book1.jpg';  
import bookCover2 from '../assets/book2.jpg';
import bookCover3 from '../assets/book3.jpg';
import bookCover4 from '../assets/book4.jpg';

// 路由实例
const router = useRouter()

// 状态管理
const username = ref('张三')
const newUsername = ref('')
const showUsernameDialog = ref(false)
const userPoints = ref(1250)
const userGender = ref('男')
const userAvatar = ref('https://img.yzcdn.cn/vant/cat.jpeg')
const activeTab = ref('profile') // 默认选中"我的"

// 阅读历史数据
const readingHistory = ref([
  {
    id: 1,
    title: '青春物语',
    cover: bookCover1
  },
  {
    id: 2,
    title: '职场生存指南',
    cover: bookCover2
  }
])

// 我的创作数据
const myCreations = ref([
  {
    id: 101,
    title: '科幻世界',
    cover: bookCover3
  },
  {
    id: 102,
    title: '美食日记',
    cover: bookCover4
  }
])

// 页面挂载时设置当前活跃标签
onMounted(() => {
  activeTab.value = 'profile'
})

// 处理用户名修改
const handleUsernameChange = () => {
  if (!newUsername.value.trim()) {
    showToast('用户名不能为空')
    return
  }
  username.value = newUsername.value.trim()
  showToast('修改成功')
}

// 导航到偏好设置页
const navigateToPreferences = () => {
  router.push('/preferences')
}

// 导航到阅读历史页
const navigateToReadingHistory = () => {
  router.push('/ReadingHistory')
}

// 导航到我的创作页
const navigateToMyCreations = () => {
  router.push('/MyCreations')
}

// 导航到书籍详情页
const navigateToBookDetail = (bookId) => {
  router.push(`/book-detail/${bookId}`)
}

// 处理退出登录
const handleLogout = () => {
  // 清除登录状态（实际项目中需清除token等）
  router.push('/login')
  showToast('已退出登录')
}

// 头像点击事件
const handleAvatarClick = () => {
  showToast('上传头像功能待实现')
}

// 底部导航切换
const handleTabChange = (tabName) => {
  switch(tabName) {
    case 'bookstore':
      router.push('/')
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
</script>

<style scoped>
.profile-page {
  padding: 20px 16px;
  background-color: #f5f5f5;
  min-height: 100vh;
  /* 为底部导航栏预留空间 */
  padding-bottom: 60px;
}

/* 用户头像区域 */
.user-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
  padding: 16px;
}

.avatar {
  width: 100px;
  height: 100px;
  border: 3px solid #f0f0f0;
  margin-bottom: 12px;
}

.username-container {
  display: flex;
  align-items: center;
}

.username {
  font-size: 18px;
  font-weight: 500;
  margin-right: 8px;
}

.edit-icon {
  color: #888;
  cursor: pointer;
}

/* 积分样式 */
.points-value {
  color: #ff7d00;
  font-weight: 500;
}

/* 内容区块样式 */
.section-container {
  background-color: #fff;
  border-radius: 12px;
  margin-bottom: 16px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.section-title-cell {
  background-color: #ffffff;
}

/* 书籍网格布局 */
.books-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
    padding:0 15px;
}

.book-item {
  border-radius: 8px;
  overflow: hidden;
  height: 110px;
}

.book-cover {
  width: 100%;
  height: 80px;
  border-radius: 8px;
  background-size: contain; /* 改为contain，确保图片完整显示 */
  background-repeat: no-repeat; /* 防止图片重复平铺 */
  background-position: center; /* 图片在容器中居中 */
}

.book-title {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 退出登录按钮 */
.logout-btn {
    margin-top: 20px;
    width: 100%;
    height: 50px;
    font-size: 16px;
    color: white;
    background: linear-gradient(135deg, #d4a5a5 0%, #b88484 100%);
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(212, 165, 165, 0.3);
}

.logout-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(212, 165, 165, 0.4);
}
.logout-btn:active {
    transform: translateY(0);
}

/* 单元格样式调整 */
::v-deep .van-cell-group {
  margin-bottom: 16px;
}

::v-deep .van-cell {
  font-size: 15px;
  height: 56px;
}

::v-deep .van-cell__title {
  color: #333;
}

::v-deep .van-cell__value {
  color: #666;
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