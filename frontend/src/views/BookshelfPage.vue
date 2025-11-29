<template>
  <div class="bookshelf-container">
    <!-- 顶部导航栏 -->
    <header class="header">
      <h1>{{ currentFolder ? currentFolder.name : '我的书架' }}</h1>
      <div class="header-actions">
        <button @click="showSearch = !showSearch" class="icon-btn">
          <i class="search-icon">🔍</i>
        </button>
        <button @click="openCreateFolderDialog" class="icon-btn" v-if="!currentFolder">
          <i class="add-folder-icon">📁+</i>
        </button>
        <button @click="goBack" class="icon-btn" v-if="currentFolder">
          <i class="back-icon">←</i>
        </button>
      </div>
    </header>

    <!-- 搜索框 -->
    <div class="search-container" v-if="showSearch">
      <input
        type="text"
        v-model="searchQuery"
        placeholder="搜索收藏作品..."
        class="search-input"
      >
      <button @click="searchQuery = ''" class="clear-search" v-if="searchQuery">
        ×
      </button>
    </div>

    <!-- 收藏夹列表（仅在书架根目录显示） -->
    <div class="folders-section" v-if="!currentFolder && folders.length">
      <h2 class="section-title">我的收藏夹</h2>
      <div class="folders-grid">
        <div 
          class="folder-item" 
          v-for="folder in folders" 
          :key="folder.id"
          @click="enterFolder(folder)"
          @dragover.prevent="handleDragOver"
          @drop.prevent="handleDrop(folder)"
          :class="{ 'folder-highlight': isDragging }"
        >
          <div class="folder-icon">📁</div>
          <div class="folder-name">{{ folder.name }}</div>
          <div class="folder-count">{{ getFolderBookCount(folder.id) }}本</div>
          <span 
            @click.stop="deleteFolder(folder.id)" 
            class="folder-delete-icon"
          >
            x
          </span>
        </div>
      </div>
    </div>

    <!-- 书籍列表 -->
    <div class="books-section">
      <h2 class="section-title">
        {{ currentFolder ? currentFolder.name + ' 中的书籍' : '未分类书籍' }}
        <span class="count">({{ filteredBooks.length }})</span>
      </h2>
      
      <div class="books-grid" v-if="filteredBooks.length">
        <div class="book-item" v-for="book in filteredBooks" :key="book.id"  draggable="true" @dragstart="handleDragStart(book, $event)"  @dragend="handleDragEnd">
          <div class="book-cover" :style="{ backgroundImage: `url(${book.coverUrl})` }"></div>
            <div class="book-info-grid">
              <div class="book-info">
                <div class="book-title">{{ book.title }}</div>
                <div class="book-author">{{ book.author }}</div>
              </div>
              
              <div class="btn">
                <button 
                  @click.stop="toggleFavorite(book)" 
                  class="favorite-btn"
                  :class="{ active: isBookFavorite(book.id) }"
                >
                  {{ isBookFavorite(book.id) ? '★' : '☆' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="empty-state" v-if="!filteredBooks.length">
        <p>{{ searchQuery ? '没有找到匹配的书籍' : '这里还是空的哦' }}</p>
        <p v-if="!currentFolder">添加书籍到书架吧~</p>
      </div>
    </div>

    <!-- 创建收藏夹对话框 -->
    <div class="dialog-overlay" v-if="showCreateFolderDialog">
      <div class="dialog">
        <h3>创建新收藏夹</h3>
        <input
          type="text"
          v-model="newFolderName"
          placeholder="输入收藏夹名称"
          class="folder-input"
        >
        <div class="dialog-buttons">
          <button @click="showCreateFolderDialog = false" class="cancel-btn">取消</button>
          <button 
            @click="createFolder" 
            class="confirm-btn"
            :disabled="!newFolderName.trim()"
          >
            创建
          </button>
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
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import bookCover1 from '../assets/book1.jpg';  
import bookCover2 from '../assets/book2.jpg';
import bookCover3 from '../assets/book3.jpg';
import bookCover4 from '../assets/book4.jpg';

// 路由实例
const router = useRouter();

// 状态管理
const folders = ref([
  { id: 1, name: '默认收藏夹' }
]);

const books = ref([
  { 
    id: 1, 
    title: '星辰大海', 
    author: '张三', 
    coverUrl: bookCover1,
    isFavorite: true,
    folderId: null
  },
  { 
    id: 2, 
    title: '时光旅行者', 
    author: '李四', 
    coverUrl: bookCover2,
    isFavorite: true,
    folderId: 1
  },
  { 
    id: 3, 
    title: '城市微光', 
    author: '王五', 
    coverUrl: bookCover3,
    isFavorite: false,
    folderId: null
  },
  { 
    id: 4, 
    title: '青春物语', 
    author: '赵六', 
    coverUrl: bookCover4,
    isFavorite: true,
    folderId: null
  }
]);

// 交互状态
const currentFolder = ref(null);
const showSearch = ref(false);
const searchQuery = ref('');
const showCreateFolderDialog = ref(false);
const newFolderName = ref('');
const selectedFolderId = ref('');

// 新增拖拽相关状态
const isDragging = ref(false);
const draggedBook = ref(null);


// 底部导航
const activeTab = ref('bookshelf');

// 处理底部导航切换
const handleTabChange = (name) => {
  switch(name) {
    case 'bookstore':
      router.push('/');
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

// 从本地存储加载数据
onMounted(() => {
  const savedFolders = localStorage.getItem('bookFolders');
  const savedBooks = localStorage.getItem('books');
  
  if (savedFolders) folders.value = JSON.parse(savedFolders);
  if (savedBooks) books.value = JSON.parse(savedBooks);
});

// 保存数据到本地存储
const saveData = () => {
  localStorage.setItem('bookFolders', JSON.stringify(folders.value));
  localStorage.setItem('books', JSON.stringify(books.value));
};

// 计算属性：过滤后的书籍列表
const filteredBooks = computed(() => {
  let result = [...books.value];
  
  // 根据当前目录筛选
  if (currentFolder.value) {
    result = result.filter(book => book.folderId === currentFolder.value.id);
  } else {
    // 根目录显示未分类的收藏书籍
    result = result.filter(book => book.isFavorite && book.folderId === null);
  }
  
  // 根据搜索关键词筛选
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(book => 
      book.title.toLowerCase().includes(query) || 
      book.author.toLowerCase().includes(query)
    );
  }
  
  return result;
});

// 检查书籍是否被收藏
const isBookFavorite = (bookId) => {
  const book = books.value.find(b => b.id === bookId);
  return book ? book.isFavorite : false;
};

// 获取收藏夹中的书籍数量
const getFolderBookCount = (folderId) => {
  return books.value.filter(book => book.folderId === folderId).length;
};

// 切换书籍收藏状态
const toggleFavorite = (book) => {
  book.isFavorite = !book.isFavorite;
  // 如果取消收藏，同时从收藏夹中移除
  if (!book.isFavorite) {
    book.folderId = null;
  }
  saveData();
};

// 进入收藏夹
const enterFolder = (folder) => {
  currentFolder.value = folder;
  searchQuery.value = '';
};

// 返回书架根目录
const goBack = () => {
  currentFolder.value = null;
  searchQuery.value = '';
};

// 打开创建收藏夹对话框
const openCreateFolderDialog = () => {
  showCreateFolderDialog.value = true;
}

// 创建新收藏夹
const createFolder = () => {
  if (!newFolderName.value.trim()) return;
  
  const newFolder = {
    id: Date.now(),
    name: newFolderName.value.trim()
  };
  
  folders.value.push(newFolder);
  newFolderName.value = '';
  showCreateFolderDialog.value = false;
  saveData();
};

// 删除收藏夹
const deleteFolder = (folderId) => {
  if (confirm('确定要删除这个收藏夹吗？里面的书籍会回到书架。')) {
    // 将收藏夹中的书籍移回书架
    books.value.forEach(book => {
      if (book.folderId === folderId) {
        book.folderId = null;
      }
    });
    
    // 删除收藏夹
    folders.value = folders.value.filter(folder => folder.id !== folderId);
    saveData();
  }
};

// 将书籍添加到收藏夹
const addToFolder = (bookId, folderId) => {
  const book = books.value.find(b => b.id === bookId);
  if (book) {
    book.folderId = folderId;
    saveData(); // 保存到本地存储
  }
};

// 处理拖拽开始
const handleDragStart = (book, event) => {  // 显式接收 event 参数
  // 只有已收藏的书籍才能被拖拽
  if (!book.isFavorite) return;
  
  isDragging.value = true;
  draggedBook.value = book;

  event.dataTransfer.setData('text/plain', book.id.toString());

  const dragImage = new Image();
  dragImage.src = book.coverUrl;
  event.dataTransfer.setDragImage(dragImage, 0, 0);
};

// 处理拖拽结束
const handleDragEnd = () => {
  isDragging.value = false;
  draggedBook.value = null;
};

// 处理拖拽经过
const handleDragOver = (event) => {
  event.preventDefault(); // 允许放置
};

// 处理放置
const handleDrop = (folder) => {
  if (draggedBook.value) {
    // 将书籍添加到目标收藏夹
    addToFolder(draggedBook.value.id, folder.id);
    // 显示提示信息
    alert(`已将《${draggedBook.value.title}》添加到${folder.name}`);
  }
};

// 打开阅读器
const openReader = (bookId) => {
  router.push(`/reader/${bookId}`);
};
</script>

<style scoped>
.bookshelf-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}

.header h1 {
  margin: 0;
  font-size: 24px;
  color: #333;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.icon-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.icon-btn:hover {
  background-color: #f0f0f0;
}

.search-container {
  position: relative;
  margin-bottom: 20px;
}

.search-input {
  width: 100%;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid #ddd;
  font-size: 16px;
}

.clear-search {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #999;
}

.section-title {
  font-size: 18px;
  color: #555;
  margin: 20px 0 15px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.count {
  font-size: 14px;
  color: #999;
  font-weight: normal;
}

.folders-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 15px;
  margin-bottom: 30px;
}

.folder-item {
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  position: relative;
}

.folder-item:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.folder-icon {
  font-size: 60px;
}

.folder-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.folder-count {
  font-size: 12px;
  color: #777;
}

/* 同步修改样式 */
.folder-delete-icon {
  position: absolute;
  top: 5px;
  right: 5px;
  color: #ff4d4f;
  font-size: 16px;
  cursor: pointer;
  transition: opacity 0.2s;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  text-transform: uppercase; /* 确保是小写x的统一显示 */
}

.books-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.book-item {
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  height: 150px;
}

.book-cover {
  position: relative;
  width: 100%;
  height: 100px;
  border-radius: 8px;
  background-size: contain; /* 改为contain，确保图片完整显示 */
  background-repeat: no-repeat; /* 防止图片重复平铺 */
  background-position: center; /* 图片在容器中居中 */
}

.book-info-grid{
  display: grid;
  grid-template-columns: 3fr 1fr;
}

.favorite-btn {
  border: none;
  background: none;
  width: 35px;
  height: 35px;
  border-radius: 50%;
  font-size: 22px;
  cursor: pointer;
  transition: all 0.2s;
}

.favorite-btn.active {
  color: #ffd700;
}

.book-title {
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-author {
  font-size: 14px;
  color: #777;
  margin-bottom: 8px;
}

.folder-select {
  width: 100%;
  padding: 4px;
  border-radius: 4px;
  border: 1px solid #ddd;
  font-size: 12px;
}

.empty-state {
  text-align: center;
  padding: 40px 0;
  color: #999;
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background-color: white;
  border-radius: 8px;
  padding: 20px;
  width: 90%;
  max-width: 400px;
}

.dialog h3 {
  margin-top: 0;
  color: #333;
}

.folder-input {
  width: 100%;
  padding: 10px;
  border-radius: 4px;
  border: 1px solid #ddd;
  margin-bottom: 15px;
  font-size: 16px;
}

.dialog-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.cancel-btn, .confirm-btn {
  padding: 8px 16px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
}

.cancel-btn {
  background-color: #f0f0f0;
}

.confirm-btn {
  background-color: #1890ff;
  color: white;
}

.confirm-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .books-grid {
    grid-template-columns: repeat(2,1fr);
  }
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