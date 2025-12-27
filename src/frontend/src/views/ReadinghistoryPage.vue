<template>
  <div class="history-page">
    <van-nav-bar title="阅读历史" left-arrow @click-left="handleBack" />
    <div
      style="
        padding: 0 16px 8px 16px;
        display: flex;
        align-items: center;
        gap: 8px;
        justify-content: flex-end;
      "
    >
      <van-button
        size="small"
        :style="{
          background: selectedIds.length === 0 ? '#b88484' : '#a73f3f',
          border: 'none',
          color: '#fff'
        }"
        @click="handleBatchDelete"
        :disabled="selectedIds.length === 0"
        >批量删除</van-button
      >
      <van-button
        size="small"
        :style="{
          background: '#a73f3f',
          border: 'none',
          color: '#fff'
        }"
        @click="handleClearAll"
        >清空全部</van-button
      >
    </div>
    <div class="book-list">
      <template v-if="isLoading">
        <div style="text-align: center; color: #999; padding: 48px 0 32px 0; font-size: 16px">
          正在加载...
        </div>
      </template>
      <template v-else-if="readingHistory.length === 0">
        <div style="text-align: center; color: #999; padding: 48px 0 32px 0; font-size: 16px">
          暂时没有阅读历史，快去发现好故事吧！
        </div>
      </template>
      <van-checkbox-group v-else v-model="selectedIds">
        <div class="book-item" v-for="book in readingHistory" :key="book.id">
          <van-checkbox :name="book.id" class="history-checkbox" />
          <van-image
            :src="book.image_url"
            class="book-cover"
            fit="cover"
            @click="navigateToBookDetail(book.id)"
          />
          <div class="book-info">
            <h3 class="book-title" @click="navigateToBookDetail(book.id)">{{ book.title }}</h3>
            <p class="book-author">作者: {{ book.author }}</p>
            <p class="book-desc">{{ book.description }}</p>
            <div class="book-tags">
              <van-tag
                v-for="tag in book.processedTags.slice(0, 2)"
                :key="tag.id"
                size="small"
                :style="tag.color"
                @click="handleTagClick(tag)"
              >
                {{ tag.name }}
              </van-tag>
            </div>
          </div>
          <van-icon
            name="delete"
            class="delete-icon"
            @click="openDeleteDialog(book.id)"
            title="删除本条"
          />
          <!-- 单本删除弹窗 -->
          <van-dialog
            v-model:show="showDeleteDialog"
            title="确认删除"
            show-cancel-button
            @confirm="confirmDelete"
            class="custom-dialog"
            overlay-class="custom-dialog-overlay"
          >
            <div class="delete-dialog-message">确定要删除这条阅读历史吗？</div>
          </van-dialog>

          <van-dialog
            v-model:show="showBatchDeleteDialog"
            title="批量删除"
            show-cancel-button
            @confirm="confirmBatchDelete"
            class="custom-dialog"
            overlay-class="custom-dialog-overlay"
          >
            <div class="delete-dialog-message">
              确定要删除选中的{{ selectedIds.length }}条记录吗？
            </div>
          </van-dialog>

          <van-dialog
            v-model:show="showClearAllDialog"
            title="清空全部"
            show-cancel-button
            @confirm="confirmClearAll"
            class="custom-dialog"
            overlay-class="custom-dialog-overlay"
          >
            <div class="delete-dialog-message">确定要清空全部阅读历史吗？</div>
          </van-dialog>
        </div>
      </van-checkbox-group>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast } from 'vant'
import { getReadingHistory, clearReadingHistory } from '../api/user'
import { useTags } from '../composables/useTags'

// 初始化标签工具
const { getTagsByIds } = useTags()

const router = useRouter()

const readingHistory = ref([])

const selectedIds = ref([])

// 加载状态
const isLoading = ref(true)

// 在组件挂载时获取阅读历史
onMounted(() => {
  fetchReadingHistory()
})

// 获取当前用户阅读历史的作品列表
const fetchReadingHistory = async () => {
  isLoading.value = true
  try {
    const response = await getReadingHistory()
    if (!response.data.code || response.data.code !== 200) {
      throw new Error('获取阅读历史失败')
    }
    const books = response.data.data
    // 为每本书处理标签（转换ID为名称和颜色）
    for (const book of books) {
      book.processedTags = await getTagsByIds(book.tags || [])
    }
    readingHistory.value = books
  } catch (error) {
    showToast({ message: error.message || '获取数据失败，请稍后重试', duration: 1000 })
    console.error('作品列表请求失败:', error)
    readingHistory.value = []
  } finally {
    isLoading.value = false
  }
}

