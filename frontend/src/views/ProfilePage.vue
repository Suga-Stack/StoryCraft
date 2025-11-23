<template>
  <div class="profile-page">
    <!-- 顶部用户信息区域 -->
    <div class="user-header">
      <div
        class="avatar-container"
        @click="handleAvatarClick"
        :style="{ cursor: 'pointer' }"
        >

        <img 
          :src="previewUrl || userInfo.profile_picture || defaultAvatar" 
          alt="用户头像"
          class="avatar-img"
        >

        <!-- 隐藏的文件选择框 -->
        <input
          type="file"
          ref="fileInput"
          class="hidden"
          accept="image/*" 
          @change="handleFileChange"
        >
      </div>
  
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
        title="性别及偏好" 
        :value="userGender"
        icon="user"
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
            :src="book.image_url" 
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
            :src="book.image_url" 
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
import { updateUserInfo } from '../api/user';
import { getUserInfo } from '../api/user';
import http from '../utils/http';
import { getRecentReadingHistory } from '../api/user';
import { getRecentMyworks } from '../api/user';
import { useUserStore } from '../store';

// 路由实例
const router = useRouter()
const userStore = useUserStore()

const showUsernameDialog = ref(false)
const activeTab = ref('profile') // 默认选中"我的"
const previewUrl = ref('')
const defaultAvatar = ref('https://img.yzcdn.cn/vant/cat.jpeg')
const fileInput = ref(null)

const userInfo = ref({})
const username = ref('')
const userPoints = ref(0)
const userGender = ref('')
const newUsername = ref('')

// 阅读历史数据
const readingHistory = ref([])

// 我的创作数据
const myCreations = ref([])

// 添加用户信息获取接口
const fetchUserInfo = async (userId) => {
  try {
    const response = await getUserInfo(userId)

    // 检查业务状态
    if (response.data.code && response.data.code !== 200) {
      throw new Error(`业务错误: ${response.data.message || '获取用户信息失败'}`);
    }

    return response.data;
  } catch (error) {
    const errorMsg = `获取用户信息失败: ${error.message}`;
    showToast(errorMsg);
    throw error;
  }
  
}

const getUserIdFromStorage = () => {
  // 从 localStorage 读取用户信息
  try{
    const storedUser = localStorage.getItem('userInfo');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      return user.id; // 返回 userId
    }
  }catch (err) {
    console.error('读取本地用户信息失败', err);
    localStorage.removeItem('userInfo'); // 清除无效数据
  }
  router.push('/login');
  return null;
}

// 获取阅读历史的函数
const fetchReadingHistory = async () => {
  try {
    const response = await getRecentReadingHistory();
    // 假设接口返回格式为 { data: [...] }
    if (response.data.code === 200) {
      readingHistory.value = response.data.data;
    } else {
      throw new Error(response.data.message || '获取阅读历史失败');
    }
  } catch (error) {
    console.error('获取阅读历史失败:', error);
    showToast(error.message || '加载阅读历史出错');
  }
}

// 获取创作作品的函数
const fetchMyCreations = async () => {
  try {
    const response = await getRecentMyworks();
    // 假设接口返回格式为 { data: [...] }
    if (response.data.code === 200) {
      myCreations.value = response.data.data;
    } else {
      throw new Error(response.data.message || '获取创作作品失败');
    }
  } catch (error) {
    console.error('获取创作作品失败:', error);
    showToast(error.message || '加载创作作品出错');
  }
}

// 页面挂载时设置当前活跃标签
onMounted(async () => {
  activeTab.value = 'profile'
  const userId = getUserIdFromStorage();
  if (!userId) return; // 未登录则不继续
  
  try {
    const userData = await fetchUserInfo(userId)
    // 更新用户信息到响应式变量
    userInfo.value = userData
    // 同步显示数据
    username.value = userData.username
    userPoints.value = userData.user_credits || 0
    userGender.value = userData.gender || '未设置'

    await fetchReadingHistory()
    await fetchMyCreations()
  } catch (error) {
    console.error('获取用户信息失败', error)
  }
})

