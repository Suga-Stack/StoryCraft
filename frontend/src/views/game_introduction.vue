<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const goBack = () => {
  router.push('/')
}

// 单个作品数据（从后端获取）
const work = ref({
  id: 1,
  title: '锦瑟深宫', // 后端提供：AI生成的作品名
  coverUrl: 'https://images.unsplash.com/photo-1587614387466-0a72ca909e16?w=800&h=500&fit=crop', // 后端提供：AI生成的封面URL
  authorId: 'user_12345', // 作者ID
  tags: ['宫斗', '冒险', '太空', '未来'], // 后端提供：作品标签
  description: `柳晚晚穿越成后宫小透明，她把宫斗当成终身职业来经营。
不争宠不夺权，只求平安活到退休。

别人算计位份，她研究菜谱
别人争抢赏赐，她核算份例
在步步惊心的深宫里，她用一口小锅涮出温暖天地。

皇帝觉得她省心，妃嫔当她没威胁。直到风波来临，众人才发现——这个整天算账吃饭的鹌鹑，早把生存智慧练到满级。

当六宫争得头破血流时，
她正捧着账本慢悠悠打算盘："这个月份例还能省出两顿火锅，
至于恩宠？那是什么，能吃吗？"

在这吃人的后宫，不想争宠的干饭人，
正在悄悄苟成最后赢家。`, // 后端提供：AI生成的作品简介
  isFavorite: false
})

// 切换收藏状态
const toggleFavorite = () => {
  work.value.isFavorite = !work.value.isFavorite
}
// 标签颜色配置（低饱和度浅色）
const tagColors = [
  { bg: '#e9e5f5', text: '#5d4d7a' },   // 浅紫色
  { bg: '#dff5eb', text: '#3d7a5e' },   // 浅绿色
  { bg: '#ffe9d9', text: '#946640' },   // 浅橙色
  { bg: '#ffe5e8', text: '#945560' },   // 浅红色
  { bg: '#e3eeff', text: '#4a6b94' },   // 浅蓝色
  { bg: '#f0e7f7', text: '#6e4d87' },   // 浅紫罗兰
  { bg: '#ffeaf2', text: '#94556e' },   // 浅粉色
  { bg: '#e0f5f3', text: '#3d7a73' }    // 浅青色
]

// 根据索引获取标签颜色
const getTagColor = (index) => {
  return tagColors[index % tagColors.length]
}

// 简介展开状态
const isDescriptionExpanded = ref(false)
const newComment = ref('')
const replyingTo = ref(null) // 正在回复的评论ID
const sortBy = ref('latest') // 排序方式: 'latest' 或 'likes'

const comments = ref([
  {
    id: 1,
    author: 'user_001',
    text: '这个作品太棒了！期待后续更新！',
    time: '2小时前',
    timestamp: Date.now() - 2 * 60 * 60 * 1000,
    likes: 15,
    isLiked: false,
    replies: [
      {
        id: 101,
        author: 'user_004',
        text: '同感！已经追更好几天了',
        time: '1小时前',
        timestamp: Date.now() - 1 * 60 * 60 * 1000,
        likes: 3,
        isLiked: false
      }
    ]
  },
  {
    id: 2,
    author: 'user_002',
    text: '故事情节很吸引人，写得很不错。',
    time: '5小时前',
    timestamp: Date.now() - 5 * 60 * 60 * 1000,
    likes: 8,
    isLiked: false,
    replies: []
  },
  {
    id: 3,
    author: 'user_003',
    text: '设定很有创意，支持作者！',
    time: '1天前',
    timestamp: Date.now() - 24 * 60 * 60 * 1000,
    likes: 23,
    isLiked: false,
    replies: []
  }
])

// 切换简介展开状态
const toggleDescription = () => {
  isDescriptionExpanded.value = !isDescriptionExpanded.value
}

// 计算属性：排序后的评论
const sortedComments = computed(() => {
  const commentsCopy = [...comments.value]
  if (sortBy.value === 'likes') {
    return commentsCopy.sort((a, b) => b.likes - a.likes)
  }
  return commentsCopy.sort((a, b) => b.timestamp - a.timestamp)
})

// 提交评论
const submitComment = () => {
  if (newComment.value.trim()) {
    if (replyingTo.value) {
      // 回复评论
      const parentComment = comments.value.find(c => c.id === replyingTo.value)
      if (parentComment) {
        parentComment.replies.push({
          id: Date.now(),
          author: 'current_user',
          text: newComment.value,
          time: '刚刚',
          timestamp: Date.now(),
          likes: 0,
          isLiked: false
        })
      }
      replyingTo.value = null
    } else {
      // 发表新评论
      comments.value.unshift({
        id: Date.now(),
        author: 'current_user',
        text: newComment.value,
        time: '刚刚',
        timestamp: Date.now(),
        likes: 0,
        isLiked: false,
        replies: []
      })
    }
    newComment.value = ''
  }
}