// 返回上一页
const handleBack = () => {
  router.back()
}

// 单本删除弹窗逻辑
const showDeleteDialog = ref(false)
const deleteId = ref(null)
const openDeleteDialog = (id) => {
  deleteId.value = id
  showDeleteDialog.value = true
}
const confirmDelete = async () => {
  if (!deleteId.value) return
  try {
    await clearReadingHistory(deleteId.value)
    showToast({ message: '删除成功', duration: 1000 })
    fetchReadingHistory()
  } catch (e) {
    showToast({ message: '删除失败', duration: 1000 })
  } finally {
    showDeleteDialog.value = false
    deleteId.value = null
  }
}

// 批量删除弹窗逻辑
const showBatchDeleteDialog = ref(false)
const handleBatchDelete = () => {
  if (selectedIds.value.length === 0) return
  showBatchDeleteDialog.value = true
}
const confirmBatchDelete = async () => {
  if (selectedIds.value.length === 0) return
  try {
    await clearReadingHistory([...selectedIds.value])
    showToast({ message: '批量删除成功', duration: 1000 })
    fetchReadingHistory()
    selectedIds.value = []
  } catch (e) {
    showToast({ message: '批量删除失败', duration: 1000 })
  } finally {
    showBatchDeleteDialog.value = false
  }
}

// 清空全部弹窗逻辑
const showClearAllDialog = ref(false)
const handleClearAll = () => {
  if (readingHistory.value.length === 0) return
  showClearAllDialog.value = true
}
const confirmClearAll = async () => {
  try {
    await clearReadingHistory()
    showToast({ message: '已清空全部', duration: 1000 })
    fetchReadingHistory()
    selectedIds.value = []
  } catch (e) {
    showToast({ message: '清空失败', duration: 1000 })
  } finally {
    showClearAllDialog.value = false
  }
}

// 导航到书籍详情页
const navigateToBookDetail = (bookId) => {
  router.push(`/works/${bookId}`)
}

// 点击标签跳转到标签页面
const handleTagClick = (tag) => {
  if (!tag?.id) {
    showToast({ message: '标签信息不完整', duration: 1000 })
    return
  }
  router.push({
    path: `/tag/${tag.id}`, // 跳转到标签页面，路径包含标签ID
    query: { name: tag.name }
  })
}
</script>

<style scoped>
/* 删除弹窗内容美化 */
.delete-dialog-message {
  text-align: center;
  font-size: 16px;
  color: #333;
  padding: 10px 0 0 0;
}

/* 美化van-dialog弹窗背景色 */
::v-deep(.van-dialog) {
  background: #faf8f3 !important;
  border-radius: 16px !important;
}

/* 美化van-dialog确认按钮为粉色 */
::v-deep(.van-dialog__confirm) {
  background-color: #faf8f3 !important;
  color: #b88484 !important;
  font-weight: 600;
}

::v-deep(.van-dialog__cancel) {
  background-color: #faf8f3 !important;
  color: #868585 !important;
}
::v-deep(.custom-dialog-overlay),
::v-deep(.van-overlay) {
  background: rgba(0, 0, 0, 0.3) !important;
  backdrop-filter: blur(5px) !important;
}
.custom-dialog-overlay {
  background: rgba(0, 0, 0, 0.3) !important;
  backdrop-filter: blur(5px) !important;
}
::v-deep .van-nav-bar {
  background: #faf8f3;
  box-shadow: none;
}
::v-deep .van-nav-bar__title,
::v-deep .van-nav-bar__left .van-icon {
  color: #54494b;
}

.history-page {
  background-color: #faf8f3;
  min-height: 100vh;
  padding-bottom: 20px;
  /* 使用内边距而非外边距，结合安全区更稳妥 */
  padding-top: 0;
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
  align-items: flex-start;
}

.book-cover {
  width: 150px;
  height: 100px;
  border-radius: 4px;
  flex-shrink: 0;
  overflow: hidden;
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

.history-checkbox {
  margin-right: 8px;
  min-width: 24px;
  min-height: 24px;
  display: flex;
  align-items: center;
}

.delete-icon {
  font-size: 20px;
  color: #a73f3f;
  margin-left: 8px;
  cursor: pointer;
  flex-shrink: 0;
}
</style>
