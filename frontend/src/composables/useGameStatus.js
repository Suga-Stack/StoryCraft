import { ref, computed, watch } from 'vue'

export function useGameState(router, route) {
  // 状态定义
  const isLoading = ref(true)
  const loadingProgress = ref(0)
  const isLandscapeReady = ref(false)
  const showText = ref(false)
  const showMenu = ref(false)
  const choicesVisible = ref(false)
  
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

  
  // 点击屏幕进入下一段对话
  const nextDialogue = async () => {
    console.log('nextDialogue called, showMenu:', showMenu.value)
    
    if (showMenu.value) {
      // 如果菜单显示，点击不做任何事
      return
    }
  
    // 在从存档/读档恢复后，我们可能抑制了自动展示选项（suppressAutoShowChoices）。
    // 此时用户需要先点击一次以显示选项而不是直接推进到下一句。
    try {
      if (suppressAutoShowChoices.value) {
        const sc = currentScene.value
        if (sc && Array.isArray(sc.choices) && typeof sc.choiceTriggerIndex === 'number' && currentDialogueIndex.value >= sc.choiceTriggerIndex && !choicesVisible.value) {
          choicesVisible.value = true
          suppressAutoShowChoices.value = false
          stopAutoPlayTimer()
          return
        }
      }
    } catch (e) { console.warn('suppressAutoShowChoices check failed', e) }
  
    // 如果当前显示选项，必须选择后才能继续
    if (choicesVisible.value) {
      console.log('Choices are visible, must select an option to continue')
      return
    }
  
    // 在创作者模式下，若未被允许播放则阻止切换（需要用户点击播放下一句按钮）
    if (creatorMode.value && !allowAdvance.value) {
      console.log('Creator mode active and advance is locked. Click "播放下一句" to continue.')
      return
    }
    
    const scene = currentScene.value
    console.log('Current scene:', scene, 'dialogue index:', currentDialogueIndex.value)
  
    // Guard against missing/undefined current scene
    if (!scene) {
      console.warn('nextDialogue: currentScene is null or undefined — attempting recovery')
      // 如果尚未加载任何场景，尝试拉取首章并恢复播放位置（仅尝试一次）
      try {
        if (Array.isArray(storyScenes.value) && storyScenes.value.length === 0 && !isFetchingNext.value) {
          startLoading()
          try {
            await fetchNextChapter(work.value.id, 1)
          } catch (e) {
            console.warn('fetchNextChapter recovery attempt failed', e)
          }
          await stopLoading()
          // 若已成功加载场景，则重置索引并展示第一句
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
    
    // 如果当前场景还有下一段对话
    if (currentDialogueIndex.value < scene.dialogues.length - 1) {
      showText.value = false
      setTimeout(() => {
        currentDialogueIndex.value++
        showText.value = true
        console.log('Next dialogue:', currentDialogueIndex.value)
      }, 200)
    } else {
      // 当前场景对话结束，检查是否是章节结束
      const isChapterEnd = (scene?.isChapterEnding === true) || (scene?.chapterEnd === true)
      
      // 切换到下一个场景
      if (currentSceneIndex.value < storyScenes.value.length - 1) {
        showText.value = false
        setTimeout(async () => {
          // 如果当前场景标记为章节结束，增加章节索引
          if (isChapterEnd) {
            currentChapterIndex.value++
            console.log('Chapter ended, moving to chapter:', currentChapterIndex.value)
          }
          
          // 切换场景时重置选项显示
          choicesVisible.value = false
          currentSceneIndex.value++
          currentDialogueIndex.value = 0
          showText.value = true
          console.log('Next scene:', currentSceneIndex.value)
          
          // 只有在当前章节真正结束（当前场景为章节结束并且已读到该场景最后一句）时
          // 才去主动拉取下一章；并且拉取时使用 replace 模式覆盖当前章节内容，避免中途拼接
          const remainingScenes = storyScenes.value.length - (currentSceneIndex.value + 1)
          console.log('Remaining scenes:', remainingScenes, 'storyEndSignaled:', storyEndSignaled.value)
  
          // 条件：当前场景为章节结束且我们已读到该场景最后一句
          const curr = storyScenes.value[currentSceneIndex.value]
          const atLastDialogue = curr && Array.isArray(curr.dialogues) ? (currentDialogueIndex.value >= curr.dialogues.length - 1) : true
          const isChapterEndScene = curr && (curr.isChapterEnding === true || curr.chapterEnd === true)
  
          if (isChapterEndScene && atLastDialogue && !eventSource && !storyEndSignaled.value && !creatorMode.value) {
            console.log('Chapter end reached — fetching next chapter and replacing current content')
            
            // 对于创作者身份，检查当前章节是否已保存
            if (creatorFeatureEnabled.value) {
              try {
                await getWorkDetails(work.value.id)
                const chapterStatus = getChapterStatus(currentChapterIndex.value)
                console.log('创作者章节切换检查 - 章节:', currentChapterIndex.value, '状态:', chapterStatus)
                
                if (chapterStatus !== 'saved') {
                  // 章节未保存，提示创作者确认保存
                  showNotice('当前章节尚未保存，请先确认并保存本章内容后再继续。')
                  return
                }
              } catch (e) {
                console.warn('检查创作者章节状态失败:', e)
              }
            }
            
            startLoading()
            try {
              const nextChapter = currentChapterIndex.value + 1
              if (totalChapters.value && Number(nextChapter) > Number(totalChapters.value)) {
                console.log('Next chapter exceeds totalChapters, marking story end (fetch skipped)')
                storyEndSignaled.value = true
              } else {
                if (USE_MOCK_STORY) {
                  await fetchNextContent(work.value.id, nextChapter)
                } else {
                  const result = await fetchNextChapter(work.value.id, nextChapter, { replace: true })
                  console.log('Replaced with next chapter result:', result)
                }
              }
            } catch (error) {
              console.warn('Fetch next chapter (replace) failed:', error)
            } finally {
              await stopLoading()
            }
          } else {
            // 若未达到章节结束，继续保持不主动拼接下一章（避免中途插入）
            try { requestNextIfNeeded() } catch (e) { console.warn('requestNextIfNeeded failed', e) }
          }
        }, 300)
      } else {
        // 已到当前已加载内容的末尾
        // 如果当前场景标记为章节结束，增加章节索引
        if (isChapterEnd) {
          currentChapterIndex.value++
          console.log('Chapter ended at last scene, moving to chapter:', currentChapterIndex.value)
          
          // 对于创作者身份，检查当前章节是否已保存
          if (creatorFeatureEnabled.value) {
            try {
              // 获取作品详情并检查章节状态
              await getWorkDetails(work.value.id)
              const chapterStatus = getChapterStatus(currentChapterIndex.value - 1) // 因为章节索引已经+1，所以检查上一章
              console.log('创作者章节结束检查 - 章节:', currentChapterIndex.value - 1, '状态:', chapterStatus)
              
              if (chapterStatus !== 'saved') {
                // 章节未保存，提示创作者确认保存
                showNotice('当前章节尚未保存，请先确认并保存本章内容后再继续。')
                // 将章节索引回退，因为还没有真正完成这一章
                currentChapterIndex.value--
                return
              }
              
              // 章节已保存，判断当前章是否为末章
              const isLastChapter = totalChapters.value && Number(currentChapterIndex.value - 1) === Number(totalChapters.value)
              console.log('章节已保存，检查是否为末章 - 当前章:', currentChapterIndex.value - 1, '总章数:', totalChapters.value, '是否末章:', isLastChapter)
              
              if (isLastChapter) {
                // 是末章，跳转到结算页面
                console.log('已完成末章，准备进入结算')
                storyEndSignaled.value = true
                handleGameEnd()
                return
              } else {
                // 不是末章，弹出下一章的大纲编辑器
                console.log('非末章已完成，准备弹出下一章大纲编辑器 - 下一章:', currentChapterIndex.value)
                
                // 调用 fetchNextChapter 来处理下一章的大纲编辑和生成
                // fetchNextChapter 会自动检查章节状态，如果是 not_generated 则弹出大纲编辑器
                try {
                  startLoading()
                  await fetchNextChapter(work.value.id, currentChapterIndex.value, { replace: true, suppressAutoEditor: false })
                  await stopLoading()
                  
                  // 加载成功后，重置场景和对话索引
                  currentSceneIndex.value = 0
                  currentDialogueIndex.value = 0
                  choicesVisible.value = false
                  showText.value = false
                  setTimeout(() => {
                    showText.value = true
                    console.log('已切换到下一章:', currentChapterIndex.value)
                  }, 300)
                } catch (e) {
                  console.error('加载下一章失败:', e)
                  showNotice('加载下一章时出错，请刷新页面重试。')
                  await stopLoading()
                }
                return
              }
            } catch (e) {
              console.warn('检查创作者章节状态失败:', e)
            }
          }
        }
        
        if (storyEndSignaled.value) {
          console.log('故事结束，跳转结算页面')
          // 对于创作者身份，在跳转结算前也要检查最后一章是否保存
          if (creatorFeatureEnabled.value) {
            try {
              await getWorkDetails(work.value.id)
              const lastChapterStatus = getChapterStatus(currentChapterIndex.value)
              console.log('创作者结算前检查 - 最后章节:', currentChapterIndex.value, '状态:', lastChapterStatus)
              
              if (lastChapterStatus !== 'saved') {
                showNotice('当前章节尚未保存，请先确认并保存本章内容后再进入结算页面。')
                return
              }
            } catch (e) {
              console.warn('检查创作者最后章节状态失败:', e)
            }
          }
          // 开始生成结算页面，而不是直接弹出结束提示
          handleGameEnd()
          return
        }
        
        // 尚未收到结束信号，则尝试拉取下一段剧情（阻塞式），并在后端仍在生成时轮询等待
        try {
          // 对于创作者身份，在加载下一章前检查当前章节是否已保存
          if (creatorFeatureEnabled.value && isChapterEnd) {
            try {
              await getWorkDetails(work.value.id)
              const currentChapterStatus = getChapterStatus(currentChapterIndex.value - 1) // 章节索引已经+1了，所以检查上一章
              console.log('创作者阻塞式加载前检查 - 章节:', currentChapterIndex.value - 1, '状态:', currentChapterStatus)
              
              if (currentChapterStatus !== 'saved') {
                showNotice('当前章节尚未保存，请先确认并保存本章内容后再继续。')
                return
              }
            } catch (e) {
              console.warn('检查创作者章节状态失败:', e)
            }
          }
          
          startLoading()
          let data
          if (USE_MOCK_STORY) {
            // 计算希望请求的章节索引
            const nextChapter = isChapterEnd ? currentChapterIndex.value : (currentChapterIndex.value + 1)
            console.log('Fetching next content for chapter:', nextChapter)
            // 若处于创作者模式，则不立即加载下一章，保存待加载章节并提示用户退出创作者模式后继续
            if (creatorMode.value) {
              pendingNextChapter.value = nextChapter
              console.log('Creator mode active — deferring blocking fetch for chapter', nextChapter)
              try { showNotice('已到本章末。请退出创作者模式以继续加载下一章。') } catch(e) {}
              await stopLoading()
              return
            }
            // 若已知 totalChapters 且下一章超出范围，直接进入结算
            if (totalChapters.value && Number(nextChapter) > Number(totalChapters.value)) {
              console.log('Next chapter exceeds totalChapters (blocking fetch), marking end and handling game end')
              storyEndSignaled.value = true
              await stopLoading()
              handleGameEnd()
              return
            }
            // 首次请求，后端可能返回 { generating: true }
            data = await fetchNextContent(work.value.id, nextChapter)
            console.log('Mock fetch result:', data)
            // 如果后端正在生成（或返回空场景但未标记结束），轮询等待生成完成
            const maxWaitMs = 60 * 1000 // 最多等 60s
            const pollInterval = 1000
            let waited = 0
            while (data && data.generating === true && waited < maxWaitMs) {
              await new Promise(r => setTimeout(r, pollInterval))
              waited += pollInterval
              data = await fetchNextContent(work.value.id, nextChapter)
              console.log('Polling result:', data, 'waited:', waited)
            }
          } else {
            // 请求下一章（使用 chapterIndex）
            const nextChapter = isChapterEnd ? currentChapterIndex.value : (currentChapterIndex.value + 1)
            console.log('Fetching next chapter:', nextChapter)
            // 若处于创作者模式，则不立即加载下一章，保存待加载章节并提示用户退出创作者模式后继续
            if (creatorMode.value) {
              pendingNextChapter.value = nextChapter
              console.log('Creator mode active — deferring blocking fetch for chapter', nextChapter)
              try { showNotice('已到本章末。请退出创作者模式以继续加载下一章。') } catch(e) {}
              await stopLoading()
              return
            }
            // 若已知 totalChapters 且下一章超出范围，直接进入结算
            if (totalChapters.value && Number(nextChapter) > Number(totalChapters.value)) {
              console.log('Next chapter exceeds totalChapters (blocking fetch), marking end and handling game end')
              storyEndSignaled.value = true
              await stopLoading()
              handleGameEnd()
              return
            }
            data = await fetchNextChapter(work.value.id, nextChapter)
            console.log('Backend fetch result:', data)
          }
  
          await stopLoading()
  
          // 如果后端最终标记结束，跳转结算
          if (!data || data.end === true) {
            console.log('Story ended based on backend response')
            storyEndSignaled.value = true
            handleGameEnd()
            return
          }
  
          // 如果后端返回了场景数组，插入并从第一个新场景开始阅读
          if (data && Array.isArray(data.scenes) && data.scenes.length > 0) {
            const startIdx = storyScenes.value.length
            console.log('Adding new scenes, starting at index:', startIdx, 'scenes count:', data.scenes.length)
            
            // 逐条添加场景以确保正确规范化
            for (const sceneData of data.scenes) {
              pushSceneFromServer(sceneData)
            }
            
            choicesVisible.value = false
            showText.value = false
            setTimeout(() => {
              // 切换到新插入的第一场景
              currentSceneIndex.value = startIdx
              currentDialogueIndex.value = 0
              showText.value = true
              console.log('Switched to new scene:', currentSceneIndex.value)
            }, 300)
            return
          }
  
          // 没有拿到内容且未标记结束，提示等待
          console.warn('No content received from backend')
          // 如果已知 totalChapters 且下一章超出范围，进入结算流程
          const nextChapter = isChapterEnd ? currentChapterIndex.value : (currentChapterIndex.value + 1)
          if (totalChapters.value && Number(nextChapter) > Number(totalChapters.value)) {
            console.log('No content and nextChapter exceeds totalChapters, handling game end')
            storyEndSignaled.value = true
            
            // 对于创作者身份，在跳转结算前检查最后一章是否保存
            if (creatorFeatureEnabled.value) {
              try {
                await getWorkDetails(work.value.id)
                const lastChapterStatus = getChapterStatus(currentChapterIndex.value)
                console.log('创作者结算前检查(无内容) - 最后章节:', currentChapterIndex.value, '状态:', lastChapterStatus)
                
                if (lastChapterStatus !== 'saved') {
                  showNotice('当前章节尚未保存，请先确认并保存本章内容后再进入结算页面。')
                  return
                }
              } catch (e) {
                console.warn('检查创作者最后章节状态失败:', e)
              }
            }
            
            handleGameEnd()
            return
          }
          alert('后续剧情正在生成，请稍候再试')
        } catch (e) {
          console.warn('fetching next content failed', e)
          await stopLoading()
          // 同样在网络/请求错误时，若已知没有后续章节则跳转结算
          const nextChapterErr = isChapterEnd ? currentChapterIndex.value : (currentChapterIndex.value + 1)
          if (totalChapters.value && Number(nextChapterErr) > Number(totalChapters.value)) {
            console.log('Fetch error and nextChapter exceeds totalChapters, handling game end')
            storyEndSignaled.value = true
            
            // 对于创作者身份，在跳转结算前检查最后一章是否保存
            if (creatorFeatureEnabled.value) {
              try {
                await getWorkDetails(work.value.id)
                const lastChapterStatus = getChapterStatus(currentChapterIndex.value)
                console.log('创作者结算前检查(错误) - 最后章节:', currentChapterIndex.value, '状态:', lastChapterStatus)
                
                if (lastChapterStatus !== 'saved') {
                  showNotice('当前章节尚未保存，请先确认并保存本章内容后再进入结算页面。')
                  return
                }
              } catch (e) {
                console.warn('检查创作者最后章节状态失败:', e)
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
   
    const applyAttributesDelta = (delta) => {
        if (!delta) return
        Object.keys(delta).forEach(k => {
            const v = delta[k]
            if (typeof v === 'number') {
            attributes.value[k] = (attributes.value[k] || 0) + v
            } else {
            // 非数值类型直接覆盖
            attributes.value[k] = v
            }
        })
    }
    // 应用“特殊状态”变化
    // 规则：
    // - 数值：累加（用于『怀疑 +10』）
    // - null/false：移除该状态
    // - 其他类型（字符串/对象/布尔）：覆盖
    const applyStatusesDelta = (delta) => {
        if (!delta) return
        const target = statuses.value
        if (Array.isArray(delta)) {
            delta.forEach(entry => {
            if (!entry) return
            const key = entry.name || entry.key
            if (!key) return
            const v = entry.value ?? entry.level ?? entry.state ?? entry.description ?? entry
            if (v === null || v === false || entry.remove === true) {
                delete target[key]
            } else if (typeof v === 'number') {
                const cur = target[key]
                const curNum = typeof cur === 'number' ? cur : (cur?.value ?? cur?.level ?? 0)
                target[key] = (curNum || 0) + v
            } else {
                target[key] = v
            }
            })
            return
        }
        if (typeof delta === 'object') {
            Object.keys(delta).forEach(key => {
            const v = delta[key]
            if (v === null || v === false) {
                delete target[key]
            } else if (typeof v === 'number') {
                const cur = target[key]
                const curNum = typeof cur === 'number' ? cur : (cur?.value ?? cur?.level ?? 0)
                target[key] = (curNum || 0) + v
            } else {
                target[key] = v
            }
            })
        }
    }

  // 处理选项点击：向后端请求选项后续剧情并应用返回结果
  const chooseOption = async (choiceId) => {
    if (isFetchingChoice.value) return
  
    console.log('[chooseOption] 处理选项:', choiceId, '当前场景:', currentSceneIndex.value)
    
    // 如果处于创作者模式且尚未有预览快照，则保存当前快照（用于退出创作者模式时恢复）
    if (creatorMode.value && !previewSnapshot.value) {
      try {
        previewSnapshot.value = {
          storyScenes: deepClone(storyScenes.value || []),
          currentSceneIndex: currentSceneIndex.value,
          currentDialogueIndex: currentDialogueIndex.value,
          attributes: deepClone(attributes.value || {}),
          statuses: deepClone(statuses.value || {}),
          choiceHistory: deepClone(choiceHistory.value || [])
        }
        console.log('Saved previewSnapshot for creator-mode preview')
      } catch (e) { console.warn('save previewSnapshot failed', e) }
    }
  
    // 记录用户选择历史（仅在非创作者模式下作为真实选择记录）
    const scene = currentScene.value
    const choiceObj = scene?.choices?.find(c => c.id === choiceId)
    if (choiceObj && !creatorMode.value) {
      choiceHistory.value.push({
        sceneId: scene.id || scene.sceneId,
        sceneTitle: scene.title || `场景 ${currentSceneIndex.value + 1}`,
        _uid: scene._uid || null,
        choiceId: choiceId,
        choiceText: choiceObj.text,
        timestamp: Date.now(),
        sceneIndex: currentSceneIndex.value,
        dialogueIndex: currentDialogueIndex.value
      })
      console.log('[chooseOption] 记录选择历史:', choiceHistory.value[choiceHistory.value.length - 1])
    }
    
    // 用户点击选项后立即隐藏选项，直到后端返回或 mock 完成
    choicesVisible.value = false
    // 记录点击时间，短时间内抑制选项重新弹出
    try { lastChoiceTimestamp.value = Date.now() } catch (e) {}
    isFetchingChoice.value = true
    
    try {
      const scene = currentScene.value
      const localChoice = scene?.choices?.find(c => c.id === choiceId)
  
      // 优先使用本地选项自带的后续剧情（subsequentDialogues / nextScenes / nextScene）
      if (localChoice) {
        console.log('[chooseOption] 找到本地选项:', localChoice)
        
        // 属性/状态变化直接应用 - 确保强制触发响应式更新
        if (localChoice.attributesDelta) {
          console.log('[chooseOption] 应用属性变化:', localChoice.attributesDelta)
          applyAttributesDelta(localChoice.attributesDelta)
          // 强制触发响应式更新
          attributes.value = { ...attributes.value }
        }
        if (localChoice.statusesDelta) {
          console.log('[chooseOption] 应用状态变化(statusesDelta):', localChoice.statusesDelta)
          applyStatusesDelta(localChoice.statusesDelta)
          // 强制触发响应式更新
          statuses.value = { ...statuses.value }
        }
        if (localChoice.statuses) {
          console.log('[chooseOption] 应用状态变化(statuses):', localChoice.statuses)
          applyStatusesDelta(localChoice.statuses)
          // 强制触发响应式更新
          statuses.value = { ...statuses.value }
        }
  
        // 若选项自带 subsequentDialogues（插入到当前场景）
        if (Array.isArray(localChoice.subsequentDialogues) && localChoice.subsequentDialogues.length > 0) {
          const idx = currentSceneIndex.value
          // 标记当前场景选项已被消费，防止后续重复弹出
          // 预览时不修改原场景的已消费标记
          if (!creatorMode.value) {
            try { 
              storyScenes.value[idx].choiceConsumed = true
              storyScenes.value[idx].chosenChoiceId = choiceId
              console.log('[chooseOption] 标记场景选项已消费(subsequentDialogues):', idx)
            } catch (e) {}
          }
          const insertAt = currentDialogueIndex.value + 1
          // 规范化为前端对话项（保留来源 metadata）
          const toInsert = localChoice.subsequentDialogues.map((d, di) => {
            const text = (typeof d === 'string') ? d : (d.narration ?? d.text ?? String(d))
            // 保留来源标记：用于在创作者模式编辑时同步回 choice.subsequentDialogues
            return { text, _fromChoiceId: localChoice.id, _fromChoiceIndex: di }
          })
          const currentDialogues = Array.isArray(storyScenes.value[idx].dialogues) ? storyScenes.value[idx].dialogues.slice() : []
          // 去重逻辑：如果目标插入位置已经存在与 toInsert 相同的连续文本，则跳过插入以避免重复展示
          const existingSegment = currentDialogues.slice(insertAt, insertAt + toInsert.length)
          const normalize = (d) => (typeof d === 'string') ? d : (d && d.text) ? d.text : String(d)
          const existingTexts = existingSegment.map(normalize)
          const toInsertTexts = toInsert.map(t => t.text)
          let alreadyPresent = true
          if (existingTexts.length !== toInsertTexts.length) alreadyPresent = false
          else {
            for (let i = 0; i < toInsertTexts.length; i++) {
              if (existingTexts[i] !== toInsertTexts[i]) { alreadyPresent = false; break }
            }
          }
          if (!alreadyPresent) {
            // 插入仅缺失或不同的项（简单策略：插入整个 toInsert）
            currentDialogues.splice(insertAt, 0, ...toInsert)
            storyScenes.value.splice(idx, 1, Object.assign({}, storyScenes.value[idx], { dialogues: currentDialogues }))
          }
          // 移动到第一条插入的对话（无论是否实际插入，都定位到该位置以显示后续内容）
          currentDialogueIndex.value = insertAt
          showText.value = true
          if (autoPlayEnabled.value) startAutoPlayTimer()
          return
        }
  
        // 若选项自带 nextScenes（跳转到新场景序列）
        if (Array.isArray(localChoice.nextScenes) && localChoice.nextScenes.length > 0) {
          const startIdx = storyScenes.value.length
          for (const sc of localChoice.nextScenes) {
            try { pushSceneFromServer(sc) } catch (e) { console.warn('pushSceneFromServer failed for choice nextScenes entry', e) }
          }
          // 标记上一个场景选项已被消费（避免回到上一场景时再次弹出）
          if (!creatorMode.value) {
            try { 
              const prev = storyScenes.value[startIdx - 1]
              if (prev) {
                prev.choiceConsumed = true
                prev.chosenChoiceId = choiceId
                console.log('[chooseOption] 标记上个场景选项已消费(nextScenes):', startIdx - 1)
              }
            } catch (e) {}
          }
          currentSceneIndex.value = startIdx
          currentDialogueIndex.value = 0
          showText.value = true
          if (autoPlayEnabled.value) startAutoPlayTimer()
          return
        }
  
        // 若选项携带单条 nextScene
        if (localChoice.nextScene) {
          const startIdx = storyScenes.value.length
          try { pushSceneFromServer(localChoice.nextScene) } catch (e) { console.warn('pushSceneFromServer failed for choice nextScene', e) }
          // 标记上一个场景选项已被消费
          if (!creatorMode.value) {
            try { 
              const prev = storyScenes.value[startIdx - 1]
              if (prev) {
                prev.choiceConsumed = true
                prev.chosenChoiceId = choiceId
                console.log('[chooseOption] 标记上个场景选项已消费(nextScene):', startIdx - 1)
              }
            } catch (e) {}
          }
          currentSceneIndex.value = startIdx
          currentDialogueIndex.value = 0
          showText.value = true
          if (autoPlayEnabled.value) startAutoPlayTimer()
          return
        }
  
        // 如果本地选项没有后续剧情，只标记选择并尝试推进到下一个场景
        if (!creatorMode.value) {
          try { 
            const prev = storyScenes.value[currentSceneIndex.value]
            if (prev) {
              prev.chosenChoiceId = choiceId
              prev.choiceConsumed = true
              console.log('[chooseOption] 标记当前场景选项已消费(无后续):', currentSceneIndex.value)
            }
          } catch (e) {}
        }
        
        if (currentSceneIndex.value < storyScenes.value.length - 1) {
          currentSceneIndex.value++
          currentDialogueIndex.value = 0
          showText.value = true
        } else {
          try { requestNextIfNeeded() } catch (e) { console.warn('requestNextIfNeeded failed after localChoice', e) }
        }
        return
      }
  
      // 没有本地选项数据的情况：尝试推进到下一个已有场景或触发预取下一章
      console.log('[chooseOption] 未找到本地选项数据,尝试推进到下一场景')
      if (currentSceneIndex.value < storyScenes.value.length - 1) {
        currentSceneIndex.value++
        currentDialogueIndex.value = 0
        showText.value = true
      } else {
        try { await requestNextIfNeeded() } catch (e) { console.warn('requestNextIfNeeded failed', e) }
      }
      } catch (err) {
      console.error('选择处理失败', err)
      // 页面内短时提醒而不是浏览器 alert
      try { showNotice('获取选项后续剧情失败：' + (err?.message || '网络异常')) } catch(e) { console.warn(e) }
    } finally {
      isFetchingChoice.value = false
    }
  }
  
  
  // 请求横屏
    const requestLandscape = async () => {
        const element = document.documentElement
        
            // 横屏准备完成，开始加载（先显示 loading 屏，再尝试全屏）
        isLandscapeReady.value = true
        // 直接进入第二阶段的 loading 屏：显示加载进度并保持，直到后端场景到达或 stopLoading 被调用。
        try { showText.value = false; startLoading() } catch (e) { console.warn('startLoading failed', e) }
        
        try {
            // 在原生 APP 中，使用 Capacitor 插件锁定横屏
            if (isNativeApp.value) {
            console.log('检测到 APP 环境，使用 ScreenOrientation 插件')
            // 使用 Capacitor 插件锁定为横屏
            await ScreenOrientation.lock({ orientation: 'landscape' })
            console.log('✅ 成功锁定为横屏')
            
            // APP 中也尝试全屏（提供更沉浸的体验）
            if (element.requestFullscreen) {
                await element.requestFullscreen().catch(err => {
                console.log('全屏请求失败（APP 中可选）:', err)
                })
            }
            } else {
            console.log('检测到浏览器环境，使用标准 API')
            // 在浏览器中，先请求全屏再锁定方向
            if (element.requestFullscreen) {
                await element.requestFullscreen()
            } else if (element.mozRequestFullScreen) {
                await element.mozRequestFullScreen()
            } else if (element.webkitRequestFullscreen) {
                await element.webkitRequestFullscreen()
            } else if (element.msRequestFullscreen) {
                await element.msRequestFullscreen()
            }
            
            // 锁定屏幕方向为横屏
            if (screen.orientation && screen.orientation.lock) {
                await screen.orientation.lock('landscape').catch(err => {
                console.log('屏幕方向锁定失败:', err)
                })
            }
            }
            } catch (err) {
            console.log('进入横屏失败:', err)
            // 开发环境降级处理：依赖 CSS 媒体查询实现横屏布局
        }
    }

  
    // 加载状态
    // 保证可控的从当前进度平滑到 100% 的视觉动画（用于内容已就绪但仍需展示加载动画的场景）
    const simulateLoadTo100 = async (duration = 900) => {
        try {
            // 停掉任何 startLoading 的定时器，交由本函数以匀速完成
            try { if (startLoading._timer) { clearInterval(startLoading._timer); startLoading._timer = null } } catch (e) {}
            isLoading.value = true
            const start = Number(loadingProgress.value) || 0
            const remain = Math.max(0, 100 - start)
            if (remain <= 0) {
            // 立即完成
            loadingProgress.value = 100
            await new Promise(r => setTimeout(r, 120))
            isLoading.value = false
            showText.value = true
            setTimeout(() => { try { loadingProgress.value = 0 } catch (e) {} }, 120)
            return
            }
            const stepMs = 30
            const steps = Math.max(1, Math.ceil(duration / stepMs))
            const per = remain / steps
            return await new Promise(resolve => {
            let cnt = 0
            const t = setInterval(() => {
                cnt++
                loadingProgress.value = Math.min(100, +(start + per * cnt).toFixed(2))
                if (cnt >= steps || loadingProgress.value >= 100) {
                clearInterval(t)
                setTimeout(() => {
                    try { loadingProgress.value = 100 } catch (e) {}
                    isLoading.value = false
                    showText.value = true
                    setTimeout(() => { try { loadingProgress.value = 0 } catch (e) {} }, 120)
                    resolve()
                }, 120)
                }
            }, stepMs)
            })
        } catch (e) { 
            console.warn('simulateLoadTo100 failed', e); 
            // 确保无论如何都关闭加载状态
            isLoading.value = false
            showText.value = true
        }
    }
  
  // 加载过程：加载页背景直接使用封面；进度条缓慢推进，便于可视化
    const startLoading = () => {
        isLoading.value = true
        loadingProgress.value = 0

        // 如果存在封面，先展示启动进度
        try { if (work.value.coverUrl) loadingProgress.value = Math.max(loadingProgress.value, 8) } catch (e) {}

        // 清理已有计时器（若有）并启动新的平滑计时器
        if (startLoading._timer) {
            clearInterval(startLoading._timer)
            startLoading._timer = null
        }
        // 以 200ms 步进，平滑推进到 90% 的目标，真实完成时调用 stopLoading
        startLoading._timer = setInterval(() => {
            try {
            const target = 90
            const delta = Math.max(0.4, (target - loadingProgress.value) * 0.06)
            loadingProgress.value = Math.min(target, +(loadingProgress.value + delta).toFixed(2))
            } catch (e) { console.warn('startLoading timer err', e) }
        }, 200)
    }

    // 停止 loading 并显示完成状态（可选短延迟以显示 100%），并清理计时器
    const stopLoading = async (opts = { delay: 200 }) => {
        try { if (startLoading._timer) { clearInterval(startLoading._timer); startLoading._timer = null } } catch (e) {}
        try { loadingProgress.value = 100 } catch (e) {}
        if (opts && opts.delay) await new Promise(r => setTimeout(r, opts.delay))
        isLoading.value = false
        showText.value = true
        // 延迟清零进度，避免视觉闪烁
        setTimeout(() => { try { loadingProgress.value = 0 } catch (e) {} }, 120)
    }
  
  return {
    // 状态
    isLoading,
    loadingProgress,
    isLandscapeReady,
    showText,
    showMenu,
    choicesVisible,
    // 计算属性
    readingProgress,
    isLastDialogue,
    // 方法
    toggleMenu,
    goBack,
    nextDialogue,
    chooseOption,
    requestLandscape,
    simulateLoadTo100,
    startLoading,
    stopLoading
  }
}