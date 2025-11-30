<script setup>
import { ref, computed, onMounted, onBeforeUnmount, onActivated } from 'vue'
import { ScreenOrientation } from '@capacitor/screen-orientation'
import { useRouter } from 'vue-router'
import { useUserStore } from '../store'
import { showToast } from 'vant'
import * as createWorkService from '../service/createWork.js'
import http from '../utils/http.js'

// 在本地测试时可开启 create mock（当后端不可用时）
// 关闭 mock 以便直接调用后端进行集成测试
const USE_MOCK_CREATE = false
// 本地可替换的函数引用
let createWorkOnBackend = createWorkService.createWorkOnBackend
// 临时开关：若为 true，则点击「一键生成」不会发送任何后端请求，直接在前端模拟生成流程（用于本地动画/交互测试）
const SKIP_BACKEND_CREATE = false

const router = useRouter()
const userStore = useUserStore()

// 分组的标签候选（支持折叠显示）
const tagGroups = ref([])
const isLoadingTags = ref(false);
const tagsError = ref('');

// 标签分类相关状态
const categories = ref([
  { name: '类型', range: [0, 15] },    // 类型标签：0-15
  { name: '风格', range: [16, 48] },   // 风格标签：16-48
  { name: '世界观', range: [49, 63] }, // 世界观标签：49-63
  { name: '题材', range: [64, 88] }    // 题材标签：64-88
]);
const currentCategory = ref(0); // 当前选中的分类索引，默认选中"类型"

const selectedTags = ref([])
const idea = ref('') // 用户构思（可选）
const lengthType = ref('') // 必选：大概篇幅

const lengthOptions = [
  { value: 'short', label: '短篇（约3-5章）' },
  { value: 'medium', label: '中篇（约6-10章）' },
  { value: 'long', label: '长篇（10章以上）' }
]

// 选择身份：阅读者（默认）或创作者
const identity = ref('reader') // 'reader' | 'creator'

// 折叠状态：默认折叠以节省空间（用户可展开）
const collapsed = ref([])
onMounted( async () => {
  await fetchAllTags();
  // 尝试锁定竖屏（Capacitor plugin / 浏览器 API）
  try {
    // Capacitor 插件优先
    ScreenOrientation.lock({ type: 'portrait' }).catch(() => {})
  } catch (e) {
    try {
      if (screen && screen.orientation && screen.orientation.lock) screen.orientation.lock('portrait').catch(() => {})
    } catch (e) {}
  }
})

// 按页数获取标签
const fetchTagsPage = async (page = 1) => {
  try {
    const response = await http.get('/api/tags/', {
      params: { page } 
    });
    return {
      results: response.data?.results || [], // 当前页标签
      totalPages: Math.ceil((response.data?.count || 0) / 10) 
    };
  } catch (error) {
  //console.error(`获取第${page}页标签失败:`, error);
    throw error; // 抛出错误让外层处理
  }
};

// 获取所有标签
const fetchAllTags = async () => {
  isLoadingTags.value = true;
  tagsError.value = '';
  tagGroups.value = []; // 清空现有数据

  try {
    // 先请求第1页，获取总页数
    const firstPage = await fetchTagsPage(1);
    tagGroups.value.push(...firstPage.results); // 合并第1页数据

    // 如果总页数大于1，循环请求剩余页数
    if (firstPage.totalPages > 1) {
      // 从第2页循环到最后一页
      for (let page = 2; page <= firstPage.totalPages; page++) {
        const currentPage = await fetchTagsPage(page);
        tagGroups.value.push(...currentPage.results); // 合并当前页数据
      }
    }

  //console.log('全部标签加载完成，共', tagGroups.value.length, '条');
  } catch (error) {
    tagsError.value = '加载标签失败，请重试';
    showToast(tagsError.value);
  } finally {
    isLoadingTags.value = false;
  }
};

// 筛选当前分类的标签
const filteredTags = computed(() => {
  const { range } = categories.value[currentCategory.value];
  const [min, max] = range;
  // 筛选出id在[min, max]范围内的标签
  return tagGroups.value.filter(tag => tag.id >= min && tag.id <= max);
});

// 切换分类
const switchCategory = (index) => {
  currentCategory.value = index;
  window.scrollTo(0, 0); // 切换时滚动到顶部
};


