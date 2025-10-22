<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { saveGameData, loadGameData, refreshSlotInfos, SLOTS } from '../utils/saveLoad.js'

const router = useRouter()
const route = useRoute()

// 从sessionStorage获取游戏数据（优先），然后才是路由state
const getGameDataFromSession = () => {
  try {
    const stored = sessionStorage.getItem('settlementData')
    if (stored) {
      const parsed = JSON.parse(stored)
      console.log('Loaded settlement data from sessionStorage:', parsed)
      return parsed
    }
  } catch (e) {
    console.warn('Failed to parse settlement data from sessionStorage:', e)
  }
  return null
}

const sessionData = getGameDataFromSession()

// 从多个来源获取游戏数据，优先级：sessionStorage > history.state > 默认值
const gameData = ref({
  work: sessionData?.work || history.state?.work || { title: '锦瑟深宫', id: 1 },
  choiceHistory: sessionData?.choiceHistory || history.state?.choiceHistory || [],
  finalAttributes: sessionData?.finalAttributes || history.state?.finalAttributes || {},
  finalStatuses: sessionData?.finalStatuses || history.state?.finalStatuses || {},
  storyScenes: sessionData?.storyScenes || history.state?.storyScenes || [],
  currentSceneIndex: sessionData?.currentSceneIndex || history.state?.currentSceneIndex || 0,
  currentDialogueIndex: sessionData?.currentDialogueIndex || history.state?.currentDialogueIndex || 0
})

// 如果没有传递真实的属性数据，才使用默认值（用于调试）
if (Object.keys(gameData.value.finalAttributes).length === 0) {
  console.warn('No finalAttributes passed, using default values for debugging')
  gameData.value.finalAttributes = {
    '心计': 30,
    '才情': 60,
    '声望': 10,
    '圣宠': 0,
    '健康': 100
  }
}

if (Object.keys(gameData.value.finalStatuses).length === 0) {
  console.warn('No finalStatuses passed, using default values for debugging')
  gameData.value.finalStatuses = {
    '姓名': '林微月',
    '位份': '从七品选侍',
    '年龄': 16,
    '阵营': '无',
    '明眸善睐': '眼波流转间易获好感',
    '暗香盈袖': '体带天然冷梅香'
  }
}

console.log('SettlementPage - Final Game Data:', gameData.value) // 调试日志

// UI 状态
const showAttributesModal = ref(false)
const showSaveModal = ref(false) 
const showLoadModal = ref(false)
const currentView = ref('overview') // overview, branching, personality

// 存档/读档相关状态
const slotInfos = ref({ slot1: null, slot2: null, slot3: null, slot4: null, slot5: null, slot6: null })
const saveToast = ref('')
const loadToast = ref('')

// 分支探索图状态
const branchingGraph = ref({ nodes: [], edges: [] })
const isDragging = ref(false)
const dragNode = ref(null)
const NODE_W = 120
const NODE_H = 60
const NODE_MARGIN = 16

// 根据节点动态计算画布尺寸，确保可以滚动查看全部内容
const graphHeight = computed(() => {
  const nodes = branchingGraph.value.nodes || []
  const maxY = nodes.reduce((m, n) => Math.max(m, typeof n.y === 'number' ? n.y : 0), 0)
  const padding = 200
  return Math.max(600, maxY + padding)
})

const graphWidth = computed(() => {
  const nodes = branchingGraph.value.nodes || []
  let minX = Infinity
  let maxX = 0
  nodes.forEach(n => {
    const x = typeof n.x === 'number' ? n.x : 0
    if (x < minX) minX = x
    if (x > maxX) maxX = x
  })
  if (!isFinite(minX)) return 900
  const padding = 300
  return Math.max(900, (maxX - minX) + padding)
})

// 简单的碰撞消解：多轮相互推开，减少重叠
const resolveNodeOverlaps = () => {
  const nodes = branchingGraph.value.nodes
  if (!nodes || nodes.length <= 1) return
  const maxIter = 10
  for (let iter = 0; iter < maxIter; iter++) {
    let moved = false
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]
        const dx = a.x - b.x
        const dy = a.y - b.y
        const overlapX = (NODE_W + NODE_MARGIN) - Math.abs(dx)
        const overlapY = (NODE_H + NODE_MARGIN) - Math.abs(dy)
        if (overlapX > 0 && overlapY > 0) {
          // 选择重叠更严重的方向分离
          if (overlapX > overlapY) {
            const push = overlapX / 2
            a.x += dx >= 0 ? push : -push
            b.x -= dx >= 0 ? push : -push
          } else {
            const push = overlapY / 2
            a.y += dy >= 0 ? push : -push
            b.y -= dy >= 0 ? push : -push
          }
          moved = true
        }
      }
    }
    if (!moved) break
  }
}

