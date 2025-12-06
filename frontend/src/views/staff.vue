<template>
  <div class="staff-page">
    <van-nav-bar title="举报管理" left-arrow @click-left="handleBack" />

    <div class="report-list">
      <div
        class="report-item"
        v-for="r in reports"
        :key="r.id"
      >
        <button class="delete-x" :disabled="r._deleting || r.status !== '已处理'" @click.stop="deleteReport(r)">×</button>
        <div class="report-main">
          <div class="report-title">{{ r.title }}</div>
        </div>
        <div class="report-body">
          <div class="report-reason">
            <span class="label">原因：</span>
            <span class="report-tag">{{ r.reason }}</span>
          </div>
          <div class="report-status">状态：<span :class="['status', r.status === '已处理' ? 'done' : 'pending']">{{ r.status }}</span></div>
        </div>
        <div v-if="r.remark" class="report-remark">备注：{{ r.remark }}</div>
        <div class="report-actions">
          <div class="actions-left">
            <button
              class="btn btn-handle"
              :disabled="r._handling || r.status === '已处理'"
              :aria-disabled="r._handling || r.status === '已处理'"
              @click="markHandled(r)">
              {{ r.status === '已处理' ? '已处理' : (r._handling ? '处理中...' : '标为已处理') }}
            </button>
            <button class="btn btn-view" @click="viewDetail(r)">查看详情</button>
          </div>
          <div class="report-meta-inline">ID: {{ r.id }} · {{ formatDate(r.created_at) }}</div>
        </div>
      </div>

      <div v-if="reports.length === 0" class="empty">当前暂无举报</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import http from '../utils/http'

const router = useRouter()

// 报表数据由后端接口提供
const reports = ref([])

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

const markHandled = async (r) => {
  if (!r) return
  // 如果已经是已处理，直接返回
  if (r.status === '已处理') return

  // 标记处理中，避免重复点击
  r._handling = true
  try {
    // 优先判断是否为评论举报（raw.comment 存在或 resolved 原型）
    let res = null
    if (r.raw && (r.raw.comment || typeof r.raw.comment !== 'undefined')) {
      // 调用评论举报的 PATCH 接口
      res = await http.patch(`/api/users/reports/comments/${r.id}/`, { id: r.id })
    } else {
      // 对于非评论类型，尝试通用的标记接口（后端可能不同），先尝试 gametworks，再尝试通用 path
      try {
        res = await http.patch(`/api/users/reports/gameworks/${r.id}/`, { id: r.id })
      } catch (e) {
        try {
          res = await http.patch(`/api/users/reports/${r.id}/`, { id: r.id })
        } catch (e2) {
          // 最终回退为空，让后面根据 res 判定失败
          res = null
        }
      }
    }

    const ok = res && (res.status === 200 || (res.data && (res.data.code === 200 || res.data.success === true || res.data.is_resolved === true)))
    if (ok) {
      r.status = '已处理'
      showToast('已标记为已处理')
    } else {
      console.warn('markHandled unexpected response', res)
      showToast('标记失败，请稍后重试')
    }
  } catch (e) {
    console.error('markHandled failed', e)
    showToast('标记失败，请稍后重试')
  } finally {
    r._handling = false
  }
}

const viewDetail = (r) => {
  if (!r) return
  const raw = r.raw || {}
  let gwId = null
  // 后端可能返回 gamework 为数字 id，或为对象
  if (raw.gamework && (typeof raw.gamework === 'number' || typeof raw.gamework === 'string')) {
    gwId = raw.gamework
  } else if (raw.gamework && typeof raw.gamework === 'object') {
    gwId = raw.gamework.id || raw.gamework.gameworkId || raw.gamework.workId || null
  } else if (r.gamework && (typeof r.gamework === 'number' || typeof r.gamework === 'string')) {
    gwId = r.gamework
  }

  if (gwId) {
    // 尝试从 raw 中解析评论 id（后端会返回 comment: <id>）
    const rawCommentId = (raw.comment || raw.comment_id || raw.commentId || (r.comment || null))
    if (rawCommentId) {
      // 带上查询参数，作品页面可根据 query.comment 定位并高亮该评论
      router.push({ path: `/works/${gwId}`, query: { comment: String(rawCommentId) } })
    } else {
      router.push({ path: `/works/${gwId}` })
    }
  } else {
    showToast(`查看举报 ${r.id}`)
  }
}

const deleteReport = async (r) => {
  if (!r) return
  // 前端校验：未处理的举报不允许删除
  if (r.status !== '已处理') {
    showToast('未处理的举报不可删除，请先标为已处理')
    return
  }
  if (!confirm('确认删除该举报记录？此操作不可恢复。')) return
  // avoid double delete
  if (r._deleting) return
  r._deleting = true
  try {
    let res = null
    // 判断是否为评论举报
    if (r.raw && (r.raw.comment || typeof r.raw.comment !== 'undefined')) {
      res = await http.delete(`/api/users/reports/comments/${r.id}/`)
    } else {
      // 作品举报删除
      try {
        res = await http.delete(`/api/users/reports/gameworks/${r.id}/`)
      } catch (e) {
        // fallback to generic reports delete
        try { res = await http.delete(`/api/users/reports/${r.id}/`) } catch (e2) { res = null }
      }
    }

    const ok = res && (res.status === 204 || res.status === 200 || (res.data && (res.data.code === 200 || res.data.success === true)))
    if (ok) {
      // 从列表中移除
      const idx = reports.value.findIndex(x => x.id === r.id)
      if (idx !== -1) reports.value.splice(idx, 1)
      showToast('删除成功')
    } else {
      console.warn('deleteReport unexpected response', res)
      showToast('删除失败，请稍后重试')
    }
  } catch (e) {
    console.error('deleteReport failed', e)
    showToast('删除失败，请稍后重试')
  } finally {
    r._deleting = false
  }
}