onBeforeUnmount(() => {
  try { ScreenOrientation.unlock && ScreenOrientation.unlock().catch(() => {}) } catch (e) {}
  try { if (screen && screen.orientation && screen.orientation.unlock) screen.orientation.unlock().catch(() => {}) } catch (e) {}
  try { if (resumeTimer) { clearInterval(resumeTimer); resumeTimer = null } } catch (e) {}
  try { if (pollTimer) { clearInterval(pollTimer); pollTimer = null } } catch (e) {}
})

const toggleGroup = (idx) => {
  collapsed.value[idx] = !collapsed.value[idx]
}

const toggleTag = (tag) => {
  const i = selectedTags.value.indexOf(tag)
  if (i >= 0) {
    selectedTags.value.splice(i, 1)
  } else {
    if (selectedTags.value.length >= 6) return // 最多6个
    selectedTags.value.push(tag)
  }
}

const canCreate = computed(() => {
  const c = selectedTags.value.length
  return c >= 3 && c <= 6 && !!lengthType.value
})

// 创建流程
const isLoading = ref(false)
const progress = ref(0)
const backendWork = ref(null)
// 持久化创建任务（用于跨页面保留加载状态）
const CREATION_JOB_KEY = 'creationJob'
let resumeTimer = null
let pollTimer = null

// 提交到后端生成作品（使用 service）
const submitToBackend = async () => {
  // 检查用户是否已登录
  if (!userStore.isAuthenticated) {
    showToast('请先登录后再创建作品')
    // 可以跳转到登录页面
    router.push('/login')
    return
  }
  
  const payload = {
    tags: selectedTags.value,
    idea: idea.value?.trim() || '',
    length: lengthType.value,
    // 严格遵循 UI 选择：只有当用户选择为创作者时才传 modifiable=true
    modifiable: identity.value === 'creator'
  }
  try {
    const res = await createWorkOnBackend(payload)

    // 新接口约定：createWorkOnBackend 在完成后应该返回 { gameworkId, backendWork }
    if (res && res.backendWork) {
      backendWork.value = res.backendWork
    } else if (res && res.gameworkId) {
      // 若实现上出现差异但仍返回 id，则尝试直接拉取详情（兼容性降级）
      try {
        const { http } = await import('../service/http.js')
        const details = await http.get(`/api/gameworks/gameworks/${res.gameworkId}/`)
        backendWork.value = details?.data || details || null
      } catch (e) {
        console.warn('Failed to fetch created work details:', e)
        throw e
      }
    } else {
      throw new Error('createWork returned unexpected format: missing backendWork')
    }

    // 缓存封面/标题/标签，供加载页与介绍页使用
    if (backendWork.value) {
      try {
        sessionStorage.setItem('lastWorkMeta', JSON.stringify({
          title: backendWork.value.title || 'AI 生成作品',
          coverUrl: backendWork.value.coverUrl || '',
          tags: selectedTags.value
        }))
      } catch {}
    }
    // 将后端返回的关键生成结果保存到 createResult，便于作品介绍页和游戏页使用
    try {
      const createResult = {
        selectedTags: selectedTags.value,
        fromCreate: true,
        backendWork: backendWork.value || null,
        // 若后端返回大纲（backendWork.outlines 或 res.chapterOutlines），则使用它；否则不写入 chapterOutlines
        chapterOutlines: (backendWork.value && backendWork.value.outlines) || res?.chapterOutlines || null,
        modifiable: payload.modifiable || false
      }

      // 严格遵循后端：不再合成本地 mock 大纲，createResult.chapterOutlines 只来自后端
      sessionStorage.setItem('createResult', JSON.stringify(createResult))
      return createResult
    } catch (e) {
      /* ignore storage errors */
      return { backendWork: backendWork.value || null }
    }
  } catch (e) {
    console.warn('create-work service 调用失败（将使用本地流程）:', e?.message || e)
    throw e
  }
}

