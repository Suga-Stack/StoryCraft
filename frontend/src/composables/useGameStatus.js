import { ref, computed } from 'vue'
import { ScreenOrientation } from '@capacitor/screen-orientation'
import { http } from '../service/http.js'
export function useGameState(dependencies = {}) {
  const {
    router,
    route,
    storyScenes,
    currentSceneIndex,
    currentDialogueIndex,
    currentScene,
    currentChapterIndex,
    totalChapters,
    storyEndSignaled,
    isFetchingNext,
    isFetchingChoice,
    isGeneratingSettlement,
    suppressAutoShowChoices,
    choiceHistory,
    lastChoiceTimestamp,
    attributes,
    statuses,
    work,
    fetchNextChapter,
    fetchNextContent,
    pushSceneFromServer,
    getChapterStatus,
    getWorkDetails,
    checkCurrentChapterSaved,
    restoreChoiceFlagsFromHistory,
    lastSelectedEndingIndex,
    // 添加缺失的依赖
    creatorMode,
    allowAdvance,
    editingDialogue,  // 🔑 关键修复：添加编辑状态
    creatorFeatureEnabled,
    isCreatorIdentity,
    modifiableFromCreate,
    USE_MOCK_STORY,
    isNativeApp,
    autoPlayEnabled,
    anyOverlayOpen,
    startAutoPlayTimer,
    stopAutoPlayTimer,
    showNotice,
    deepClone,
    fetchReport,
    pendingNextChapter,
    AUTO_SAVE_SLOT,
    autoSaveToSlot,
    previewSnapshot,
    waitingForClickToShowChoices  // 🔑 新增：等待用户点击显示选项的标记
  } = dependencies

  // 状态定义
  const isLoading = ref(true)
  const loadingProgress = ref(0)
  const isLandscapeReady = ref(false)
  const showText = ref(false)
  const showMenu = ref(false)
  const choicesVisible = ref(false)
  let eventSource = null
  // 标记当前是否正在播放后端提供的结局场景（在读者模式下）
  const playingEndingScenes = ref(false)
  // 标记刚刚播放完后端结局（用于避免在播放完后再次去拉取并重复追加结局场景）
  const justFinishedPlayingEnding = ref(false)
  // 标记是否已把后端结局追加到当前 storyScenes 中（避免重复追加）
  const endingsAppended = ref(false)
  // 追加的结局是否已在后端标记为 saved
  const appendedEndingSaved = ref(null)
  // 正在等待后端生成的特定结局（{ workId, endingIndex }），用于在创作者模式下阻止占位/摘要场景的显示
  const pendingGeneratedEnding = ref(null)
  // 结局编辑器（供创作者在选择结局后编辑大纲）
  const endingEditorVisible = ref(false)
  const endingEditorBusy = ref(false)
  const endingEditorForm = ref({ title: '', outline: '', userPrompt: '', endingIndex: null, choice: null })

  // 打开结局编辑器（创作者在选择结局后会弹出）
  const openEndingEditor = async (choice) => {
    try {
      const idx = (choice._endingIndex != null) ? Number(choice._endingIndex) : null
      // 初始化表单（优先使用传入的 _endingOutline / _endingTitle）
      endingEditorForm.value = {
        title: choice._endingTitle || choice.text || '',
        outline: choice._endingOutline || (choice._endingCondition ? JSON.stringify(choice._endingCondition) : '') || '',
        userPrompt: '',
        endingIndex: idx,
        choice: choice
      }

      // 如果没有 outline 内容，优先从前端已缓存的位置读取（不再主动向后端 GET）
      try {
        const workId = work && work.value && work.value.id
        if (idx != null && (!endingEditorForm.value.outline || String(endingEditorForm.value.outline).trim() === '')) {
          // 1) 优先使用 choice 上的 _endingOutline（如果存在）
          if (choice && choice._endingOutline && String(choice._endingOutline).trim()) {
            endingEditorForm.value.outline = String(choice._endingOutline)
          }

          // 2) 尝试从 sessionStorage 中读取之前保存的 selectedEndingOutline_{workId}
          if ((!endingEditorForm.value.outline || String(endingEditorForm.value.outline).trim() === '') && workId) {
            try {
              const cached = sessionStorage.getItem(`selectedEndingOutline_${workId}`)
              if (cached && String(cached).trim()) endingEditorForm.value.outline = String(cached)
            } catch (e) { /* ignore sessionStorage errors */ }
          }

          // 3) 尝试从当前场景（如果可用）读取 _endingOutline / _endingSummary
          if ((!endingEditorForm.value.outline || String(endingEditorForm.value.outline).trim() === '') && currentScene && currentScene.value) {
            try {
              const cs = currentScene.value
              if (cs._endingOutline && String(cs._endingOutline).trim()) endingEditorForm.value.outline = String(cs._endingOutline)
              else if (cs._endingSummary && String(cs._endingSummary).trim()) endingEditorForm.value.outline = String(cs._endingSummary)
            } catch (e) { /* ignore */ }
          }
        }
      } catch (e) { console.warn('openEndingEditor fill-from-cache failed', e) }

      endingEditorVisible.value = true
    } catch (e) { console.warn('openEndingEditor failed', e) }
  }

  const cancelEndingEditor = () => {
    endingEditorVisible.value = false
    endingEditorBusy.value = false
    endingEditorForm.value = { title: '', outline: '', userPrompt: '', endingIndex: null, choice: null }
  }

  const submitEndingEditor = async () => {
    try {
      if (!endingEditorForm.value || endingEditorBusy.value) return
      endingEditorBusy.value = true
      const workId = work && work.value && work.value.id
      const endingIndex = endingEditorForm.value.endingIndex
      if (!workId || endingIndex == null) {
        showNotice('无法识别作品或结局索引', 3000)
        endingEditorBusy.value = false
        return
      }

      const body = {
        title: endingEditorForm.value.title || '',
        outline: endingEditorForm.value.outline || '',
        userPrompt: endingEditorForm.value.userPrompt || ''
      }

      // 标记正在等待后端生成指定结局（用于阻止其他逻辑在生成期间展示占位或摘要场景）
      try { pendingGeneratedEnding.value = { workId, endingIndex: Number(endingIndex) } } catch (e) { pendingGeneratedEnding.value = { workId, endingIndex } }
      // 触发后端重新生成该结局
      try {
        await http.post(`/api/game/ending/generate/${workId}/${endingIndex}/`, body)
      } catch (postErr) {
        // 清理 pending 标记
        try { pendingGeneratedEnding.value = null } catch (e) {}
        throw postErr
      }

      // 立即关闭编辑器并显示全局加载界面，提示正在生成结局
      try {
        endingEditorVisible.value = false
      } catch (e) {}
      try {
        if (typeof startLoading === 'function') startLoading()
      } catch (e) { console.warn('startLoading for ending generation failed', e) }

      // 轮询获取该结局的生成状态和场景
      const pollInterval = 2000
      const timeoutMs = 120000 // 2 分钟
      let waited = 0
      let pollTimer = null

      const stopPoll = () => {
        if (pollTimer) {
          clearInterval(pollTimer)
          pollTimer = null
        }
      }

      pollTimer = setInterval(async () => {
        try {
          const resp = await http.get(`/api/game/storyending/${workId}/${endingIndex}/`)
          let payload = resp && resp.data ? resp.data : resp
          // 如果本地缓存中存在 endings 列表，使用该列表中相应 endingIndex 的 status 覆盖单条返回的 status（保证列表与单条状态一致）
          try {
            const cached = sessionStorage.getItem(`endingsList_${workId}`)
            if (cached) {
              const arr = JSON.parse(cached)
              if (Array.isArray(arr)) {
                const found = arr.find(e => {
                  const idx = (e.endingIndex != null) ? Number(e.endingIndex) : (e.endingId != null ? Number(e.endingId) : null)
                  return idx === Number(endingIndex)
                })
                if (found && (found.status || found.state)) {
                  try { payload = Object.assign({}, payload, { status: found.status || found.state }) } catch (e) {}
                }
              }
            }
          } catch (e) { /* ignore JSON parse/storage errors */ }
          if (payload && payload.status === 'ready') {
            stopPoll()
            endingEditorBusy.value = false
            // 确保编辑器已关闭
            try { endingEditorVisible.value = false } catch (e) {}

            // 尝试从多种位置提取 scenes（兼容后端不同返回结构）
            let scenes = extractScenesFromPayload(payload, attributes)
            if (!scenes) scenes = extractScenesFromPayload(payload.ending || payload.result || payload.data, attributes)
            if (Array.isArray(scenes) && scenes.length > 0) {
              // 删除之前标记为后端结局的场景
              const before = storyScenes.value.filter(s => !s._isBackendEnding)
              storyScenes.value = before.slice()
              const startIdx = storyScenes.value.length
              for (const s of scenes) {
                try {
                  const beforePush = storyScenes.value.length
                  pushSceneFromServer(s)
                  try {
                    const pushed = storyScenes.value[beforePush]
                    if (pushed) {
                      pushed._isBackendEnding = true
                      pushed.isEnding = true
                      try { pushed._endingSaved = Boolean(appendedEndingSaved.value) } catch (e) {}
                      try { pushed._endingIndex = Number(endingIndex) } catch (e) {}
                    }
                  } catch (tagErr) { console.warn('tagging pushed chosen ending scene failed', tagErr) }
                } catch (e) { console.warn('pushSceneFromServer for generated ending failed', e) }
              }

              // 跳转到生成的结局起点并播放
              choicesVisible.value = false
              showText.value = false
              setTimeout(() => {
                currentSceneIndex.value = startIdx
                currentDialogueIndex.value = 0
                showText.value = true
                playingEndingScenes.value = true
                // 生成完成，关闭加载界面
                try { if (typeof stopLoading === 'function') stopLoading() } catch (e) { console.warn('stopLoading after ending push failed', e) }
                // 清理 pending 标记
                try { pendingGeneratedEnding.value = null } catch (e) {}
              }, 300)
            } else {
              showNotice('已生成结局，但未返回可播放的场景。', 4000)
              try { if (typeof stopLoading === 'function') stopLoading() } catch (e) {}
              try { pendingGeneratedEnding.value = null } catch (e) {}
            }
          }
        } catch (e) {
          console.warn('polling ending detail failed', e)
        }

        waited += pollInterval
        if (waited >= timeoutMs) {
          stopPoll()
          endingEditorBusy.value = false
          showNotice('结局生成超时，请稍后查看', 4000)
          try { if (typeof stopLoading === 'function') stopLoading() } catch (e) {}
          try { pendingGeneratedEnding.value = null } catch (e) {}
        }
      }, pollInterval)

      // 隐式返回
      return
    } catch (e) {
      console.warn('submitEndingEditor failed', e)
      endingEditorBusy.value = false
      showNotice('提交结局编辑器失败，请重试', 4000)
    }
  }
  // 安全调用 autoPlay 控制器（一些环境下该函数可能未被注入）
  const safeStartAutoPlay = () => {
    try {
      if (startAutoPlayTimer && typeof startAutoPlayTimer === 'function') startAutoPlayTimer()
    } catch (e) { /* ignore */ }
  }
  const safeStopAutoPlay = () => {
    try {
      if (stopAutoPlayTimer && typeof stopAutoPlayTimer === 'function') stopAutoPlayTimer()
    } catch (e) { /* ignore */ }
  }
  // helper: 评估单个结局的条件是否满足当前属性
  const evaluateCondition = (condition = {}, attrsRef) => {
    try {
      // 空条件当作匹配
      if (!condition || Object.keys(condition).length === 0) return true

      const attrs = (attrsRef && attrsRef.value) ? attrsRef.value : (attrsRef || {})

      for (const [key, expr] of Object.entries(condition)) {
        const actualRaw = attrs?.[key]
        const actual = Number(actualRaw)

        // 如果条件是数字，直接比较相等
        if (typeof expr === 'number') {
          if (Number.isNaN(actual) || actual !== expr) return false
          continue
        }

        if (typeof expr === 'string') {
          const trimmed = expr.trim()
          // 支持 >=, <=, >, <, ==, =
          const m = trimmed.match(/^(>=|<=|>|<|==|=)\s*(-?\d+(?:\.\d+)?)$/)
          if (m) {
            const op = m[1]
            const num = Number(m[2])
            if (Number.isNaN(actual)) return false
            switch (op) {
              case '>': if (!(actual > num)) return false; break
              case '<': if (!(actual < num)) return false; break
              case '>=': if (!(actual >= num)) return false; break
              case '<=': if (!(actual <= num)) return false; break
              case '==': if (!(actual == num)) return false; break
              case '=': if (!(actual == num)) return false; break
              default: return false
            }
            continue
          }

          // 如果不是带操作符的数字比较，则做宽松相等匹配（字符串/数字）
          if (String(actualRaw) !== trimmed) return false
          continue
        }

        // 其它类型，严格相等
        if (actualRaw !== expr) return false
      }

      return true
    } catch (e) {
      console.warn('evaluateCondition error', e)
      return false
    }
  }

  // helper: 从后端返回的多个结局中选取第一个满足条件的结局
  const pickEnding = (endingsArray, attrsRef) => {
    if (!Array.isArray(endingsArray)) return null
    for (const ending of endingsArray) {
      const cond = ending?.condition || {}
      if (evaluateCondition(cond, attrsRef)) return ending
    }
    return null
  }
  // 从后端载荷中提取 scenes 的通用函数，兼容多种可能的返回结构
  const extractScenesFromPayload = (payload, attrsRef) => {
    if (!payload) return null

    // 直接就是 scenes 数组
    if (Array.isArray(payload) && payload.length > 0 && (payload[0]?.dialogues || payload[0]?.backgroundImage)) {
      return payload
    }

    // payload.scenes
    if (Array.isArray(payload?.scenes)) return payload.scenes

    // payload.data.scenes 或 payload.result.scenes
    if (Array.isArray(payload?.data?.scenes)) return payload.data.scenes
    if (Array.isArray(payload?.result?.scenes)) return payload.result.scenes

    // payload.endings 是结局列表（带 condition 和 scenes字段）
    if (Array.isArray(payload?.endings) && payload.endings.length > 0) {
      // 如果 endings 本身就是 scenes 数组（兼容错误命名）
      if (payload.endings.length > 0 && (payload.endings[0]?.dialogues || payload.endings[0]?.backgroundImage)) {
        return payload.endings
      }
      const ending = pickEnding(payload.endings, attrsRef)
      if (ending && Array.isArray(ending.scenes)) return ending.scenes
    }

    // payload 是 endings 列表（顶层为数组，每项包含 scenes）
    if (Array.isArray(payload) && payload.length > 0 && payload[0]?.scenes) {
      const ending = pickEnding(payload, attrsRef)
      if (ending && Array.isArray(ending.scenes)) return ending.scenes
    }

    // payload.ending 单个对象
    if (payload?.ending && Array.isArray(payload.ending.scenes)) return payload.ending.scenes

    // 兜底：尝试其他常见键名
    if (Array.isArray(payload?.endingScenes)) return payload.endingScenes

    return null
  }
  // 标记是否正在请求下一章或结局，防止并发请求
  let isRequestingNext = false

  // 从后端拉取结局并追加到 storyScenes（如果可用）
  const fetchAndAppendEndings = async (workId) => {
    // 如果当前正在等待某个特定结局的生成，则在创作者生成期间不要尝试拉取/追加其它结局或显示占位
    try {
      if (pendingGeneratedEnding.value && pendingGeneratedEnding.value.workId === workId) {
        console.log('fetchAndAppendEndings: skip because pendingGeneratedEnding is set for work', workId)
        return false
      }
    } catch (e) {}
    if (endingsAppended.value) return false
    if (isRequestingNext) return false
    isRequestingNext = true
    try {
      const resp = await http.get(`/api/game/storyending/${workId}`)
      const payload = resp && resp.data ? resp.data : resp
      // 记录结局状态（兼容多种后端字段）
      try {
        // 优先使用 payload.ending.status（若后端在 ending 对象内返回真实状态），再回退到顶层 status
        const status = payload?.ending?.status ?? payload?.status ?? null
        appendedEndingSaved.value = (status === 'saved')
      } catch (e) { appendedEndingSaved.value = null }
      // 优先尝试提取 scenes
      const scenes = extractScenesFromPayload(payload, attributes)
      // 如果 payload 中包含 ending 的索引信息，提取以便标记推入的场景
      const payloadEndingIdx = (payload?.ending?.endingIndex != null) ? Number(payload.ending.endingIndex) : (payload?.endingIndex != null ? Number(payload.endingIndex) : null)
      if (scenes && Array.isArray(scenes) && scenes.length > 0) {
        const startIdx = storyScenes.value.length
        for (const s of scenes) {
          try {
            const before = storyScenes.value.length
            pushSceneFromServer(s)
            const pushed = storyScenes.value[before]
              if (pushed) {
                pushed._isBackendEnding = true
                pushed.isEnding = true
                // 标记该结局场景是否已经保存
                try { pushed._endingSaved = Boolean(appendedEndingSaved.value) } catch (e) {}
                // 如果后端提供了 endingIndex，则在场景上标记，方便编辑/提交时使用
                try { if (payloadEndingIdx != null) pushed._endingIndex = payloadEndingIdx } catch (e) {}
              }
          } catch (e) { console.warn('fetchAndAppendEndings: pushSceneFromServer failed', e) }
        }
        endingsAppended.value = true
        console.log('fetchAndAppendEndings: appended', scenes.length, 'ending scenes')

        // 如果是创作者且结局尚未保存，自动打开结局编辑器以便创作者在阅读时编辑并保存大纲
        try {
          const isCreator = (creatorMode && creatorMode.value) || (creatorFeatureEnabled && creatorFeatureEnabled.value) || (isCreatorIdentity && isCreatorIdentity.value)
          if (isCreator && appendedEndingSaved.value === false) {
            // 尝试从 payload 中取出 outline/title/index
            const outline = payload?.ending?.outline || payload?.outline || null
            const title = payload?.ending?.title || payload?.title || null
            const idx = (payload?.ending?.endingIndex != null) ? Number(payload.ending.endingIndex) : null
            endingEditorForm.value = { title: title || '', outline: outline || '', userPrompt: '', endingIndex: idx, choice: null }
            endingEditorVisible.value = true
          }
        } catch (e) { console.warn('auto open ending editor failed', e) }
        return true
      }

      // 如果返回的是 endings 列表（每项包含 scenes 或 title），则创建一个总结性场景
      if (Array.isArray(payload?.endings) && payload.endings.length > 0) {
        const summaries = payload.endings.map((ed, i) => `结局 ${i + 1}: ${ed.title || ed.name || ''}`).join('\n')
        const summaryScene = {
          sceneId: `endings-summary-${Date.now()}`,
          backgroundImage: work.value.coverUrl || '',
          dialogues: [payload.prompt || '以下为可能的结局：', summaries],
          choices: [],
          isChapterEnding: false
        }
        try {
          pushSceneFromServer(summaryScene)
          const pushed = storyScenes.value[storyScenes.value.length - 1]
          if (pushed) pushed._isBackendEnding = true
          endingsAppended.value = true
          console.log('fetchAndAppendEndings: appended endings summary scene')
          return true
        } catch (e) { console.warn('fetchAndAppendEndings: push summary failed', e) }
      }

      return false
    } catch (e) {
      console.warn('fetchAndAppendEndings failed', e)
      return false
    } finally {
      isRequestingNext = false
    }
  }
  
  // 计算属性
    // 计算阅读进度
    const readingProgress = computed(() => {
        let totalDialogues = 0
        let currentDialogues = 0
        
        storyScenes.value.forEach((scene, index) => {
            totalDialogues += scene.dialogues.length
            if (index < currentSceneIndex.value) {
            currentDialogues += scene.dialogues.length
            } else if (index === currentSceneIndex.value) {
            currentDialogues += currentDialogueIndex.value + 1
            }
        })
        
        return (currentDialogues / totalDialogues) * 100
    })
  
    // 是否是最后一句对话
    const isLastDialogue = computed(() => {
    const scene = currentScene.value
        if (!scene || !Array.isArray(scene.dialogues)) return false
        return currentSceneIndex.value === storyScenes.value.length - 1 &&
                currentDialogueIndex.value === scene.dialogues.length - 1
    })

  // 方法
  const toggleMenu = () => {
    showMenu.value = !showMenu.value
  }
  
  // 返回作品介绍页
    const goBack = async () => {
        try {
            // 退出前自动存档到六号位
            await autoSaveToSlot(AUTO_SAVE_SLOT)
            // 退出横屏，恢复竖屏
            if (isNativeApp.value) {
            console.log('恢复竖屏')
            await ScreenOrientation.unlock()
            } else {
            // 浏览器环境：退出全屏
            if (document.exitFullscreen) {
                await document.exitFullscreen()
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen()
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen()
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen()
            }
            
            if (screen.orientation && screen.orientation.unlock) {
                screen.orientation.unlock()
            }
            }
        } catch (err) {
            console.log('退出横屏失败:', err)
        }
        
        // 🔑 修复：路由到 /works/{workId} 而不是 /works
        const workId = work && work.value && work.value.id
        if (workId) {
            router.push(`/works/${workId}`)
        } else {
            router.push('/works')
        }
    }

    
    // 处理游戏结束，生成结算页面
    const handleGameEnd = async () => {
        console.log('handleGameEnd 被调用 - creatorFeatureEnabled:', creatorFeatureEnabled.value, 'currentChapter:', currentChapterIndex.value)
        
        // 🔑 关键修复：对于创作者身份，在任何操作之前先进行章节保存状态检查
        // 这样可以避免在未保存状态下生成结局选项场景
        if (creatorFeatureEnabled.value) {
            try {
            console.log('开始获取作品详情以检查章节状态...')
            await getWorkDetails(work.value.id)
            
            // 检查当前章节的状态
            const currentStatus = getChapterStatus(currentChapterIndex.value)
            console.log('handleGameEnd 检查当前章节:', currentChapterIndex.value, '状态:', currentStatus)
            
            // 🔑 关键修复：如果当前章节未保存，立即阻止所有后续操作（包括获取结局详情）
            if (currentStatus !== 'saved') {
                console.warn('handleGameEnd 阻止 - 当前章节未保存')
                showNotice('当前章节（第' + currentChapterIndex.value + '章）尚未保存，请先确认并保存本章内容后再进入结算页面。', 10000)
                // 重置加载状态
                isGeneratingSettlement.value = false
                isLoading.value = false
                return
            }
            
            // 另外也检查一下前一章（以防万一）
            if (currentChapterIndex.value > 1) {
                const prevStatus = getChapterStatus(currentChapterIndex.value - 1)
                console.log('handleGameEnd 检查前一章节:', currentChapterIndex.value - 1, '状态:', prevStatus)
                
                if (prevStatus !== 'saved') {
                console.warn('handleGameEnd 阻止 - 前一章节未保存')
                showNotice('第' + (currentChapterIndex.value - 1) + '章尚未保存，请先确认并保存该章内容后再进入结算页面。', 10000)
                isGeneratingSettlement.value = false
                isLoading.value = false
                return
                }
            }
            
            console.log('handleGameEnd 所有章节检查通过，允许进入结算和获取结局')
            } catch (e) {
            console.error('handleGameEnd 检查创作者章节状态失败:', e)
            // 如果检查失败，也阻止跳转，让创作者手动处理
            showNotice('无法确认章节保存状态，请先确认并保存本章内容后再进入结算。', 10000)
            isGeneratingSettlement.value = false
            isLoading.value = false
            return
            }
        }
        
        // 在进入生成结算前，先尝试在「阅读者」模式下从后端获取结局场景并播放
        // 🔑 创作者模式：只有在章节状态为 saved 后才会执行到这里
        // 如果当前正在等待创作者触发的指定结局生成，则保持加载状态，不展示占位或结局选项
        try {
          if (creatorMode && creatorMode.value && pendingGeneratedEnding.value && pendingGeneratedEnding.value.workId === work.value.id) {
            console.log('handleGameEnd: awaiting pending generated ending, keep loading until it arrives')
            isGeneratingSettlement.value = true
            isLoading.value = true
            loadingProgress.value = 0
            return
          }
        } catch (e) { /* ignore */ }
        // 如果后端返回结局场景，则优先播放结局并返回，不直接进入结算页面
        // 如果我们刚刚播放完结局（justFinishedPlayingEnding），则不要再次去拉取结局以避免重复追加
        try {
          if (!justFinishedPlayingEnding.value && !playingEndingScenes.value && !eventSource) {
            try {
              const resp = await http.get(`/api/game/storyending/${work.value.id}`)
              const payload = resp && resp.data ? resp.data : resp
              // 缓存结局列表到 sessionStorage，供单个结局查询/轮询时参考其 status
              try {
                if (payload && Array.isArray(payload.endings) && payload.endings.length > 0) {
                  try { sessionStorage.setItem(`endingsList_${work.value.id}`, JSON.stringify(payload.endings)) } catch (e) {}
                }
              } catch (e) { /* ignore */ }

              // 如果后端明确返回了多个 endings（每个带 title/condition/scenes），
              // 我们需要先将这些结局作为“可选择的结局选项”呈现给用户，用户点击后会触发对应结局场景的播放。
              if (Array.isArray(payload?.endings) && payload.endings.length > 0) {
                const endings = payload.endings
                const startIdx = storyScenes.value.length
                // 构造一个临时场景，用于展示结局选项（场景级别 choices）
                const formatConditionText = (cond) => {
                  try {
                    if (!cond || typeof cond !== 'object') return ''
                    const parts = []
                    for (const [k, v] of Object.entries(cond)) {
                      if (v == null) continue
                      if (typeof v === 'string') {
                        const trimmed = v.trim()
                        // 如果像 ">=36"、"<=23"、">5" 等形式，直接拼接
                        if (/^(>=|<=|>|<|==|=)/.test(trimmed)) {
                          parts.push(`${k} ${trimmed}`)
                        } else {
                          parts.push(`${k} = ${trimmed}`)
                        }
                      } else {
                        parts.push(`${k} = ${String(v)}`)
                      }
                    }
                    return parts.join(', ')
                  } catch (e) { return '' }
                }

                const choiceScene = {
                  sceneId: `ending-choices-${Date.now()}`,
                  backgroundImage: work.value.coverUrl || '',
                  dialogues: [payload.prompt || '请选择一个结局：'],
                  // 直接使用场景级 choices 字段，pushSceneFromServer 会识别并处理
                  choices: endings.map((ed, i) => {
                    const cond = ed.condition || ed.conditions || {}
                    const condText = formatConditionText(cond)
                    const title = ed.title || `结局 ${i + 1}`
                    const display = condText ? `${title} (${condText})` : title
                    return {
                      id: ed.id ?? `ending-${i}`,
                      text: display,
                      // 附带元数据，供 chooseOption 识别并处理
                      _endingScenes: ed.scenes || [],
                      _endingCondition: cond,
                      _endingTitle: ed.title || ed.name || null,
                      _endingOutline: ed.outline || ed.summary || null,
                      _endingIndex: (ed.endingIndex != null) ? Number(ed.endingIndex) : (i + 1),
                      _endingStatus: ed.status || ed.state || null,
                      // 保持兼容：保留 subsequentDialogues 空数组
                      subsequentDialogues: []
                    }
                  }),
                  // 触发点在第一句对话后立即展示选项
                  isChapterEnding: false
                }

                // 🔑 创作者模式下，结局选项覆盖末章场景而非追加
                startIdx = storyScenes.value.length
                if (creatorMode && creatorMode.value) {
                  // 清空当前所有场景（末章缓存），用结局选项场景替换
                  const beforeCount = storyScenes.value.length
                  storyScenes.value = []
                  console.log(`[handleGameEnd] 创作者模式：清空末章的 ${beforeCount} 个场景，准备用结局选项覆盖`)
                  startIdx = 0
                }

                try { 
                  pushSceneFromServer(choiceScene) 
                  // pushSceneFromServer 会规范化 choices 字段，可能会丢弃我们直接放入的自定义字段。
                  // 因此这里将原始 endings 的元数据附回到刚推入的场景的 choices 上，保持索引对应关系。
                  try {
                    const pushedIdx = storyScenes.value.length - 1
                    const pushed = storyScenes.value[pushedIdx]
                    if (pushed && Array.isArray(pushed.choices)) {
                      for (let i = 0; i < pushed.choices.length; i++) {
                        const orig = endings[i] || {}
                        try { pushed.choices[i]._endingScenes = orig.scenes || orig.scenes || [] } catch (e) {}
                        try { pushed.choices[i]._endingCondition = orig.condition || orig.conditions || {} } catch (e) {}
                        try { pushed.choices[i]._endingTitle = orig.title || orig.name || null } catch (e) {}
                        try { pushed.choices[i]._endingOutline = orig.outline || orig.summary || null } catch (e) {}
                          try { pushed.choices[i]._endingIndex = (orig.endingIndex != null) ? Number(orig.endingIndex) : (i + 1) } catch (e) {}
                      }
                    }
                  } catch (attachErr) { console.warn('attach ending metadata failed', attachErr) }

                    // 标记该场景为结局选择场景（供 UI 特殊样式使用）
                    try {
                      const pushedIdx2 = storyScenes.value.length - 1
                      const pushed2 = storyScenes.value[pushedIdx2]
                      if (pushed2) pushed2._isEndingChoiceScene = true
                    } catch (e) { /* ignore */ }
                } catch (e) { console.warn('pushSceneFromServer for ending choice scene failed', e) }

                // 跳转到选项场景并显示文本，等待用户选择
                choicesVisible.value = false
                showText.value = false
                setTimeout(() => {
                  currentSceneIndex.value = startIdx
                  currentDialogueIndex.value = 0
                  showText.value = true
                  console.log('[handleGameEnd] 展示结局选项场景 at index', startIdx)
                }, 300)
                return
              }

              const scenes = extractScenesFromPayload(payload, attributes)

              if (scenes && Array.isArray(scenes) && scenes.length > 0) {
                // 记录结局 saved 状态（兼容多种后端字段）
                try { appendedEndingSaved.value = (payload?.status === 'saved') || (payload?.ending?.status === 'saved') || appendedEndingSaved.value } catch (e) {}
                startIdx = storyScenes.value.length
                console.log('[handleGameEnd] 收到后端结局场景，追加', scenes.length, '个场景，startIdx:', startIdx)
                for (const s of scenes) {
                  try {
                    const before = storyScenes.value.length
                    pushSceneFromServer(s)
                    // 标记刚追加的场景为后端结局场景，便于存档识别
                    try {
                      const pushed = storyScenes.value[before]
                      if (pushed) {
                        pushed._isBackendEnding = true
                        // 兼容性：也标记为 isEnding
                        pushed.isEnding = true
                        try { pushed._endingSaved = Boolean(appendedEndingSaved.value) } catch (e) {}
                      }
                    } catch (tagErr) { console.warn('tagging pushed ending scene failed', tagErr) }
                  } catch (e) { console.warn('pushSceneFromServer for ending scene failed', e) }
                }
                // 跳转到结局开始位置并开始播放
                choicesVisible.value = false
                showText.value = false
                setTimeout(() => {
                  currentSceneIndex.value = startIdx
                  currentDialogueIndex.value = 0
                  showText.value = true
                  // 标记正在播放结局场景
                  playingEndingScenes.value = true
                  console.log('[handleGameEnd] 开始播放结局场景 at index', startIdx)
                }, 300)
                return
              }
            } catch (e) {
              console.warn('[handleGameEnd] 获取结局场景失败，回退到结算流程:', e)
            }
          }
          // 如果我们到这里并且 justFinishedPlayingEnding 为 true，说明我们刚刚播放完结局，
          // 将其重置以便后续流程可以正常进入结算页面并且不会再次触发拉取结局
          if (justFinishedPlayingEnding.value) {
            try { justFinishedPlayingEnding.value = false } catch (e) {}
            console.log('[handleGameEnd] 刚刚播放完结局，跳过再次拉取结局，直接进入结算流程')
          }
        } catch (e) {
          console.warn('[handleGameEnd] 处理结局前置请求时发生错误:', e)
        }

        isGeneratingSettlement.value = true
        isLoading.value = true
        loadingProgress.value = 0

        // 如果尚未将结局追加到剧情中，先尝试拉取并插入结局场景
        // 对于创作者：如果刚刚播放的后端结局已被标记为 saved，则不再尝试去拉取/追加结局（避免再次弹出结局选择）
        const isCreatorUser = (creatorMode && creatorMode.value) || (creatorFeatureEnabled && creatorFeatureEnabled.value) || (isCreatorIdentity && isCreatorIdentity.value)
        if (!endingsAppended.value && !(isCreatorUser && appendedEndingSaved.value === true)) {
          try {
            console.log('handleGameEnd: 尚未追加结局，尝试拉取并追加结局场景')
            const appended = await fetchAndAppendEndings(work.value.id)
            // 如果成功追加结局，则退出 handleGameEnd，让玩家阅读结局后再次触发结算流程
            if (appended) {
              isGeneratingSettlement.value = false
              isLoading.value = false
              loadingProgress.value = 0
              return
            }
            // 如果未追加（超时或失败），继续走原始结算逻辑作为回退
            console.log('handleGameEnd: 结局未追加（可能超时或错误），继续结算流程')
          } catch (e) {
            console.warn('handleGameEnd: fetchAndAppendEndings 失败，继续结算流程', e)
          }
        } else {
          console.log('handleGameEnd: 结局已追加，进入结算生成')
        }
        
        // 模拟结算页面生成过程
        const generateSettlement = async () => {
            for (let i = 0; i <= 100; i += 5) {
            loadingProgress.value = i
            await new Promise(resolve => setTimeout(resolve, 50))
            }
            
            // 生成完成后跳转到结算页面
            // 优先尝试从后端获取个性化结算报告（若后端返回则使用），否则回退到本地快照
            let settlementData = null
            try {
            const remote = await fetchReport(work.value.id)
            if (remote) {
                // 保留后端返回的结算数据，但确保包含本地的 choiceHistory / storyScenes / attributes/statuses
                settlementData = Object.assign({}, remote)
                
                // 🔑 关键修复：确保 work 信息始终存在
                if (!settlementData.work) {
                    try { settlementData.work = deepClone(work.value) } catch (e) { settlementData.work = work.value }
                }
                
                if (!Array.isArray(settlementData.choiceHistory) || settlementData.choiceHistory.length === 0) {
                try { settlementData.choiceHistory = Array.isArray(choiceHistory.value) ? deepClone(choiceHistory.value) : [] } catch (e) { settlementData.choiceHistory = [] }
                }
                if (!settlementData.storyScenes || !Array.isArray(settlementData.storyScenes) || settlementData.storyScenes.length === 0) {
                try { settlementData.storyScenes = deepClone(storyScenes.value) } catch (e) { settlementData.storyScenes = [] }
                }
                if (!settlementData.finalAttributes) {
                try { settlementData.finalAttributes = deepClone(attributes.value) } catch (e) { settlementData.finalAttributes = {} }
                }
                if (!settlementData.finalStatuses) {
                try { settlementData.finalStatuses = deepClone(statuses.value) } catch (e) { settlementData.finalStatuses = {} }
                }
            }
            } catch (e) { console.warn('fetchReport failed in handleGameEnd:', e) }

            if (!settlementData) {
                settlementData = {
                    work: work.value,
                    choiceHistory: choiceHistory.value,
                    finalAttributes: attributes.value,
                    finalStatuses: statuses.value,
                    storyScenes: storyScenes.value,
                    currentSceneIndex: currentSceneIndex.value,
                    currentDialogueIndex: currentDialogueIndex.value
                }
            }
            
            // 最后再次检查确保 work 信息存在（双重保险）
            if (!settlementData.work) {
                console.warn('handleGameEnd: settlementData 缺少 work，使用当前 work')
                settlementData.work = work.value
            }
            
            // 详细调试日志
            console.log('[handleGameEnd] 当前 work 对象:', work.value)
            console.log('[handleGameEnd] settlementData.work:', settlementData.work)
            console.log('[handleGameEnd] 完整的 settlementData:', settlementData)
            
            try { 
                sessionStorage.setItem('settlementData', JSON.stringify(settlementData))
                console.log('[handleGameEnd] settlementData 已保存到 sessionStorage')
            } catch (e) { 
                console.error('[handleGameEnd] 保存 settlementData 到 sessionStorage 失败:', e) 
            }
            
            console.log('跳转到结算页面，结算数据:', settlementData)
            router.push('/settlement')
        }
        
        generateSettlement()
    }

    // 交叉检查并修正 attributesDelta 和 statusesDelta
    // 确保属性变化不会被错误地放到状态中，反之亦然
    const normalizeDeltas = (attributesDelta, statusesDelta) => {
        // 获取初始属性和状态的键集合
        const initialAttributeKeys = new Set(Object.keys(attributes.value || {}))
        const initialStatusKeys = new Set(Object.keys(statuses.value || {}))
        
        const correctedAttributesDelta = {}
        const correctedStatusesDelta = {}
        
        // 处理 attributesDelta：检查是否有应该在 statusesDelta 中的字段
        if (attributesDelta && typeof attributesDelta === 'object') {
            for (const [key, value] of Object.entries(attributesDelta)) {
                if (initialStatusKeys.has(key)) {
                    // 这个字段原本是状态，应该放到 statusesDelta
                    console.log(`[normalizeDeltas] 修正: "${key}" 从 attributesDelta 移到 statusesDelta`)
                    correctedStatusesDelta[key] = value
                } else {
                    // 正常的属性
                    correctedAttributesDelta[key] = value
                }
            }
        }
        
        // 处理 statusesDelta：检查是否有应该在 attributesDelta 中的字段
        if (statusesDelta && typeof statusesDelta === 'object') {
            for (const [key, value] of Object.entries(statusesDelta)) {
                if (initialAttributeKeys.has(key)) {
                    // 这个字段原本是属性，应该放到 attributesDelta
                    console.log(`[normalizeDeltas] 修正: "${key}" 从 statusesDelta 移到 attributesDelta`)
                    correctedAttributesDelta[key] = value
                } else {
                    // 正常的状态
                    correctedStatusesDelta[key] = value
                }
            }
        }
        
        console.log('[normalizeDeltas] 修正前:', { attributesDelta, statusesDelta })
        console.log('[normalizeDeltas] 修正后:', { 
            attributesDelta: correctedAttributesDelta, 
            statusesDelta: correctedStatusesDelta 
        })
        
        return {
            attributesDelta: correctedAttributesDelta,
            statusesDelta: correctedStatusesDelta
        }
    }

    // 选择选项
    const chooseOption = async (choice) => {
        try {
            console.log('[chooseOption] 选择了选项:', choice)
            console.log('[chooseOption] 当前是否在手动编辑模式:', creatorMode?.value)
            console.log('[chooseOption] 原始 attributesDelta:', choice.attributesDelta)
            console.log('[chooseOption] 原始 statusesDelta:', choice.statusesDelta)
            console.log('[chooseOption] subsequentDialogues:', choice.subsequentDialogues)
            
            // 🔑 关键修复：交叉检查并修正 delta
            const { attributesDelta, statusesDelta } = normalizeDeltas(
                choice.attributesDelta || {},
                choice.statusesDelta || {}
            )
            
            // 标记选项已消费
            const scene = currentScene.value
            if (scene) {
                scene.choiceConsumed = true
                scene.chosenChoiceId = choice.id
              // 如果这是一个后端结局选项（我们在 handleGameEnd 中构造的），优先处理结局分支
              if (choice._endingScenes || choice._endingIndex != null) {
                try {
                  const cond = choice._endingCondition || choice.condition || {}
                  const isCreator = (creatorMode && creatorMode.value) || (creatorFeatureEnabled && creatorFeatureEnabled.value) || (isCreatorIdentity && isCreatorIdentity.value)
                  const matched = isCreator ? true : evaluateCondition(cond, attributes)
                  if (!matched) {
                    // 条件不满足：提示并允许用户继续选择其它结局
                    showNotice('你不满足进入该结局的条件，进入失败。', 4000)
                    // 恢复选项未被消费状态，允许再次选择
                    try { scene.choiceConsumed = false } catch (e) {}
                    try { scene.chosenChoiceId = null } catch (e) {}
                    return
                  }

                  // 条件满足或为创作者：将对应的结局场景追加并播放
                  // 在本地记录用户进入的结局标题，供结算页面显示分支缩略图使用
                  try {
                    const endingTitle = choice._endingTitle || (choice.text && choice.text.toString()) || ''
                    if (endingTitle && work && work.value && work.value.id) {
                      sessionStorage.setItem(`selectedEndingTitle_${work.value.id}`, endingTitle)
                      console.log('[chooseOption] 已记录所选结局标题到 sessionStorage:', `selectedEndingTitle_${work.value.id}`, endingTitle)
                    }
                  } catch (e) { console.warn('保存 selectedEndingTitle 到 sessionStorage 失败', e) }

                  // 记录用户选择的结局索引（优先使用 choice._endingIndex，否则回退到 1）
                  try {
                    if (typeof lastSelectedEndingIndex !== 'undefined' && lastSelectedEndingIndex && lastSelectedEndingIndex.value !== undefined) {
                      const chosenIdx = (choice._endingIndex != null) ? Number(choice._endingIndex) : 1
                      lastSelectedEndingIndex.value = chosenIdx
                      console.log('[chooseOption] 记录 lastSelectedEndingIndex =', chosenIdx)
                      // 也持久化到 sessionStorage 以便页面刷新前能保留该值
                      try { if (work && work.value && work.value.id) sessionStorage.setItem(`lastSelectedEndingIndex_${work.value.id}`, String(chosenIdx)) } catch (e) {}
                    }
                  } catch (e) { console.warn('记录 lastSelectedEndingIndex 时出错', e) }

                  // 如果为创作者身份：先请求结局列表（GET /api/game/storyending/{workId}/），
                  // 若所选结局在列表中存在且 status != 'not_generated'，则直接请求该结局详情并播放；
                  // 否则打开结局编辑器以供创作者编辑/生成（取消不会触发额外请求）。
                  if (isCreator) {
                    const endingIdx = (choice._endingIndex != null) ? Number(choice._endingIndex) : null
                    try {
                      // 获取结局列表
                      const listResp = await http.get(`/api/game/storyending/${work.value.id}/`)
                      const listPayload = listResp && listResp.data ? listResp.data : listResp
                      const endings = Array.isArray(listPayload?.endings) ? listPayload.endings : []

                      // 尝试按逻辑 endingIndex 或 endingId 找到对应条目
                      let matched = null
                      if (endingIdx != null && endings.length > 0) {
                        matched = endings.find(e => (e.endingIndex != null && Number(e.endingIndex) === endingIdx) || (e.endingId != null && Number(e.endingId) === endingIdx) || (e.id != null && Number(e.id) === endingIdx))
                      }
                      // 回退：按标题匹配
                      if (!matched && endings.length > 0) {
                        const title = choice._endingTitle || (choice.text && choice.text.toString()) || ''
                        if (title) matched = endings.find(e => (e.title === title) || (e.name === title))
                      }

                      const backendStatus = matched ? (matched.status || matched.state || null) : null
                      // 如果后端已生成或已保存，则直接 GET 结局详情并播放
                      if (backendStatus && backendStatus !== 'not_generated') {
                        // 若找不到 endingIdx，无法通过索引请求详情，回退到弹出编辑器
                        if (endingIdx == null) {
                          try { openEndingEditor(choice) } catch (e) { console.warn('openEndingEditor failed', e) }
                          return
                        }
                        try { if (typeof startLoading === 'function') startLoading() } catch (e) {}
                        try {
                          const resp = await http.get(`/api/game/storyending/${work.value.id}/${endingIdx}/`)
                          const payload = resp && resp.data ? resp.data : resp
                          const endingStatus = payload && payload.ending && payload.ending.status
                          try { appendedEndingSaved.value = (endingStatus === 'saved') || appendedEndingSaved.value } catch (e) {}
                          const fetchedScenes = extractScenesFromPayload(payload, attributes)
                          let scenesToPush = Array.isArray(fetchedScenes) ? fetchedScenes : []
                          if (!scenesToPush || scenesToPush.length === 0) scenesToPush = Array.isArray(choice._endingScenes) ? choice._endingScenes : []
                          if (!scenesToPush || scenesToPush.length === 0) {
                            showNotice('所选结局未返回可播放场景，无法直接进入结局。', 4000)
                            try { scene.choiceConsumed = false } catch (e) {}
                            try { scene.chosenChoiceId = null } catch (e) {}
                            try { if (typeof stopLoading === 'function') stopLoading() } catch (e) {}
                            return
                          }
                          try {
                            const outline = (payload && (payload.ending?.outline || payload.outline)) ? (payload.ending?.outline || payload.outline) : ''
                            if (outline && work && work.value && work.value.id) {
                              try { sessionStorage.setItem(`selectedEndingOutline_${work.value.id}`, String(outline)) } catch (e) {}
                            }
                          } catch (e) { console.warn('保存 selectedEndingOutline 失败', e) }
                          const before = storyScenes.value.filter(s => !s._isBackendEnding)
                          storyScenes.value = before.slice()
                          const startIdx = storyScenes.value.length
                          for (const s of scenesToPush) {
                            try {
                              const beforePush = storyScenes.value.length
                              pushSceneFromServer(s)
                              try {
                                const pushed = storyScenes.value[beforePush]
                                if (pushed) {
                                  pushed._isBackendEnding = true
                                  pushed.isEnding = true
                                  try { pushed._endingSaved = Boolean(appendedEndingSaved.value) } catch (e) {}
                                  try { if (endingIdx != null) pushed._endingIndex = Number(endingIdx) } catch (e) {}
                                }
                              } catch (tagErr) { console.warn('tagging pushed chosen ending scene failed', tagErr) }
                            } catch (e) { console.warn('pushSceneFromServer for chosen ending failed', e) }
                          }
                          choicesVisible.value = false
                          showText.value = false
                          setTimeout(() => {
                            currentSceneIndex.value = startIdx
                            currentDialogueIndex.value = 0
                            showText.value = true
                            playingEndingScenes.value = true
                            try { if (typeof stopLoading === 'function') stopLoading() } catch (e) {}
                          }, 300)
                          return
                        } catch (e) {
                          console.warn('[chooseOption] Creator: 请求结局详情失败，回退到编辑器流程', e)
                          try { if (typeof stopLoading === 'function') stopLoading() } catch (ee) {}
                          try { openEndingEditor(choice) } catch (err) { console.warn('openEndingEditor failed', err) }
                          return
                        }
                      }
                      // 后端标记为未生成或未找到：打开编辑器让创作者编辑/生成（取消不会触发额外请求）
                      try { openEndingEditor(choice) } catch (e) { console.warn('openEndingEditor failed', e) }
                      return
                    } catch (e) {
                      console.warn('[chooseOption] Creator: 获取结局列表失败，回退到编辑器流程', e)
                      try { openEndingEditor(choice) } catch (err) { console.warn('openEndingEditor failed', err) }
                      return
                    }
                  }

                  let scenesToPush = Array.isArray(choice._endingScenes) ? choice._endingScenes : []
                  // 对于阅读者：优先通过 endingIndex 向后端请求最新的结局场景（若提供 endingIndex）
                  if (!isCreator && (choice._endingIndex != null)) {
                    try {
                      const endingIndex = Number(choice._endingIndex)
                      console.log('[chooseOption] Reader: 将通过 endingIndex 向后端请求结局场景, endingIndex=', endingIndex)
                      const resp = await http.get(`/api/game/storyending/${work.value.id}/${endingIndex}`)
                      const payload = resp && resp.data ? resp.data : resp
                      // 记录该结局是否已保存
                      try { appendedEndingSaved.value = (payload?.status === 'saved') || (payload?.ending?.status === 'saved') || appendedEndingSaved.value } catch (e) {}
                      const fetchedScenes = extractScenesFromPayload(payload, attributes)
                      if (Array.isArray(fetchedScenes) && fetchedScenes.length > 0) {
                        scenesToPush = fetchedScenes
                        console.log('[chooseOption] Reader: 成功获取结局场景，共', scenesToPush.length, '个场景')
                        try {
                          // 保存所选结局的大纲，供结算页显示
                          const outline = (payload && (payload.ending?.outline || payload.outline)) ? (payload.ending?.outline || payload.outline) : ''
                          if (outline && work && work.value && work.value.id) {
                            try { sessionStorage.setItem(`selectedEndingOutline_${work.value.id}`, String(outline)) } catch (e) {}
                          }
                        } catch (e) { console.warn('保存 selectedEndingOutline 失败', e) }
                      } else {
                        // 后端未返回 scenes，回退到 choice._endingScenes（若有）或报错
                        if (!scenesToPush || scenesToPush.length === 0) {
                          console.warn('[chooseOption] Reader: 后端返回的结局没有可用场景，且本地也无 scenes')
                          showNotice('无法获取所选结局的剧情内容，请稍后重试。', 4000)
                          try { scene.choiceConsumed = false } catch (e) {}
                          try { scene.chosenChoiceId = null } catch (e) {}
                          return
                        }
                      }
                    } catch (e) {
                      console.warn('[chooseOption] Reader: 请求结局场景失败:', e)
                      showNotice('请求结局剧情失败，请检查网络或稍后重试。', 4000)
                      try { scene.choiceConsumed = false } catch (e) {}
                      try { scene.chosenChoiceId = null } catch (e) {}
                      return
                    }
                  } else {
                    // 对于创作者或未提供 endingIndex 的情况，保持原有逻辑：使用 choice._endingScenes（创作者会被拦截到 editor）
                    scenesToPush = Array.isArray(choice._endingScenes) ? choice._endingScenes : []
                  }

                  // 新规则：用所选结局覆盖「前一章」的缓存（如果能找到前一章），否则回退为追加行为
                  const replaceChapter = (currentChapterIndex && Number(currentChapterIndex.value)) ? Number(currentChapterIndex.value) : null
                  if (replaceChapter != null) {
                    const firstIndex = storyScenes.value.findIndex(s => Number(s.chapterIndex) === replaceChapter)
                    if (firstIndex >= 0) {
                      let lastIndex = firstIndex
                      for (let i = firstIndex; i < storyScenes.value.length; i++) {
                        if (Number(storyScenes.value[i].chapterIndex) === replaceChapter) lastIndex = i
                        else break
                      }

                      const before = storyScenes.value.slice(0, firstIndex)
                      const after = storyScenes.value.slice(lastIndex + 1)

                      // 重建 scenes：前段 + 结局 scenes + 后段
                      storyScenes.value = before.slice()
                      for (const s of scenesToPush) {
                        try {
                          const beforePush = storyScenes.value.length
                          pushSceneFromServer(s)
                          try {
                            const pushed = storyScenes.value[beforePush]
                            if (pushed) {
                              pushed._isBackendEnding = true
                              pushed.isEnding = true
                              try { pushed._endingSaved = Boolean(appendedEndingSaved.value) } catch (e) {}
                              try {
                                if (choice && choice._endingIndex != null) pushed._endingIndex = Number(choice._endingIndex)
                                else if (typeof endingIdx !== 'undefined' && endingIdx != null) pushed._endingIndex = Number(endingIdx)
                                else if (typeof endingIndex !== 'undefined' && endingIndex != null) pushed._endingIndex = Number(endingIndex)
                              } catch (e) {}
                            }
                          } catch (tagErr) { console.warn('tagging pushed chosen ending scene failed', tagErr) }
                        } catch (e) { console.warn('pushSceneFromServer for chosen ending failed', e) }
                      }

                      for (const s of after) {
                        try { storyScenes.value.push(s) } catch (e) { console.warn('re-append after segment failed', e) }
                      }

                      // 标记结局已被追加/覆盖，避免后续重复插入
                      try { endingsAppended.value = true } catch (e) { console.warn('failed to set endingsAppended in chooseOption', e) }

                      // 跳转到被替换后结局的起始位置
                      const startIdx = before.length
                      choicesVisible.value = false
                      showText.value = false
                      setTimeout(() => {
                        currentSceneIndex.value = startIdx
                        currentDialogueIndex.value = 0
                        currentChapterIndex.value = replaceChapter
                        showText.value = true
                        playingEndingScenes.value = true
                        console.log('[chooseOption] 已用所选结局覆盖前一章，开始播放结局场景 at index', startIdx)
                      }, 300)
                      return
                    }
                  }

                  // 兼容回退：未找到要替换的章节，按旧逻辑追加到末尾
                  const startIdx = storyScenes.value.length
                  for (const s of scenesToPush) {
                    try {
                      const beforePush = storyScenes.value.length
                      pushSceneFromServer(s)
                      try {
                        const pushed = storyScenes.value[beforePush]
                        if (pushed) {
                          pushed._isBackendEnding = true
                          pushed.isEnding = true
                          try { pushed._endingSaved = Boolean(appendedEndingSaved.value) } catch (e) {}
                          try {
                            if (choice && choice._endingIndex != null) pushed._endingIndex = Number(choice._endingIndex)
                            else if (typeof endingIdx !== 'undefined' && endingIdx != null) pushed._endingIndex = Number(endingIdx)
                            else if (typeof endingIndex !== 'undefined' && endingIndex != null) pushed._endingIndex = Number(endingIndex)
                          } catch (e) {}
                        }
                      } catch (tagErr) { console.warn('tagging pushed chosen ending scene failed', tagErr) }
                    } catch (e) { console.warn('pushSceneFromServer for chosen ending failed', e) }
                  }

                  try { endingsAppended.value = true } catch (e) { console.warn('failed to set endingsAppended in chooseOption', e) }

                  // 跳转到结局场景并开始播放
                  choicesVisible.value = false
                  showText.value = false
                  setTimeout(() => {
                    currentSceneIndex.value = startIdx
                    currentDialogueIndex.value = 0
                    showText.value = true
                    playingEndingScenes.value = true
                    console.log('[chooseOption] 选择结局，开始播放结局场景 at index', startIdx)
                  }, 300)
                  return
                } catch (e) {
                  console.warn('[chooseOption] 处理结局选项时出错:', e)
                }
              }
                
                // 🔑 关键修复：如果选项有 subsequentDialogues，插入到当前场景的对话列表中
                // 保持 subsequentDialogues 的原始格式，不转换为 narration
                if (Array.isArray(choice.subsequentDialogues) && choice.subsequentDialogues.length > 0) {
                    console.log('[chooseOption] 插入 subsequentDialogues:', choice.subsequentDialogues)
                    // 获取当前触发点的位置
                    const triggerIndex = scene.choiceTriggerIndex || currentDialogueIndex.value
                    // 在触发点之后插入 subsequentDialogues
                    const insertIndex = triggerIndex + 1
                    
                    // 🔑 关键修复：规范化 subsequentDialogues，保持其原始格式
                    // subsequentDialogues 中的每一项都按原样插入，不做格式转换
                    // - 如果是字符串，保持为字符串（会被 getDialogueItem 转换为 { text: string }）
                    // - 如果是对象（包含 text/narration/speaker/backgroundImage 等），保持完整结构
                    // 🔑 关键修复：添加标记以便在保存时识别这些对话来自哪个选项
                    const normalizedSubsequent = choice.subsequentDialogues.map((item, idx) => {
                        let normalized
                        // 如果是字符串，转换为对象以便添加标记
                        if (typeof item === 'string') {
                            normalized = {
                                text: item,
                                _fromChoiceId: choice.id,
                                _fromChoiceIndex: idx
                            }
                        }
                        // 如果是对象，保持其完整结构并添加标记
                        else if (item && typeof item === 'object') {
                            normalized = {
                                ...item,
                                _fromChoiceId: choice.id,
                                _fromChoiceIndex: idx
                            }
                        }
                        // 其他情况转为字符串再转对象
                        else {
                            normalized = {
                                text: String(item),
                                _fromChoiceId: choice.id,
                                _fromChoiceIndex: idx
                            }
                        }
                        return normalized
                    })
                    
                    scene.dialogues.splice(insertIndex, 0, ...normalizedSubsequent)
                    console.log('[chooseOption] 插入后的对话列表:', scene.dialogues)
                    console.log('[chooseOption] 插入后的对话列表长度:', scene.dialogues.length)
                }
            }
            
            // 🔑 关键：只有在非手动编辑模式下才记录选择历史
            if (!creatorMode?.value) {
                // 🔑 关键修复：记录选择历史时，保存所有可选项以供分支图使用
                // 从当前场景获取所有选项
                const allChoices = scene?.choices || []
                
                // 记录选择历史（包含 choiceTriggerIndex 用于读档恢复）
                choiceHistory.value.push({
                    sceneId: scene?.id || scene?.sceneId,
                    sceneIndex: currentSceneIndex?.value,
                    sceneTitle: scene?.title || scene?.chapterTitle,
                    choiceId: choice.id,
                    choiceText: choice.text,
                    choiceTriggerIndex: scene?.choiceTriggerIndex || currentDialogueIndex.value,
                    chapterIndex: currentChapterIndex?.value || 1,
                    timestamp: Date.now(),
                    // 🔑 保存所有可选项，用于生成分支探索图
                    allChoices: allChoices.map(c => ({
                        id: c.id || c.choiceId,
                        choiceId: c.id || c.choiceId,
                        text: c.text
                    }))
                })
                console.log('[chooseOption] ✅ 记录选择历史（正常游戏模式），包含', allChoices.length, '个可选项')
            } else {
                console.log('[chooseOption] ⚠️ 手动编辑模式下不记录选择历史')
            }
            
            // 更新最后选择时间戳
            if (lastChoiceTimestamp) {
                lastChoiceTimestamp.value = Date.now()
            }
            
            // 隐藏选项
            choicesVisible.value = false
            
            // 🔑 清除等待点击显示选项的标记
            if (waitingForClickToShowChoices) {
                waitingForClickToShowChoices.value = false
            }
            
            // 🔑 关键：只有在非手动编辑模式下才应用属性和状态变化
            if (!creatorMode?.value) {
                // 应用属性和状态变化（使用修正后的 delta）
                if (attributesDelta && Object.keys(attributesDelta).length > 0) {
                    console.log('[chooseOption] 调用 applyAttributesDelta（修正后）')
                    applyAttributesDelta(attributesDelta)
                } else {
                    console.log('[chooseOption] 没有 attributesDelta 需要应用')
                }
                
                if (statusesDelta && Object.keys(statusesDelta).length > 0) {
                    console.log('[chooseOption] 调用 applyStatusesDelta（修正后）')
                    applyStatusesDelta(statusesDelta)
                } else {
                    console.log('[chooseOption] 没有 statusesDelta 需要应用')
                }
            } else {
                console.log('[chooseOption] ⚠️ 手动编辑模式下不应用属性和状态变化')
            }
            
            // 🔑 修复：安全地访问 autoPlayEnabled 和 startAutoPlayTimer
            try {
                if (autoPlayEnabled && autoPlayEnabled.value && startAutoPlayTimer) {
                    startAutoPlayTimer()
                }
            } catch (e) {
                console.warn('[chooseOption] 启动自动播放失败:', e)
            }
            
            // 🔑 关键修复：前进到下一句对话（选项触发点的下一句，可能是 subsequentDialogues 的第一句）
            showText.value = false
            setTimeout(() => {
                // 如果选项有 subsequentDialogues，前进到下一句会显示这些对话
                if (currentDialogueIndex.value < scene.dialogues.length - 1) {
                    currentDialogueIndex.value++
                    showText.value = true
                    console.log('[chooseOption] 前进到下一句对话，索引:', currentDialogueIndex.value)
                } else {
                    // 场景结束，移动到下一个场景
                    if (currentSceneIndex.value < storyScenes.value.length - 1) {
                        currentSceneIndex.value++
                        currentDialogueIndex.value = 0
                        showText.value = true
                        console.log('[chooseOption] 场景结束，移动到下一个场景')
                    }
                }
            }, 500)
        } catch (e) {
            console.error('[chooseOption] 选择选项失败:', e)
        }
    }

    // 请求横屏
    const requestLandscape = async () => {
        try {
            if (isNativeApp.value) {
                // Capacitor 环境
                await ScreenOrientation.lock({ orientation: 'landscape' })
            } else {
                // 浏览器环境：请求全屏
                const elem = document.documentElement
                if (elem.requestFullscreen) {
                    await elem.requestFullscreen()
                } else if (elem.mozRequestFullScreen) {
                    await elem.mozRequestFullScreen()
                } else if (elem.webkitRequestFullscreen) {
                    await elem.webkitRequestFullscreen()
                } else if (elem.msRequestFullscreen) {
                    await elem.msRequestFullscreen()
                }
                
                // 尝试锁定横屏
                if (screen.orientation && screen.orientation.lock) {
                    try {
                        await screen.orientation.lock('landscape')
                    } catch (e) {
                        console.warn('横屏锁定失败:', e)
                    }
                }
            }
            
            isLandscapeReady.value = true
        } catch (err) {
            console.error('请求横屏失败:', err)
            // 即使失败也标记为就绪
            isLandscapeReady.value = true
        }
    }

    // 进度条定时器引用
    let progressTimer = null

    // 模拟加载到100%
    const simulateLoadTo100 = async () => {
        for (let i = loadingProgress.value; i <= 100; i += 5) {
            loadingProgress.value = i
            await new Promise(resolve => setTimeout(resolve, 50))
        }
    }

    // 开始加载 - 匀速前进到90%
    const startLoading = () => {
        isLoading.value = true
        loadingProgress.value = 0
        
        // 清除之前的定时器
        if (progressTimer) {
            clearInterval(progressTimer)
            progressTimer = null
        }
        
        // 匀速增加进度到90%，假设30秒内完成
        // 每100ms增加0.3%，大约30秒到达90%
        progressTimer = setInterval(() => {
            if (loadingProgress.value < 90) {
                loadingProgress.value = Math.min(90, loadingProgress.value + 0.3)
            }
        }, 100)
    }

    // 停止加载
    const stopLoading = async () => {
        // 清除进度定时器
        if (progressTimer) {
            clearInterval(progressTimer)
            progressTimer = null
        }
        
        // 如果还没到90%，直接跳到90%
        if (loadingProgress.value < 90) {
            loadingProgress.value = 90
        }
        
        // 然后快速完成到100%
        await simulateLoadTo100()
        isLoading.value = false
    }

    // 应用属性变化
    const applyAttributesDelta = (delta) => {
        if (!delta || typeof delta !== 'object') return
        
        console.log('[applyAttributesDelta] 应用属性变化:', delta)
        console.log('[applyAttributesDelta] 当前属性:', attributes.value)
        
        for (const [key, value] of Object.entries(delta)) {
            if (typeof value === 'number') {
                // 确保初始化属性值
                if (!attributes.value[key]) {
                    attributes.value[key] = 0
                }
                // 累加属性值
                attributes.value[key] += value
                console.log(`[applyAttributesDelta] ${key}: ${attributes.value[key] - value} + ${value} = ${attributes.value[key]}`)
            } else {
                // 直接设置属性值
                attributes.value[key] = value
                console.log(`[applyAttributesDelta] ${key} 设置为: ${value}`)
            }
        }
        
        console.log('[applyAttributesDelta] 更新后的属性:', attributes.value)
    }

    // 应用状态变化
    const applyStatusesDelta = (delta) => {
        if (!delta || typeof delta !== 'object') return
        
        console.log('[applyStatusesDelta] 应用状态变化:', delta)
        console.log('[applyStatusesDelta] 当前状态:', statuses.value)
        
        for (const [key, value] of Object.entries(delta)) {
            statuses.value[key] = value
            console.log(`[applyStatusesDelta] ${key} 设置为: ${value}`)
        }
        
        console.log('[applyStatusesDelta] 更新后的状态:', statuses.value)
    }

    
    // 在玩家阅读到场景开头（函数 nextDialogue 或进入新 scene 调用处）调用此函数以触发后端生成下一章（若后端未通过 streamUrl 自动推送）
    const requestNextIfNeeded = async () => {
    try {
        // 防止重复调用
        if (isRequestingNext) {
        console.log('[requestNextIfNeeded] 已在处理中，跳过重复调用')
        return
        }
        
        // 如果已由 SSE 推送，则不需要额外请求
        if (eventSource) return
        
        // 检查是否到达当前章节末尾
        if (!currentScene.value) return
        
        const atLastScene = currentSceneIndex.value >= storyScenes.value.length - 1
        const atLastDialogue = Array.isArray(currentScene.value.dialogues) 
        ? (currentDialogueIndex.value >= (currentScene.value.dialogues.length - 1)) 
        : true
        const isChapterEndScene = currentScene.value.isChapterEnding === true || currentScene.value.chapterEnd === true
        
        // 判断是否到达章节末尾：要么场景明确标记为章节结束，要么已经是最后一个场景的最后一句对话
        const isAtChapterEnd = (isChapterEndScene && atLastDialogue) || (atLastScene && atLastDialogue)
        
        if (!isAtChapterEnd) {
        console.log('[requestNextIfNeeded] 未到章节末尾，不触发加载')
        return
        }

        // 设置标志，表示正在处理
        isRequestingNext = true
        
        // 立即停止自动播放，避免重复调用
        safeStopAutoPlay()

        console.log('[requestNextIfNeeded] 到达章节末尾，准备加载下一章')
        console.log('[requestNextIfNeeded] 当前章节:', currentChapterIndex.value, '总章数:', totalChapters.value)
        
        // 现在确认为章节结束，按原先逻辑请求下一章（并在需要时替换现有章节）
        const nextChapter = currentChapterIndex.value + 1
        
        // 检查是否已经读完最后一章
        // 只有当 totalChapters 有值时才进行判断
        const isLastChapter = totalChapters.value && Number(currentChapterIndex.value) === Number(totalChapters.value)
        
        console.log('[requestNextIfNeeded] 下一章:', nextChapter, '是否最后一章:', isLastChapter)
        
        if (isLastChapter) {
        // 已读完最后一章
        console.log('[requestNextIfNeeded] 已读完最后一章，准备跳转到结算界面')

        // 仅在阅读者模式下尝试从后端获取结局剧情并插入播放，若返回则直接播放结局
        if (!creatorMode.value) {
        try {
          console.log('[requestNextIfNeeded] Reader last chapter reached — attempting to fetch story ending from backend')
          const resp = await http.get(`/api/game/storyending/${work.value.id}`)
          const payload = resp && resp.data ? resp.data : resp
          // 仅当后端明确返回 `endings` 列表时，才把结局作为剧情追加并播放；否则视为无结局（不追加）
          if (Array.isArray(payload?.endings) && payload.endings.length > 0) {
            const endings = payload.endings
            const startIdx = storyScenes.value.length
            // 构造一个临时场景用于展示结局选项，保持与 handleGameEnd 中的行为一致
            const formatConditionText = (cond) => {
              try {
                if (!cond || typeof cond !== 'object') return ''
                const parts = []
                for (const [k, v] of Object.entries(cond)) {
                  if (v == null) continue
                  if (typeof v === 'string') {
                    const trimmed = v.trim()
                    if (/^(>=|<=|>|<|==|=)/.test(trimmed)) {
                      parts.push(`${k} ${trimmed}`)
                    } else {
                      parts.push(`${k} = ${trimmed}`)
                    }
                  } else {
                    parts.push(`${k} = ${String(v)}`)
                  }
                }
                return parts.join(', ')
              } catch (e) { return '' }
            }

            const choiceScene = {
              sceneId: `ending-choices-${Date.now()}`,
              backgroundImage: work.value.coverUrl || '',
              dialogues: [payload.prompt || '请选择一个结局：'],
              choices: endings.map((ed, i) => {
                const cond = ed.condition || ed.conditions || {}
                const condText = formatConditionText(cond)
                const title = ed.title || `结局 ${i + 1}`
                const display = condText ? `${title} (${condText})` : title
                return {
                  id: ed.id ?? `ending-${i}`,
                  text: display,
                  _endingScenes: ed.scenes || [],
                  _endingCondition: cond,
                  _endingStatus: ed.status || ed.state || null,
                  subsequentDialogues: []
                }
              }),
              isChapterEnding: false
            }

            // 🔑 创作者模式下，结局选项覆盖末章场景而非追加
            startIdx = storyScenes.value.length
            if (creatorMode && creatorMode.value) {
              // 清空当前所有场景（末章缓存），用结局选项场景替换
              const beforeCount = storyScenes.value.length
              storyScenes.value = []
              console.log(`[requestNextIfNeeded] 创作者模式：清空末章的 ${beforeCount} 个场景，准备用结局选项覆盖`)
              startIdx = 0
            }

            try {
              pushSceneFromServer(choiceScene)
              try {
                const pushedIdx = storyScenes.value.length - 1
                const pushed = storyScenes.value[pushedIdx]
                if (pushed && Array.isArray(pushed.choices)) {
                  for (let i = 0; i < pushed.choices.length; i++) {
                    const orig = endings[i] || {}
                    try { pushed.choices[i]._endingScenes = orig.scenes || [] } catch (e) {}
                    try { pushed.choices[i]._endingCondition = orig.condition || orig.conditions || {} } catch (e) {}
                    try { pushed.choices[i]._endingTitle = orig.title || orig.name || null } catch (e) {}
                    try { pushed.choices[i]._endingOutline = orig.outline || orig.summary || null } catch (e) {}
                    try { pushed.choices[i]._endingIndex = (orig.endingIndex != null) ? Number(orig.endingIndex) : (i + 1) } catch (e) {}
                  }
                }
              } catch (attachErr) { console.warn('attach ending metadata failed', attachErr) }

              try {
                const pushedIdx2 = storyScenes.value.length - 1
                const pushed2 = storyScenes.value[pushedIdx2]
                if (pushed2) pushed2._isEndingChoiceScene = true
              } catch (e) { /* ignore */ }
            } catch (e) { console.warn('pushSceneFromServer for ending choice scene failed', e) }

            choicesVisible.value = false
            showText.value = false
            setTimeout(() => {
              currentSceneIndex.value = startIdx
              currentDialogueIndex.value = 0
              showText.value = true
              playingEndingScenes.value = true
              console.log('[requestNextIfNeeded] 展示结局选项场景 at index', startIdx)
            }, 300)
            isRequestingNext = false
            return
          } else {
            console.log('[requestNextIfNeeded] backend returned no endings list — skipping append')
          }
        } catch (e) {
          console.warn('[requestNextIfNeeded] fetch story ending failed or returned no scenes, continuing fallback logic', e)
        }
        } else {
          console.log('[requestNextIfNeeded] Creator mode — 不自动请求结局，走原有结算/保存检查流程')
        }

        // 若后端没有结局或请求失败，则继续原有的创作者/阅读者结算流程
        // 创作者身份：检查最后一章是否已保存
        if (creatorFeatureEnabled.value) {
            try {
            // 获取最新的章节状态
            await getWorkDetails(work.value.id)
            const lastChapterStatus = getChapterStatus(currentChapterIndex.value)
            console.log('[requestNextIfNeeded] 创作者身份，最后一章状态:', lastChapterStatus)
            
            // 如果最后一章状态是 saved，则跳转到结算
            if (lastChapterStatus === 'saved') {
                console.log('[requestNextIfNeeded] 最后一章已保存，跳转到结算界面')
                showNotice('故事已完结，即将进入结算页面...', 2000)
                setTimeout(async () => {
                // 在进入结算前先尝试拉取并追加结局
                try {
                  if (!endingsAppended.value) {
                    const appended = await fetchAndAppendEndings(work.value.id)
                    if (appended) {
                      // 用户将阅读结局，停止后续结算流程
                      isRequestingNext = false
                      return
                    }
                  }
                } catch (e) { console.warn('pre-handleGameEnd fetch endings failed', e) }

                storyEndSignaled.value = true
                handleGameEnd()
                isRequestingNext = false  // 重置标志
                }, 2000)
                return
            } else {
                // 最后一章未保存，不跳转，等待创作者保存
                console.log('[requestNextIfNeeded] 最后一章未保存(状态:', lastChapterStatus, ')，等待手动保存')
                showNotice('已到达最后一章章末，请先确认并保存本章内容后再进入结算。', 5000)
                isRequestingNext = false  // 重置标志
                return
            }
            } catch (e) {
            console.warn('[requestNextIfNeeded] 检查最后一章状态失败:', e)
            showNotice('无法确认最后一章状态，请先确认并保存本章内容后再进入结算。', 5000)
            isRequestingNext = false  // 重置标志
            return
            }
        }

        // 阅读者身份：后端未返回结局，直接进入结算（兼容原逻辑）
        showNotice('故事已完结，即将进入结算页面...', 2000)
        setTimeout(() => {
          storyEndSignaled.value = true
          handleGameEnd()
          isRequestingNext = false  // 重置标志
        }, 2000)
        return
        }
        
        // 如果下一章超出范围，则标记为结束
        if (totalChapters.value && Number(nextChapter) > Number(totalChapters.value)) {
        console.log('[requestNextIfNeeded] nextChapter exceeds totalChapters, marking story end')
        storyEndSignaled.value = true
        showNotice('故事已完结，即将进入结算页面...', 2000)
        setTimeout(async () => {
          try {
            if (!endingsAppended.value) {
              const appended = await fetchAndAppendEndings(work.value.id)
              if (appended) { isRequestingNext = false; return }
            }
          } catch (e) { console.warn('pre-handleGameEnd fetch endings failed', e) }

          handleGameEnd()
          isRequestingNext = false  // 重置标志
        }, 2000)
        return
        }

        // 如果处于菜单创作者模式则不自动请求（但创作者身份仍然可以，会弹出编辑器）
        if (creatorMode.value) {
        console.log('[requestNextIfNeeded] 菜单创作者模式，不自动加载下一章')
        isRequestingNext = false  // 重置标志
        return
        }
        
        // 如果当前章节处于生成中或已生成但未保存（generated / generating），阻止自动请求下一章
        try {
        const curStatus = getChapterStatus(currentChapterIndex.value)
        if (curStatus === 'generating' || curStatus === 'generated') {
            console.log('[requestNextIfNeeded] current chapter in generated/generating state, auto-next blocked', curStatus)
            isRequestingNext = false  // 重置标志
            return
        }
        } catch (e) { /* ignore */ }

        // 请求下一章并用返回内容覆盖当前已加载的章节
        // 注意：对于创作者身份（creatorFeatureEnabled），不传递 suppressAutoEditor，让 fetchNextChapter 在章节未生成时弹出编辑器
        console.log(`[requestNextIfNeeded] 正在请求第 ${nextChapter} 章...`)
        try {
        startLoading()
        const opts = { replace: true }
        // 只有在非创作者身份时才抑制自动编辑器
        if (!creatorFeatureEnabled.value) {
            opts.suppressAutoEditor = true
        }
        const resp = await fetchNextChapter(work.value.id, nextChapter, opts)
        console.log('[requestNextIfNeeded] 成功加载下一章:', resp)
        
        // 加载成功后，重新启动自动播放（如果启用且无弹窗）
        if (autoPlayEnabled.value && !anyOverlayOpen.value) {
            console.log('[requestNextIfNeeded] 准备恢复自动播放...')
            setTimeout(() => {
            // 再次检查条件，确保没有弹窗打开
            if (autoPlayEnabled.value && !anyOverlayOpen.value) {
            console.log('[requestNextIfNeeded] 恢复自动播放')
            safeStartAutoPlay()
            } else {
                console.log('[requestNextIfNeeded] 自动播放未恢复 - enabled:', autoPlayEnabled.value, 'overlay:', anyOverlayOpen.value)
            }
            }, 500)
        } else {
            console.log('[requestNextIfNeeded] 自动播放未启用或有弹窗打开，不恢复 - enabled:', autoPlayEnabled.value, 'overlay:', anyOverlayOpen.value)
        }
        } catch (e) {
        console.error('[requestNextIfNeeded] 加载下一章失败:', e)
        } finally {
        try { await stopLoading() } catch (e) {}
        // 重置标志
        isRequestingNext = false
        }
    } catch (e) { 
        console.error('[requestNextIfNeeded] requestNextIfNeeded 执行失败:', e)
        // 重置标志
        isRequestingNext = false
    }
    }

  
  // 点击屏幕进入下一段对话
  const nextDialogue = async () => {
  console.log('[nextDialogue] called, showMenu:', showMenu.value, 'choicesVisible:', choicesVisible.value, 'editingDialogue:', editingDialogue?.value)
  
  if (showMenu.value) {
    // 如果菜单显示，点击不做任何事
    console.log('[nextDialogue] 菜单打开，忽略点击')
    return
  }

  // 🔑 关键修复：如果正在编辑对话，完全阻止任何对话切换
  if (editingDialogue?.value) {
    console.log('[nextDialogue] 正在编辑对话，阻止切换到下一句')
    return
  }

  // 🔑 新增：如果等待用户点击显示选项，此时用户点击了，就显示选项
    if (waitingForClickToShowChoices && waitingForClickToShowChoices.value) {
    console.log('[nextDialogue] 检测到等待点击显示选项标记，现在显示选项')
    waitingForClickToShowChoices.value = false
    choicesVisible.value = true
    safeStopAutoPlay()
    return
  }

  // 🔑 关键修复：如果当前显示选项，必须选择后才能继续，阻止任何前进
  if (choicesVisible.value) {
    console.log('[nextDialogue] 选项正在显示，必须先选择选项才能继续')
    // 可以添加一个视觉提示，告诉用户需要选择
    return
  }

  // 🔑 关键修复：检查当前是否应该显示选项但还没有显示（比如刚到达触发点）
  const scene = currentScene.value
  if (scene && Array.isArray(scene.choices) && scene.choices.length > 0) {
    // 检查是否到达选项触发点
    if (typeof scene.choiceTriggerIndex === 'number' && 
        currentDialogueIndex.value === scene.choiceTriggerIndex &&
        !scene.choiceConsumed) {
      console.log('[nextDialogue] 到达选项触发点，设置等待用户再次点击的标记')
      // 🔑 修改：不再立即显示选项，而是设置等待标记
      if (waitingForClickToShowChoices) {
        waitingForClickToShowChoices.value = true
      }
      safeStopAutoPlay()
      return
    }
  }

  // 在从存档/读档恢复后，我们可能抑制了自动展示选项（suppressAutoShowChoices）
  // 🔑 修复：只有当选项未被消费且当前正好在触发点时才显示选项
  try {
    if (suppressAutoShowChoices.value && scene) {
      // 清除抑制标记，让 watch 来决定是否显示选项
      suppressAutoShowChoices.value = false
      
      // 🔑 智能检查选择历史：只有当用户已经通过选项触发点时才拒绝
      const sceneId = String(scene.id || scene.sceneId)
      const historyRecord = choiceHistory.value.find(h => String(h.sceneId) === sceneId)
      
      if (historyRecord) {
        // 确定触发索引
        const triggerIndex = typeof scene.choiceTriggerIndex === 'number' 
          ? scene.choiceTriggerIndex 
          : (typeof historyRecord.choiceTriggerIndex === 'number' ? historyRecord.choiceTriggerIndex : null)
        
        // 🔑 关键判断：只有当当前对话位置大于触发点时，才拒绝显示
        if (triggerIndex !== null && currentDialogueIndex.value > triggerIndex) {
          console.log('[nextDialogue] ⛔ 智能拒绝：用户已通过选项触发点 - 场景ID:', sceneId, '当前位置:', currentDialogueIndex.value, '触发点:', triggerIndex)
          // 确保标记为已消费
          if (!scene.choiceConsumed) {
            scene.choiceConsumed = true
            scene.chosenChoiceId = historyRecord.choiceId
            if (typeof historyRecord.choiceTriggerIndex === 'number' && typeof scene.choiceTriggerIndex !== 'number') {
              scene.choiceTriggerIndex = historyRecord.choiceTriggerIndex
            }
            console.log('[nextDialogue] ⛔ 已自动标记场景为已消费')
          }
          choicesVisible.value = false
          return
        } else {
          console.log('[nextDialogue] ✅ 允许：用户还未通过触发点 - 场景ID:', sceneId, '当前位置:', currentDialogueIndex.value, '触发点:', triggerIndex)
          // 用户还未通过触发点，清除可能错误的标记
          if (scene.choiceConsumed && currentDialogueIndex.value < triggerIndex) {
            scene.choiceConsumed = false
            scene.chosenChoiceId = null
            console.log('[nextDialogue] ✅ 清除错误的消费标记')
          }
        }
      }
      
      // 只有在以下情况下才显示选项：
      // 1. 场景有有效的选项配置
      // 2. 选项未被消费过
      // 3. 当前对话索引正好等于触发索引（而不是大于等于）
      // 4. 选择历史中没有该场景的记录（上面已检查）
      // 🔑 修改：不再立即显示选项，而是设置等待标记
      if (scene && Array.isArray(scene.choices) && typeof scene.choiceTriggerIndex === 'number' && 
          currentDialogueIndex.value === scene.choiceTriggerIndex && 
          !scene.choiceConsumed &&
          !choicesVisible.value) {
        console.log('[nextDialogue] suppressAutoShowChoices active, 设置等待用户点击标记')
        if (waitingForClickToShowChoices) {
          waitingForClickToShowChoices.value = true
        }
        safeStopAutoPlay()
        return
      } else {
        console.log('[nextDialogue] suppressAutoShowChoices cleared, but not showing choices:', {
          hasChoices: Array.isArray(scene.choices),
          triggerIndex: scene.choiceTriggerIndex,
          currentIndex: currentDialogueIndex.value,
          choiceConsumed: scene.choiceConsumed,
          shouldShow: currentDialogueIndex.value === scene.choiceTriggerIndex
        })
      }
    }
  } catch (e) { console.warn('suppressAutoShowChoices check failed', e) }

  // 在创作者模式下，若未被允许播放则阻止切换
  if (creatorMode.value && !allowAdvance.value) {
    console.log('[nextDialogue] Creator mode active and advance is locked')
    return
  }
  
  console.log('[nextDialogue] Current scene:', scene, 'dialogue index:', currentDialogueIndex.value)

  // Guard against missing/undefined current scene
  if (!scene) {
    console.warn('[nextDialogue] currentScene is null or undefined — attempting recovery')
    try {
      if (Array.isArray(storyScenes.value) && storyScenes.value.length === 0 && !isFetchingNext.value) {
        startLoading()
        try {
          await fetchNextChapter(work.value.id, 1)
        } catch (e) {
          console.warn('fetchNextChapter recovery attempt failed', e)
        }
        await stopLoading()
        if (Array.isArray(storyScenes.value) && storyScenes.value.length > 0) {
          currentSceneIndex.value = 0
          currentDialogueIndex.value = 0
          showText.value = true
          return
        }
      }
    } catch (e) { console.warn('recovery from missing scene failed', e) }
    return
  }
  
  // 🔑 关键修复：在推进对话前，再次检查是否有未处理的选项
  if (Array.isArray(scene.choices) && scene.choices.length > 0 && !scene.choiceConsumed) {
    if (typeof scene.choiceTriggerIndex === 'number' && 
        currentDialogueIndex.value >= scene.choiceTriggerIndex) {
      console.log('[nextDialogue] 有未消费的选项，设置等待用户点击标记')
      if (waitingForClickToShowChoices) {
        waitingForClickToShowChoices.value = true
      }
      safeStopAutoPlay()
      return
    }
  }
  
  // 如果当前场景还有下一段对话
  if (currentDialogueIndex.value < scene.dialogues.length - 1) {
    showText.value = false
    setTimeout(() => {
      currentDialogueIndex.value++
      showText.value = true
      console.log('[nextDialogue] Next dialogue:', currentDialogueIndex.value)
    }, 200)
  } else {
    // 当前场景对话结束，检查是否是章节结束
    const isChapterEnd = (scene?.isChapterEnding === true) || (scene?.chapterEnd === true)
    
    // 切换到下一个场景
    if (currentSceneIndex.value < storyScenes.value.length - 1) {
      showText.value = false
      setTimeout(async () => {
        if (isChapterEnd) {
          currentChapterIndex.value++
          console.log('[nextDialogue] Chapter ended, moving to chapter:', currentChapterIndex.value)
        }
        
        choicesVisible.value = false
        currentSceneIndex.value++
        currentDialogueIndex.value = 0
        showText.value = true
        console.log('[nextDialogue] Next scene:', currentSceneIndex.value)
        
        const remainingScenes = storyScenes.value.length - (currentSceneIndex.value + 1)
        console.log('[nextDialogue] Remaining scenes:', remainingScenes, 'storyEndSignaled:', storyEndSignaled.value)

        const curr = storyScenes.value[currentSceneIndex.value]
        const atLastDialogue = curr && Array.isArray(curr.dialogues) ? (currentDialogueIndex.value >= curr.dialogues.length - 1) : true
        const isChapterEndScene = curr && (curr.isChapterEnding === true || curr.chapterEnd === true)

        if (isChapterEndScene && atLastDialogue && !eventSource && !storyEndSignaled.value && !creatorMode.value) {
          console.log('[nextDialogue] Chapter end reached — fetching next chapter')
          
          // 检查当前章节是否已保存（对所有模式都进行检查）
          if (creatorFeatureEnabled.value || isCreatorIdentity.value || modifiableFromCreate.value) {
            try {
              await getWorkDetails(work.value.id)
              const chapterStatus = getChapterStatus(currentChapterIndex.value)
              console.log('[nextDialogue] 章节切换检查 - 章节:', currentChapterIndex.value, '状态:', chapterStatus)
              
              if (chapterStatus !== 'saved') {
                showNotice('当前章节尚未保存，请先确认并保存本章内容后再继续。', 5000)
                return
              }
            } catch (e) {
              console.warn('[nextDialogue] 检查章节状态失败:', e)
              showNotice('无法确认章节保存状态，请先保存本章内容后再继续。', 5000)
              return
            }
          }
          
          startLoading()
          try {
            const nextChapter = currentChapterIndex.value + 1
            if (totalChapters.value && Number(nextChapter) > Number(totalChapters.value)) {
              console.log('[nextDialogue] Next chapter exceeds totalChapters, marking end')
              storyEndSignaled.value = true
            } else {
              if (USE_MOCK_STORY) {
                await fetchNextContent(work.value.id, nextChapter)
              } else {
                const result = await fetchNextChapter(work.value.id, nextChapter, { replace: true })
                console.log('[nextDialogue] Replaced with next chapter result:', result)
              }
            }
          } catch (error) {
            console.warn('[nextDialogue] Fetch next chapter failed:', error)
          } finally {
            await stopLoading()
          }
        } else {
          try { requestNextIfNeeded() } catch (e) { console.warn('requestNextIfNeeded failed', e) }
        }
      }, 300)
    } else {
      // 已到当前已加载内容的末尾
      if (isChapterEnd) {
        currentChapterIndex.value++
        console.log('[nextDialogue] Chapter ended at last scene, moving to chapter:', currentChapterIndex.value)
        
        if (creatorFeatureEnabled.value) {
          try {
            await getWorkDetails(work.value.id)
            const chapterStatus = getChapterStatus(currentChapterIndex.value - 1)
            console.log('[nextDialogue] 创作者章节结束检查 - 章节:', currentChapterIndex.value - 1, '状态:', chapterStatus)
            
            if (chapterStatus !== 'saved') {
              showNotice('当前章节尚未保存，请先确认并保存本章内容后再继续。')
              currentChapterIndex.value--
              return
            }
            
            // 检查是否为最后一章：当前章索引-1（刚读完的章节）应该等于总章数
            const completedChapter = currentChapterIndex.value - 1
            const isLastChapter = totalChapters.value && Number(completedChapter) === Number(totalChapters.value)
            console.log('[nextDialogue] 章节已保存，检查是否为末章 - 已完成章节:', completedChapter, '总章数:', totalChapters.value, '是否末章:', isLastChapter)
            
            if (isLastChapter) {
              console.log('[nextDialogue] 已完成末章，准备进入结算')
              storyEndSignaled.value = true
              try {
                if (!endingsAppended.value) {
                  const appended = await fetchAndAppendEndings(work.value.id)
                  if (appended) return
                }
              } catch (e) { console.warn('pre-handleGameEnd fetch endings failed', e) }

              handleGameEnd()
              return
            } else {
              console.log('[nextDialogue] 非末章已完成，准备弹出下一章大纲编辑器 - 下一章:', currentChapterIndex.value)
              
              try {
                startLoading()
                await fetchNextChapter(work.value.id, currentChapterIndex.value, { replace: true, suppressAutoEditor: false })
                await stopLoading()
                
                currentSceneIndex.value = 0
                currentDialogueIndex.value = 0
                choicesVisible.value = false
                showText.value = false
                setTimeout(() => {
                  showText.value = true
                  console.log('[nextDialogue] 已切换到下一章:', currentChapterIndex.value)
                }, 300)
              } catch (e) {
                console.error('[nextDialogue] 加载下一章失败:', e)
                showNotice('加载下一章时出错，请刷新页面重试。')
                await stopLoading()
              }
              return
            }
          } catch (e) {
            console.warn('[nextDialogue] 检查创作者章节状态失败:', e)
          }
        }
        // 非创作者（即阅读者）在已加载内容末尾且为章节结束时，应主动请求下一章或结局
        if (!creatorFeatureEnabled.value && !playingEndingScenes.value && !eventSource) {
          try {
            console.log('[nextDialogue] Reader at chapter end at end-of-loaded-content — calling requestNextIfNeeded() to fetch next/ending')
            await requestNextIfNeeded()
            // requestNextIfNeeded 会在成功获取结局时处理跳转或追加场景并返回
            return
          } catch (e) {
            console.warn('[nextDialogue] requestNextIfNeeded failed in end-of-loaded-content branch:', e)
          }
        }
      }
      
      // 如果我们正在播放后端提供的结局场景，且已到达这些场景的最后一句，则在此触发结算
      // 兼容读档场景：即便没有通过播放流程设置 playingEndingScenes，
      // 但如果当前已加载内容的最后一段正是后端结局场景（例如从存档恢复），
      // 我们也应当在读完后触发结算/创作者检查逻辑。
      try {
        const lastIdxCheck = storyScenes.value.length - 1
        const lastSceneCheck = storyScenes.value[lastIdxCheck]
        const atLastSceneCheck = currentSceneIndex.value === lastIdxCheck
        const atLastDialogueCheck = lastSceneCheck && Array.isArray(lastSceneCheck.dialogues) ? (currentDialogueIndex.value === lastSceneCheck.dialogues.length - 1) : true
        const isMarkedEnding = lastSceneCheck && (lastSceneCheck._isBackendEnding || lastSceneCheck.isEnding)
        if (!playingEndingScenes.value && isMarkedEnding && atLastSceneCheck && atLastDialogueCheck) {
          console.log('[nextDialogue] 读档/已加载末尾为后端结局，检测到读完结局，触发结算流')
          try { justFinishedPlayingEnding.value = true } catch (e) {}
          // 保持 playingEndingScenes 与原有播放流程一致性标记为 false（因为并非通过播放流程进入）
          try { playingEndingScenes.value = false } catch (e) {}

          const isCreator = (creatorMode && creatorMode.value) || (creatorFeatureEnabled && creatorFeatureEnabled.value) || (isCreatorIdentity && isCreatorIdentity.value)
          // 若为创作者身份且该结局未被标记为 saved，则打开结局编辑器
          if (isCreator && appendedEndingSaved.value !== true && !(lastSceneCheck && lastSceneCheck._endingSaved === true)) {
            try {
              showNotice('结局尚未保存，请在结局编辑器中确认并保存后再进入结算。', 5000)
              if (!endingEditorVisible.value) {
                const idx = (lastSceneCheck && lastSceneCheck._endingIndex != null) ? Number(lastSceneCheck._endingIndex) : (lastSceneCheck && lastSceneCheck.chapterIndex ? Number(lastSceneCheck.chapterIndex) : null)
                endingEditorForm.value = endingEditorForm.value || { title: '', outline: '', userPrompt: '', endingIndex: idx, choice: null }
                endingEditorVisible.value = true
              }
            } catch (e) { console.warn('open ending editor on saved-load ending failed', e) }
            return
          }

          showNotice('结局已读，进入结算页面...', 1500)
          setTimeout(() => {
            storyEndSignaled.value = true
            handleGameEnd()
          }, 800)
          return
        }
      } catch (e) { console.warn('pre-playingEndingScenes saved-load check failed', e) }

      if (playingEndingScenes.value) {
        try {
          const lastIdx = storyScenes.value.length - 1
          const lastScene = storyScenes.value[lastIdx]
          const atLastScene = currentSceneIndex.value === lastIdx
          const atLastDialogue = lastScene && Array.isArray(lastScene.dialogues) ? (currentDialogueIndex.value === lastScene.dialogues.length - 1) : true
          if (atLastScene && atLastDialogue) {
            console.log('[nextDialogue] 结局场景播放完毕，进入结算')
            // 标记刚刚播放完结局，避免 handleGameEnd 再次去拉取结局并重复追加
            try { justFinishedPlayingEnding.value = true } catch (e) {}
            playingEndingScenes.value = false
            // 如果是创作者且追加的结局未标记为 saved，则先尝试通过后端确认该结局的真实状态
            const isCreator = (creatorMode && creatorMode.value) || (creatorFeatureEnabled && creatorFeatureEnabled.value) || (isCreatorIdentity && isCreatorIdentity.value)
            if (isCreator && appendedEndingSaved.value !== true) {
              try {
                // 尝试获取已选结局的索引：优先使用 lastSelectedEndingIndex（由 chooseOption 写入），
                // 回退到最后一段场景内的 _endingIndex 或 endingIndex 字段
                let endingIdx = null
                try { if (typeof lastSelectedEndingIndex !== 'undefined' && lastSelectedEndingIndex && lastSelectedEndingIndex.value) endingIdx = Number(lastSelectedEndingIndex.value) } catch (e) {}
                if (endingIdx == null) {
                  try {
                    const last = storyScenes.value[storyScenes.value.length - 1] || null
                    if (last) endingIdx = (last._endingIndex != null) ? Number(last._endingIndex) : (last.endingIndex != null ? Number(last.endingIndex) : null)
                  } catch (e) {}
                }

                // 如果能确定 endingIdx，则请求后端该结局详情以查询 status
                if (endingIdx != null) {
                  try {
                    const resp = await http.get(`/api/game/storyending/${work.value.id}/${endingIdx}/`)
                    const payload = resp && resp.data ? resp.data : resp
                    const endingStatus = payload && (payload.ending?.status || payload.status || payload.state)
                    if (endingStatus === 'saved') {
                      // 标记为已保存并直接进入结算（与阅读者一致的流）
                      appendedEndingSaved.value = true
                      showNotice('结局已保存，进入结算页面...', 1200)
                      setTimeout(() => {
                        storyEndSignaled.value = true
                        handleGameEnd()
                      }, 800)
                      return
                    }
                  } catch (e) {
                    console.warn('检查结局状态失败，回退到默认提示流程', e)
                    // 若检查失败，则继续后续打开编辑器的流程
                  }
                }

                // 若无法确认 saved 或非 saved，则提示创作者保存并打开编辑器
                showNotice('结局尚未保存，请在结局编辑器中确认并保存后再进入结算。', 5000)
                if (!endingEditorVisible.value) {
                  try {
                    const last = storyScenes.value[storyScenes.value.length - 1] || null
                    const idx = (last && last.endingIndex != null) ? Number(last.endingIndex) : (last && last.chapterIndex ? Number(last.chapterIndex) : null)
                    endingEditorForm.value = endingEditorForm.value || { title: '', outline: '', userPrompt: '', endingIndex: idx, choice: null }
                    endingEditorVisible.value = true
                  } catch (e) { console.warn('open ending editor on ending finish failed', e) }
                }
                return
              } catch (e) {
                console.warn('creator ending saved-check flow failed', e)
                showNotice('结局尚未保存，请在结局编辑器中确认并保存后再进入结算。', 5000)
                return
              }
            }

            showNotice('结局已读，进入结算页面...', 1500)
            setTimeout(() => {
              storyEndSignaled.value = true
              handleGameEnd()
            }, 800)
            return
          }
        } catch (e) { console.warn('playingEndingScenes check failed', e) }
      }

      if (storyEndSignaled.value) {
        console.log('[nextDialogue] 故事结束，跳转结算页面')
        if (creatorFeatureEnabled.value) {
          try {
            await getWorkDetails(work.value.id)
            const lastChapterStatus = getChapterStatus(currentChapterIndex.value)
            console.log('[nextDialogue] 创作者结算前检查 - 最后章节:', currentChapterIndex.value, '状态:', lastChapterStatus)
            
            if (lastChapterStatus !== 'saved') {
              showNotice('当前章节尚未保存，请先确认并保存本章内容后再进入结算页面。')
              return
            }
          } catch (e) {
            console.warn('[nextDialogue] 检查创作者最后章节状态失败:', e)
          }
        }
        handleGameEnd()
        return
      }
      
      try {
        if (creatorFeatureEnabled.value && isChapterEnd) {
          try {
            await getWorkDetails(work.value.id)
            const currentChapterStatus = getChapterStatus(currentChapterIndex.value - 1)
            console.log('[nextDialogue] 创作者阻塞式加载前检查 - 章节:', currentChapterIndex.value - 1, '状态:', currentChapterStatus)
            
            if (currentChapterStatus !== 'saved') {
              showNotice('当前章节尚未保存，请先确认并保存本章内容后再继续。')
              return
            }
          } catch (e) {
            console.warn('[nextDialogue] 检查创作者章节状态失败:', e)
          }
        }
        
        startLoading()
        let data
        if (USE_MOCK_STORY) {
          const nextChapter = isChapterEnd ? currentChapterIndex.value : (currentChapterIndex.value + 1)
          console.log('[nextDialogue] Fetching next content for chapter:', nextChapter)
          
          if (creatorMode.value) {
            pendingNextChapter.value = nextChapter
            console.log('[nextDialogue] Creator mode active — deferring fetch')
            try { showNotice('已到本章末。请退出创作者模式以继续加载下一章。') } catch(e) {}
            await stopLoading()
            return
          }
          
            if (totalChapters.value && Number(nextChapter) > Number(totalChapters.value)) {
            console.log('[nextDialogue] Next chapter exceeds totalChapters')
            storyEndSignaled.value = true
            await stopLoading()
            try {
              if (!endingsAppended.value) {
                const appended = await fetchAndAppendEndings(work.value.id)
                if (appended) return
              }
            } catch (e) { console.warn('pre-handleGameEnd fetch endings failed', e) }
            handleGameEnd()
            return
          }
          
          data = await fetchNextContent(work.value.id, nextChapter)
          console.log('[nextDialogue] Mock fetch result:', data)
          
          const maxWaitMs = 60 * 1000
          const pollInterval = 1000
          let waited = 0
          while (data && data.generating === true && waited < maxWaitMs) {
            await new Promise(r => setTimeout(r, pollInterval))
            waited += pollInterval
            data = await fetchNextContent(work.value.id, nextChapter)
            console.log('[nextDialogue] Polling result:', data, 'waited:', waited)
          }
        } else {
          const nextChapter = isChapterEnd ? currentChapterIndex.value : (currentChapterIndex.value + 1)
          console.log('[nextDialogue] Fetching next chapter:', nextChapter)
          
          if (creatorMode.value) {
            pendingNextChapter.value = nextChapter
            console.log('[nextDialogue] Creator mode active — deferring fetch')
            try { showNotice('已到本章末。请退出创作者模式以继续加载下一章。') } catch(e) {}
            await stopLoading()
            return
          }
          
          if (totalChapters.value && Number(nextChapter) > Number(totalChapters.value)) {
            console.log('[nextDialogue] Next chapter exceeds totalChapters')
            storyEndSignaled.value = true
            await stopLoading()
            handleGameEnd()
            return
          }
          
          data = await fetchNextChapter(work.value.id, nextChapter)
          console.log('[nextDialogue] Backend fetch result:', data)
        }

        await stopLoading()

        if (!data || data.end === true) {
          console.log('[nextDialogue] Story ended')
          storyEndSignaled.value = true
          try {
            if (!endingsAppended.value) {
              const appended = await fetchAndAppendEndings(work.value.id)
              if (appended) return
            }
          } catch (e) { console.warn('pre-handleGameEnd fetch endings failed', e) }
          handleGameEnd()
          return
        }

        if (data && Array.isArray(data.scenes) && data.scenes.length > 0) {
          const startIdx = storyScenes.value.length
          console.log('[nextDialogue] Adding new scenes, starting at:', startIdx)
          
          for (const sceneData of data.scenes) {
            pushSceneFromServer(sceneData)
          }
          
          choicesVisible.value = false
          showText.value = false
          setTimeout(() => {
            currentSceneIndex.value = startIdx
            currentDialogueIndex.value = 0
            showText.value = true
            console.log('[nextDialogue] Switched to new scene:', currentSceneIndex.value)
          }, 300)
          return
        }

        console.warn('[nextDialogue] No content received')
        const nextChapter = isChapterEnd ? currentChapterIndex.value : (currentChapterIndex.value + 1)
          if (totalChapters.value && Number(nextChapter) > Number(totalChapters.value)) {
            console.log('[nextDialogue] No content and exceeds totalChapters')
            storyEndSignaled.value = true
          
          if (creatorFeatureEnabled.value) {
            try {
              await getWorkDetails(work.value.id)
              const lastChapterStatus = getChapterStatus(currentChapterIndex.value)
              console.log('[nextDialogue] 创作者结算前检查(无内容) - 最后章节:', currentChapterIndex.value, '状态:', lastChapterStatus)
              
              if (lastChapterStatus !== 'saved') {
                showNotice('当前章节尚未保存，请先确认并保存本章内容后再进入结算页面。')
                return
              }
            } catch (e) {
              console.warn('[nextDialogue] 检查创作者最后章节状态失败:', e)
            }
          }
          
          try {
            if (!endingsAppended.value) {
              const appended = await fetchAndAppendEndings(work.value.id)
              if (appended) return
            }
          } catch (e) { console.warn('pre-handleGameEnd fetch endings failed', e) }

          handleGameEnd()
          return
        }
        alert('后续剧情正在生成，请稍候再试')
      } catch (e) {
        console.warn('[nextDialogue] fetching next content failed', e)
        await stopLoading()
        
        const nextChapterErr = isChapterEnd ? currentChapterIndex.value : (currentChapterIndex.value + 1)
        if (totalChapters.value && Number(nextChapterErr) > Number(totalChapters.value)) {
          console.log('[nextDialogue] Fetch error and exceeds totalChapters')
          storyEndSignaled.value = true
          
          if (creatorFeatureEnabled.value) {
            try {
              await getWorkDetails(work.value.id)
              const lastChapterStatus = getChapterStatus(currentChapterIndex.value)
              console.log('[nextDialogue] 创作者结算前检查(错误) - 最后章节:', currentChapterIndex.value, '状态:', lastChapterStatus)
              
              if (lastChapterStatus !== 'saved') {
                showNotice('当前章节尚未保存，请先确认并保存本章内容后再进入结算页面。')
                return
              }
            } catch (e) {
              console.warn('[nextDialogue] 检查创作者最后章节状态失败:', e)
            }
          }
          
          try {
            if (!endingsAppended.value) {
              const appended = await fetchAndAppendEndings(work.value.id)
              if (appended) return
            }
          } catch (e) { console.warn('pre-handleGameEnd fetch endings failed', e) }

          handleGameEnd()
          return
        }
        alert('后续剧情正在生成，请稍候再试')
      }
    }
  }
}
    return {
    // 状态
    isLoading,
    loadingProgress,
    isLandscapeReady,
    showText,
    showMenu,
    choicesVisible,
    eventSource,
    // 导出播放结局的标记，供外部（如读档）设置
    playingEndingScenes,
    // 导出是否已追加结局的标记
    endingsAppended,
    
    // 计算属性
    readingProgress,
    isLastDialogue,
    
    // 游戏控制方法
    toggleMenu,
    goBack,
    nextDialogue,
    chooseOption,
    requestLandscape,
    handleGameEnd,
    requestNextIfNeeded,
    // 结局编辑器（创作者）
    endingEditorVisible,
    endingEditorBusy,
    endingEditorForm,
    openEndingEditor,
    submitEndingEditor,
    cancelEndingEditor,
    
    // 加载控制方法
    simulateLoadTo100,
    startLoading,
    stopLoading,
    
    // 清理方法
    cleanup: () => {
      if (progressTimer) {
        clearInterval(progressTimer)
        progressTimer = null
      }
    },
    
    // 属性/状态管理方法
    applyAttributesDelta,
    applyStatusesDelta,
    normalizeDeltas
  }
}