// 个性报告
const personalityReport = ref({
  title: '',
  content: '',
  traits: [],
  scores: {}
})

// 预设个性报告模板（基于最终属性）
const personalityTemplates = [
  {
    condition: (attrs) => attrs['心计'] >= 50 && attrs['圣宠'] >= 30,
    title: '宫心计谋家',
    content: '你在深宫中展现了出色的智慧与手段，善于察言观色，步步为营。你的每一个选择都经过深思熟虑，最终在宫斗中占据了有利位置。',
    traits: ['善于谋划', '察言观色', '步步为营', '深谋远虑'],
    scores: { 智慧: 95, 手段: 88, 人缘: 75, 威望: 82 }
  },
  {
    condition: (attrs) => attrs['才情'] >= 60 && attrs['声望'] >= 20,
    title: '才华横溢的文雅佳人',
    content: '你凭借出众的才华和优雅的气质在宫中赢得了众人的赞赏。无论是诗词歌赋还是琴棋书画，你都能信手拈来，成为宫中的一道亮丽风景。',
    traits: ['才华出众', '气质优雅', '博学多才', '温文尔雅'],
    scores: { 才华: 92, 气质: 90, 学识: 85, 魅力: 88 }
  },
  {
    condition: (attrs) => attrs['健康'] >= 80 && attrs['心计'] <= 30,
    title: '天真烂漫的纯真少女',
    content: '你保持着一颗纯真的心，在复杂的宫廷中依然坚持自己的本心。虽然不善权谋，但你的真诚和善良为你赢得了真心朋友。',
    traits: ['心地善良', '真诚待人', '天真无邪', '坚持本心'],
    scores: { 纯真: 95, 善良: 92, 真诚: 90, 坚韧: 78 }
  },
  {
    condition: (attrs) => attrs['声望'] >= 30,
    title: '备受瞩目的宫中新星',
    content: '你在宫中迅速崭露头角，凭借自己的努力和智慧获得了众人的认可。你的名声在后宫中传播，成为了不可忽视的存在。',
    traits: ['迅速成长', '备受瞩目', '努力上进', '潜力无限'],
    scores: { 影响力: 88, 成长性: 92, 适应力: 85, 潜力: 90 }
  }
]

// 默认个性报告
const defaultPersonalityReport = {
  title: '初入宫闱的谨慎新人',
  content: '你在宫中小心翼翼，每一步都走得格外谨慎。虽然还在适应宫廷生活，但你的谨慎和观察力将会是你在深宫中生存的重要武器。',
  traits: ['小心谨慎', '善于观察', '稳重内敛', '厚积薄发'],
  scores: { 谨慎: 85, 观察力: 80, 适应力: 75, 潜力: 82 }
}

