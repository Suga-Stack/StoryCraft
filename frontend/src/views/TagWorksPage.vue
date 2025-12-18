```vue
<template>
  <div class="tag-works-page">
    <!-- 顶部导航栏 -->
    <van-nav-bar
      title="标签作品"
      left-arrow
      @click-left="handleBack"
      :title="currentTagName || '标签作品'"
    />

    <!-- 标签分类切换 -->
    <div class="category-tabs">
      <button
        v-for="(category, index) in categories"
        :key="index"
        class="category-tab"
        :class="{ active: currentCategory === index }"
        @click="switchCategory(index)"
      >
        {{ category.name }}
      </button>
      <!-- 下拉箭头，控制标签区展开/收起，与按钮行为一致 -->
      <button
        class="toggle-arrow"
        :class="{ open: isTagsOpen }"
        @click="toggleTagsSection"
        :aria-label="isTagsOpen ? '收起标签' : '展开标签'"
        title="切换标签显示"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 14l6-6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>

    <!-- 标签列表区域 -->
    <div class="section tags-section" v-show="isTagsOpen">
      <div class="tags-grid">
        <button
          v-for="tag in filteredTags"
          :key="tag.id"
          class="tag-btn"
          :class="{ selected: currentTagId === tag.id.toString() }"
          @click="handleTagClick(tag)"
        >
          {{ tag.name }}
        </button>
      </div>
    </div>

    <!-- 作品列表区域 -->
    <div class="works-section">
      <!-- 加载状态 -->
      <van-loading v-if="isLoading" color="#d4a5a5" size="30" class="loading-indicator" />

      <!-- 空状态 -->
      <div v-else-if="works.length === 0 && !isLoading" class="empty-state">
        <van-empty description="该标签下暂无作品" />
      </div>

      <!-- 作品列表 -->
      <div v-else class="works-grid">
        <div 
          v-for="work in works" 
          :key="work.id" 
          class="work-card"
          @click="navigateToWorkDetail(work.id)"
        >
          <div class="cover-container">
          <!-- 封面图 -->
          <img :src="work.image_url" alt="作品封面" class="work-cover" />
          <!-- 渐变遮罩层（单独一层，仅负责渐变效果） -->
          <div class="gradient-mask"></div>
          <!-- 文字内容层（只放文字，不包含背景） -->
          <div class="text-content">
            <h3 class="work-title">{{ work.title }}</h3>
            <p class="work-description">{{ work.description }}</p>
            <div class="work-meta">
              <span class="author">作者: {{ work.author }}</span>
              <span class="price">¥{{ work.price }}</span>
            </div>
          </div>
        </div>
        </div>
      </div>

      <!-- 简洁的上一页/下一页与页码信息 -->
      <div v-if="works.length!=0 && !isLoading" class="pager-controls">
        <button class="pager-btn" :disabled="currentPage <= 1" @click="goPrevPage">上一页</button>
        <span class="pager-info">第 {{ currentPage }} 页</span>
        <button class="pager-btn" :disabled="works.length < pageSize" @click="goNextPage">下一页</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NavBar, Loading, Empty, Pagination } from 'vant';
import { search } from '../api/user'; // 导入搜索接口
import { defaultTags } from '../config/tags'; // 导入标签数据

// 路由与导航
const router = useRouter();
const route = useRoute();

// 标签分类数据
const categories = ref([
  { name: '类型', range: [1, 16] },
  { name: '风格', range: [17, 49] },
  { name: '世界观', range: [50, 64] },
  { name: '题材', range: [65, 89] }
]);

// 状态管理
const currentCategory = ref(0); // 当前选中的分类索引
const currentTagId = ref(''); // 当前选中的标签ID（字符串便于路由参数比较）
const currentTagName = ref(''); // 当前标签名称
const allTags = ref([...defaultTags]); // 所有标签数据
const isLoading = ref(false); // 加载状态
const isTagsOpen = ref(false); // 标签区是否展开（初始收起，箭头朝上）

// 作品列表相关
const works = ref([]);
const currentPage = ref(1);
const pageSize = ref(10);

// 筛选当前分类的标签
const filteredTags = computed(() => {
  const { range } = categories.value[currentCategory.value];
  const [min, max] = range;
  return allTags.value.filter(tag => tag.id >= min && tag.id <= max);
});

// 从路由参数初始化标签
onMounted(() => {
  const paramId = route.params.id; // 来自 /tag/:id
  const queryId = route.query.tagId; // 兼容旧的 query 方式
  const tagId = paramId || queryId;
  const tagName = route.query.tagName || '';
  if (tagId) {
    currentTagId.value = String(tagId);
    currentTagName.value = String(tagName);
    switchTagCategory(tagId);
    isTagsOpen.value = true; // 进入页面时展开标签区
    currentPage.value = 1;
    fetchWorks();
  }
});

// 监听路由参数变化，支持从其他页面再次跳转到不同标签
watch(
  () => route.params.id,
  (newId, oldId) => {
    if (newId && newId !== oldId) {
      currentTagId.value = String(newId);
      currentTagName.value = String(route.query.tagName || '');
      switchTagCategory(newId);
      isTagsOpen.value = true;
      currentPage.value = 1;
      fetchWorks();
    }
  }
);

// 根据标签ID切换到对应分类
const switchTagCategory = (tagId) => {
  const tagIdNum = Number(tagId);
  const targetCategory = categories.value.findIndex(cat => {
    const [min, max] = cat.range;
    return tagIdNum >= min && tagIdNum <= max;
  });
  if (targetCategory !== -1) {
    currentCategory.value = targetCategory;
  }
};

// 切换分类
const switchCategory = (index) => {
  currentCategory.value = index;
  currentPage.value = 1; // 切换分类重置分页
  // 分类按钮仅负责切换分类，且始终展开标签区
  isTagsOpen.value = true;
};

// 点击标签
const handleTagClick = (tag) => {
  currentTagId.value = tag.id.toString();
  currentTagName.value = tag.name;
  currentPage.value = 1; // 切换标签重置分页
  fetchWorks();
};

// 切换标签区域显隐（与按钮行为一致）
const toggleTagsSection = () => {
  isTagsOpen.value = !isTagsOpen.value;
};

// 获取标签下的作品
const fetchWorks = async () => {
  if (!currentTagId.value) return;

  isLoading.value = true;
  try {
    const response = await search(
      currentPage.value,
      '', // 空搜索词
      '', // 空作者筛选
      currentTagId.value // 标签ID
    );
    // 新接口格式：{ code, message, data: [ ... ] }
    works.value = response.data.data || [];
  } catch (error) {
    console.error('获取作品失败:', error);
    vanToast('加载作品失败，请重试');
  } finally {
    isLoading.value = false;
  }
};

// 监听页码变化，统一触发加载，避免多处手动调用
watch(currentPage, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    fetchWorks();
  }
});

// 上一页/下一页控制
const goPrevPage = () => {
  if (currentPage.value > 1) currentPage.value -= 1;
};
const goNextPage = () => {
  // 只有本页数据满 pageSize 才能翻到下一页
  if (works.value.length >= pageSize.value) currentPage.value += 1;
};

// 导航到作品详情
const navigateToWorkDetail = (workId) => {
  router.push(`/works/${workId}`);
};

// 返回上一页
const handleBack = () => {
  router.back();
};
</script>

<style scoped>
::v-deep .van-nav-bar {
  background: #faf8f3;
  box-shadow: none;
}
::v-deep .van-nav-bar__title,
::v-deep .van-nav-bar__left .van-icon {
  color: #54494B; 
}
.tag-works-page {
  background-color: #faf8f3;
  min-height: 100vh;
  padding-bottom: 20px;
}

/* 分类标签样式（复用CreateWork的设计） */
.category-tabs {
  display: flex;
  flex-wrap: nowrap;
  align-items: flex-start; /* 让箭头与首行按钮顶部对齐 */
  gap: 0.5rem;
  padding: 0.5rem 0.4rem;
  background-color: #faf8f3;
  border-bottom: 1px solid rgba(212,165,165,0.18);
}

.category-tab {
  padding: 0.36rem 0.8rem; /* 适当缩小按钮高度 */
  border-radius: 10px;
  border: 1px solid transparent;
  background: #efefef;
  cursor: pointer;
  color: #6b6b6b;
  font-size: 0.9rem; /* 略微缩小字号以便与箭头对齐 */
  min-width: 60px;
  text-align: center;
  transition: all 0.18s ease;
}

.category-tab.active {
  background: #fff;
  color: #2c1810;
  border-color: rgba(212,165,165,0.18);
  font-weight: 700;
}

/* 下拉箭头按钮 */
.toggle-arrow {
  margin-left: auto;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid rgba(212,165,165,0.35);
  background: #efefef;
  color: #6b6b6b;
  cursor: pointer;
  align-self: flex-start; /* 保持与首行按钮同一水平线 */
  flex-shrink: 0; 
 }

.toggle-arrow:hover {
  background: #fff;
  color: #2c1810;
}

.toggle-arrow svg {
  transform: rotate(0deg); 
  transition: transform 0.2s ease;
}

.toggle-arrow.open svg {
  transform: rotate(180deg); 
}

/* 标签列表区域 */
.tags-section {
  max-width: 960px;
  background: #fff;
  border: 1px solid rgba(212,165,165,0.35);
  border-radius: 12px;
  padding: 1rem;
}

.tags-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 0.5rem;
}

.tag-btn {
  padding: 0.6rem 0.8rem;
  border-radius: 999px;
  border: 1px solid rgba(212,165,165,0.35);
  background: #fff;
  color: #2c1810;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.92rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tag-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0,0,0,0.08);
}

.tag-btn.selected {
  background: #d4a5a5;
  color: #fff;
  border-color: #d4a574;
}

/* 作品列表区域 */
.works-section {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 1.4rem;
}

.loading-indicator {
  padding: 2rem 0;
  text-align: center;
}

.empty-state {
  padding: 2rem 0;
}

.works-grid {
  display: grid;
  grid-template-columns: 1fr; /* 一行一个作品 */
  gap: 0.9rem; /* 整体间距略缩小 */
  margin-top: 1rem;
}

.work-card {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  cursor: pointer;
  transition: transform 0.2s ease;
  transform: scale(0.95); /* 整体缩小一点 */
  transform-origin: center;
}

.work-card:hover {
  transform: scale(0.96) translateY(-2px); /* 悬停时稍微放大并上移，保持轻盈感 */
}

.cover-container {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9; /* 横向封面比例 */
  overflow: hidden;
}

.work-cover {
  width: 100%;
  height: 100%;
  object-fit: cover; /* 确保封面完整显示 */
  /* 让图片本身从上到下逐渐透明淡出（兼容 WebKit） */
  -webkit-mask-image: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 1) 0%,    /* 顶部完全显示 */
    rgba(0, 0, 0, 1) 20%,   /* 上20%保持显示 */
    rgba(0, 0, 0, 0.4) 60%, /* 中间开始淡出 */
    rgba(0, 0, 0, 0) 100%   /* 底部完全透明 */
  );
  mask-image: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 1) 0%,
    rgba(0, 0, 0, 1) 20%,
    rgba(0, 0, 0, 0.4) 60%,
    rgba(0, 0, 0, 0) 100%
  );
}

/* 单独的渐变遮罩层，只负责图片的透明度渐变 */
.gradient-mask {
  position: absolute;
  inset: 0; /* 覆盖整个封面 */
  /* 从上到下：顶部完全透明（图片清晰），底部完全变暗（透明度降低） */
  /* 如果只需要淡出效果，遮罩层可以移除或保持透明 */
  background: transparent;
  z-index: 1; /* 保持层级，但不再影响视觉 */
}

/* 文字内容层，放在遮罩上方 */
.text-content {
  position: absolute;
  inset: 0;
  padding: 1.2rem;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  justify-content: flex-end; /* 文字靠下 */
  z-index: 2; /* 文字在遮罩上方，确保可见 */
  /* 在文字区域底部增加轻微的暗化，提高对比度 */
  background: linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 35%, rgba(0,0,0,0) 70%);
}

/* 标题和描述样式优化 */
.work-title {
  font-size: 1.4rem;
  font-weight: 800;
  letter-spacing: 0.2px;
  margin: 0 0 0.6rem 0;
  color: #ffffff;
  text-shadow: 0 3px 8px rgba(0,0,0,0.65); /* 增强文字清晰度 */
}

.work-description {
  font-size: 1rem;
  line-height: 1.5;
  margin: 0 0 1rem 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: #f2f2f2;
  text-shadow: 0 2px 6px rgba(0,0,0,0.6);
}

.work-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255,255,255,0.2);
}

.author {
  color: #ffdd77; /* 调亮作者颜色，增强对比 */
}

.price {
  font-weight: 500;
  color: #ffd700; /* 价格用金色突出 */
}

.pagination {
  margin-top: 2rem;
  text-align: center;
}

.pager-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 10px;
}

.pager-btn {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid rgba(212,165,165,0.35);
  background: #fff;
  color: #2c1810;
  cursor: pointer;
  transition: all 0.18s ease;
}
.pager-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.pager-btn:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.pager-info {
  color: #6b6b6b;
  font-size: 0.92rem;
}
</style>