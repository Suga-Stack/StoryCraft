<template>
  <div class="search-page">
    <!-- 顶部搜索栏 -->
    <div class="search-bar">
      <van-search
        v-model="searchValue"
        placeholder="搜索作品..."
        shape="round"
        background="#f5f5f5"
        :right-icon="showAdvancedFilter ? 'arrow-up' : 'arrow-down'"
        @click-right-icon="toggleAdvancedFilter"
        :show-action="true" 
        @search="handleSearch" 
        :show-left-icon="false"
      >
        <template #left>
          <van-icon name="arrow-left" @click="handleBack" />
        </template>

        <!-- 添加搜索按钮 -->
        <template #action>
          <van-button type="text" @click="handleSearch(searchValue)" class="custom-search-btn">搜索</van-button>
        </template>
      </van-search>
    </div>

    <!-- 高级搜索筛选区 -->
    <div class="advanced-filter" v-if="showAdvancedFilter && !isSearchCompleted ">
      <van-row :gutter="16" class="filter-row">
        <van-col span="12">
          <van-field
            v-model="authorFilter"
            placeholder="搜索作者名"
            clearable
          />
        </van-col>
        <van-col span="12">
          <van-field
            v-model=tagDisplayText
            placeholder="选择标签（可多选）"
            readonly
            :clickable="true"
            @click="toggleTagPopup"
          />
        </van-col>
      </van-row>
    </div>

      <!-- 标签选择弹窗 -->
      <van-popup
        v-model:show="showTagPopup"
        round
        position="bottom"
        :style="{ height: '50%' }"
      >
        <div class="tag-popup-header">
          <span>选择标签</span>
          <span class="close-btn" @click="showTagPopup = false">x</span>
        </div>
        <div class="tag-list" @scroll="handleTagListScroll">
          <!-- 加载状态 -->
          <van-loading v-if="isLoadingTags && allTags.length === 0" color="#c78c8c" size="24" class="loading-indicator" />
          
          <!-- 错误提示 -->
          <p class="error-text" v-if="tagsError && allTags.length === 0">{{ tagsError }}</p>
          
          <!-- 标签列表 -->
          <van-tag
            v-for="tag in allTags"
            :key="tag.id"
            :color="getTagColorById(tag.id).backgroundColor"
            :text-color="getTagColorById(tag.id).color"
            clickable
            @click="selectTag(tag)"
            :class="{ 'selected-tag': selectedTagIds.includes(tag.id) }"
          >
            {{ tag.name }}
          </van-tag>
          <!-- 加载更多提示 -->
          <div v-if="isLoadingTags && allTags.length > 0" class="loading-more">
            <van-loading size="16" />
          </div>
          
          <!-- 没有更多数据提示 -->
          <div v-if="!hasMoreTags && !isLoadingTags && allTags.length > 0" class="no-more">
            没有更多标签了
          </div>
        </div>
        <div class="tag-popup-footer">
          <van-button 
            type="primary" 
            block 
            @click="confirmTagSelection"
            :style="{ 
              background: 'linear-gradient(135deg, #d4a5a5 0%, #b88484 100%)',
              border: 'none'
            }"
          >
            确定
          </van-button>
        </div>
      </van-popup>
    


    <!-- 导航按钮栏 -->
    <div class="nav-buttons" v-if="!isSearchCompleted">
      <button 
        class="primary-btn" 
        :class="{ active: currentTab === 'total' }"
        @click="switchTab('total')"
      >
        总热榜
      </button>
      <button 
        class="primary-btn" 
        :class="{ active: currentTab === 'month' }"
        @click="switchTab('month')"
      >
        本月热榜
      </button>
      <button 
        class="primary-btn" 
        :class="{ active: currentTab === 'week' }"
        @click="switchTab('week')"
      >
        本周热榜
      </button>
      <button 
        class="primary-btn" 
        :class="{ active: currentTab === 'rating' }"
        @click="switchTab('rating')"
      >
        评分榜
      </button>
      <button 
        class="primary-btn" 
        :class="{ active: currentTab === 'collection' }"
        @click="switchTab('collection')"
      >
        收藏榜
      </button>
    </div>

    <!-- 搜索历史 -->
    <div class="search-history" v-if="searchValue === '' && searchHistory.length && !isSearchCompleted">
      <div class="history-header">
        <span>搜索历史</span>
        <van-icon name="delete" @click="clearHistory" />
      </div>
      <div class="history-tags">
        <van-tag 
          v-for="(item, index) in searchHistory" 
          :key="index"
          closeable
          @click="handleHistoryClick(item)"
          @close="deleteHistory(index)"
          
        >
          {{ item }}
        </van-tag>
      </div>
    </div>

    <!-- 排行榜区域 -->
    <div class="rankings" v-if="!isSearchCompleted">
      <div class="ranking-section">
        <div class="ranking-header">
         <van-icon 
          :name="currentTab === 'rating' ? 'star' : currentTab === 'collection' ? 'like' : 'fire'" 
          :color="currentTab === 'rating' ? '#ffd700' : currentTab === 'collection' ? '#ff4d4f' : '#ff7a45'" 
        />
          <span>{{ currentTabText }}</span>
        </div>
        
        <!-- 可滚动的排行榜列表 -->
        <div class="ranking-list-wrapper">
          <div class="ranking-list">
            <div 
              class="ranking-item" 
              v-for="(item, index) in currentRankList" 
              :key="item.id"
              @click="navigateToDetail(item.id)"
            >
              <!-- 排名标识 -->
              <div class="rank-number" :class="{ top3: index < 3 }">
                  {{ (currentPage - 1) * pageSize + index + 1 }}
              </div>
              
              <!-- 封面 -->
              <van-image 
                :src="item.cover" 
                class="item-cover" 
                fit="cover"
              />
              
              <!-- 信息区域 -->
              <div class="item-info">
                <h3 class="item-title">{{ item.title }}</h3>
                <p class="item-author">作者: {{ item.author }}</p>
                <div class="item-meta">
                  <span class="meta-tag">
                    {{ currentTab === 'rating' ? '评分: ' + item.rating.toFixed(1) : 
                    currentTab === 'collection' ? '收藏: ' + formatNumber(item.collectionCount) : 
                    '热度: ' + formatNumber(item.hotScore) }}
                  </span>
                  <div class="tags">
                    <van-tag 
                      v-for="(tagId, index) in item.tags.slice(0, 2)" 
                      :key="tagId"
                      :color="getTagColorById(tagId).backgroundColor"
                      :text-color="getTagColorById(tagId).color"
                      size="mini"
                      round
                    >
                      {{ item.tagNames[index] }}
                    </van-tag>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
        

    <!-- 搜索结果区域 -->
    <div class="search-result" v-if="isSearchCompleted">
      <div class="result-header">
        <span>搜索结果: "{{ searchValue }}"</span>
      </div>
      <div class="result-list" v-if="searchResults.length">
        <div 
          class="result-item" 
          v-for="item in searchResults" 
          :key="item.id"
          @click="navigateToDetail(item.id)"
        >
          <van-image 
            :src="item.cover" 
            class="result-cover" 
            fit="cover"
          />
          <div class="result-info">
            <div class="result-draft">
              <p class="result-title">{{ item.title }}</p>
              <div class="author-tags-container">
                <p class="result-author">作者: {{ item.author }}</p>
                <div class="result-tags">
                  <van-tag 
                    v-for="(tagId, index) in item.tags.slice(0, 2)"
                    :key="tagId"
                    :color="getTagColorById(tagId).backgroundColor" 
                    :text-color="getTagColorById(tagId).color"  
                    size="small"
                    round
                  >
                    {{ item.tagNames[index] }}
                  </van-tag>
                </div>
              </div>
            </div>    
            <div class="result-description">
              {{ item.description }}
            </div>
          </div>
        </div>
      </div>
      <div class="empty-result" v-else>
        <van-empty description="未找到相关作品" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { getFavoriteLeaderboard, search, getRatingLeaderboard, getHotLeaderboard } from '../api/user' 
