<template>
  <div class="staff-page">
    <van-nav-bar title="举报管理" left-arrow @click-left="handleBack" />

    <div class="report-list">
      <div
        class="report-item"
        v-for="r in reports"
        :key="r.id"
      >
        <div class="report-main">
          <div class="report-title">{{ r.title }}</div>
          <div class="report-meta">ID: {{ r.id }} · {{ formatDate(r.created_at) }}</div>
        </div>
        <div class="report-body">
          <div class="report-reason">原因：{{ r.reason }}</div>
          <div class="report-status">状态：<span :class="['status', r.status === '已处理' ? 'done' : 'pending']">{{ r.status }}</span></div>
        </div>
        <div class="report-actions">
          <button class="btn btn-handle" @click="markHandled(r)">标为已处理</button>
          <button class="btn btn-view" @click="viewDetail(r)">查看详情</button>
        </div>
      </div>

      <div v-if="reports.length === 0" class="empty">当前暂无举报</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'

const router = useRouter()

// 示例数据（页面为静态前端页面，后端对接后可替换为实际请求）
const reports = ref([
  { id: 101, title: '涉嫌抄袭内容', reason: '全文大量雷同，疑似抄袭', status: '待处理', created_at: '2025-12-01T10:12:00Z' },
  { id: 102, title: '色情低俗', reason: '包含不适宜内容', status: '待处理', created_at: '2025-12-02T14:30:00Z' },
  { id: 103, title: '违规广告', reason: '恶意插入广告', status: '已处理', created_at: '2025-11-28T09:00:00Z' }
])

const handleBack = () => {
  router.back()
}

const formatDate = (iso) => {
  try {
    const d = new Date(iso)
    return d.toLocaleString()
  } catch (e) {
    return iso || '未知时间'
  }
}

const markHandled = (r) => {
  if (!r) return
  r.status = '已处理'
  showToast('已标记为已处理')
}

const viewDetail = (r) => {
  // 页面目前为前端静态模板；如果需要可跳转到具体路由。
  showToast(`查看举报 ${r.id}`)
}
</script>

<style scoped>
.staff-page { min-height:100vh; background:#f5f5f5; }
.report-list { padding:16px }
.report-item { background:#fff; border-radius:12px; padding:12px; margin-bottom:12px; box-shadow:0 2px 8px rgba(0,0,0,0.04); }
.report-main { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px }
.report-title { font-weight:600; font-size:16px; color:#333 }
.report-meta { font-size:12px; color:#999 }
.report-body { display:flex; gap:12px; align-items:center; flex-wrap:wrap }
.report-reason { color:#666; font-size:13px }
.report-status { color:#666; font-size:13px }
.status { padding:2px 8px; border-radius:12px; font-size:12px }
.status.pending { background:#fff3cd; color:#856404 }
.status.done { background:#d4edda; color:#155724 }
.report-actions { margin-top:10px; display:flex; gap:8px }
.btn { padding:6px 10px; border-radius:8px; border:none; cursor:pointer }
.btn-handle { background:linear-gradient(135deg,#d4a5a5 0%,#b88484 100%); color:#fff }
.btn-view { background:#fff; border:1px solid #e6e6e6; color:#333 }
.empty { padding:20px; color:#999; text-align:center }
</style>