// 拉取全部举报（评论与作品）
const fetchAllReports = async () => {
  try {
    const storedUser = JSON.parse(localStorage.getItem('userInfo') || '{}')
    const userId = storedUser.id
    if (!userId) {
      reports.value = []
      return
    }

    // 使用列表端点：评论列表使用通用端点，作品举报改为使用新的端点：GET /api/users/report/gamework/
    const urls = [
      `/api/users/reports/comments/`,
      `/api/users/report/gamework/`
    ]

    const all = []
    for (const u of urls) {
      try {
        const res = await http.get(u)
        const data = res?.data || res
        console.debug('fetchAllReports response for', u, data)
        let list = []
        if (Array.isArray(data.results)) list = data.results
        else if (Array.isArray(data)) list = data
        else if (data && Array.isArray(data.data)) list = data.data
        // 支持后端返回单个对象但其中包含 reports 数组的情况
        else if (data && Array.isArray(data.reports)) list = data.reports
        else if (data && typeof data === 'object' && data.id) list = [data]

        for (const item of list) {
          const fallbackTitle = item.target_title || item.work_title || item.title || (item.gamework && item.gamework.title)
          const gwTitleField = item.gamework_title || item.game_title || (item.gamework && (item.gamework.title || item.gamework.work_title))
          const commentContent = item.comment_content || item.comment_text || item.content || (item.raw && (item.raw.comment_content || item.raw.content))
          const isComment = !!(item.comment || commentContent || (item.raw && (item.raw.comment || item.raw.comment_id || item.raw.comment_content)))

          let resolvedTitle = fallbackTitle || null
          if (!resolvedTitle) {
            if (isComment) {
              const content = commentContent ? `${commentContent}` : (item.comment ? `#${item.comment}` : '')
              resolvedTitle = `评论：${content}`
            } else if (item.gamework) {
              resolvedTitle = `作品${gwTitleField ? ' ' + gwTitleField : ''}`
            } else {
              resolvedTitle = '未知'
            }
          }

          all.push({
            id: item.id,
            title: resolvedTitle,
            reason: item.tag || item.reason || item.type || item.detail || '—',
            remark: item.remark || '',
            status: item.is_resolved ? '已处理' : '待处理',
            created_at: item.created_at || item.created || item.timestamp ||  null,
            raw: item
          })
        }
      } catch (e) {
        console.warn('fetch reports failed', u, e)
      }
    }

    // 按时间排序
    all.sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0
      return tb - ta
    })

    reports.value = all
  } catch (err) {
    console.error('加载举报列表失败', err)
    showToast('加载举报列表失败')
  }
}

onMounted(() => {
  fetchAllReports()
})
</script>

<style scoped>
::v-deep .van-nav-bar {
  background: #faf8f3;
  box-shadow: none;
}
::v-deep .van-nav-bar__title,
::v-deep .van-nav-bar__left .van-icon {
  color: #444444 ; 
}
.staff-page { min-height:100vh; background:#faf8f3; }
.report-list { padding:16px }
.report-item { background:#fff; border-radius:12px; padding:16px; margin-bottom:14px; box-shadow:0 6px 20px rgba(0,0,0,0.06); position:relative; }
.report-main { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px }
.report-title { font-weight:600; font-size:16px; color:#333 }
.report-meta { font-size:12px; color:#999 }
.report-meta-inline { font-size:12px; color:#666 }
.report-actions { margin-top:10px; margin-bottom:14px; display:flex; gap:8px; justify-content:space-between; align-items:center }
.actions-left { display:flex; gap:8px; align-items:center }
.report-body { display:flex; gap:12px; align-items:center; flex-wrap:wrap }
.report-reason { color:#666; font-size:13px; display:flex; align-items:center; gap:8px }
.report-tag { background: linear-gradient(90deg,#ffe9e9,#fff4e6); color:#b33; padding:4px 8px; border-radius:12px; font-weight:700; font-size:13px }
.report-remark { margin-top:8px; color:#444; font-size:13px; background:#fff; padding:8px; border-radius:8px; box-shadow:0 1px 4px rgba(0,0,0,0.03) }
.report-status { color:#666; font-size:13px }
.status { padding:2px 8px; border-radius:12px; font-size:12px }
.status.pending { background:#fff3cd; color:#856404 }
.status.done { background:#d4edda; color:#155724 }
.report-actions { margin-top:10px; margin-bottom:34px; display:flex; gap:8px }
.btn { padding:6px 10px; border-radius:8px; border:none; cursor:pointer }
.btn-handle { background:linear-gradient(135deg,#d4a5a5 0%,#b88484 100%); color:#fff }
.btn-view { background:#fff; border:1px solid #e6e6e6; color:#333 }
.delete-x {
  position: absolute;
  right: 12px;
  top: 12px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(180deg,#ff6b6b,#e63946);
  color: #fff;
  font-size: 18px;
  line-height: 36px;
  display:flex;
  align-items:center;
  justify-content:center;
  box-shadow: 0 6px 18px rgba(230,50,70,0.18);
  cursor: pointer;
  transition: transform .12s ease, box-shadow .12s ease, opacity .12s ease;
}
.delete-x:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(230,50,70,0.22); }
.delete-x:active { transform: translateY(0); }
.delete-x:disabled { opacity: 0.5; cursor: not-allowed }
.empty { padding:20px; color:#999; text-align:center }
</style>