// 生成分支探索图
// 规则：
// - 每个选择场景都会展示所有选项；
// - 用户实际选择的选项用高亮标记，并连接到“主线继续”节点；
// - 未选择的选项连接到一个问号节点“?”；
// - 所有节点标题限制为前6个字符；
// - 尝试在末端显示“故事完结”或“主线”汇合节点。
const generateBranchingGraph = () => {
  const nodes = []
  const edges = []
  let nodeId = 0

  // 起始节点
  nodes.push({
    id: nodeId++,
    title: '初入深宫',
    type: 'start',
    x: 400,
    y: 50,
    description: '故事开始，初入宫闱'
  })

  let currentY = 150
  let lastNodeId = 0

  // 根据用户的选择历史按顺序生成分支图
  gameData.value.choiceHistory.forEach((userChoice, historyIndex) => {
    // 找到对应的场景
    const scene = gameData.value.storyScenes.find(s => 
      s.id === userChoice.sceneId || 
      s.sceneId === userChoice.sceneId
    )
    
    if (!scene || !scene.choices) return

    // 场景节点（选择发生的地方）
    const sceneNodeId = nodeId++
    const sceneTitle = (userChoice.sceneTitle || scene.title || `第${historyIndex + 1}章`).toString()
    nodes.push({
      id: sceneNodeId,
      title: sceneTitle.substring(0, 6),
      type: 'scene',
      x: 400,
      y: currentY,
      description: sceneTitle
    })

    // 连接上一个节点到当前场景
    edges.push({
      from: lastNodeId,
      to: sceneNodeId,
      label: historyIndex === 0 ? '开始' : '',
      isSelected: true
    })

    // 为这个场景的所有选项创建节点
    const choiceSpacing = 180
    const startX = 400 - (scene.choices.length - 1) * choiceSpacing / 2

    scene.choices.forEach((choice, choiceIndex) => {
      const choiceX = startX + choiceIndex * choiceSpacing
      const choiceY = currentY + 120

      // 判断是否是用户实际选择的选项
      const isUserChoice = choice.id === userChoice.choiceId

      // 选项节点
      const choiceNodeId = nodeId++
      const choiceText = (choice.text || '').toString().substring(0, 6)
      nodes.push({
        id: choiceNodeId,
        title: choiceText,
        type: isUserChoice ? 'choice-selected' : 'choice-unselected',
        x: choiceX,
        y: choiceY,
        description: choice.text,
        isSelected: isUserChoice
      })

      // 连接场景到选项
      edges.push({
        from: sceneNodeId,
        to: choiceNodeId,
        label: '',
        isSelected: isUserChoice
      })

      if (isUserChoice) {
        // 只为用户实际选择的选项创建主线继续节点
        const mainlineNodeId = nodeId++
        nodes.push({
          id: mainlineNodeId,
          title: '主线继续',
          type: 'result',
          x: choiceX,
          y: choiceY + 100,
          description: `选择"${(choice.text || '').toString().substring(0, 10)}"后接入主线`
        })

        edges.push({
          from: choiceNodeId,
          to: mainlineNodeId,
          label: '',
          isSelected: true
        })

        // 为下一轮循环准备
        lastNodeId = mainlineNodeId
      } else {
        // 为未选择的选项创建问号终点
        const questionNodeId = nodeId++
        nodes.push({
          id: questionNodeId,
          title: '?',
          type: 'question',
          x: choiceX,
          y: choiceY + 80,
          description: '未探索的分支'
        })

        edges.push({
          from: choiceNodeId,
          to: questionNodeId,
          label: '',
          isSelected: false
        })
      }
    })

    currentY += 250
  })

  // 结束节点
  if (gameData.value.choiceHistory.length > 0) {
    const endNodeId = nodeId++
    nodes.push({
      id: endNodeId,
      title: '主线/完结',
      type: 'end',
      x: 400,
      y: currentY + 100,
      description: '分支收束于主线，完成一次旅程'
    })

    edges.push({
      from: lastNodeId,
      to: endNodeId,
      label: '',
      isSelected: true
    })
  }
  branchingGraph.value = { nodes, edges }
  // 生成后做一次碰撞消解，减少重合
  resolveNodeOverlaps()
}

// 生成个性报告
const generatePersonalityReport = () => {
  const attrs = gameData.value.finalAttributes
  
  // 寻找匹配的模板
  const matchedTemplate = personalityTemplates.find(template => 
    template.condition(attrs)
  )
  
  personalityReport.value = matchedTemplate || defaultPersonalityReport
}

// 拖拽相关函数
const startDrag = (event, node) => {
  if (event.type === 'mousedown') {
    isDragging.value = true
    dragNode.value = node
    
    const onMouseMove = (e) => {
      if (isDragging.value && dragNode.value) {
        const container = document.querySelector('.branching-graph')
        const rect = container.getBoundingClientRect()
        const scrollLeft = container.scrollLeft || 0
        const scrollTop = container.scrollTop || 0
        dragNode.value.x = e.clientX - rect.left + scrollLeft
        dragNode.value.y = e.clientY - rect.top + scrollTop
      }
    }
    
    const onMouseUp = () => {
      isDragging.value = false
      dragNode.value = null
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      // 拖拽结束后整理布局，避免与其它节点重叠
      resolveNodeOverlaps()
    }
    
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }
}