import { useTags } from '../composables/useTags';
import http from '../utils/http'
import { get } from 'vant/lib/utils';
// 路由实例
const router = useRouter()

const { convertTagIdsToNames, getTagColorById } = useTags();

// 搜索相关数据
const searchValue = ref('')
const searchHistory = ref([])
const searchResults = ref([])
const showTagPopup = ref(false)

// 标签相关变量
const allTags = ref([]) 
const tagDisplayText = ref('') 
const tagFilter = ref('')
const selectedTagIds = ref([])  // 新增这一行
const selectedTagNames = ref([])  // 已存在的行
const isLoadingTags = ref(false); // 加载状态
const tagsError = ref(''); // 错误信息

const authorFilter = ref('')

const isSearchCompleted = ref(false)
const searchCurrentPage = ref(1)
const searchTotalItems = ref(0)

// 排行榜切换相关
const currentTab = ref('total') // total, month, week, rating
const currentPage = ref(1)
const pageSize = ref(20)

// 排行榜数据
const totalRank = ref([])
const monthRank = ref([])
const weekRank = ref([])
const ratingRank = ref([])
const collectionRank = ref([])

// 计算当前显示的排行榜数据
const currentRankList = computed(() => {
  const allData = currentTab.value === 'total' ? totalRank.value :
                 currentTab.value === 'month' ? monthRank.value :
                 currentTab.value === 'week' ? weekRank.value :
                 currentTab.value === 'rating' ? ratingRank.value :
                 collectionRank.value 
  
  // 计算分页
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return allData.slice(start, end)
})

