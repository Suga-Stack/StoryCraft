<template>
  <div class="bookshelf-container">
    <!-- 顶部导航栏 -->
    <header class="header">
      <h1>{{ currentFolder ? currentFolder.name : '我的书架' }}</h1>
      <div class="header-actions">
        <button @click="showSearch = !showSearch" class="icon-btn">
          <i class="search-icon">🔍</i>
        </button>
        <button 
          @click="() => { showCreateFolderDialog = true }" 
          class="icon-btn" 
          v-if="!currentFolder"
        >
          <i class="add-folder-icon">+</i>
        </button>
        <button @click="goBack" class="icon-btn" v-if="currentFolder">
          <i class="back-icon">←</i>
        </button>
        <!-- 批量管理按钮 -->
        <button @click="toggleBatchMode" class="icon-btn">
          <i class="batch-icon">{{ isBatchMode ? '✓' : '✎' }}</i>
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
        @input="handleSearch"
      >
      <button @click="searchQuery = ''" class="clear-search" v-if="searchQuery">
        ×
      </button>
    </div>

    <!-- 批量操作栏 -->
    <div class="batch-actions" v-if="isBatchMode && selectedBooks.length">
      <button @click="showAddToFolderDialog = true" class="batch-btn">
        加入收藏夹
      </button>
      <button @click="removeSelectedFromFolder" class="batch-btn remove-btn">
        从收藏夹移除
      </button>
      <button @click="cancelBatchMode" class="batch-btn cancel-btn">
        取消
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
        >
          <div class="folder-icon">📁</div>
          <div class="folder-name">{{ folder.name }}</div>
          <div class="folder-count">{{ getFolderBookCount(folder.id) }}本</div>
          <span 
            @click.stop="openDeleteFolderDialog(folder.id)" 
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
        <div 
          class="book-item" 
          v-for="book in filteredBooks" 
          :key="book.id"
          @click="isBatchMode ? toggleSelectBook(book) : openReader(book.id)"
        >
          <!-- 批量选择框 -->
          <div class="batch-select" v-if="isBatchMode">
            <input 
              type="checkbox" 
              v-model="selectedBooks" 
              :value="book"
              @click.stop
            >
          </div>
          
          <div class="book-cover" :style="{ backgroundImage: `url(${book.cover})` }"></div>
            <div class="book-info-grid">
              <div class="book-info">
                <div class="book-title">{{ book.title }}</div>
              </div>
              
              <div class="btn-group">
                <!-- 收藏状态按钮 -->
                <van-icon 
                  :name="book.isFavorite ? 'star' : 'star-o'" 
                  class="favorite-icon"
                  :class="{ active: book.isFavorite }"
                  @click.stop="handleFavorite(book)"
                />
                
                <!-- 收藏夹操作按钮 -->
                <van-icon 
                  :name="book.folderId ? 'clear' : 'plus'" 
                  class="folder-action-icon"
                  :class="{ 'in-folder': book.folderId }"
                  @click.stop="handleFolderAction(book)"
                />
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

    <!-- 移除确认对话框 -->
    <div class="dialog-overlay" v-if="showRemoveFromFolderDialog">
      <div class="dialog">
        <h3>从收藏夹移除</h3>
        <p>确定要将《{{ currentBook?.title }}》从收藏夹中移除吗？</p>
        <div class="dialog-actions">
          <button @click="showRemoveFromFolderDialog = false" class="cancel-btn">取消</button>
          <button 
            @click="confirmRemoveFromFolder(); showRemoveFromFolderDialog = false" 
            class="confirm-btn"
          >
            确认移除
          </button>
        </div>
      </div>
    </div>

    <!-- 创建收藏夹弹窗 -->
    <div class="dialog-overlay" v-if="showCreateFolderDialog">
      <div class="dialog">
        <h3>创建新收藏夹</h3>
        <van-field
          v-model="folderName"
          placeholder="请输入收藏夹名称"
          clearable
          class="folder-input"
        />
        <div class="dialog-actions">
          <button @click="showCreateFolderDialog = false" class="cancel-btn">取消</button>
          <button 
            @click="handleCreateFolder"
            class="confirm-btn"
            :style="{ 
              background: 'linear-gradient(135deg, #d4a5a5 0%, #b88484 100%)',
              border: 'none'
            }"
          >
            创建
          </button>
        </div>
      </div>
    </div>

    <!-- 添加到收藏夹对话框 -->
    <div class="dialog-overlay" v-if="showAddToFolderDialog">
      <div class="dialog">
        <h3>{{ currentBook ? '添加到收藏夹' : '批量添加到收藏夹' }}</h3>
        <select 
          v-model="selectedFolderId" 
          class="folder-select"
          @change.stop
        >
          <option value="">-- 选择收藏夹 --</option>
          <option 
            v-for="folder in folders" 
            :key="folder.id" 
            :value="folder.id"
          >
            {{ folder.name }}
          </option>
        </select>
        <div class="dialog-actions">
          <button @click="showAddToFolderDialog = false; resetFolderDialog()" class="cancel-btn">取消</button>
          <button 
            @click="confirmAddToFolder(); resetFolderDialog()" 
            class="confirm-btn"
            :disabled="!selectedFolderId"
          >
            确认添加
          </button>
        </div>
      </div>
    </div>

    <!-- 删除收藏夹对话框 -->
    <div class="dialog-overlay" v-if="showDeleteFolderDialog">
      <div class="dialog">
        <h3>删除收藏夹</h3>
        <p>确定要删除这个收藏夹吗？里面的书籍会回到书架。</p>
        <div class="dialog-actions">
          <button @click="showDeleteFolderDialog = false" class="cancel-btn">取消</button>
          <button 
            @click="confirmDeleteFolder(); showDeleteFolderDialog = false" 
            class="confirm-btn"
          >
            确认删除
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
import { getFolders, createFolders, deleteFolders, searchFavorites, addFavorite, moveFavorite, deleteFavorite } from '../api/user';
import { showToast } from 'vant';