// 存档相关
const saveGame = async (slot) => {
  try {
    const result = await saveGameData({
      work: gameData.value.work,
      currentSceneIndex: gameData.value.currentSceneIndex,
      currentDialogueIndex: gameData.value.currentDialogueIndex,
      attributes: gameData.value.finalAttributes,
      statuses: gameData.value.finalStatuses,
      storyScenes: gameData.value.storyScenes,
      choiceHistory: gameData.value.choiceHistory
    }, slot)
    
    if (result.success) {
      saveToast.value = result.message
      setTimeout(() => (saveToast.value = ''), 2000)
      showSaveModal.value = false
      // 刷新槽位信息
      await refreshSlotInfosData()
    }
  } catch (err) {
    console.error('存档失败:', err)
    alert('存档失败：' + err.message)
  }
}

const loadGame = async (slot) => {
  try {
    const result = await loadGameData(gameData.value.work.id, slot)
    if (result.success) {
      // 跳转回游戏页面并传递加载的数据
      router.push({
        path: `/game/${gameData.value.work.id}`,
        state: {
          loadedData: result.data,
          title: gameData.value.work.title,
          coverUrl: gameData.value.work.coverUrl
        }
      })
    } else {
      alert(result.message)
    }
  } catch (err) {
    console.error('读档失败:', err)
    alert('读档失败：' + err.message)
  }
}

// 刷新槽位信息
const refreshSlotInfosData = async () => {
  try {
    const infos = await refreshSlotInfos(gameData.value.work.id, SLOTS)
    slotInfos.value = infos
  } catch (err) {
    console.error('刷新槽位信息失败:', err)
  }
}

// 打开存档/读档弹窗
const openSaveModal = async () => {
  showSaveModal.value = true
  await refreshSlotInfosData()
}

const openLoadModal = async () => {
  showLoadModal.value = true
  await refreshSlotInfosData()
}

const closeSaveModal = () => { showSaveModal.value = false }
const closeLoadModal = () => { showLoadModal.value = false }

// 返回游戏或主页
const goBack = () => {
  router.push('/works')
}

const continueGame = () => {
  // 重新开始当前作品，携带封面与标题用于加载页背景
  try {
    const meta = {
      id: gameData.value.work.id,
      title: gameData.value.work.title,
      coverUrl: gameData.value.work.coverUrl
    }
    sessionStorage.setItem('lastWorkMeta', JSON.stringify(meta))
  } catch {}
  router.push({
    path: `/game/${gameData.value.work.id}`,
    state: {
      title: gameData.value.work.title,
      coverUrl: gameData.value.work.coverUrl
    }
  })
}

onMounted(() => {
  console.log('SettlementPage mounted with data:', gameData.value)
  console.log('Final Attributes:', gameData.value.finalAttributes)
  console.log('Final Statuses:', gameData.value.finalStatuses)
  generateBranchingGraph()
  generatePersonalityReport()
  refreshSlotInfosData()
  
  // 清理sessionStorage中的临时数据
  setTimeout(() => {
    sessionStorage.removeItem('settlementData')
  }, 1000) // 延迟1秒清理，确保页面已经加载完成
})
</script>