// 当前标签页文本
const currentTabText = computed(() => {
  const texts = {
    total: '总热榜',
    month: '本月热榜',
    week: '本周热榜',
    rating: '评分榜',
    collection: '收藏榜'
  }
  return texts[currentTab.value]
})

// 切换标签页
const switchTab = (tab) => {
  currentTab.value = tab
  currentPage.value = 1 // 切换标签时重置到第一页
}

// 获取收藏榜数据的函数
const fetchFavoriteLeaderboard = async () => {
  try {
    const response = await getFavoriteLeaderboard()
    const itemsWithTags = await Promise.all(
      response.data.data.map(async (item) => {
        const tagNames = await convertTagIdsToNames(item.tags);
        return{
          ...item,
          id: item.id.toString(),  // 统一转为字符串ID
          title: item.title,
          author: item.author,
          cover: item.image_url,  // 映射到cover字段
          tags: item.tags,
          tagNames: tagNames,
          hotScore: item.read_count,  // 热度使用阅读量
          rating: item.average_score, // 评分
          collectionCount: item.favorite_count  // 收藏数
        }
      })
    )
    // 按收藏数排序
    collectionRank.value = itemsWithTags.sort((a, b) => b.collectionCount - a.collectionCount)
    
  } catch (error) {
    console.error('获取收藏收藏榜失败', error);
    showToast('获取收藏榜失败，请稍后重试');
  }
}

// 修改fetchRatingLeaderboard函数，适配新接口格式
const fetchRatingLeaderboard = async () => {
  try {
    const response = await getRatingLeaderboard()
    // 转换接口返回数据为统一格式
    if (response.data) {
      const itemsWithTags = await Promise.all(
        response.data.data.map(async (item) => {
          const tagNames = await convertTagIdsToNames(item.tags);
          return{
            ...item,
            id: item.id.toString(),  // 统一转为字符串ID
            title: item.title,
            author: item.author,
            cover: item.image_url,  // 映射到cover字段
            tags: item.tags, // 等待标签名称解析完成
            tagNames: tagNames,
            rating: item.average_score, // 评分
            collectionCount: item.favorite_count  // 收藏数
          }
        })
      )
      ratingRank.value = itemsWithTags.sort((a, b) => b.average_score - a.average_score);
    }

  } catch (error) {
    console.error('获取评分评分榜失败', error);
    showToast('获取评分评分榜失败，请稍后重试');
  }
}

const fetchHotLeaderboard = async () => {
  try {
    // 获取总榜
    const totalResponse = await getHotLeaderboard('total')
    const totalItems = await Promise.all(
      totalResponse.data.data.map(async (item) => {
        const tagNames = await convertTagIdsToNames(item.tags);
        return {
          ...item,
          id: item.id.toString(),
          title: item.title,
          author: item.author,
          cover: item.image_url,
          tags: item.tags, // 保留原始标签ID
          tagNames: tagNames, // 存储转换后的标签名称
          rating: item.average_score,
          collectionCount: item.favorite_count
        }
      })
    )
    totalRank.value = totalItems

    // 获取月榜
    const monthResponse = await getHotLeaderboard('month')
    const monthItems = await Promise.all(
      monthResponse.data.data.map(async (item) => {
        const tagNames = await convertTagIdsToNames(item.tags);
        return {
          ...item,
          id: item.id.toString(),
          title: item.title,
          author: item.author,
          cover: item.image_url,
          tags: item.tags, // 保留原始标签ID
          tagNames: tagNames, // 存储转换后的标签名称
          rating: item.average_score,
          collectionCount: item.favorite_count
        }
      })
    )
    monthRank.value = monthItems

    // 获取周榜
    const weekResponse = await getHotLeaderboard('week')
    const weekItems = await Promise.all(
      weekResponse.data.data.map(async (item) => {
        const tagNames = await convertTagIdsToNames(item.tags);
        return {
          ...item,
          id: item.id.toString(),
          title: item.title,
          author: item.author,
          cover: item.image_url,
          tags: item.tags, // 保留原始标签ID
          tagNames: tagNames, // 存储转换后的标签名称
          rating: item.average_score,
          collectionCount: item.favorite_count
        }
      })
    )
    weekRank.value = weekItems
    
  } catch (error) {
    console.error('获取热度榜失败', error);
    showToast('获取热度榜失败，请稍后重试');
  }
}