const startCreate = async () => {
  if (!canCreate.value) return
  // 如果已经有完成的创建任务，直接跳转到已生成的作品（避免重复请求）
  // 始终尝试发起新的生成请求（即使之前存在已完成的 creationJob），
  // 避免点击时自动跳转到之前生成的作品。我们要保证点击「一键生成」即刻向后端发起生成。
  // 记录本次用户请求，便于后端读取或下页使用
  try {
    sessionStorage.setItem('createRequest', JSON.stringify({
      tags: selectedTags.value,
      idea: idea.value?.trim() || '',
      length: lengthType.value
    }))
  } catch {}

  // 不在这里提前写入本地 pending job（避免在返回时触发本地模拟并误结束加载）。

  // 如果启用跳过后端模式，则在前端模拟一个生成流程（不调用任何后端接口）
  if (SKIP_BACKEND_CREATE) {
    // 在 sessionStorage 中记录 creationJob，方便跨页面恢复
    const job = {
      id: `local-${Date.now()}`,
      status: 'pending',
      progress: 0,
      createdAt: Date.now(),
      backendWork: null
    }
    try { sessionStorage.setItem(CREATION_JOB_KEY, JSON.stringify(job)) } catch (e) {}
    startResumeSimulation(job)
    return
  }

  // 如果启用了 mock，则按需动态加载 mock 实现以覆盖 createWorkOnBackend
  if (USE_MOCK_CREATE) {
    try {
      const mock = await import('../service/createWork.mock.js')
      createWorkOnBackend = mock.createWorkOnBackend || createWorkOnBackend
    } catch (e) {
      console.warn('加载 createWork.mock.js 失败，继续使用真实 service：', e)
    }
  }

  // 显示创建加载流程，直到后端完全生成首章并返回；在 submitToBackend 完成并写入 createResult 后再跳转
  isLoading.value = true
  progress.value = 0
  // 启动一个进度计时器，在等待后端返回时平滑推进到 75~85% 区间
  let progressTimer = null
  const startFakeProgress = () => {
    if (progressTimer) return
    progressTimer = setInterval(() => {
      // 逐步推进，越接近 80% 增幅越小
      const target = 80
      const delta = Math.max(0.2, (target - progress.value) * 0.06)
      progress.value = Math.min(target, +(progress.value + delta).toFixed(2))
    }, 250)
  }
  const stopFakeProgress = () => {
    if (progressTimer) {
      clearInterval(progressTimer)
      progressTimer = null
    }
  }

  try {
    startFakeProgress()
    const result = await submitToBackend()
    // submitToBackend 成功后，把 creationJob 标记为 done 并写回（兼容恢复逻辑）
    try {
      const finished = JSON.parse(sessionStorage.getItem(CREATION_JOB_KEY) || '{}')
      finished.status = 'done'
      finished.progress = 100
      finished.backendWork = backendWork.value || null
      finished.finishedAt = Date.now()
      sessionStorage.setItem(CREATION_JOB_KEY, JSON.stringify(finished))
    } catch (e) { console.warn('update finished creationJob failed', e) }
    // 服务返回后，把进度推进到 100%
    stopFakeProgress()
    progress.value = 100
    // 给用户一个短暂的完成感（200-400ms）再跳转到作品介绍页
    await new Promise(r => setTimeout(r, 300))
    // 跳转到作品介绍页，让用户查看作品详情并决定是否开始游戏
    router.push('/works')
  } catch (e) {
    // 发生错误：停止假的进度条，但保持页面处于 loading 状态，
    // 不再自动跳转到作品页。用户可以稍后重试或刷新页面以继续生成。
    stopFakeProgress()
    console.error('submitToBackend failed:', e)
    // 标记 creationJob 为 pending/failed 保留在 sessionStorage 中，方便用户返回继续
    try {
      const cur = JSON.parse(sessionStorage.getItem(CREATION_JOB_KEY) || '{}')
      cur.status = cur.status || 'pending'
      cur.progress = progress.value || 0
      cur.error = (e && e.message) ? e.message : String(e)
      sessionStorage.setItem(CREATION_JOB_KEY, JSON.stringify(cur))
    } catch (ee) { console.warn('update creationJob on failure failed', ee) }
    // 保持 isLoading=true，这样创建页一直显示加载覆盖层，符合需求
    return
  } finally {
    // 成功路径会跳转页面并在路由变化中卸载本组件；失败路径会在上面 return 保持 isLoading。
    // 这里不再在 finally 中清理 isLoading，以保证在失败时保持加载覆盖层。
  }
}