<template>
  <div class="settlement-page">
    <!-- 顶部导航 -->
    <div class="top-nav">
      <button class="nav-btn back-btn" @click="goBack">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M19 12H6m6-7l-7 7 7 7"/>
        </svg>
        返回
      </button>
      
      <h1 class="page-title">{{ gameData.work.title }} - 游戏结算</h1>
      
      <div class="quick-actions">
        <button class="nav-btn" @click="showAttributesModal = true">属性</button>
        <button class="nav-btn" @click="openSaveModal">存档</button>
        <button class="nav-btn" @click="openLoadModal">读档</button>
      </div>
    </div>

    <!-- 视图切换标签 -->
    <div class="view-tabs">
      <button 
        class="tab-btn" 
        :class="{ active: currentView === 'overview' }"
        @click="currentView = 'overview'"
      >
        总览
      </button>
      <button 
        class="tab-btn" 
        :class="{ active: currentView === 'branching' }"
        @click="currentView = 'branching'"
      >
        分支探索
      </button>
      <button 
        class="tab-btn" 
        :class="{ active: currentView === 'personality' }"
        @click="currentView = 'personality'"
      >
        个性报告
      </button>
    </div>

    <!-- 主要内容区域 -->
    <div class="content-area">
      <!-- 总览页面 -->
      <div v-if="currentView === 'overview'" class="overview-content">
        <div class="completion-stats">
          <div class="stat-card">
            <h3>完成度</h3>
            <div class="stat-value">100%</div>
            <p>恭喜通关全部剧情！</p>
          </div>
          
          <div class="stat-card">
            <h3>选择次数</h3>
            <div class="stat-value">{{ gameData.choiceHistory.length }}</div>
            <p>做出的关键决定</p>
          </div>
          
          <div class="stat-card">
            <h3>最终评价</h3>
            <div class="stat-value">{{ personalityReport.title }}</div>
            <p>{{ personalityReport.content.substring(0, 50) }}...</p>
          </div>
        </div>
      </div>

      <!-- 分支探索图 -->
      <div v-if="currentView === 'branching'" class="branching-content">
        <div class="branching-header">
          <h3>你的故事分支</h3>
          <p>拖动节点查看你的选择路径</p>
        </div>
        
        <div class="branching-graph">
          <svg class="graph-svg" :width="graphWidth" :height="graphHeight">
            <!-- 边 -->
            <g class="edges">
              <line
                v-for="edge in branchingGraph.edges"
                :key="`edge-${edge.from}-${edge.to}`"
                :x1="branchingGraph.nodes.find(n => n.id === edge.from)?.x || 0"
                :y1="branchingGraph.nodes.find(n => n.id === edge.from)?.y || 0"
                :x2="branchingGraph.nodes.find(n => n.id === edge.to)?.x || 0"
                :y2="branchingGraph.nodes.find(n => n.id === edge.to)?.y || 0"
                :class="['edge-line', edge.isSelected ? 'edge-selected' : 'edge-unselected']"
              />
            </g>
            
            <!-- 节点 -->
            <g class="nodes">
              <g
                v-for="node in branchingGraph.nodes"
                :key="node.id"
                :transform="`translate(${node.x - 60}, ${node.y - 30})`"
                class="node-group"
                :class="[`node-${node.type}`]"
                @mousedown="startDrag($event, node)"
              >
                <rect
                  width="120"
                  height="60"
                  rx="8"
                  class="node-rect"
                />
                <text
                  x="60"
                  y="25"
                  text-anchor="middle"
                  class="node-title"
                >{{ node.title }}</text>
                <text
                  x="60"
                  y="40"
                  text-anchor="middle"
                  class="node-desc"
                >{{ node.description?.substring(0, 10) }}...</text>
              </g>
            </g>
          </svg>
        </div>
      </div>

      <!-- 个性报告 -->
      <div v-if="currentView === 'personality'" class="personality-content">
        <div class="personality-header">
          <h2 class="personality-title">{{ personalityReport.title }}</h2>
          <p class="personality-subtitle">基于你的选择生成的个性分析</p>
        </div>
        
        <div class="personality-body">
          <div class="personality-description">
            <p>{{ personalityReport.content }}</p>
          </div>
          
          <div class="personality-traits">
            <h4>性格特征</h4>
            <div class="traits-list">
              <span 
                v-for="trait in personalityReport.traits" 
                :key="trait"
                class="trait-tag"
              >
                {{ trait }}
              </span>
            </div>
          </div>
          
          <div class="personality-scores">
            <h4>综合评分</h4>
            <div class="scores-grid">
              <div 
                v-for="(score, key) in personalityReport.scores" 
                :key="key"
                class="score-item"
              >
                <span class="score-name">{{ key }}</span>
                <div class="score-bar">
                  <div 
                    class="score-fill" 
                    :style="{ width: `${score}%` }"
                  ></div>
                  <span class="score-value">{{ score }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="bottom-actions">
      <button class="action-btn secondary" @click="goBack">
        返回主页
      </button>
      <button class="action-btn primary" @click="continueGame">
        重新游戏
      </button>
    </div>

    <!-- 属性弹窗（复用GamePage的样式） -->
    <div v-if="showAttributesModal" class="modal-backdrop" @click="showAttributesModal = false">
      <div class="modal-panel attributes-panel" @click.stop>
        <div class="modal-header">
          <h3>角色属性与状态</h3>
          <button class="modal-close" @click="showAttributesModal = false">×</button>
        </div>
        
        <div class="attr-status-grid">
          <div class="attributes-section">
            <div class="section-title">属性数值</div>
            <ul class="kv-list">
              <li v-for="(value, key) in gameData.finalAttributes" :key="key">
                <span class="kv-key">{{ key }}</span>
                <span class="kv-sep">:</span>
                <span class="kv-val">{{ value }}</span>
              </li>
            </ul>
          </div>
          
          <div class="statuses-section">
            <div class="section-title">状态档案</div>
            <ul class="kv-list">
              <li v-for="(value, key) in gameData.finalStatuses" :key="key">
                <span class="kv-key">{{ key }}</span>
                <span class="kv-sep">:</span>
                <span class="kv-val">{{ value }}</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div class="modal-actions">
          <button @click="showAttributesModal = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 存档弹窗 -->
    <div v-if="showSaveModal" class="modal-backdrop" @click="closeSaveModal">
      <div class="modal-panel save-load-modal" @click.stop>
        <div class="modal-header">
          <h3>保存存档</h3>
          <button class="modal-close" @click="closeSaveModal">×</button>
        </div>
        
        <div class="slot-list">
          <div v-for="slot in SLOTS" :key="slot" class="slot-card">
            <div class="slot-title">{{ slot === 'slot6' ? '自动存档' : `存档位 ${slot.slice(-1)}` }}</div>
            <div class="slot-meta" :class="{ empty: !slotInfos[slot] }">
              <template v-if="slotInfos[slot]">
                {{ slotInfos[slot].sceneTitle }}<br>
                {{ new Date(slotInfos[slot].timestamp).toLocaleString() }}
              </template>
              <template v-else>空存档位</template>
            </div>
            <div class="slot-actions">
              <button @click="saveGame(slot)">保存</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 读档弹窗 -->
    <div v-if="showLoadModal" class="modal-backdrop" @click="closeLoadModal">
      <div class="modal-panel save-load-modal" @click.stop>
        <div class="modal-header">
          <h3>读取存档</h3>
          <button class="modal-close" @click="closeLoadModal">×</button>
        </div>
        
        <div class="slot-list">
          <div v-for="slot in SLOTS" :key="slot" class="slot-card">
            <div class="slot-title">{{ slot === 'slot6' ? '自动存档' : `存档位 ${slot.slice(-1)}` }}</div>
            <div class="slot-meta" :class="{ empty: !slotInfos[slot] }">
              <template v-if="slotInfos[slot]">
                {{ slotInfos[slot].sceneTitle }}<br>
                {{ new Date(slotInfos[slot].timestamp).toLocaleString() }}
              </template>
              <template v-else>空存档位</template>
            </div>
            <div class="slot-actions">
              <button :disabled="!slotInfos[slot]" @click="loadGame(slot)">读取</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Toast 提示 -->
    <div v-if="saveToast" class="toast save-toast">{{ saveToast }}</div>
    <div v-if="loadToast" class="toast load-toast">{{ loadToast }}</div>
  </div>
</template>

<style scoped>
.settlement-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #faf8f3 0%, #f0ebe3 100%);
  display: flex;
  flex-direction: column;
}

