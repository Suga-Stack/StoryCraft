<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// 分组的标签候选（支持折叠显示）
const tagGroups = [
  {
    title: '类型',
    tags: ['玄幻','奇幻','仙侠','武侠','科幻','都市','历史','军事','悬疑','灵异','惊悚','游戏','竞技','体育','言情','现实']
  },
  {
    title: '风格',
    tags: ['升级流','无敌流','重生','穿越','系统','无限流','种田','基建','末世','废土','爽文','轻松','搞笑','治愈','暗黑','虐心','烧脑','智斗','群像','日常','生活流','热血','争霸','权谋','扮猪吃虎','腹黑','忠犬','傲娇','病娇','萌宝','马甲','神豪','赘婿']
  },
  {
    title: '世界观',
    tags: ['现代','古代','异界','异世界','星际','未来','末世','废土','民国','原始社会','原始部落','洪荒','高武','西幻','克苏鲁','赛博朋克','蒸汽朋克']
  },
  {
    title: '题材',
    tags: ['男频','女频','甜宠','霸总','女强','女尊','宫斗','宅斗','职场','职场商战','校园','青春','耽美','百合','明星同人','二次元','轻小说','影视改编','出版小说','真人互动','多人视角','第一人称','第三人称','单元剧']
  }
]

const selectedTags = ref([])
const idea = ref('') // 用户构思（可选）
const lengthType = ref('') // 必选：大概篇幅

const lengthOptions = [
  { value: 'short', label: '短篇（约3-5章）' },
  { value: 'medium', label: '中篇（约6-10章）' },
  { value: 'long', label: '长篇（10章以上）' }
]