// 页面挂载时加载搜索历史
onMounted(() => {
  const history = localStorage.getItem('searchHistory')
  if (history) {
    try {
      searchHistory.value = JSON.parse(history)
    } catch (e) {
      console.error('解析搜索历史失败', e)
      localStorage.removeItem('searchHistory')
    }
  }
  fetchRatingLeaderboard()
  fetchFavoriteLeaderboard()
  fetchHotLeaderboard()
})

// 选择标签（切换选中状态）
const selectTag = (tag) => {
  const index = selectedTagIds.value.indexOf(tag.id)
  if (index > -1) {
    // 已选中则移除
    selectedTagIds.value.splice(index, 1)
    selectedTagNames.value.splice(index, 1)
  } else {
    // 未选中则添加
    selectedTagIds.value.push(tag.id)
    selectedTagNames.value.push(tag.name)
  }

  // 实时更新显示文本
  tagDisplayText.value = selectedTagNames.value.join(',')
}

// 确认标签选择
const confirmTagSelection = () => {
  // 将数组转换为逗号分隔的字符串，适应后端参数格式
  tagFilter.value = selectedTagIds.value.join(',')
  showTagPopup.value = false
}

// 控制高级搜索显示的变量
const showAdvancedFilter = ref(false)

// 切换显示状态的方法
const toggleAdvancedFilter = () => {
  showAdvancedFilter.value = !showAdvancedFilter.value
}

// 保存搜索历史到本地存储
const saveHistory = (value) => {
  if (!value.trim()) return
  // 去重
  const newHistory = searchHistory.value.filter(item => item !== value)
  // 添加到最前面
  newHistory.unshift(value)
  // 限制最多10条历史
  if (newHistory.length > 10) newHistory.pop()
  searchHistory.value = newHistory
  localStorage.setItem('searchHistory', JSON.stringify(newHistory))
}

// 搜索处理
const handleSearch = async (value = searchValue.value) => {
  const searchText = (value || '').toString().trim();
  const authorText = (authorFilter.value || '').toString().trim();
  const tagText = (tagFilter.value || '').toString().trim();

  // 验证：所有条件都为空时才阻止搜索
  if (!searchText && !authorText && !tagText) {
    showToast('请输入搜索内容或选择筛选条件')
    return
  }
  
  // 保存搜索历史（如果有搜索关键词）
  if (value.trim()) {
    saveHistory(value)
  }
  
  // 重置搜索状态
  isSearchCompleted.value = false
  searchCurrentPage.value = 1
  
  try {
    const searchResponse = await search(
      searchCurrentPage.value,  // page参数
      searchText,               // q参数
      authorText,               // author参数
      tagText                   // tag参数
    )
    const searchItems = await Promise.all(
      searchResponse.data.data.map(async (item) => {
        const tagNames = await convertTagIdsToNames(item.tags);
        return {
          ...item,
          id: item.id.toString(),
          title: item.title,
          author: item.author,
          cover: item.image_url,
          tags: item.tags, // 保留原始标签ID
          tagNames: tagNames, // 存储转换后的标签名称
          rating: item.average_score,
          collectionCount: item.favorite_count,
          description: item.description
        }
      })
    )
    searchResults.value = searchItems
    isSearchCompleted.value = true
    console.log("搜索成功", isSearchCompleted.value)
  } catch (error) {
    console.error('搜索失败', error)
    showToast('搜索失败，请稍后重试')
    isSearchCompleted.value = true
  }
}