// 恢复/检查 sessionStorage 中的 creationJob（用于挂载与激活时）
const restoreCreationJob = () => {
  try {
    const existing = JSON.parse(sessionStorage.getItem(CREATION_JOB_KEY) || 'null')
    if (existing && (existing.status === 'pending' || existing.status === 'in-progress')) {
      // 仅在本地模拟或明确要求跳过后端时使用本地模拟
      const isLocalJob = existing.id && String(existing.id).startsWith('local-')
      if (SKIP_BACKEND_CREATE || USE_MOCK_CREATE || isLocalJob) {
        startResumeSimulation(existing)
      } else {
        // 对于真实的后端生成任务，启动轮询 sessionStorage.createResult 或后端接口，
        // 保持创建页的加载覆盖层直到后端写入 createResult.backendWork
        try {
          isLoading.value = true
          // 清理可能存在的旧定时器
          if (pollTimer) clearInterval(pollTimer)
          pollTimer = setInterval(() => {
            try {
              const crRaw = sessionStorage.getItem('createResult')
              if (!crRaw) return
              const cr = JSON.parse(crRaw)
              if (cr && cr.backendWork) {
                backendWork.value = cr.backendWork
                // mark creationJob as done
                try {
                  const finished = JSON.parse(sessionStorage.getItem(CREATION_JOB_KEY) || '{}')
                  finished.status = 'done'
                  finished.progress = 100
                  finished.backendWork = backendWork.value
                  finished.finishedAt = Date.now()
                  sessionStorage.setItem(CREATION_JOB_KEY, JSON.stringify(finished))
                } catch (e) {}
                clearInterval(pollTimer)
                pollTimer = null
                // stop loading and navigate
                isLoading.value = false
                progress.value = 100
                // short delay for UX
                setTimeout(() => {
                  router.push('/works')
                }, 250)
              }
            } catch (e) { /* ignore parse errors */ }
          }, 2000)
        } catch (e) { /* ignore */ }
      }
    }
  } catch (e) {}
}

// 在挂载与激活时尝试恢复，以兼容 keep-alive 场景
onMounted(() => { try { restoreCreationJob() } catch (e) {} })
onActivated(() => { try { restoreCreationJob() } catch (e) {} })

// 底部导航
const activeTab = ref('create');

// GIF 加载状态：若项目中存在 `frontend/public/images/create_loading.gif`，会优先展示该动图
const loadingGifLoaded = ref(false)
const onGifLoad = () => { loadingGifLoaded.value = true }
const onGifError = () => { loadingGifLoaded.value = false }

// 恢复/模拟创建任务的逻辑
const startResumeSimulation = (job) => {
  // 写入本地状态
  try { sessionStorage.setItem(CREATION_JOB_KEY, JSON.stringify(job)) } catch (e) {}
  isLoading.value = true
  progress.value = job.progress || 0
  // 清理旧定时器
  if (resumeTimer) clearInterval(resumeTimer)
  resumeTimer = setInterval(() => {
    const target = 100
    const delta = Math.max(0.5, (target - progress.value) * 0.06)
    progress.value = Math.min(target, +(progress.value + delta).toFixed(2))
    // 同步写回 job
    try {
      const cur = JSON.parse(sessionStorage.getItem(CREATION_JOB_KEY) || '{}')
      cur.progress = progress.value
      sessionStorage.setItem(CREATION_JOB_KEY, JSON.stringify(cur))
    } catch (e) {}
    if (progress.value >= 100) {
      clearInterval(resumeTimer)
      resumeTimer = null
      // 生成 fake backendWork 并写回 job
      const fakeBackendWork = {
        id: Date.now(),
        title: idea.value?.trim() || 'AI 生成作品',
        coverUrl: '/images/placeholder_cover.png',
        tags: selectedTags.value,
        favorite_count: 0,
        is_favorited: false,
        average_score: 0,
        rating_count: 0,
        word_count: null
      }
      try {
        const finished = JSON.parse(sessionStorage.getItem(CREATION_JOB_KEY) || '{}')
        finished.status = 'done'
        finished.progress = 100
        finished.backendWork = fakeBackendWork
        finished.finishedAt = Date.now()
        sessionStorage.setItem(CREATION_JOB_KEY, JSON.stringify(finished))
        // Also write createResult for compatibility
        const createResult = {
          selectedTags: selectedTags.value,
          fromCreate: true,
          backendWork: fakeBackendWork,
          chapterOutlines: null,
          modifiable: identity.value === 'creator'
        }
        try { sessionStorage.setItem('createResult', JSON.stringify(createResult)) } catch (e) {}
      } catch (e) { console.warn('write finished job failed', e) }
      // 给用户短暂完成感，但保持 isLoading true until navigation or explicit clear
      setTimeout(() => {
        isLoading.value = false
        progress.value = 0
      }, 300)
    }
  }, 250)
}