// 头像点击事件
const handleAvatarClick = () => {
  fileInput.value.click()
}

const uploadImage = async (file) => {
  const formData = new FormData();
  formData.append('file', file); 

  const response = await http.post('/game/upload-image/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });

  if (response.status === 201) {
    console.log('上传成功，返回的图片URL：', response.data.imageUrl);
    return response.data.imageUrl;
  } else {
    throw new Error('图片上传失败，服务器返回异常');
  }
}

// 处理用户选择图片的方法
const handleFileChange = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // 1. 校验图片格式和大小（保持不变）
  const isImage = file.type.startsWith('image/');
  const isLt5M = file.size / 1024 / 1024 < 5; // 限制5MB以内
  if (!isImage) {
    showToast('请选择图片格式文件（如jpg、png）');
    return;
  }
  if (!isLt5M) {
    showToast('图片大小不能超过5MB');
    return;
  }

  // 2. 生成预览图（可选，提升用户体验）
  const reader = new FileReader();
  reader.onload = (e) => {
    previewUrl.value = e.target.result; // 显示本地预览
  };
  reader.readAsDataURL(file);

  // 3. 上传图片并更新头像
  uploadImage(file)
    .then((imageUrl) => {
      // 上传成功后，用返回的URL更新用户信息
      return updateUserInfo(userInfo.value.id, {
        profile_picture: imageUrl // 后端要求的字段名，和swagger一致
      });
    })
    .then((userResponse) => {
      // 4. 更新本地缓存和显示
      userInfo.value.profile_picture = userResponse.data.profile_picture;
      const storedUser = JSON.parse(localStorage.getItem('userInfo') || '{}');
      storedUser.profile_picture = userResponse.data.profile_picture;
      localStorage.setItem('userInfo', JSON.stringify(storedUser));
      
      previewUrl.value = ''; // 清空预览
      showToast('头像更换成功');
    })
    .catch((err) => {
      // 捕获所有可能的错误（上传失败/更新失败）
      const errorMsg = err.response?.data?.message || err.message || '头像更新失败';
      showToast(errorMsg);
      previewUrl.value = ''; // 清空预览
    });
}


const handleUsernameChange = async () => {
  const trimmedName = newUsername.value.trim();
  if (!trimmedName) {
    showToast('用户名不能为空');
    return;
  }

  try {
    // 只传递需要修改的username字段
    const response = await updateUserInfo(
      userInfo.value.id,
      { username: trimmedName } 
    );

    // 更新本地数据
    userInfo.value.username = response.data.username;
    username.value = response.data.username;
    const storedUser = JSON.parse(localStorage.getItem('userInfo') || '{}');
    storedUser.username = response.data.username;
    localStorage.setItem('userInfo', JSON.stringify(storedUser));
    
    showToast('用户名修改成功');
    showUsernameDialog.value = false;
    newUsername.value = '';
  } catch (err) {
    showToast('用户名更新失败：' + (err.response?.data?.message || err.message));
  }
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
  router.push(`/works/${bookId}`)
}

// 处理退出登录
const handleLogout = async () => {
  try {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      // 调用后端logout接口
      await http.post('/auth/logout/', {
        refresh: refreshToken
      });
    }
    
    userStore.logout();
    
    // 跳转到登录页
    router.push('/login');
    showToast('已成功退出登录');
  } catch (error) {
    console.error('退出登录失败', error);
    // 即使接口调用失败也清除本地状态并跳转，保证前端状态一致性
    localStorage.removeItem('userInfo');
    router.push('/login');
    showToast('退出登录失败，请重试');
  }
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

.avatar-container {
  width: 100px;
  height: 100px;
  border-radius: 50%; 
  overflow: hidden;
  margin-bottom: 12px;
  border: 3px solid #f0f0f0;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover; 
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

::v-deep .van-dialog__confirm {
  color: white;
  font-size: 16px;
  width: 100%;
  background: linear-gradient(135deg, #d4a5a5 0%, #b88484 100%);
  border: none;
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