// 加载更多搜索结果
const loadMoreSearchResults = async () => {
  if (!hasMoreSearchResults.value || !isSearchCompleted.value) return
  
  searchCurrentPage.value += 1
  isSearchCompleted.value = false
  
  try {
    // 使用新的search接口函数
    const response = await search(
      searchCurrentPage.value,
      searchValue.value,
      authorFilter.value,
      tagFilter.value
    )
    
    // 将新结果添加到现有结果中
    searchResults.value = [...searchResults.value, ...response.data.results]
    searchTotalItems.value = response.data.count
    isSearchCompleted.value = true
    
    // 判断是否还有更多数据
    hasMoreSearchResults.value = !!response.data.next
  } catch (error) {
    console.error('加载更多失败', error)
    searchCurrentPage.value -= 1 // 恢复页码
    isSearchCompleted.value = true
  }
}

// 点击历史记录
const handleHistoryClick = (value) => {
  searchValue.value = value
  handleSearch(value)
}

// 删除单条历史
const deleteHistory = (index) => {
  searchHistory.value.splice(index, 1)
  localStorage.setItem('searchHistory', JSON.stringify(searchHistory.value))
}

// 清空所有历史
const clearHistory = () => {
  searchHistory.value = []
  localStorage.removeItem('searchHistory')
  showToast('已清空搜索历史')
}

// 返回上一页
const handleBack = () => {
  router.back()
}

// 跳转到作品详情
const navigateToDetail = (id) => {
  router.push(`/works/${id}`)
}

// 数字格式化
const formatNumber = (num) => {
  if (num === undefined || num === null) {
    return '0';
  }
  // 确保是数字类型
  const number = Number(num);
  if (isNaN(number)) {
    return '0';
  }
  if (number >= 10000) {
    return (number / 10000).toFixed(1) + '万';
  }
  return number.toString();
}

// 在标签相关变量区域添加
const tagCurrentPage = ref(1)
const hasMoreTags = ref(true)

// fetchTags函数
const fetchTags = async (page = 1) => {
  try {
    // 显示加载状态（需要在模板中添加加载指示器）
    isLoadingTags.value = true;
    tagsError.value = '';

    const newTagsRes = await http.get('/api/tags/', {
      params: { page }
    });
    
    if (page === 1) {
      allTags.value = newTagsRes.data?.results || [];
    } else {
      allTags.value = [...allTags.value, ...(newTagsRes.data?.results || [])];
    }
    
    hasMoreTags.value = !!newTagsRes.data?.next;
    tagCurrentPage.value = page;
  } catch (error) {
    console.error('获取标签失败', error);
    tagsError.value = error.response?.data?.message || '获取标签失败，请稍后重试';
    showToast(tagsError.value);
  } finally {
    isLoadingTags.value = false;
  }
}

// 在打开标签弹窗时加载标签
const toggleTagPopup = () => {
  // 切换弹窗显示状态（true→false 或 false→true）
  showTagPopup.value = !showTagPopup.value;
  // 只有当弹窗被打开，且标签数据为空、没有正在加载时，才加载第一页标签
  if (showTagPopup.value && allTags.value.length === 0 && !isLoadingTags.value) {
    fetchTags(1);
  }
}

// 处理标签列表滚动加载
const handleTagListScroll = (e) => {
  const { scrollTop, scrollHeight, clientHeight } = e.target;
  // 当滚动到距离底部20px时加载更多
  if (scrollHeight - scrollTop - clientHeight < 20 && hasMoreTags.value) {
    fetchTags(tagCurrentPage.value + 1);
  }
}
</script>

<style scoped>
.search-page {
  background-color: #f5f5f5;
  min-height: 100vh;
}

.custom-search-btn {
  border: 2px solid #d4a5a5;
  background-color: #fff;
  color: #d4a5a5 !important;
  border-radius: 8px;
  padding: 3px 6px;
}

.custom-search-btn:active {
  background-color: #fff !important;
  opacity: 0.9;
}

.advanced-filter {
  padding: 10px 16px;
  background-color: #fff;
  border-bottom: 1px solid #f5f5f5;
}

.filter-row {
  margin-bottom: 12px;
}

.van-popup {
  display: flex;
  flex-direction: column;
  z-index: 9999 !important; 
  
}

.tag-popup-header {
  height: 44px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #eee;
}

.close-btn {
  font-size: 18px;
}

.tag-popup-footer {
  height: 44px;
  width: 100%;
  padding: 0 20px;
}

.tag-list {
  padding: 16px;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 10px;
  overflow-y: auto;
  flex: 0.9;
}

::v-deep .tag-list .van-tag {
  padding: 2px 10px !important; 
  border-radius: 20px !important; 
  font-size: 12px !important;
  height: 30px;
}