// 路由实例
const router = useRouter();

// 数据存储
const folders = ref([]);
const books = ref([]);
const folderToDelete = ref(null);

// 交互状态
const currentFolder = ref(null);
const showSearch = ref(false);
const searchQuery = ref('');
const selectedFolderId = ref('');
const showAddToFolderDialog = ref(false);
const currentBook = ref(null);
const isBatchMode = ref(false);
const selectedBooks = ref([]);
const showRemoveFromFolderDialog = ref(false);
const showDeleteFolderDialog = ref(false);

// 收藏夹相关状态
const folderName = ref('');
const showCreateFolderDialog = ref(false);

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

// 加载收藏作品
const loadFavoriteBooks = async () => {
  try {
    const response = await searchFavorites('', 1);
    // 1. 提取后端返回的书籍数组（response.data.results.data）
    const rawBooks = response.data.results.data || [];
    
    // 2. 映射为前端需要的结构
    books.value = rawBooks.map(book => ({
      id: book.id,
      gameworkId: book.gamework_detail.id,  // 书籍ID
      title: book.gamework_detail.title,  // 标题
      author: book.gamework_detail.author,  // 作者
      cover: book.gamework_detail.cover || '默认封面图地址',  // 封面（处理null情况）
      folderId: book.folder ? book.folder.id : null,  // 收藏夹ID（后端folder对应前端folderId）
      isFavorite: true  // 收藏状态（默认true，因为是从收藏列表获取的）
    }));
    
    saveData();
  } catch (error) {
    console.error('加载收藏作品失败', error);
    const savedBooks = localStorage.getItem('favoriteBooks');
    try {
      // 解析本地存储时也可能出错，需要捕获
      books.value = savedBooks ? JSON.parse(savedBooks) : [];
    } catch (e) {
      console.error('解析本地书籍数据失败', e);
      books.value = []; // 确保是数组
    }
  }
};

// 加载收藏夹数据
const loadFolders = async () => {
  try {
    const response = await getFolders();
    folders.value = response.data.results;
    saveData();
  } catch (error) {
    console.error('加载收藏夹失败', error);
    const savedFoldersData = localStorage.getItem('bookFolders'); 
    if (savedFoldersData) {
      folders.value = JSON.parse(savedFoldersData); 
    }
  }
};

// 初始化加载数据
onMounted(() => {
  loadFolders();
  loadFavoriteBooks();
});

// 筛选书籍
const filteredBooks = computed(() => {
  const bookList = Array.isArray(books.value) ? books.value : [];
  let result = [...bookList];

  // 根据当前文件夹筛选
  if (currentFolder.value) {
    result = result.filter(book => book.folderId === currentFolder.value.id);
  } else {
    // 根目录下显示未分类的书籍（folderId为null或空）
    result = result.filter(book => !book.folderId);
  }
  
  // 搜索筛选
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(book => 
      book.title.toLowerCase().includes(query) || 
      (book.author && book.author.toLowerCase().includes(query))
    );
  }
  
  return result;
});

