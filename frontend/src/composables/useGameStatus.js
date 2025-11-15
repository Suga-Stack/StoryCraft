import { ref, computed } from 'vue'
import { ScreenOrientation } from '@capacitor/screen-orientation'

export function useGameState(dependencies = {}) {
  // 从依赖中解构所需的函数和状态
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
    // 添加缺失的依赖
    creatorMode,
    allowAdvance,
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
    previewSnapshot
  } = dependencies

  // 状态定义
  const isLoading = ref(true)
  const loadingProgress = ref(0)
  const isLandscapeReady = ref(false)
  const showText = ref(false)
  const showMenu = ref(false)
  const choicesVisible = ref(false)
  let eventSource = null
  
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
        
        router.push('/works')
    }

    
    // 处理游戏结束，生成结算页面
    const handleGameEnd = async () => {
        console.log('handleGameEnd 被调用 - creatorFeatureEnabled:', creatorFeatureEnabled.value, 'currentChapter:', currentChapterIndex.value)
        
        // 对于创作者身份，在进入结算前进行最终检查
        if (creatorFeatureEnabled.value) {
            try {
            console.log('开始获取作品详情以检查章节状态...')
            await getWorkDetails(work.value.id)
            
            // 检查当前章节的状态
            const currentStatus = getChapterStatus(currentChapterIndex.value)
            console.log('handleGameEnd 检查当前章节:', currentChapterIndex.value, '状态:', currentStatus)
            
            // 如果当前章节未保存，阻止进入结算
            if (currentStatus !== 'saved') {
                console.warn('handleGameEnd 阻止结算 - 当前章节未保存')
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
                console.warn('handleGameEnd 阻止结算 - 前一章节未保存')
                showNotice('第' + (currentChapterIndex.value - 1) + '章尚未保存，请先确认并保存该章内容后再进入结算页面。', 10000)
                isGeneratingSettlement.value = false
                isLoading.value = false
                return
                }
            }
            
            console.log('handleGameEnd 所有章节检查通过，允许进入结算')
            } catch (e) {
            console.error('handleGameEnd 检查创作者章节状态失败:', e)
            // 如果检查失败，也阻止跳转，让创作者手动处理
            showNotice('无法确认章节保存状态，请先确认并保存本章内容后再进入结算。', 10000)
            isGeneratingSettlement.value = false
            isLoading.value = false
            return
            }
        }
        
        isGeneratingSettlement.value = true
        isLoading.value = true
        loadingProgress.value = 0
        
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

            try { sessionStorage.setItem('settlementData', JSON.stringify(settlementData)) } catch (e) { console.warn('set settlementData failed', e) }
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
            console.log('[chooseOption] 原始 attributesDelta:', choice.attributesDelta)
            console.log('[chooseOption] 原始 statusesDelta:', choice.statusesDelta)
            
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
            }
            
            // 记录选择历史
            choiceHistory.value.push({
                sceneId: scene?.id,
                choiceId: choice.id,
                choiceText: choice.text,
                timestamp: Date.now()
            })
            
            // 隐藏选项
            choicesVisible.value = false
            
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
            
            // 继续播放
            if (autoPlayEnabled.value) {
                startAutoPlayTimer()
            }
            
            // 前进到下一句对话将由 nextDialogue 函数处理
            // 这里只是更新当前对话索引
            showText.value = false
            setTimeout(() => {
                if (currentDialogueIndex.value < scene.dialogues.length - 1) {
                    currentDialogueIndex.value++
                    showText.value = true
                } else {
                    // 场景结束，移动到下一个场景
                    if (currentSceneIndex.value < storyScenes.value.length - 1) {
                        currentSceneIndex.value++
                        currentDialogueIndex.value = 0
                        showText.value = true
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

    // 模拟加载到100%
    const simulateLoadTo100 = async () => {
        for (let i = loadingProgress.value; i <= 100; i += 5) {
            loadingProgress.value = i
            await new Promise(resolve => setTimeout(resolve, 50))
        }
    }

    // 开始加载
    const startLoading = () => {
        isLoading.value = true
        loadingProgress.value = 0
    }

    // 停止加载
    const stopLoading = async () => {
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
        stopAutoPlayTimer()

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
                setTimeout(() => {
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
        
        // 阅读者身份：直接显示提示并跳转到结算
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
        setTimeout(() => {
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
                startAutoPlayTimer()
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
  console.log('[nextDialogue] called, showMenu:', showMenu.value, 'choicesVisible:', choicesVisible.value)
  
  if (showMenu.value) {
    // 如果菜单显示，点击不做任何事
    console.log('[nextDialogue] 菜单打开，忽略点击')
    return
  }

  // 🔑 关键修复：如果当前显示选项，必须选择后才能继续，阻止任何前进
  if (choicesVisible.value) {
    console.log('[nextDialogue] 选项正在显示，必须先选择选项才能继续')
    // 可以添加一个视觉提示，告诉用户需要选择
    try {
      if (showNotice) showNotice('请先选择一个选项再继续', 1500)
    } catch (e) {}
    return
  }

  // 🔑 关键修复：检查当前是否应该显示选项但还没有显示（比如刚到达触发点）
  const scene = currentScene.value
  if (scene && Array.isArray(scene.choices) && scene.choices.length > 0) {
    // 检查是否到达选项触发点
    if (typeof scene.choiceTriggerIndex === 'number' && 
        currentDialogueIndex.value === scene.choiceTriggerIndex &&
        !scene.choiceConsumed) {
      console.log('[nextDialogue] 到达选项触发点，应该显示选项而不是前进')
      // 触发选项显示
      choicesVisible.value = true
      stopAutoPlayTimer()
      return
    }
  }

  // 在从存档/读档恢复后，我们可能抑制了自动展示选项（suppressAutoShowChoices）
  try {
    if (suppressAutoShowChoices.value && scene) {
      if (scene && Array.isArray(scene.choices) && typeof scene.choiceTriggerIndex === 'number' && 
          currentDialogueIndex.value >= scene.choiceTriggerIndex && 
          !scene.choiceConsumed &&
          !choicesVisible.value) {
        console.log('[nextDialogue] suppressAutoShowChoices active, showing choices')
        choicesVisible.value = true
        suppressAutoShowChoices.value = false
        stopAutoPlayTimer()
        return
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
      console.log('[nextDialogue] 有未消费的选项，应该显示选项而不是前进')
      choicesVisible.value = true
      stopAutoPlayTimer()
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
          
          if (creatorFeatureEnabled.value) {
            try {
              await getWorkDetails(work.value.id)
              const chapterStatus = getChapterStatus(currentChapterIndex.value)
              console.log('[nextDialogue] 创作者章节切换检查 - 章节:', currentChapterIndex.value, '状态:', chapterStatus)
              
              if (chapterStatus !== 'saved') {
                showNotice('当前章节尚未保存，请先确认并保存本章内容后再继续。')
                return
              }
            } catch (e) {
              console.warn('[nextDialogue] 检查创作者章节状态失败:', e)
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
            
            const isLastChapter = totalChapters.value && Number(currentChapterIndex.value - 1) === Number(totalChapters.value)
            console.log('[nextDialogue] 章节已保存，检查是否为末章 - 当前章:', currentChapterIndex.value - 1, '总章数:', totalChapters.value, '是否末章:', isLastChapter)
            
            if (isLastChapter) {
              console.log('[nextDialogue] 已完成末章，准备进入结算')
              storyEndSignaled.value = true
              handleGameEnd()
              return
            } else {
              console.log('[nextDialogue] 非末章已完成，准备弹出下一章大纲编辑器')
              
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
    
    // 加载控制方法
    simulateLoadTo100,
    startLoading,
    stopLoading,
    
    // 属性/状态管理方法
    applyAttributesDelta,
    applyStatusesDelta,
    normalizeDeltas
  }
}