::v-deep .tag-list .van-tag.selected-tag {
  filter: brightness(0.8);
  border: 1px solid #d4a5a5 !important;
  position: relative;
}

.active-filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 0;
}

.reset-btn {
  color: #666;
  font-size: 12px;
  padding: 0;
}

.loading-indicator {
  text-align: center;
  padding: 20px 0;
  width: 100%;
}

.error-text {
  color: #ff4d4f;
  font-size: 14px;
  text-align: center;
  padding: 20px 0;
  width: 100%;
}

.loading-more {
  width: 100%;
  text-align: center;
  padding: 10px 0;
}

.no-more {
  width: 100%;
  text-align: center;
  padding: 10px 0;
  color: #888;
  font-size: 14px;
}

/* 搜索栏样式 */
.search-bar {
  padding: 10px 16px;
  background-color: #fff;
}

/* 导航按钮样式 */
.nav-buttons {
  display: flex;
  padding: 10px 16px;
  background-color: #fff;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
}

.nav-buttons::-webkit-scrollbar {
  display: none;
}

.primary-btn {
  flex: 1;
  min-width: 80px;
  padding: 8px 0;
  color: white;
  background: linear-gradient(135deg, #d4a5a5 0%, #b88484 100%);
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(212, 165, 165, 0.3);
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.primary-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(212, 165, 165, 0.4);
}

.primary-btn:active {
  transform: translateY(0);
}

.primary-btn.active {
  opacity: 0.9;
  box-shadow: 0 2px 8px rgba(212, 165, 165, 0.5);
}

/* 搜索历史样式 */
.search-history {
  padding: 16px;
  background-color: #fff;
  margin-bottom: 10px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 14px;
  color: #666;
}

.history-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

/* 排行榜通用样式 */

.ranking-section {
  background-color: #fff;
  margin-bottom: 10px;
  padding: 16px;
}

.ranking-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
  color: #333;
}

/* 可滚动的排行榜列表容器 */
.ranking-list-wrapper {
  max-height: 610px;
  overflow-y: auto;
  margin-bottom: 16px;
  scrollbar-width: thin;
}

.ranking-list-wrapper::-webkit-scrollbar {
  width: 4px;
}

.ranking-list-wrapper::-webkit-scrollbar-thumb {
  background-color: #ddd;
  border-radius: 2px;
}

.ranking-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 排行榜项样式 */
.ranking-item {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f5f5f5;
}

.ranking-item:last-child {
  border-bottom: none;
}

.rank-number {
  width: 24px;
  height: 24px;
  line-height: 24px;
  text-align: center;
  font-size: 14px;
  color: #999;
  margin-right: 12px;
}

.rank-number.top3 {
  color: #fff;
  border-radius: 50%;
}

.rank-number.top3:nth-child(1) {
  background-color: #d4a5a5; /* 金牌 */
}
.rank-number.top3:nth-child(2) {
  background-color: #c0c0c0; /* 银牌 */
}
.rank-number.top3:nth-child(3) {
  background-color: #cd7f32; /* 铜牌 */
}

.item-cover {
  width: 120px;
  height: 80px;
  border-radius: 4px;
  flex-shrink: 0;
}

.item-info {
  margin-left: 12px;
  flex-grow: 1;
}

.item-title {
  font-size: 15px;
  font-weight: 500;
  margin: 0 0 4px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-author {
  font-size: 12px;
  color: #666;
  margin: 0 0 6px 0;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.meta-tag {
  font-size: 12px;
  color: #888;
}

.tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

/* 搜索结果样式 */
.search-result {
  padding: 16px;
}

.result-header {
  font-size: 14px;
  color: #666;
  margin-bottom: 16px;
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.result-item {
  display: flex;
  background-color: #fff;
  border-radius: 8px;
  padding: 12px;
  align-items: center;
}

.result-cover {
  width: 80px;
  height: 110px;
  border-radius: 6px;
  flex-shrink: 0;
  overflow: hidden;
}

.result-info {
  margin-left: 15px;
  flex-grow: 1;
}

.author-tags-container {
  overflow: hidden;
  display: flex;
  flex-direction: row;
  margin: 5px 0;
}

.result-title {
  font-size: 16px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-author {
  font-size: 13px;
  color: #666;
  margin: 0 20px 0 0;
}

.result-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.result-description {
  font-size: 14px;
  color: #444444;
  height: 60px;
  overflow: hidden;
}

.empty-result {
  padding: 40px 0;
  text-align: center;
}
</style>