/* 顶部导航 */
.top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(212, 165, 165, 0.2);
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(212, 165, 165, 0.1);
  border: 1px solid rgba(212, 165, 165, 0.3);
  border-radius: 8px;
  color: #8B7355;
  cursor: pointer;
  transition: all 0.3s ease;
}

.nav-btn:hover {
  background: rgba(212, 165, 165, 0.2);
  transform: translateY(-1px);
}

.nav-btn svg {
  width: 16px;
  height: 16px;
}

.page-title {
  font-size: 1.5rem;
  color: #2c1810;
  margin: 0;
  font-weight: 600;
}

.quick-actions {
  display: flex;
  gap: 0.5rem;
}

/* 视图切换标签 */
.view-tabs {
  display: flex;
  background: white;
  border-bottom: 1px solid rgba(212, 165, 165, 0.2);
  padding: 0 2rem;
}

.tab-btn {
  padding: 1rem 2rem;
  border: none;
  background: transparent;
  color: #8B7355;
  font-size: 1rem;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  transition: all 0.3s ease;
}

.tab-btn:hover {
  background: rgba(212, 165, 165, 0.1);
}

.tab-btn.active {
  color: #d4a5a5;
  border-bottom-color: #d4a5a5;
  background: rgba(212, 165, 165, 0.05);
}

/* 内容区域 */
.content-area {
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
}

/* 总览内容 */
.completion-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.stat-card h3 {
  color: #8B7355;
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #d4a5a5;
  margin-bottom: 0.5rem;
}

.stat-card p {
  color: #666;
  margin: 0;
  font-size: 0.9rem;
}

/* 已移除：结算总览中的最终属性视觉块，改为通过“属性”按钮查看 */