// 页面加载时检查是否已有正在进行或已完成的 creationJob
try {
  const existing = JSON.parse(sessionStorage.getItem(CREATION_JOB_KEY) || 'null')
  if (existing && existing.status === 'pending') {
    // 恢复进度并继续模拟
    startResumeSimulation(existing)
  }
} catch (e) {}

// 处理底部导航切换
const handleTabChange = (name) => {
  switch(name) {
    case 'bookstore':
      router.push('/');
      break;
    case 'create':
      // 已经在创建页面，不需要跳转
      break;
    case 'bookshelf':
      router.push('/bookshelf');
      break;
    case 'profile':
      router.push('/profile');
      break;
  }
};
</script>

<template>
  <div class="create-page">
    <div class="header section">
      <h1>创建你的作品</h1>
      <p class="hint">请选择 3-6 个标签，并选择大概的篇幅；也可以填写你的构思哦~</p>
    </div>

    <div class="section">
      <div class="section-title">选择身份</div>
      <div style="display:flex; gap:1rem; margin:0.5rem 0 1rem;">
        <label style="display:flex; align-items:center; gap:0.5rem;">
          <input type="radio" name="identity" value="reader" v-model="identity" /> 阅读者（默认）
        </label>
        <label style="display:flex; align-items:center; gap:0.5rem;">
          <input type="radio" name="identity" value="creator" v-model="identity" /> 创作者（获得章节大纲，可编辑并发起生成）
        </label>
      </div>

      <div class="section-title">选择标签（3-6 个）</div>
      <!-- 横向四个分类按钮 -->
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
      </div>

      <!-- 当前分类的标签，分页展示 -->
      <div class="tags-grid all-tags">
        <button
          v-for="tag in filteredTags"
          :key="tag.id"
          class="tag-btn small"
          :class="{ selected: selectedTags.includes(tag), disabled: !selectedTags.includes(tag) && selectedTags.length >= 6 }"
          @click="toggleTag(tag)"
        >
          <span class="check" v-if="selectedTags.includes(tag)">✓</span>{{ tag.name }}
        </button>
      </div>

      <div class="counter" :class="{ invalid: selectedTags.length < 3 || selectedTags.length > 6 }">
        已选 {{ selectedTags.length }} / 6
      </div>
    </div>

    <div class="section">
      <div class="section-title">大概篇幅（必选）</div>
      <div class="length-options">
        <label v-for="opt in lengthOptions" :key="opt.value" class="length-item">
          <input type="radio" name="length" :value="opt.value" v-model="lengthType" />
          <span>{{ opt.label }}</span>
        </label>
      </div>
    </div>

    <div class="section idea-section">
      <div class="section-title">你的构思</div>
      <div class="idea-wrap">
        <div class="idea-frame">
          <textarea class="idea-input" v-model="idea" rows="4" placeholder="概述你的灵感或者想看的作者文风吧~"></textarea>
        </div>
      </div>
      <div class="idea-actions">
        <button class="create-btn create-btn-small" :disabled="!canCreate || isLoading" @click="startCreate">一键生成</button>
      </div>
    </div>

    <!-- 加载覆盖层 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-card">
          <div class="loading-title">正在生成你的专属作品...</div>

          <!-- 优先展示项目静态资源 /images/create_loading.gif -->
          <img
            src="/images/create_loading.gif"
            alt="loading"
            class="loading-gif"
            @load="onGifLoad"
            @error="onGifError"
          />

          <!-- 不显示进度条，优先展示 GIF（若 GIF 不存在或加载失败则只显示标题） -->
        </div>
    </div>

    

    <!-- 底部导航栏 -->
    <van-tabbar v-model="activeTab" @change="handleTabChange" safe-area-inset-bottom>
      <van-tabbar-item icon="home-o" name="bookstore">书城</van-tabbar-item>
      <van-tabbar-item icon="edit" name="create">创作</van-tabbar-item>
      <van-tabbar-item icon="bookmark-o" name="bookshelf">书架</van-tabbar-item>
      <van-tabbar-item icon="user-o" name="profile">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<style scoped>