// 折叠状态：默认折叠以节省空间（用户可展开）
const collapsed = ref([])
onMounted(() => {
  collapsed.value = tagGroups.map(() => true)
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

// 提交到后端生成作品（容错：失败则继续本地流程）
const submitToBackend = async () => {
  try {
    const payload = {
      tags: selectedTags.value,
      idea: idea.value?.trim() || '',
      length: lengthType.value
    }
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), 8000)
    const res = await fetch('/api/create-work', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
    clearTimeout(id)
    if (res.ok) {
      const data = await res.json()
      backendWork.value = data?.work || null
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
    }
  } catch (e) {
    console.warn('create-work 后端调用失败（将使用本地流程）:', e?.message || e)
  }
}

const startCreate = async () => {
  if (!canCreate.value) return
  // 记录本次用户请求，便于后端读取或下页使用
  try {
    sessionStorage.setItem('createRequest', JSON.stringify({
      tags: selectedTags.value,
      idea: idea.value?.trim() || '',
      length: lengthType.value
    }))
  } catch {}

  // 同步调用后端创建（并行，不阻塞动画）
  submitToBackend()

  // 显示创建加载流程
  isLoading.value = true
  progress.value = 0
  const duration = 2500
  const startAt = performance.now()
  const animate = (now) => {
    const elapsed = now - startAt
    const percent = Math.min(100, Math.round((elapsed / duration) * 100))
    progress.value = percent
    if (percent >= 100) {
      // 跳转前把必要数据放入 sessionStorage，避免通过 history.state 传递复杂/不可克隆对象
      try {
        sessionStorage.setItem('createResult', JSON.stringify({
          selectedTags: selectedTags.value,
          fromCreate: true,
          backendWork: backendWork.value || null
        }))
      } catch (e) { /* ignore storage errors */ }
      router.push('/works')
    } else {
      requestAnimationFrame(animate)
    }
  }
  requestAnimationFrame(animate)
}
</script>

<template>
  <div class="create-page">
    <div class="header">
      <h1>创建你的作品偏好</h1>
        <p class="hint">请选择 3-6 个标签，并选择大概的篇幅；可选地填写你的构思。</p>
    </div>

    <div class="section">
  <div class="section-title">选择标签（3-6 个）</div>
      <div class="tag-groups">
        <div class="tag-group" v-for="(group, gi) in tagGroups" :key="group.title">
          <div class="group-header" @click="toggleGroup(gi)">
            <strong>{{ group.title }}</strong>
            <span class="chev">{{ collapsed[gi] ? '▸' : '▾' }}</span>
          </div>
          <transition name="collapse">
            <div v-show="!collapsed[gi]" class="tags-grid">
              <button
                v-for="tag in group.tags"
                :key="tag"
                class="tag-btn"
                :class="{ selected: selectedTags.includes(tag), disabled: !selectedTags.includes(tag) && selectedTags.length >= 6 }"
                @click="toggleTag(tag)"
              >
                <span class="check" v-if="selectedTags.includes(tag)">✓</span>{{ tag }}
              </button>
            </div>
          </transition>
        </div>
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

    <div class="section">
      <div class="section-title">你的构思（可选）</div>
      <textarea class="idea-input" v-model="idea" rows="4" placeholder="一句话概述/开头设定/人物关系等...（可留空）"></textarea>
    </div>

    <!-- 固定底部的大按钮 -->
    <div class="actions actions-fixed">
      <button class="create-btn create-btn-full" :disabled="!canCreate || isLoading" @click="startCreate">一键生成</button>
    </div>

    <!-- 加载覆盖层 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-card">
        <div class="loading-title">正在生成你的专属作品...</div>
        <div class="progress-bg">
          <div class="progress-fill" :style="{ width: progress + '%' }"></div>
        </div>
        <div class="progress-text">{{ progress }}%</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.create-page { min-height: 100vh; background: #faf8f3; padding: 2rem 1rem; }
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
.tag-btn.selected { background: #f5e6d3; border-color:#d4a574; }
.tag-btn.disabled { opacity: 0.5; cursor: not-allowed; }
.check { margin-right: 0.25rem; color:#8B7355; }
.counter { margin-top:0.5rem; color:#8B7355; font-size:0.9rem; }
.counter.invalid { color:#b85c5c; }

.length-options { display:flex; flex-wrap:wrap; gap:0.75rem; }
.length-item { display:flex; align-items:center; gap:0.4rem; color:#2c1810; }

.idea-input { width:100%; border-radius:8px; border:1px solid rgba(212,165,165,0.35); padding:0.6rem 0.75rem; font-size:0.95rem; outline:none; }
.idea-input:focus { border-color:#d4a5a5; box-shadow: 0 0 0 3px rgba(212,165,165,0.2); }

.actions { max-width:960px; margin: 1rem auto; display:flex; justify-content:flex-end; }
.actions-fixed { position: fixed; left: 0; right: 0; bottom: 0; padding: 0.4rem 0.5rem; background: linear-gradient(180deg, rgba(250,248,243,0.0), rgba(250,248,243,0.02)); box-shadow: 0 -6px 20px rgba(0,0,0,0.06); z-index: 12000; }
.create-btn { padding:0.8rem 1.4rem; border-radius:10px; border:1px solid rgba(212,165,165,0.5); background: linear-gradient(135deg, #d4a5a5 0%, #b88484 100%); color:#fff; font-weight:700; cursor:pointer; box-shadow:0 6px 18px rgba(0,0,0,0.12); }
.create-btn-full { width: 100%; padding: 1rem 1.2rem; font-size: 1.1rem; border-radius: 12px; }
.create-btn:disabled { opacity: 1; cursor:not-allowed; filter: grayscale(8%); }

.loading-overlay { position:fixed; inset:0; background: rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; z-index: 10000; }
.loading-card { width:min(92vw, 560px); background:#fff; border:1px solid rgba(212,165,165,0.35); border-radius:12px; padding:1rem; box-shadow: 0 8px 24px rgba(0,0,0,0.18); }
.loading-title { color:#2c1810; font-weight:700; margin-bottom:0.75rem; }
.progress-bg { width:100%; height:12px; background: rgba(0,0,0,0.08); border-radius: 999px; overflow:hidden; }
.progress-fill { height:100%; width:0%; background: linear-gradient(90deg, #d4a5a5, #f5e6d3); transition: width 0.2s ease; }
.progress-text { margin-top:0.5rem; color:#8B7355; font-weight:700; text-align:right; }

@media (max-width: 720px) {
  .tags-grid { grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); }
  .create-btn-full { font-size: 1rem; padding: 0.95rem 1rem; }
}
/* 给页面底部内容留出空间，避免被固定按钮遮挡 */
.create-page { padding-bottom: 64px; }
/* 保持原有样式结尾 */
</style>