/* 分支探索图 */
.branching-content {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.branching-header {
  text-align: center;
  margin-bottom: 2rem;
}

.branching-header h3 {
  color: #8B7355;
  margin: 0 0 0.5rem 0;
}

.branching-header p {
  color: #666;
  margin: 0;
}

.branching-graph {
  position: relative;
  height: 600px;
  overflow: auto;
  border: 1px solid #eee;
  border-radius: 8px;
}

.graph-svg {
  cursor: grab;
  display: block;
}

.edge-line {
  stroke: #d4a5a5;
  stroke-width: 2;
  opacity: 0.6;
}

.edge-selected {
  stroke: #8b5a3c;
  stroke-width: 3;
  opacity: 0.9;
}

.edge-unselected {
  stroke: #d4a5a5;
  stroke-width: 1;
  opacity: 0.3;
  stroke-dasharray: 5,5;
}

.node-group {
  cursor: move;
}

.node-rect {
  fill: white;
  stroke: #d4a5a5;
  stroke-width: 2;
}

.node-start .node-rect {
  fill: #e8f5e8;
  stroke: #4caf50;
}

.node-scene .node-rect {
  fill: #f3e5f5;
  stroke: #9c27b0;
}

.node-choice .node-rect {
  fill: #fff3e0;
  stroke: #ff9800;
}

.node-choice-selected .node-rect {
  fill: #e8f5e8;
  stroke: #4caf50;
  stroke-width: 3;
}

.node-choice-unselected .node-rect {
  fill: #fafafa;
  stroke: #bdbdbd;
  stroke-dasharray: 5,5;
}

.node-result .node-rect {
  fill: #e3f2fd;
  stroke: #2196f3;
}

.node-question .node-rect {
  fill: #ffebee;
  stroke: #f44336;
  stroke-dasharray: 3,3;
}

.node-end .node-rect {
  fill: #fce4ec;
  stroke: #e91e63;
}

.node-title {
  fill: #333;
  font-size: 12px;
  font-weight: 600;
}

.node-desc {
  fill: #666;
  font-size: 10px;
}

/* 个性报告 */
.personality-content {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.personality-header {
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #eee;
}

.personality-title {
  color: #d4a5a5;
  font-size: 2rem;
  margin: 0 0 0.5rem 0;
  font-weight: 700;
}

.personality-subtitle {
  color: #8B7355;
  margin: 0;
  font-size: 1.1rem;
}

.personality-description {
  margin-bottom: 2rem;
  line-height: 1.8;
  color: #555;
  font-size: 1.1rem;
}

.personality-traits {
  margin-bottom: 2rem;
}

.personality-traits h4 {
  color: #8B7355;
  margin: 0 0 1rem 0;
}

.traits-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.trait-tag {
  background: linear-gradient(135deg, #d4a5a5, #c89090);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 500;
}

.personality-scores h4 {
  color: #8B7355;
  margin: 0 0 1rem 0;
}

.scores-grid {
  display: grid;
  gap: 1rem;
}

.score-item {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.score-name {
  min-width: 80px;
  color: #8B7355;
  font-weight: 500;
}

.score-bar {
  flex: 1;
  position: relative;
  height: 20px;
  background: #f0f0f0;
  border-radius: 10px;
  overflow: hidden;
}

.score-fill {
  height: 100%;
  background: linear-gradient(90deg, #d4a5a5, #c89090);
  transition: width 0.5s ease;
}

.score-value {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.8rem;
  color: #666;
  font-weight: 500;
}

/* 底部操作栏 */
.bottom-actions {
  display: flex;
  gap: 1rem;
  padding: 1.5rem 2rem;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(212, 165, 165, 0.2);
}

.action-btn {
  flex: 1;
  padding: 1rem 2rem;
  border: none;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.action-btn.secondary {
  background: #f5f5f5;
  color: #8B7355;
}

.action-btn.secondary:hover {
  background: #e8e8e8;
  transform: translateY(-2px);
}

.action-btn.primary {
  background: linear-gradient(135deg, #d4a5a5, #c89090);
  color: white;
}

.action-btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(212, 165, 165, 0.4);
}

/* 模态框样式（复用GamePage的样式） */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.modal-panel {
  background: rgba(255, 255, 255, 0.75);
  color: #2c1810;
  padding: 1.25rem;
  border-radius: 8px;
  min-width: 300px;
  border: 1px solid rgba(212,165,165,0.3);
  box-shadow: 0 8px 24px rgba(0,0,0,0.18);
  backdrop-filter: blur(10px);
}

.attributes-panel { 
  width: min(90vw, 900px); 
  max-height: 92vh; 
  display:flex; 
  flex-direction:column; 
}

.modal-header { 
  display:flex; 
  align-items:center; 
  justify-content:space-between; 
  margin-bottom: 0.5rem; 
}

.modal-close { 
  background: transparent; 
  color:#8B7355; 
  border: none; 
  font-size: 1.25rem; 
  cursor: pointer; 
}

.attr-status-grid { 
  display:grid; 
  grid-template-columns: 1fr 1fr; 
  gap: 1rem; 
  margin-top: 0.25rem; 
  flex: 1 1 auto; 
  min-height: 78%; 
  overflow: auto; 
}

.section-title { 
  font-weight: 700; 
  color:#8B7355; 
  margin-bottom: 0.25rem; 
}

.kv-list { 
  list-style: none; 
  margin: 0; 
  padding: 0; 
}

.kv-list li { 
  display:flex; 
  align-items: baseline; 
  gap: 0.25rem; 
  padding: 0.25rem 0; 
  border-bottom: 1px dashed rgba(212,165,165,0.15); 
}

.kv-key { color:#5a4533; }
.kv-sep { color:#8B7355; }
.kv-val { color:#2c1810; }

.modal-actions { 
  display:flex; 
  gap:0.5rem; 
  justify-content:flex-end; 
  margin-top:1rem;
}

.modal-actions button { 
  padding:0.4rem 0.8rem; 
  border-radius:6px; 
  cursor:pointer;
  background: rgba(212,165,165,0.15); 
  color:#fff; 
  border:1px solid rgba(212,165,165,0.3);
}

/* 存/读档弹窗样式 */
.save-load-modal {
  width: min(88vw, 720px);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.slot-list { 
  display:grid; 
  grid-template-columns: repeat(3, 1fr); 
  gap: 0.75rem; 
  margin-top: 0.5rem; 
  flex: 1 1 auto; 
  overflow-y: auto; 
  min-height: 0; 
  padding-right: 0.25rem; 
}

.slot-card { 
  background:#ffffff; 
  border:1px solid rgba(212,165,165,0.2); 
  border-radius:8px; 
  padding:0.75rem; 
  display:flex; 
  flex-direction:column; 
  gap:0.5rem;
}

.slot-title { 
  font-weight:700; 
  color:#8B7355; 
  letter-spacing: 0.08em; 
}

.slot-meta { 
  font-size: 0.9rem; 
  color:#555; 
  line-height:1.4;
}

.slot-meta.empty { 
  color:#aaa;
}

.slot-actions { 
  display:flex; 
  justify-content:flex-end; 
}

.slot-actions button { 
  padding:0.4rem 0.8rem; 
  border-radius:6px; 
  cursor:pointer; 
  background: rgba(212,165,165,0.15); 
  color:#2c1810; 
  border:1px solid rgba(212,165,165,0.35);
}

.slot-actions button:hover { 
  background: rgba(212,165,165,0.22);
}

.slot-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.slot-actions button:disabled:hover {
  background: rgba(212,165,165,0.15);
}

/* Toast 提示 */
.toast { 
  position: fixed; 
  right: 1rem; 
  bottom: 1rem; 
  background: rgba(0,0,0,0.8); 
  color: #fff; 
  padding: 0.6rem 1rem; 
  border-radius: 6px; 
  z-index: 11000;
}

.save-toast { 
  background: linear-gradient(90deg,#d4a574,#f5e6d3); 
  color:#2c1810;
}

.load-toast { 
  background: linear-gradient(90deg,#a5d4a5,#d3f5d3); 
  color:#183a12;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .top-nav {
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }
  
  .page-title {
    font-size: 1.2rem;
  }
  
  .quick-actions {
    justify-content: center;
  }
  
  .view-tabs {
    padding: 0 1rem;
  }
  
  .tab-btn {
    padding: 0.75rem 1rem;
    font-size: 0.9rem;
  }
  
  .content-area {
    padding: 1rem;
  }
  
  .completion-stats {
    grid-template-columns: 1fr;
  }
  
  .attr-status-grid {
    grid-template-columns: 1fr;
  }
  
  .bottom-actions {
    flex-direction: column;
    padding: 1rem;
  }
}
</style>