// 搜索防抖处理
const handleSearch = debounce(() => {
  // 防抖处理，避免频繁触发筛选
}, 300);

// 防抖函数实现
function debounce(func, delay = 300) {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

// 创建收藏夹
const handleCreateFolder = async () => {
  if (!folderName.value.trim()) {
    showToast({ message: '请输入收藏夹名称', type: 'fail' });
    return;
  }
  
  try {
    // 获取接口返回的新收藏夹完整数据（包含name）
    const response = await createFolders(folderName.value);
    const newFolder = response.data; // 接口返回的{id, name, ...}对象
    
    // 直接添加到本地列表，实时显示名称
    folders.value.push(newFolder);
    
    // 成功提示
    showToast({ message: '收藏夹创建成功', type: 'success' });
    
    folderName.value = '';
    showCreateFolderDialog.value = false;
    saveData(); // 立即保存到本地存储
    loadFolders();
  } catch (error) {
    console.error('创建收藏夹失败', error);
    // 错误提示
    showToast({ 
      message: error.response?.data?.message || '创建收藏夹失败', 
      type: 'fail' 
    });
  }
};


// 删除收藏夹
const confirmDeleteFolder = async () => {
  if (folderToDelete.value) {
    try {
      await deleteFolders(folderToDelete.value);
      
      // 将收藏夹中的书籍移回书架
      books.value.forEach(book => {
        if (book.folderId === folderToDelete.value) {
          book.folderId = null;
        }
      });
      
      // 如果删除当前打开的文件夹，自动返回根目录
      if (currentFolder.value && currentFolder.value.id === folderToDelete.value) {
        currentFolder.value = null;
      }
      
      loadFolders();
      saveData();
      folderToDelete.value = null;
      showToast('收藏夹已删除');
    } catch (error) {
      console.error('删除收藏夹失败', error);
      showToast(error.response?.data?.message || '删除收藏夹失败');
    }
  }
};

// 打开删除收藏夹对话框
const openDeleteFolderDialog = (folderId) => {
  folderToDelete.value = folderId;
  showDeleteFolderDialog.value = true;
};

// 处理书籍的收藏夹操作（加入或移出）
const handleFolderAction = (book) => {
  if (book.folderId) {
    // 如果已在收藏夹中，显示移除确认对话框
    currentBook.value = book;
    showRemoveFromFolderDialog.value = true;
  } else {
    // 如果不在收藏夹中，显示添加到收藏夹对话框
    currentBook.value = book;
    showAddToFolderDialog.value = true;
  }
};


// 批量加入收藏夹
const confirmAddToFolder = async () => {
  if (!selectedFolderId.value) return;
  
  try {
    if (currentBook.value) {
      // 单个移动：使用moveFavorite替代addFavorite
      await moveFavorite(currentBook.value.id, selectedFolderId.value);
      currentBook.value.folderId = selectedFolderId.value;
    } else if (selectedBooks.value.length) {
      // 批量移动
      const batchSize = 5;
      const batches = [];
      for (let i = 0; i < selectedBooks.value.length; i += batchSize) {
        batches.push(selectedBooks.value.slice(i, i + batchSize));
      }
      
      for (const batch of batches) {
        await Promise.all(
          // 批量调用moveFavorite接口
          batch.map(book => moveFavorite(book.id, selectedFolderId.value))
        );
        batch.forEach(book => {
          book.folderId = selectedFolderId.value;
        });
      }
      
      selectedBooks.value = [];
      isBatchMode.value = false;
    }
    
    saveData();
    showAddToFolderDialog.value = false;
    selectedFolderId.value = '';
    showToast('添加成功');
  } catch (error) {
    console.error('添加到收藏夹失败', error);
    showToast('添加失败: ' + (error.response?.data?.message || '未知错误'));
  }
};

// 单个作品移出收藏夹
const confirmRemoveFromFolder = async () => {
  if (currentBook.value) {
    try {
      // 移出到根目录本质是移动到"无收藏夹"状态，folderId传空或null
      await moveFavorite(currentBook.value.id, null);
      currentBook.value.folderId = null; // 清空所属收藏夹标识
      saveData();
      showRemoveFromFolderDialog.value = false;
      showToast('已移出收藏夹');
    } catch (error) {
      console.error('从收藏夹移除失败', error);
      showToast('移除失败: ' + (error.response?.data?.message || '未知错误'));
    }
  }
};

// 批量移出收藏夹
const removeSelectedFromFolder = async () => {
  if (selectedBooks.value.length === 0) return;
  
  try {
    // 批量调用moveFavorite，目标folderId为null（根目录）
    await Promise.all(
      selectedBooks.value.map(book => moveFavorite(book.id, null))
    );
    
    // 更新本地数据，清空folderId
    selectedBooks.value.forEach(book => {
      book.folderId = null;
    });
    
    saveData();
    selectedBooks.value = [];
    isBatchMode.value = false;
    showToast('已批量移出');
  } catch (error) {
    console.error('批量移出失败', error);
    showToast('批量移出失败: ' + (error.response?.data?.message || '未知错误'));
  }
};

// 获取收藏夹书籍数量
const getFolderBookCount = (folderId) => {
  if (!Array.isArray(books.value)) {
    return 0;
  }
  return books.value.filter(book => book.folderId === folderId).length;
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


// 批量管理相关函数
const toggleBatchMode = () => {
  isBatchMode.value = !isBatchMode.value;
  if (!isBatchMode.value) {
    selectedBooks.value = [];
  }
};

const toggleSelectBook = (book) => {
  const index = selectedBooks.value.findIndex(b => b.id === book.id);
  if (index > -1) {
    selectedBooks.value.splice(index, 1);
  } else {
    selectedBooks.value.push(book);
  }
};

const cancelBatchMode = () => {
  isBatchMode.value = false;
  selectedBooks.value = [];
};

// 打开阅读器
const openReader = (bookId) => {
  router.push(`/reader/${bookId}`);
};

// 重置收藏夹对话框状态
const resetFolderDialog = () => {
  currentBook.value = null;
  selectedFolderId.value = '';
  showRemoveFromFolderDialog.value = false;
};

// 保存数据到本地存储
const saveData = () => {
  localStorage.setItem('favoriteBooks', JSON.stringify(books.value));
  localStorage.setItem('bookFolders', JSON.stringify(folders.value));
};

// 在取消收藏时从列表中移除书籍
const handleFavorite = async (book) => {
  try {
    if (book.isFavorite) {
      // 取消收藏：调用删除接口并从列表中移除
      await deleteFavorite(book.id);
      
      // 从books数组中移除该书籍
      const index = books.value.findIndex(b => b.id === book.id);
      if (index !== -1) {
        books.value.splice(index, 1);
      }
      
      showToast('已取消收藏');
    } else {
      // 添加收藏逻辑保持不变
      await addFavorite(book.gameworkId);
      book.isFavorite = true;
      showToast('收藏成功');
    }
    saveData(); // 保存最新状态到本地存储
  } catch (error) {
    console.error('处理收藏失败', error);
    showToast(error.response?.data?.message || '操作失败');
  }
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
  text-transform: uppercase;
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
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

.book-info-grid{
  display: grid;
  grid-template-columns: 3fr 1fr;
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


.book-title {
  font-size: 14px;
  width: 100px;
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

.folder-select{
  padding: 10px 0;
}
.folder-input {
  width: 100%;
  padding: 10px;
  border-radius: 4px;
  border: 1px solid #ddd;
  margin-bottom: 15px;
  font-size: 16px;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  margin-top: 5px;
}

.cancel-btn, .confirm-btn {
  font-size: 16px;
  padding: 8px 16px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  flex: 1;
}

.cancel-btn {
  background-color: #f0f0f0;
}

.confirm-btn {
  color: white;
  background: linear-gradient(135deg, #d4a5a5 0%, #b88484 100%);
}

.btn-group {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
}

.folder-action-icon {
  font-size: 18px;
  cursor: pointer;
}

.folder-action-icon.in-folder {
  color: #ff4d4f;
}

.batch-actions {
  display: flex;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
  margin-bottom: 15px;
}

.batch-btn {
  padding: 6px 12px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  background: #d4a5a5;
  color: white;
}

.batch-btn.remove-btn {
  background: #d17d7d;
}

.batch-btn.cancel-btn {
  background: #978787;
}

.batch-select {
  position: absolute;
  top: 5px;
  left: 5px;
  z-index: 10;
}

.book-item {
  position: relative;
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  height: 150px;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #eee;
}

.folder-input {
  padding: 0 16px;
  margin-top: 16px;
}

.popup-footer {
  padding: 16px;
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: #fff;
  box-sizing: border-box;
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