.create-page { min-height: 100vh; background: #faf8f3; padding: 2rem 1rem 80px; }
.header { max-width: 960px; margin: -36px auto 1rem; }
.header { max-width: 960px; margin: 0 auto 1rem; }
.header h1 { color:#2c1810; margin:0 0 0.25rem; }
.hint { color:#8B7355; margin:0; }

.section { max-width: 960px; margin: 1rem auto; background:#fff; border:1px solid rgba(212,165,165,0.35); border-radius:12px; padding:1rem; }
.section-title { color:#d4a5a5; font-weight:700; margin-bottom:0.5rem; }

.tags-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap:0.5rem; }
.tag-groups { display:flex; flex-direction:column; gap:0.75rem; }
.tag-group { background: transparent; border-radius:8px; }
.group-header { display:flex; justify-content:space-between; align-items:center; padding:0.45rem 0.6rem; cursor:pointer; border-bottom:1px dashed rgba(212,165,165,0.12); }
.group-header .chev { color:#8B7355; }
.collapse-enter-active, .collapse-leave-active { transition: all 0.25s ease; }
.collapse-enter-from, .collapse-leave-to { max-height: 0; opacity: 0; transform: translateY(-6px); }
.collapse-enter-to, .collapse-leave-from { max-height: 1200px; opacity: 1; transform: translateY(0); }
.tag-btn { padding:0.6rem 0.8rem; border-radius:999px; border:1px solid rgba(212,165,165,0.35); background:#fff; color:#2c1810; cursor:pointer; transition: all .2s ease; }
.tag-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.08); }
.tag-btn.selected { background: #d4a5a5; color: #fff; border-color:#d4a574; }
.tag-btn.disabled { opacity: 0.5; cursor: not-allowed; }
.check { margin-right: 0.25rem; color:#8B7355; }
.counter { margin-top:0.5rem; color:#8B7355; font-size:0.9rem; }
.counter.invalid { color:#b85c5c; }

.length-options { display:flex; flex-wrap:wrap; gap:0.75rem; }
.length-item { display:flex; align-items:center; gap:0.4rem; color:#2c1810; }

.idea-input { width:100%; border-radius:8px; border:1px solid rgba(212,165,165,0.35); padding:0.6rem 0.75rem; font-size:0.95rem; outline:none; }
.idea-input:focus { border-color:#d4a5a5; box-shadow: 0 0 0 3px rgba(212,165,165,0.2); }

/* 横向分类标签（四个按钮） */
.category-tabs { display:flex; flex-wrap:wrap; gap:0.5rem; justify-content:flex-start; margin:0.5rem 0 1rem; }
.category-tab { padding:0.48rem 0.9rem; border-radius:10px; border:1px solid transparent; background:#efefef; cursor:pointer; color:#6b6b6b; font-size:0.96rem; min-width:80px; text-align:center; box-shadow: none; transition: all .18s ease; }
.category-tab.active { background: #fff; color:#2c1810; border-color: rgba(212,165,165,0.18); font-weight:700; box-shadow: none; }

/* 分页控件 */
.tag-pagination { display:flex; gap:0.4rem; align-items:center; justify-content:flex-start; margin-top:0.75rem; }
.tags-grid.all-tags { margin-top: 0.6rem; }
.page-btn, .page-num { padding:0.28rem 0.6rem; border-radius:6px; border:1px solid rgba(0,0,0,0.06); background:#fff; cursor:pointer; }
.page-num.active { background:#d4a5a5; color:#fff; border-color:transparent; }
.page-btn:disabled { opacity:0.5; cursor:not-allowed; }

/* 区分大类按钮与小标签样式 */
.tag-btn.small { padding:0.45rem 0.6rem; font-size:0.92rem; border-radius:10px; }
.tag-btn { transition: all .18s ease; }

/* 多层边框装饰：使用外层包裹和多重阴影/伪元素产生叠层效果 */
.idea-wrap { display:flex; justify-content:center; }
.idea-frame { position: relative; width:100%; max-width:960px; border-radius:12px; padding:10px; background: linear-gradient(180deg, #fff, #fff); }
.idea-frame::before,
.idea-frame::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 14px;
  pointer-events: none;
}
.idea-frame::before {
  /* 外层淡色边框 */
  box-shadow: 0 6px 18px rgba(0,0,0,0.06), 0 0 0 4px rgba(212,165,165,0.08);
  transform: translateY(4px);
  z-index: 0;
}
.idea-frame::after {
  /* 第二层边框/描边 */
  box-shadow: 0 0 0 2px rgba(212,165,165,0.14) inset, 0 0 0 8px rgba(245,230,211,0.25);
  z-index: 1;
}
.idea-frame .idea-input {
  position: relative;
  z-index: 2;
  background: transparent; /* 让外层颜色显现 */
  border-radius: 8px;
  padding: 12px 14px;
}

@media (max-width: 720px) {
  .idea-frame { padding: 8px; }
  .idea-input { padding: 10px 12px; }
  .header { margin: -18px auto 1rem; }
}

/* idea-section: 包含 textarea 与右下的小按钮 */
.idea-section { position: relative; }
.idea-wrap { position: relative; }
.idea-actions { display:flex; justify-content:flex-end; margin-top: 0.5rem; }
.create-btn-small { position: static; padding: 0.48rem 1rem; font-size: 0.92rem; border-radius: 8px; width: auto; min-width: 120px; max-width: 520px; text-align: center; }
.create-btn-small:disabled { filter: grayscale(8%); }

.actions { max-width:960px; margin: 1rem auto; display:flex; justify-content:flex-end; }
.actions-inline { max-width:960px; margin: 1rem auto; display:flex; justify-content:center; }
.create-btn { padding:0.5rem 1.2rem; border-radius:10px; border:1px solid rgba(212,165,165,0.5); background: linear-gradient(135deg, #d4a5a5 0%, #b88484 100%); color:#fff; font-weight:700; cursor:pointer; box-shadow:0 6px 18px rgba(0,0,0,0.12); }
.create-btn-full { width: 100%; max-width: 480px; padding: 0.44rem 0.9rem; font-size: 0.98rem; border-radius: 10px; }
.create-btn:disabled { opacity: 1; cursor:not-allowed; filter: grayscale(8%); }

/* 全屏加载覆盖层 */
.loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

/* loading-card 占满整个视口，展示为全屏等待页样式 */
.loading-card {
  width: 100vw;
  height: 100vh;
  max-width: none;
  max-height: none;
  background: #fff;
  border: none;
  border-radius: 0;
  padding: 2rem;
  box-shadow: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.loading-title { color:#2c1810; font-weight:700; margin-bottom:1rem; font-size:1.25rem; text-align:center; }
.progress-bg { width:100%; height:12px; background: rgba(0,0,0,0.08); border-radius: 999px; overflow:hidden; }
.progress-fill { height:100%; width:0%; background: linear-gradient(90deg, #d4a5a5, #f5e6d3); transition: width 0.2s ease; }
.progress-text { margin-top:0.5rem; color:#8B7355; font-weight:700; text-align:right; }

/* 加载动图样式 */
.loading-gif {
  display:block;
  margin: 1rem auto;
  width: 160px;
  height: auto;
  object-fit: contain;
}

@media (max-width: 720px) {
  .tags-grid { grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); }
  .create-btn-full { width: 100%; font-size: 1rem; padding: 0.8rem 1rem; }
  /* 小屏幕上让按钮恢复为普通流布局，避免遮挡文本 */
  .create-btn-small { display: block; width: 100%; margin-top: 0.75rem; }
}
/* 取消为固定底部按钮预留的底部空间 */
.create-page { padding-bottom: 16px; }
/* 保持原有样式结尾 */

/* 底部导航栏 */
.van-tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: #faf8f3;
  z-index: 10001; /* 保持 tabbar 在加载覆盖层之上，仍可切换页面 */
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
