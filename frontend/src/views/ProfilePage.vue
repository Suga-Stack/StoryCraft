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
import { updateUserInfo } from '../api/user';
import { getUserInfo } from '../api/user';
import { get } from 'vant/lib/utils';

// 路由实例
const router = useRouter()

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

// 添加用户信息获取接口
const fetchUserInfo = async (userId) => {
  try {
    const response = await getUserInfo(userId)

    if (!response.ok) {
      throw new Error(`获取用户信息失败: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    showToast(`接口请求失败: ${error.message}`)
    throw error
  }
}

const getUserIdFromStorage = () => {
  // 从 localStorage 读取用户信息
  const storedUser = localStorage.getItem('userInfo');
  if (storedUser) {
    const user = JSON.parse(storedUser);
    return user.id; // 返回 userId
  }
  // 未找到用户信息（未登录），跳转到登录页
//  router.push('/login');
  return null;
};

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
  } catch (error) {
    console.error('获取用户信息失败', error)
  }
})

// 头像点击事件
const handleAvatarClick = () => {
  fileInput.value.click()
}

const handleFileChange = (e) => {
  const file = e.target.files[0]; // 获取选中的图片文件
  if (!file) return;

  // 校验图片格式和大小（可选，提升体验）
  const isImage = file.type.startsWith('image/');
  const isLt5M = file.size / 1024 / 1024 < 5; // 限制 5MB 内
  if (!isImage) {
    showToast('请选择图片格式文件（JPG/PNG等）');
    return;
  }
  if (!isLt5M) {
    showToast('图片大小不能超过 5MB');
    return;
  }

  // 生成预览图（File -> Base64）
  const reader = new FileReader();
  reader.onload = (e) => {
    previewUrl.value = e.target.result; // 显示预览
  };
  reader.readAsDataURL(file);

  getLocalImageUrl(file)
    .then((localImageUrl) => {
      previewUrl.value = localImageUrl; // 显示本地预览
      // 直接调用更新接口，传入本地 URL
      updateAvatar(localImageUrl);
    })
    .catch((err) => {
      showToast(err.message);
      previewUrl.value = '';
    });

  /*
  // 3. 上传图片到后端/云存储，获取 URI
  uploadImageToServer(file).then((imageUri) => {
    // 4. 调用用户信息更新接口，提交头像 URI
    updateAvatar(imageUri);
  }).catch((err) => {
    showToast('图片上传失败：' + err.message);
    previewUrl.value = ''; // 清空预览
  });
  */
};

/*
// 上传图片到服务器（获取图片 URI）
const uploadImageToServer = async (file) => {
  // 构造 FormData（图片上传常用格式）
  const formData = new FormData();
  formData.append('image', file); // 后端接收图片的字段名（需与后端协商，如 image）

  // 调用图片上传接口（假设后端有专门的图片上传接口）
  // 如果后端要求直接在 updateUser 接口中传文件，可跳过此步，直接在 updateAvatar 中传 FormData
  const response = await fetch('/api/upload/image', {
    method: 'POST',
    body: formData,
    // 注意：上传文件时不要设置 Content-Type: application/json，浏览器会自动处理
  });

  if (!response.ok) throw new Error('上传失败');
  const data = await response.json();
  return data.imageUri; // 假设后端返回 { imageUri: "https://xxx.com/new-avatar.png" }
};
*/

const getLocalImageUrl = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    // 读取文件为 Base64 格式（可直接作为 img 标签的 src）
    reader.readAsDataURL(file);
    // 读取成功：返回 Base64 字符串
    reader.onload = (e) => {
      resolve(e.target.result); // 结果格式：data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...
    };
    // 读取失败：抛出错误
    reader.onerror = (err) => {
      reject(new Error('图片读取失败：' + err.message));
    };
  });
};


// 调用用户信息更新接口（提交头像 URI）
// 修改updateAvatar函数的接口调用部分
const updateAvatar = async (imageUri) => {
  try {
    const response = await updateUserInfo(
      userInfo.value.id,
      userInfo.value.username,
      imageUri,
    ) 

    if (!response.ok) {
      throw new Error('更新头像失败')
    }

    const updatedData = await response.json()
    userInfo.value.profile_picture = updatedData.profile_picture
    previewUrl.value = '' // 清空预览，使用更新后的值
    showToast('头像更换成功')
  } catch (err) {
    showToast('头像更新失败：' + err.message)
    previewUrl.value = ''
  }
}

// 处理用户名修改
const handleUsernameChange = async () => {
  if (!newUsername.value.trim()) {
    showToast('用户名不能为空')
    return
  }

  try {
    // 调用用户信息更新接口
    const response = await updateUserInfo(
      userInfo.value.id,
      newUsername.value, // 新用户名
      userInfo.value.profile_picture // 保持原有头像不变
    )

    if (!response.ok) {
      throw new Error('更新用户名失败')
    }

    const updatedData = await response.json()
    // 更新本地缓存的用户信息
    userInfo.value.username = updatedData.username
    username.value = updatedData.username
    // 更新localStorage中的用户信息
    const storedUser = JSON.parse(localStorage.getItem('userInfo') || '{}')
    storedUser.username = updatedData.username
    localStorage.setItem('userInfo', JSON.stringify(storedUser))
    
    showToast('用户名修改成功')
    showUsernameDialog.value = false // 关闭弹窗
    newUsername.value = '' // 清空输入框
  } catch (err) {
    showToast('用户名更新失败：' + err.message)
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
  router.push(`/book-detail/${bookId}`)
}

// 处理退出登录
const handleLogout = () => {
  // 清除登录状态（实际项目中需清除token等）
  router.push('/login')
  showToast('已退出登录')
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