// 点赞评论
const toggleLike = (comment) => {
  comment.isLiked = !comment.isLiked
  comment.likes += comment.isLiked ? 1 : -1
}

// 开始回复
const startReply = (commentId, author) => {
  replyingTo.value = commentId
  newComment.value = `@${author} `
}

// 取消回复
const cancelReply = () => {
  replyingTo.value = null
  newComment.value = ''
}

// 关闭弹窗
const closeModal = () => {
  isDescriptionExpanded.value = false
}

// 开始阅读
const startReading = () => {
  // 跳转到阅读页面，通过路由 state 传递作品信息
  try {
    // 同步缓存，确保 GamePage 与加载页统一使用本次选择的封面/标题
    sessionStorage.setItem('lastWorkMeta', JSON.stringify({
      title: work.value.title,
      coverUrl: work.value.coverUrl
    }))
  } catch {}
  router.push({
    path: `/game/${work.value.id}`,
    state: {
      title: work.value.title,
      coverUrl: work.value.coverUrl
    }
  })
}
</script>

<template>
  <div class="works-page">
    <!-- AI生成的封面（顶部全宽） -->
    <div class="cover-container">
      <img :src="work.coverUrl" :alt="work.title" class="cover-image" />
    </div>
    
    <!-- 作品信息 -->
    <div class="content">
      <!-- 作品名和收藏按钮 -->
      <div class="title-row">
        <h1 class="work-title">{{ work.title }}</h1>
        <button 
          class="favorite-btn" 
          :class="{ active: work.isFavorite }"
          @click="toggleFavorite"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </button>
      </div>
      
      <!-- 作者ID -->
      <div class="author-info">
        <span class="author-label">作者：</span>
        <span class="author-id">{{ work.authorId }}</span>
      </div>
      
      <!-- 标签 -->
      <div class="tags-container">
        <span 
          v-for="(tag, index) in work.tags" 
          :key="index" 
          class="tag"
          :style="{
            backgroundColor: getTagColor(index).bg,
            color: getTagColor(index).text
          }"
        >
          {{ tag }}
        </span>
      </div>
      
      <!-- 作品简介（限高35%） -->
      <div class="description-container">
        <h2 class="description-title">作品简介</h2>
        <div class="description">
          <p v-for="(paragraph, index) in work.description.split('\n')" :key="index">
            {{ paragraph }}
          </p>
        </div>
        
        <!-- 展开按钮 -->
        <button class="expand-btn" @click="toggleDescription">
          <span>展开</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M19 9l-7 7-7-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      
      <!-- 评论区域 -->
      <div class="comments-section">
        <div class="comments-header">
          <h2 class="comments-title">评论 ({{ comments.length }})</h2>
          
          <!-- 排序选择器 -->
          <div class="sort-selector">
            <button 
              class="sort-btn" 
              :class="{ active: sortBy === 'latest' }"
              @click="sortBy = 'latest'"
            >
              最新
            </button>
            <button 
              class="sort-btn" 
              :class="{ active: sortBy === 'likes' }"
              @click="sortBy = 'likes'"
            >
              最热
            </button>
          </div>
        </div>
        
        <!-- 发表评论输入框 -->
        <div class="comment-input-container">
          <div v-if="replyingTo" class="replying-to">
            <span>回复评论中...</span>
            <button class="cancel-reply-btn" @click="cancelReply">取消</button>
          </div>
          <textarea 
            v-model="newComment" 
            class="comment-input" 
            :placeholder="replyingTo ? '写下你的回复...' : '说说你的看法...'"
            rows="3"
          ></textarea>
          <button class="submit-comment-btn" @click="submitComment">
            {{ replyingTo ? '发表回复' : '发表评论' }}
          </button>
        </div>
        
        <!-- 评论列表 -->
        <div class="comments-list">
          <div 
            v-for="comment in sortedComments" 
            :key="comment.id" 
            class="comment-item"
          >
            <div class="comment-avatar">
              {{ comment.author.charAt(0) }}
            </div>
            <div class="comment-content">
              <div class="comment-header">
                <span class="comment-author">{{ comment.author }}</span>
                <span class="comment-time">{{ comment.time }}</span>
              </div>
              <p class="comment-text">{{ comment.text }}</p>
              
              <!-- 评论操作按钮 -->
              <div class="comment-actions">
                <button 
                  class="action-btn like-btn" 
                  :class="{ active: comment.isLiked }"
                  @click="toggleLike(comment)"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span>{{ comment.likes }}</span>
                </button>
                <button class="action-btn reply-btn" @click="startReply(comment.id, comment.author)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span>回复</span>
                </button>
              </div>
              
              <!-- 回复列表 -->
              <div v-if="comment.replies.length > 0" class="replies-list">
                <div 
                  v-for="reply in comment.replies" 
                  :key="reply.id" 
                  class="reply-item"
                >
                  <div class="comment-avatar reply-avatar">
                    {{ reply.author.charAt(0) }}
                  </div>
                  <div class="comment-content">
                    <div class="comment-header">
                      <span class="comment-author">{{ reply.author }}</span>
                      <span class="comment-time">{{ reply.time }}</span>
                    </div>
                    <p class="comment-text">{{ reply.text }}</p>
                    
                    <!-- 回复操作按钮 -->
                    <div class="comment-actions">
                      <button 
                        class="action-btn like-btn" 
                        :class="{ active: reply.isLiked }"
                        @click="toggleLike(reply)"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span>{{ reply.likes }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 空状态 -->
          <div v-if="comments.length === 0" class="empty-comments">
            <span class="empty-icon">💬</span>
            <p>还没有评论，快来抢沙发吧！</p>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 完整简介弹窗 -->
    <div v-if="isDescriptionExpanded" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <button class="close-btn" @click="closeModal">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M18 6L6 18M6 6l12 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        
        <h2 class="modal-title">作品简介</h2>
        
        <div class="modal-description">
          <p v-for="(paragraph, index) in work.description.split('\n')" :key="index">
            {{ paragraph }}
          </p>
        </div>
      </div>
    </div>
    
    <!-- 固定在底部的按钮栏 -->
    <div class="bottom-bar">
      <button class="back-button" @click="goBack">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M19 12H5M12 19l-7-7 7-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      
      <button class="read-button" @click="startReading">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="read-text">开始阅读</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.works-page {
  min-height: 100vh;
  background-color: #faf8f3; /* 米白色背景 */
  position: relative;
  padding-bottom: 100px; /* 给固定按钮留空间 */
}

/* 封面容器（顶部全宽） */
.cover-container {
  width: 100%;
  height: 30vh; /* 屏幕高度的30% */
  min-height: 200px;
  max-height: 350px;
  overflow: hidden;
  background-color: #f0f0f0;
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 内容区域 */
.content {
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

/* 标题行 */
.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  gap: 1rem;
}

.work-title {
  font-size: 2rem;
  font-weight: 700;
  color: #2c3e50;
  margin: 0;
  flex: 1;
  line-height: 1.3;
}

/* 作者信息 */
.author-info {
  font-size: 0.9rem;
  color: #999;
  margin-bottom: 1.5rem;
}

.author-label {
  color: #999;
}

.author-id {
  color: #999;
  font-weight: 500;
}

/* 收藏按钮 */
.favorite-btn {
  width: 48px;
  height: 48px;
  border: none;
  background-color: rgba(128, 128, 128, 0.15);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.favorite-btn svg {
  width: 24px;
  height: 24px;
  color: rgba(128, 128, 128, 0.5);
  transition: color 0.3s ease;
}

.favorite-btn:hover {
  background-color: rgba(102, 126, 234, 0.15);
  transform: scale(1.1);
}

.favorite-btn:hover svg {
  color: #667eea;
}

.favorite-btn.active {
  background-color: rgba(255, 215, 0, 0.2);
}

.favorite-btn.active svg {
  color: #ffd700;
}

/* 标签容器 */
.tags-container {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.tag {
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 1.05rem;
  font-weight: 500;
  white-space: nowrap;
  transition: all 0.3s ease;
}

.tag:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 作品描述容器 */
.description-container {
  margin-top: 2rem;
  position: relative;
}

/* 作品简介标题 */
.description-title {
  font-size: 1.5rem;
  font-weight: 900;
  color: #000;
  margin: 0 0 1rem 0;
}

/* 作品描述（限高35vh） */
.description {
  padding: 2rem;
  background-color: white;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  max-height: 35vh;
  overflow: hidden;
  position: relative;
}

.description::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 80px;
  background: linear-gradient(to bottom, transparent, white);
  pointer-events: none;
}

.description p {
  color: #2c3e50;
  line-height: 2;
  margin: 0.25rem 0;
  font-size: 1rem;
}

.description br {
  display: block;
  content: "";
  margin: 0.5rem 0;
}

/* 展开按钮 */
.expand-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  margin-top: 1rem;
  padding: 0.875rem 1.5rem;
  background-color: white;
  border: 2px solid #d4a5a5;
  border-radius: 12px;
  color: #d4a5a5;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.expand-btn:hover {
  background-color: #d4a5a5;
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(212, 165, 165, 0.3);
}

.expand-btn svg {
  width: 20px;
  height: 20px;
  transition: transform 0.3s ease;
}

.expand-btn:hover svg {
  transform: translateY(2px);
}

/* 弹窗遮罩 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* 弹窗内容 */
.modal-content {
  background-color: white;
  border-radius: 20px;
  padding: 2.5rem;
  max-width: 1000px;
  width: 95%;
  max-height: 55vh;
  overflow-y: auto;
  position: relative;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(50px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* 关闭按钮 */
.close-btn {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  width: 36px;
  height: 36px;
  border: none;
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.close-btn:hover {
  background-color: rgba(0, 0, 0, 0.1);
  transform: rotate(90deg);
}

.close-btn svg {
  width: 20px;
  height: 20px;
  color: #666;
}

/* 弹窗标题 */
.modal-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #2c3e50;
  margin: 0 0 1.5rem 0;
  padding-right: 2rem;
}

/* 弹窗简介内容 */
.modal-description {
  color: #2c3e50;
}

.modal-description p {
  line-height: 2;
  margin: 0.25rem 0;
  font-size: 1rem;
}

.modal-description br {
  display: block;
  content: "";
  margin: 0.5rem 0;
}

/* 固定底部按钮栏 */
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 80px;
  background: white;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0 1.5rem;
  z-index: 100;
}

/* 返回按钮 */
.back-button {
  width: 56px;
  height: 56px;
  border: 2px solid #d4a5a5;
  background: #faf8f3;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(212, 165, 165, 0.2);
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.back-button svg {
  width: 24px;
  height: 24px;
  color: #d4a5a5;
  stroke-width: 2.5;
}

.back-button:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(212, 165, 165, 0.4);
  border-color: #c89090;
}

.back-button:hover svg {
  color: #c89090;
}

.back-button:active {
  transform: scale(0.98);
}

/* 开始阅读按钮 */
.read-button {
  flex: 1;
  height: 56px;
  border: none;
  background: linear-gradient(135deg, #d4a5a5 0%, #c89090 100%);
  border-radius: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(212, 165, 165, 0.3);
  transition: all 0.3s ease;
}

.read-button svg {
  width: 24px;
  height: 24px;
  color: white;
  stroke-width: 2.5;
}

.read-text {
  color: white;
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.read-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(212, 165, 165, 0.5);
}

.read-button:active {
  transform: translateY(0);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .cover-container {
    height: 25vh;
    min-height: 180px;
  }
  
  .content {
    padding: 1.5rem 1rem;
  }
  
  .work-title {
    font-size: 1.5rem;
  }
  
  .author-info {
    font-size: 0.85rem;
    margin-bottom: 1rem;
  }
  
  .favorite-btn {
    width: 40px;
    height: 40px;
  }
  
  .favorite-btn svg {
    width: 20px;
    height: 20px;
  }
  
  .tags-container {
    gap: 0.5rem;
  }
  
  .tag {
    font-size: 0.85rem;
    padding: 0.4rem 0.8rem;
  }
  
  .description-title {
    font-size: 1.25rem;
  }
  
  .description {
    max-height: 30vh;
    padding: 1.5rem;
  }
  
  .expand-btn {
    font-size: 0.9rem;
    padding: 0.75rem 1.25rem;
  }
  
  .modal-content {
    padding: 2rem;
    margin: 1rem;
  }
  
  .modal-title {
    font-size: 1.5rem;
  }
  
  .bottom-bar {
    height: 70px;
    padding: 0 1rem;
    gap: 0.75rem;
  }
  
  .back-button {
    width: 48px;
    height: 48px;
  }
  
  .back-button svg {
    width: 20px;
    height: 20px;
  }
  
  .read-button {
    height: 48px;
    border-radius: 24px;
  }
  
  .read-text {
    font-size: 1rem;
  }
}

/* 评论区域样式 */
.comments-section {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.comments-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.comments-title {
  font-size: 1.5rem;
  color: #333;
  margin: 0;
  font-weight: 600;
}

/* 排序选择器 */
.sort-selector {
  display: flex;
  gap: 0.5rem;
  background: #f5f5f5;
  padding: 0.25rem;
  border-radius: 8px;
}

.sort-btn {
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  color: #666;
  font-size: 0.9rem;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.sort-btn.active {
  background: white;
  color: #d4a5a5;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.sort-btn:hover:not(.active) {
  color: #333;
}

/* 回复提示 */
.replying-to {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: #f0e7f7;
  border-radius: 6px;
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
  color: #6e4d87;
}

.cancel-reply-btn {
  background: none;
  border: none;
  color: #d4a5a5;
  font-size: 0.9rem;
  cursor: pointer;
  font-weight: 500;
  transition: color 0.3s ease;
}

.cancel-reply-btn:hover {
  color: #c89090;
}

/* 评论输入区 */
.comment-input-container {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.comment-input {
  width: 100%;
  padding: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  font-family: inherit;
  resize: vertical;
  min-height: 80px;
  transition: border-color 0.3s ease;
  background-color: #faf8f3;
}

.comment-input:focus {
  outline: none;
  border-color: #d4a5a5;
}

.comment-input::placeholder {
  color: #999;
}

.submit-comment-btn {
  margin-top: 1rem;
  padding: 0.75rem 2rem;
  background: #d4a5a5; /* 肉粉色 */
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 500;
}

.submit-comment-btn:hover {
  background: #c89090;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(212, 165, 165, 0.3);
}

.submit-comment-btn:active {
  transform: translateY(0);
}

/* 评论列表 */
.comments-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.comment-item {
  display: flex;
  gap: 1rem;
  padding: 1.5rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: box-shadow 0.3s ease;
}

.comment-item:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.comment-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1.1rem;
  flex-shrink: 0;
}

.comment-content {
  flex: 1;
  min-width: 0;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  gap: 1rem;
}

.comment-author {
  font-weight: 600;
  color: #333;
  font-size: 0.95rem;
}

.comment-time {
  color: #999;
  font-size: 0.85rem;
  white-space: nowrap;
}

.comment-text {
  color: #555;
  line-height: 1.6;
  font-size: 0.95rem;
  word-wrap: break-word;
  margin-bottom: 0.75rem;
}

/* 评论操作按钮 */
.comment-actions {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.75rem;
  background: transparent;
  border: 1px solid #e0e0e0;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.85rem;
  color: #666;
  transition: all 0.3s ease;
}

.action-btn svg {
  width: 16px;
  height: 16px;
  stroke-width: 2;
}

.action-btn:hover {
  border-color: #d4a5a5;
  color: #d4a5a5;
  background: rgba(212, 165, 165, 0.05);
}

.action-btn.active {
  border-color: #d4a5a5;
  color: #d4a5a5;
  background: rgba(212, 165, 165, 0.1);
}

.like-btn.active svg {
  fill: #d4a5a5;
}

/* 回复列表 */
.replies-list {
  margin-top: 1rem;
  padding-left: 1rem;
  border-left: 2px solid #f0f0f0;
}

.reply-item {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
  padding: 1rem;
  background: #fafafa;
  border-radius: 8px;
}

.reply-avatar {
  width: 32px;
  height: 32px;
  font-size: 0.9rem;
  background: linear-gradient(135deg, #d4a5a5 0%, #c89090 100%);
}

/* 空状态 */
.empty-comments {
  text-align: center;
  padding: 3rem 1rem;
  color: #999;
}

.empty-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 1rem;
}

.empty-comments p {
  font-size: 1rem;
  margin: 0;
}

/* 超小屏幕 */
@media (max-width: 480px) {
  .work-title {
    font-size: 1.25rem;
  }
  
  .bottom-bar {
    height: 65px;
    padding: 0 0.75rem;
    gap: 0.5rem;
  }
  
  .back-button {
    width: 44px;
    height: 44px;
  }
  
  .read-button {
    height: 44px;
  }
  
  .read-text {
    font-size: 0.95rem;
  }
  
  .comments-section {
    padding: 1.5rem 1rem;
  }
  
  .comments-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .comments-title {
    font-size: 1.25rem;
  }
  
  .sort-selector {
    width: 100%;
  }
  
  .sort-btn {
    flex: 1;
  }
  
  .comment-input-container {
    padding: 1rem;
  }
  
  .comment-item {
    padding: 1rem;
    gap: 0.75rem;
  }
  
  .comment-avatar {
    width: 36px;
    height: 36px;
    font-size: 1rem;
  }
  
  .comment-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
  
  .comment-actions {
    gap: 0.5rem;
  }
  
  .action-btn {
    font-size: 0.8rem;
    padding: 0.35rem 0.6rem;
  }
  
  .replies-list {
    padding-left: 0.5rem;
  }
  
  .reply-item {
    padding: 0.75rem;
    gap: 0.5rem;
  }
}
</style>
