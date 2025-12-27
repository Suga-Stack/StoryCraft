import { ref, watch } from 'vue'
import { deepClone, getCurrentUserId } from '../utils/auth.js'
import { editorInvocation } from '../config/gamepage.js'
import http from '../utils/http.js'
import { getScenes } from '../service/story.js'

export function useCreatorMode(dependencies = {}) {
  // 从依赖中解构所需的函数和状态
  const {
    fetchNextChapter,
    pollWorkStatus,
    work,
    storyScenes,
    currentSceneIndex,
    currentDialogueIndex,
    attributes,
    statuses,
    choiceHistory,
    restoreChoiceFlagsFromHistory,
    generateChapter,
    showToast,
    isCreatorIdentity,
    modifiableFromCreate,
    currentChapterIndex,
    totalChapters,
    checkCurrentChapterSaved,
    getWorkDetails
  } = dependencies

  const creatorMode = ref(false)
  const showOutlineEditor = ref(false)
  const outlineEdits = ref([])
  const outlineCurrentPage = ref(0)  
  const outlineUserPrompt = ref('')
  const originalOutlineSnapshot = ref([])
  const editingDialogue = ref(false)
  const editableText = ref('')
  const editableDiv = ref(null)
  const isComposing = ref(false)
  const imgInput = ref(null)
  const allowAdvance = ref(true)
  const creatorEntry = { sceneIndex: null, dialogueIndex: null }
  const pendingNextChapter = ref(null)
  const previewSnapshot = ref(null)
  const pendingOutlineTargetChapter = ref(null)
  let outlineEditorResolver = null
  // 本地生成锁，防止重复提交同一章节生成请求（如果未从外部依赖注入 generationLocks，则使用本地的）
  const generationLocks = ref({})
  
  const overrides = ref({})
  const userId = getCurrentUserId()
  
  const overridesKey = (userId, workId) => `storycraft_overrides_${userId}_${workId}`
  
  const loadOverrides = (workId) => {
    try {
      try { localStorage.removeItem(overridesKey(userId, workId)) } catch (e) {}
      const raw = sessionStorage.getItem(overridesKey(userId, workId))
      if (raw) overrides.value = JSON.parse(raw)
      else overrides.value = {}
    } catch (e) { overrides.value = {} }
  }
  
  const saveOverrides = (workId) => {
    try {
      sessionStorage.setItem(overridesKey(userId, workId), JSON.stringify(overrides.value || {}))
    } catch (e) {
      try {
        const size = JSON.stringify(overrides.value || {}).length
        console.warn('保存 overrides 失败, size:', size, e)
      } catch (inner) { console.warn('保存 overrides 失败', e) }
    }
  }
  
  const applyOverridesToScenes = (showText) => {
    try {
      if (!overrides.value || !overrides.value.scenes) return
      for (const sid in overrides.value.scenes) {
        let sIdx = -1
        for (let i = 0; i < storyScenes.value.length; i++) {
          const s = storyScenes.value[i]
          const key = String((s && (s._uid ?? s.sceneId ?? s.id)) != null ? (s._uid ?? s.sceneId ?? s.id) : `idx_${i}`)
          if (key === String(sid)) { sIdx = i; break }
        }
        if (sIdx === -1) continue
        const ov = overrides.value.scenes[sid]
        if (ov.backgroundImage) storyScenes.value[sIdx].backgroundImage = ov.backgroundImage
        if (ov.dialogues) {
          for (const k in ov.dialogues) {
            const idx = Number(k)
            if (!isNaN(idx) && storyScenes.value[sIdx].dialogues && idx < storyScenes.value[sIdx].dialogues.length) {
              const orig = storyScenes.value[sIdx].dialogues[idx]
              // 无论原始对话是字符串还是对象，都用覆盖的文本直接替换
              // 如果是字符串，直接替换
              if (typeof orig === 'string') {
                storyScenes.value[sIdx].dialogues[idx] = ov.dialogues[k]
              }
              // 如果是对象，创建新对象只保留必要属性，避免原始对象中的文本字段干扰
              else if (typeof orig === 'object' && orig !== null) {
                // 保留原始的 type / 旁白标记，避免 isNarration 识别失败
                const preservedType = orig.type
                const preservedNarrationFlag = orig.__narration === true
                storyScenes.value[sIdx].dialogues[idx] = {
                  text: ov.dialogues[k],
                  type: preservedType, // 如果原来是 narration 会有 type:'narration'
                  __narration: preservedNarrationFlag || (preservedType === 'narration'),
                  backgroundImage: orig.backgroundImage,
                  speaker: orig.speaker,
                  _fromChoiceId: orig._fromChoiceId,
                  _fromChoiceIndex: orig._fromChoiceIndex,
                }
              }
            }
          }
        }
      }
      try {
        // 强制刷新场景数据
        storyScenes.value = JSON.parse(JSON.stringify(storyScenes.value || []))
        try { showText.value = false; setTimeout(() => { showText.value = true }, 40) } catch (e) {}
      } catch (e) { console.warn('force refresh after applyOverridesToScenes failed', e) }
    } catch (e) { console.warn('applyOverridesToScenes failed', e) }
  }
  
  const toggleCreatorMode = async (params = {}) => {
    try {
      // 优先使用 params，如果没有则从依赖中获取
      const _work = params.work || work
      const _checkCurrentChapterSaved = params.checkCurrentChapterSaved || checkCurrentChapterSaved
      const _creatorFeatureEnabled = params.creatorFeatureEnabled || dependencies.creatorFeatureEnabled
      const _stopAutoPlayTimer = params.stopAutoPlayTimer || dependencies.stopAutoPlayTimer
      const _startAutoPlayTimer = params.startAutoPlayTimer || dependencies.startAutoPlayTimer
      const _autoPlayEnabled = params.autoPlayEnabled || dependencies.autoPlayEnabled
      const _persistCurrentChapterEdits = params.persistCurrentChapterEdits || dependencies.persistCurrentChapterEdits

      const allowed = (isCreatorIdentity?.value || modifiableFromCreate?.value)
      if (!allowed) {
        if (showToast) showToast('无编辑权限。', 1000)
        return
      }

      if (!creatorMode.value) {
        // 如果 modifiable=true 且 ai_callable=false，无论章节状态如何都允许进入手动编辑模式
        const isManualEditOnly = modifiableFromCreate?.value && _work?.value?.ai_callable === false
        
        if (isManualEditOnly) {
          console.log('[toggleCreatorMode] 检测到手动编辑模式 (modifiable=true, ai_callable=false)，跳过所有章节状态检查')
          // 直接跳过后续所有检查，允许进入手动编辑模式
        } else {
          // 检查当前章节是否已保存
          if (_work?.value?.ai_callable !== false) {
            if (_checkCurrentChapterSaved) {
              const isSaved = await _checkCurrentChapterSaved()
              if (!isSaved) {
                if (showToast) showToast('未保存', 1000)
                return
              }
            }
          }
        }
        // 仅在创作者身份下，若当前场景是后端生成的结局且尚未被保存，则不允许通过菜单进入手动编辑模式
        try {
          // 如果是创作者身份或者来自 create 页面且可修改（modifiableFromCreate），
          // 都应当被视为需要额外的已保存检查，避免未保存的后端结局被菜单直接进入手动编辑。
          if (!isManualEditOnly && (isCreatorIdentity?.value || modifiableFromCreate?.value)) {
            const cs = (dependencies && dependencies.currentScene) || params.currentScene
            const cur = cs && cs.value ? cs.value : (cs || null)
            if (cur && (cur._isBackendEnding || cur.isGameEnding || cur.isEnding) && cur._endingSaved !== true) {
              if (showToast) showToast('未保存')
              return
            }
          }
        } catch (e) { /* ignore */ }
        // if (_creatorFeatureEnabled && !_creatorFeatureEnabled.value) {
        //   if (showToast) showToast('进入手动编辑：当前作品未开启 AI 自动生成，仅支持人工调整后保存。')
        // 进入创作者模式时停止自动播放
        if (_stopAutoPlayTimer) {
          try { _stopAutoPlayTimer() } catch (e) {}
        }
      } else {
        // 退出创作者模式时，如果开启了自动播放则恢复
        if (_autoPlayEnabled?.value && _startAutoPlayTimer) {
          try { _startAutoPlayTimer() } catch (e) {}
        }
        // 退出时持久化当前章节编辑（仅本地持久化，不自动发送到后端）
        if (_persistCurrentChapterEdits) {
          try { await _persistCurrentChapterEdits({ auto: true, performNetworkSave: false }) } catch (e) {}
        }
      }
      creatorMode.value = !creatorMode.value
    } catch (e) { console.warn('toggleCreatorMode failed', e) }
  }
  
  const openOutlineEditorManual = async (params = {}) => {
    try {
      // 允许所有身份（包括阅读者）打开手动大纲编辑
      // 只有在创作者身份下，才会阻止"已保存"状态下的编辑行为。
      try {
        // 默认不在打开编辑器时触发全量作品详情请求（避免重复调用 /api/gameworks/gameworks/<id>/）
        // 只有当调用方明确要求时才进行已保存检查（params.requireSavedCheck === true）
        if ((isCreatorIdentity?.value || modifiableFromCreate?.value) && params.requireSavedCheck) {
          if (typeof checkCurrentChapterSaved === 'function') {
            const isSaved = await checkCurrentChapterSaved()
            if (isSaved) {
              try {
                const cs = (dependencies && dependencies.currentScene) || params.currentScene
                const cur = cs && cs.value ? cs.value : (cs || null)
                if (cur && (cur._isBackendEnding || cur.isGameEnding || cur.isEnding) && cur._endingSaved === true) {
                  // 允许进入创作者手动编辑（编辑结局与阅读者模式一致）
                } else {
                  showToast?.('已保存')
                  return
                }
              } catch (e) {
                showToast?.('已保存')
                return
              }
            }
          }
        }
      } catch (e) { /* ignore */ }

      // 使用依赖中的 currentChapterIndex 和 totalChapters
      const start = Number(currentChapterIndex?.value || params.currentChapterIndex?.value || 1) || 1
      const total = Math.max((Number(totalChapters?.value || params.totalChapters?.value || 0) || 5), 0)

      // 只从后端获取大纲数据，不使用前端缓存
      let rawOutlines = []
      // 从后端获取作品详情以获取最新的大纲数据
      try {
        const workId = (work && work.value && work.value.id) ? work.value.id : null
        if (workId && typeof getWorkDetails === 'function') {
          const workDetailsData = await getWorkDetails(workId)
          if (workDetailsData) {
            // 从后端返回的数据中提取大纲
            if (Array.isArray(workDetailsData.outlines) && workDetailsData.outlines.length > 0) {
              rawOutlines = workDetailsData.outlines
            } else if (workDetailsData.data && Array.isArray(workDetailsData.data.outlines) && workDetailsData.data.outlines.length > 0) {
              rawOutlines = workDetailsData.data.outlines
            }
          }
          console.log('[openOutlineEditorManual] 已从后端加载大纲数据，共', rawOutlines.length, '章')
        }
      } catch (e) {
        console.warn('[openOutlineEditorManual] 从后端获取大纲失败:', e)
        rawOutlines = []
      }

      const outlinesMap = {}
      let maxIdx = 0
      if (Array.isArray(rawOutlines)) {
        for (let i = 0; i < rawOutlines.length; i++) {
          const ch = rawOutlines[i]
          
          // 过滤掉结局章节（有 endingIndex 字段的）
          if (ch && typeof ch.endingIndex !== 'undefined') {
            continue
          }
          
          let ci = null
          try {
            if (ch && (typeof ch.chapterIndex !== 'undefined')) ci = Number(ch.chapterIndex)
            else if (ch && (typeof ch.chapter_index !== 'undefined')) ci = Number(ch.chapter_index)
            else ci = i + 1
          } catch (e) { ci = i + 1 }
          // 合并标题与大纲正文：title + 空行 + outline/summary
          try {
            // 兼容多种后端字段命名：title/chapter_title/name 以及 outline/summary/description/content/body/story_outline
            const title = (ch && (ch.title ?? ch.chapter_title ?? ch.name)) || ''
            const body  = (ch && (ch.outline ?? ch.summary ?? ch.description ?? ch.content ?? ch.body ?? ch.story_outline ?? ch.name)) || ''
            // 存储为结构化对象，保留 title 与 outline 两部分，方便编辑器分别展示与回填
            outlinesMap[ci] = { title: title, outline: body }
          } catch (e) { outlinesMap[ci] = { title: '', outline: JSON.stringify(ch) } }
          if (ci > maxIdx) maxIdx = ci
        }
      }

      const finalTotal = Math.max(total, maxIdx)
      outlineEdits.value = []
      for (let j = start; j <= finalTotal; j++) {
        const entry = outlinesMap[j]
        if (typeof entry !== 'undefined') {
          // entry 可能是结构化对象 {title, outline}
          if (entry && typeof entry === 'object') {
            outlineEdits.value.push({ chapterIndex: j, title: entry.title || '', outline: entry.outline || '' })
          } else {
            // 兜底：若仍为字符串则放到 outline 字段
            outlineEdits.value.push({ chapterIndex: j, title: '', outline: String(entry) })
          }
        } else {
          outlineEdits.value.push({ chapterIndex: j, title: `第${j}章`, outline: `第${j}章：请在此编辑/补充本章大纲以指导生成。` })
        }
      }
      // 清空 userPrompt（不再从缓存读取）
      outlineUserPrompt.value = ''
      try { originalOutlineSnapshot.value = JSON.parse(JSON.stringify(outlineEdits.value || [])) } catch(e) { originalOutlineSnapshot.value = (outlineEdits.value || []).slice() }
      outlineCurrentPage.value = 0  // 初始化为第一页
      editorInvocation.value = 'manual'
      pendingOutlineTargetChapter.value = start
      console.log('[useCreatorMode] 打开大纲编辑器: reason=manual-invocation, targetChapter=', pendingOutlineTargetChapter.value)
      showOutlineEditor.value = true
    } catch (e) { console.warn('openOutlineEditorManual failed', e) }
  }
  
  const cancelOutlineEdits = (params) => {
    try { showOutlineEditor.value = false } catch (e) {}
    
    (async () => {
      try {
        const workId = work.value.id
        if (editorInvocation.value === 'auto' || creatorMode.value) {
      // 后端 ChapterGenerateSerializer 期望字段名为 outline 而不是 summary
      const payloadOutlines = (originalOutlineSnapshot.value || []).map(o => ({ chapterIndex: o.chapterIndex, outline: o.outline }))
          try {
            const tChap = payloadOutlines[0]?.chapterIndex || 1
            const lockKey = `${workId}:${tChap}`
            if (generationLocks.value[lockKey]) {
              console.log('cancelOutlineEdits: generate already in progress for', lockKey)
            } else {
              generationLocks.value[lockKey] = true
              try {
                await generateChapter(workId, tChap, { chapterOutlines: payloadOutlines, userPrompt: outlineUserPrompt.value })
              } catch (e) {
                console.warn('cancelOutlineEdits generate failed', e)
              } finally {
                try { delete generationLocks.value[lockKey] } catch (ee) {}
              }
            }
          } catch (e) { console.warn('cancelOutlineEdits generate flow failed', e) }
        }
      } catch (e) { console.warn('cancelOutlineEdits async failed', e) }
    })()
    
    if (typeof outlineEditorResolver === 'function') { outlineEditorResolver(false); outlineEditorResolver = null }
    pendingOutlineTargetChapter.value = null
  }
  
  const confirmOutlineEdits = async (params = {}) => {
    const { startLoading, stopLoading } = params
    // 仅在创作者身份下，确认大纲前再次校验章节是否已保存，若已保存阻止提交；阅读者不受该限制
    try {
      if (isCreatorIdentity?.value) {
        if (typeof checkCurrentChapterSaved === 'function') {
          const isSaved = await checkCurrentChapterSaved()
          if (isSaved) {
            showToast?.('已保存')
            if (stopLoading) stopLoading()
            return
          }
        }
      }
    } catch (e) { /* ignore */ }
    
    try {
      // 关闭编辑器界面
      showOutlineEditor.value = false

      const workId = work?.value?.id
      if (!workId) {
        showToast?.('生成失败')
        if (typeof outlineEditorResolver === 'function') { outlineEditorResolver(false); outlineEditorResolver = null }
        if (stopLoading) {
          try {
            await stopLoading()
          } catch (e) {}
        }
        return
      }

      // 目标章节：优先使用 pendingOutlineTargetChapter，其次取第一条编辑项的 chapterIndex，最后回退 1
      const targetChapter = pendingOutlineTargetChapter.value || outlineEdits.value?.[0]?.chapterIndex || 1

      // 组装章节大纲 payload（后端期望 summary 字段）
      // 注意：与后端 serializers.ChapterOutlineSerializer 保持一致: {chapterIndex, outline}
      let payloadOutlines = (outlineEdits.value || []).map(o => ({ chapterIndex: o.chapterIndex, outline: o.outline }))
      if (!Array.isArray(payloadOutlines) || payloadOutlines.length === 0) {
        // 提供一个最小的占位，避免后端解析空数组失败
        payloadOutlines = [{ chapterIndex: targetChapter, outline: '' }]
      }

      const lockKey = `${workId}:${targetChapter}`
      if (generationLocks.value[lockKey]) {
        showToast?.('该章节正在生成中，请稍候...')
        if (typeof outlineEditorResolver === 'function') { outlineEditorResolver(true); outlineEditorResolver = null }
        pendingOutlineTargetChapter.value = null
        if (stopLoading) {
          try {
            await stopLoading()
          } catch (e) {}
        }
        return
      }

      generationLocks.value[lockKey] = true
      let _startedLoadingHere = false
      try {
        // 启动加载界面：优先使用传入的 startLoading，其次尝试依赖中的 startLoading
        try {
          if (typeof startLoading === 'function') {
            startLoading()
            _startedLoadingHere = true
          } else if (dependencies && typeof dependencies.startLoading === 'function') {
            dependencies.startLoading()
            _startedLoadingHere = true
          }
        } catch (e) { /* ignore start loading errors */ }

        await generateChapter(workId, targetChapter, { chapterOutlines: payloadOutlines, userPrompt: outlineUserPrompt.value })
        // showToast?.('已提交大纲，开始生成中…')
        // 轮询作品详情，直到目标章节状态为 generated/saved
        try {
          await pollWorkStatus?.(workId, targetChapter, { interval: 1500, timeout: 0 })
        } catch (pollErr) {
          console.warn('pollWorkStatus timeout or failed', pollErr)
        }
        // 状态就绪后拉取该章剧情
        try {
          await fetchNextChapter(workId, targetChapter, { replace: true, singleRequest: true, suppressAutoEditor: true })
        } catch (fetchErr) {
          console.warn('fetchNextChapter after generation failed', fetchErr)
        }
        if (typeof outlineEditorResolver === 'function') { outlineEditorResolver(true); outlineEditorResolver = null }
      } catch (genErr) {
        console.warn('confirmOutlineEdits generateChapter failed', genErr)
        showToast?.('生成失败，请稍后重试')
        if (typeof outlineEditorResolver === 'function') { outlineEditorResolver(false); outlineEditorResolver = null }
      } finally {
        try { delete generationLocks.value[lockKey] } catch (e) {}
        // 生成完成后关闭加载界面
        try {
          if (typeof stopLoading === 'function') {
            await stopLoading()
          } else if (_startedLoadingHere && dependencies && typeof dependencies.stopLoading === 'function') {
            try { await dependencies.stopLoading() } catch (e) {}
          }
        } catch (e) {}
      }
      pendingOutlineTargetChapter.value = null
    } catch (e) {
      console.warn('confirmOutlineEdits failed', e)
      showToast?.('确认大纲错误')
      if (typeof outlineEditorResolver === 'function') { outlineEditorResolver(false); outlineEditorResolver = null }
      pendingOutlineTargetChapter.value = null
      if (stopLoading) {
        try {
          await stopLoading()
        } catch (e) {}
      }
    }
  }
  
  const startEdit = async (params = {}) => {
    // 优先使用 params
    const _work = params.work || work
    const _checkCurrentChapterSaved = params.checkCurrentChapterSaved || checkCurrentChapterSaved
    const _showMenu = params.showMenu || dependencies.showMenu
    const _currentDialogue = params.currentDialogue || dependencies.currentDialogue
    
    if (!creatorMode.value) {
      if (_showMenu) _showMenu.value = true
      return
    }
    
    if (_work?.value?.ai_callable !== false) {
      if (_checkCurrentChapterSaved) {
        const isSaved = await _checkCurrentChapterSaved()
        if (!isSaved) {
          if (showToast) showToast('未保存')
          return
        }
      }
    }
    
    editableText.value = (_currentDialogue?.value || _currentDialogue || currentDialogue?.value || '')
    editingDialogue.value = true
    
    setTimeout(() => {
      try {
        const el = editableDiv.value || document.querySelector('.dialogue-text[contenteditable]')
        if (el) {
          try { el.innerText = editableText.value } catch (e) {}
          el.focus()
          try { 
            const range = document.createRange()
            const sel = window.getSelection()
            range.selectNodeContents(el)
            range.collapse(false)
            sel.removeAllRanges()
            sel.addRange(range)
          } catch (e) {}
        }
      } catch (e) {}
    }, 50)
  }
  
  const onEditableInput = (e) => {
    try {
      if (!isComposing.value) editableText.value = e.target.innerText
    } catch (err) { console.warn('onEditableInput failed', err) }
  }
  
  const onCompositionStart = () => {
    try { isComposing.value = true } catch (err) { console.warn('onCompositionStart failed', err) }
  }
  
  const onCompositionEnd = (e) => {
    try { 
      isComposing.value = false
      editableText.value = e.target.innerText 
    } catch (err) { console.warn('onCompositionEnd failed', err) }
  }
  
  const cancelEdit = (params = {}) => {
    // 优先使用 params，如果没有则从依赖中获取
    const _currentDialogue = params.currentDialogue || params || dependencies.currentDialogue
    editableText.value = (_currentDialogue?.value || _currentDialogue || '')
    editingDialogue.value = false
  }
  
  const finishEdit = (params = {}) => {
    // 优先使用 params
    const _currentScene = params.currentScene || dependencies.currentScene
    const _currentSceneIndex = params.currentSceneIndex || currentSceneIndex
    const _currentDialogueIndex = params.currentDialogueIndex || currentDialogueIndex
    const _storyScenes = params.storyScenes || storyScenes
    const _overrides = params.overrides || overrides
    const _saveOverrides = params.saveOverrides || saveOverrides
    const _applyOverridesToScenes = params.applyOverridesToScenes || applyOverridesToScenes
    const _previewSnapshot = params.previewSnapshot || previewSnapshot
    const _editingDialogue = params.editingDialogue || dependencies.editingDialogue
    const _allowAdvance = params.allowAdvance || allowAdvance
    const _showText = params.showText || dependencies.showText
    
    try {
      const scene = _currentScene?.value || _currentScene
      if (!scene) return
      
      const sid = (scene._uid || scene.sceneId || scene.id || `idx_${_currentSceneIndex.value}`)

      _overrides.value.scenes = _overrides.value.scenes || {}
      _overrides.value.scenes[sid] = _overrides.value.scenes[sid] || { dialogues: {} }
      _overrides.value.scenes[sid].dialogues = _overrides.value.scenes[sid].dialogues || {}
      
      // 确保只存储纯文本，避免对象嵌套导致的重复
      _overrides.value.scenes[sid].dialogues[_currentDialogueIndex.value] = editableText.value
      
      if (_saveOverrides) _saveOverrides(work.value.id)
      if (_applyOverridesToScenes) _applyOverridesToScenes(_showText)
      
      try { if (_previewSnapshot) _previewSnapshot.value = null } catch (e) {}
    } catch (e) { console.warn('finishEdit failed', e) }
    
    console.log('dialogue edit finished', _overrides.value)
    editingDialogue.value = false
    if (_allowAdvance) _allowAdvance.value = false
    
    try {
      if (_showText) {
        _showText.value = false
        setTimeout(() => { _showText.value = true }, 60)
      }
    } catch (e) {}
  }

  // 辅助：判断一条对话是否为旁白（narration）
  const isNarration = (item) => {
    try {
      if (!item) return false
      if (typeof item === 'object') {
        if (item.type === 'narration' || item.__narration === true) return true
        // 兜底：没有 speaker 且没有选择分支标记，且是对象，视为旁白
        if (!item.speaker && item._fromChoiceId == null && item._fromChoiceIndex == null && typeof item.text === 'string') {
          return true
        }
      }
      return false
    } catch (e) { return false }
  }

  // 插入一条旁白
  const addNarration = async (params = {}) => {
    const _work = params.work || work
    const _checkCurrentChapterSaved = params.checkCurrentChapterSaved || checkCurrentChapterSaved
    const _currentScene = params.currentScene || dependencies.currentScene
    const _currentSceneIndex = params.currentSceneIndex || currentSceneIndex
    const _currentDialogueIndex = params.currentDialogueIndex || currentDialogueIndex
    const _storyScenes = params.storyScenes || storyScenes
    const _overrides = params.overrides || overrides
    const _saveOverrides = params.saveOverrides || saveOverrides
    const _applyOverridesToScenes = params.applyOverridesToScenes || applyOverridesToScenes
    const _showText = params.showText || dependencies.showText

    try {
      if (!creatorMode.value) {
        showToast?.('请先进入创作者模式')
        return
      }
      // 已保存章节校验
      if (_work?.value?.ai_callable !== false) {
        if (_checkCurrentChapterSaved) {
          const isSaved = await _checkCurrentChapterSaved()
          if (!isSaved) {
            showToast?.('未保存')
            return
          }
        }
      }

      const scene = _currentScene?.value || _currentScene
      if (!scene) { showToast?.('无法确定当前场景'); return }
      scene.dialogues = Array.isArray(scene.dialogues) ? scene.dialogues : []
      // 插入位置：当前对话后一位；若当前索引越界则插入末尾
      let insertIndex = (_currentDialogueIndex?.value != null) ? (_currentDialogueIndex.value + 1) : scene.dialogues.length
      if (insertIndex < 0 || insertIndex > scene.dialogues.length) insertIndex = scene.dialogues.length

      const newText = params.text || '（新增旁白，请编辑内容）'
  const narrationObj = { text: newText, type: 'narration', __narration: true, speaker: null }
      scene.dialogues.splice(insertIndex, 0, narrationObj)

      // 对话索引后移
      const sid = (scene._uid || scene.sceneId || scene.id || `idx_${_currentSceneIndex.value}`)
      _overrides.value.scenes = _overrides.value.scenes || {}
      _overrides.value.scenes[sid] = _overrides.value.scenes[sid] || { dialogues: {} }
      const od = _overrides.value.scenes[sid].dialogues || {}
      // 先将需要后移的索引从末尾向后移动，避免覆盖
      const existingKeys = Object.keys(od).map(k => Number(k)).filter(k => !isNaN(k)).sort((a,b) => b - a)
      for (const k of existingKeys) {
        if (k >= insertIndex) {
          od[k + 1] = od[k]
          delete od[k]
        }
      }
      od[insertIndex] = newText
      _overrides.value.scenes[sid].dialogues = od

      if (_saveOverrides) _saveOverrides(_work.value.id)
      if (_applyOverridesToScenes) _applyOverridesToScenes(_showText)

      // 将当前编辑索引跳到新旁白
      try { _currentDialogueIndex.value = insertIndex } catch (e) {}
      showToast?.('已插入旁白')
    } catch (e) {
      console.warn('addNarration failed', e)
      showToast?.('插入旁白失败')
    }
  }

  // 删除当前旁白
  const deleteNarration = (params = {}) => {
    const _currentScene = params.currentScene || dependencies.currentScene
    const _currentSceneIndex = params.currentSceneIndex || currentSceneIndex
    const _currentDialogueIndex = params.currentDialogueIndex || currentDialogueIndex
    const _storyScenes = params.storyScenes || storyScenes
    const _overrides = params.overrides || overrides
    const _saveOverrides = params.saveOverrides || saveOverrides
    const _applyOverridesToScenes = params.applyOverridesToScenes || applyOverridesToScenes
    const _showText = params.showText || dependencies.showText

    try {
      if (!creatorMode.value) { showToast?.('尚未进入创作者模式'); return }
      const scene = _currentScene?.value || _currentScene
      if (!scene) { showToast?.('无法确定当前场景'); return }
      const idx = _currentDialogueIndex?.value ?? 0
      if (!Array.isArray(scene.dialogues) || idx < 0 || idx >= scene.dialogues.length) { showToast?.('当前对话索引无效'); return }
      const target = scene.dialogues[idx]
      if (!isNarration(target)) { showToast?.('当前项不是旁白，无法删除'); return }

      // 如果该场景包含选项，并且当前索引正好是触发选项的那句旁白，则禁止删除
      const hasChoices = Array.isArray(scene.choices) && scene.choices.length > 0
      const triggerIdx = (typeof scene.choiceTriggerIndex === 'number') ? scene.choiceTriggerIndex : null
      if (hasChoices && triggerIdx !== null && idx === triggerIdx) {
        showToast?.('无法删除触发选项的旁白，请先移动或修改选项触发点');
        return
      }

      // 记录旧的 trigger 索引，以便在删除靠前项时调整
      const oldTriggerIdx = triggerIdx

      // 删除
      scene.dialogues.splice(idx, 1)

      // 如果删除的项在触发点之前，触发索引需要左移一位，以保持触发旁白不变
      if (hasChoices && oldTriggerIdx !== null && idx < oldTriggerIdx) {
        try { scene.choiceTriggerIndex = oldTriggerIdx - 1 } catch (e) { /* ignore */ }
      }

      // 更新 overrides：重建索引映射，保持其它被编辑的文本
      const sid = (scene._uid || scene.sceneId || scene.id || `idx_${_currentSceneIndex.value}`)
      _overrides.value.scenes = _overrides.value.scenes || {}
      _overrides.value.scenes[sid] = _overrides.value.scenes[sid] || { dialogues: {} }
      const oldMap = _overrides.value.scenes[sid].dialogues || {}
      const newMap = {}
      for (let i = 0; i < scene.dialogues.length; i++) {
        // 原索引：若新索引 >= 删除位置，则对应旧索引 i+1；否则 i
        const oldIdx = (i >= idx) ? (i + 1) : i
        // 直接根据 scene 当前内容生成覆盖文本（更稳健）
        const item = scene.dialogues[i]
        let txt = ''
        if (typeof item === 'string') txt = item
        else if (item && typeof item === 'object') txt = item.text || item.narration || item.content || ''
        // 如果旧映射中存在编辑记录优先使用旧编辑文本
        if (oldMap && typeof oldMap[oldIdx] !== 'undefined') {
          txt = oldMap[oldIdx]
        }
        newMap[i] = txt
      }

      // 若删空，保留一个占位旁白，避免空数组导致前端逻辑异常
      if (scene.dialogues.length === 0) {
        const placeholder = { text: '（场景已空，自动添加占位旁白）', type: 'narration' }
        scene.dialogues.push(placeholder)
        newMap[0] = placeholder.text
        _currentDialogueIndex.value = 0
      } else {
        // 调整当前索引
        if (_currentDialogueIndex.value >= scene.dialogues.length) {
          _currentDialogueIndex.value = scene.dialogues.length - 1
        }
      }

      _overrides.value.scenes[sid].dialogues = newMap
      if (_saveOverrides) _saveOverrides(work.value.id)
      if (_applyOverridesToScenes) _applyOverridesToScenes(_showText)

      showToast?.('已删除旁白')
    } catch (e) {
      console.warn('deleteNarration failed', e)
      showToast?.('删除旁白失败')
    }
  }
  
  const triggerImagePicker = async (params = {}) => {
    // 优先使用 params
    const _work = params.work || work
    const _checkCurrentChapterSaved = params.checkCurrentChapterSaved || checkCurrentChapterSaved
    const _showMenu = params.showMenu || dependencies.showMenu
    
    const allowed = (isCreatorIdentity?.value || modifiableFromCreate?.value)
    if (!creatorMode.value) { 
      if (_showMenu) _showMenu.value = true
      return 
    }
    if (!allowed) { 
      if (showToast) showToast('您无权替换图片：非作者或作品未开启编辑', 1000)
      return 
    }
    
    if (_work?.value?.ai_callable !== false) {
      if (_checkCurrentChapterSaved) {
        const isSaved = await _checkCurrentChapterSaved()
        if (!isSaved) {
          if (showToast) showToast('当前章节未保存(saved)状态，无法进行手动编辑', 1000)
          return
        }
      }
    }
    
    try { imgInput.value && imgInput.value.click() } catch (e) {}
  }
  
  const onImageSelected = async (ev, params = {}) => {
    // 优先使用 params
    const _currentScene = params.currentScene || dependencies.currentScene
    const _currentSceneIndex = params.currentSceneIndex || currentSceneIndex
    const _overrides = params.overrides || overrides
    const _saveOverrides = params.saveOverrides || saveOverrides
    const _applyOverridesToScenes = params.applyOverridesToScenes || applyOverridesToScenes
    const _previewSnapshot = params.previewSnapshot || previewSnapshot
    const _showText = params.showText || dependencies.showText
    
    try {
      const f = ev?.target?.files?.[0]
      if (!f) return
      if (!/^image\//.test(f.type)) return
      
      const reader = new FileReader()
      reader.onload = async () => {
        const data = reader.result
        const scene = _currentScene?.value || _currentScene
        if (!scene) return
        const sid = (scene._uid || scene.sceneId || scene.id || `idx_${_currentSceneIndex.value}`)
        
        _overrides.value.scenes = _overrides.value.scenes || {}
        _overrides.value.scenes[sid] = _overrides.value.scenes[sid] || { dialogues: {} }
        _overrides.value.scenes[sid].backgroundImage = data
        if (_saveOverrides) _saveOverrides(work.value.id)
        if (_applyOverridesToScenes) _applyOverridesToScenes(_showText)
        
        try {
          const form = new FormData()
          form.append('file', f)
          try {
            const resp = await http.post('/api/game/upload-image/', form, { headers: { 'Content-Type': 'multipart/form-data' } })
            const imageUrl = (resp && resp.data && (resp.data.imageUrl || resp.data.imageUrl)) || (resp && resp.imageUrl) || null
            if (imageUrl) {
              _overrides.value.scenes[sid].backgroundImage = imageUrl
              if (_saveOverrides) _saveOverrides(work.value.id)
              if (_applyOverridesToScenes) _applyOverridesToScenes(_showText)
              if (showToast) showToast('图片已上传并替换为服务器 URL', 1000)
            } else {
              console.warn('upload returned no imageUrl', resp)
              if (showToast) showToast('图片已本地替换，但上传未返回 URL', 1000)
            }
          } catch (uploadErr) {
            console.error('upload image failed', uploadErr)
            if (showToast) showToast('图片上传失败，请稍后重试（已保留本地预览）', 1000)
          }
        } catch (e) { console.warn('image upload flow failed', e) }

        try { if (_previewSnapshot) _previewSnapshot.value = null } catch (e) {}
        try { 
          if (_showText) {
            _showText.value = false
            setTimeout(() => { _showText.value = true }, 40)
          }
        } catch (e) {}
      }
      reader.readAsDataURL(f)
    } catch (e) { console.warn('onImageSelected failed', e) }
  }
  
  const playNextAfterEdit = (params = {}) => {
    // 优先使用 params
    const _allowAdvance = params.allowAdvance || allowAdvance
    const _showMenu = params.showMenu || dependencies.showMenu
    const _nextDialogue = params.nextDialogue || dependencies.nextDialogue
    
    try {
      if (_allowAdvance) _allowAdvance.value = true
      try { if (_showMenu) _showMenu.value = false } catch (e) {}
      setTimeout(() => { 
        if (_nextDialogue) {
          if (typeof _nextDialogue === 'function') {
            _nextDialogue()
          } else if (_nextDialogue.value && typeof _nextDialogue.value === 'function') {
            _nextDialogue.value()
          }
        }
      }, 60)
    } catch (e) { console.warn('playNextAfterEdit failed', e) }
  }
  
  const setupCreatorModeWatch = (params) => {
    const { creatorMode, creatorEntry, currentSceneIndex, currentDialogueIndex, allowAdvance, stopAutoPlayTimer, startAutoPlayTimer, autoPlayEnabled, showText, persistCurrentChapterEdits, pendingNextChapter, fetchNextChapter, startLoading, stopLoading } = params
    watch(creatorMode, (val) => {
      if (val) {
        try {
          creatorEntry.sceneIndex = currentSceneIndex.value
          creatorEntry.dialogueIndex = currentDialogueIndex.value
          allowAdvance.value = false
          try { stopAutoPlayTimer() } catch (e) {}
        } catch (e) { console.warn('enter creatorMode failed', e) }
      } else {
        try {
          try {
            (async () => {
              try {
                await persistCurrentChapterEdits({ auto: false, allowSaveGenerated: false, performNetworkSave: false })
              } catch (e) { console.warn('persistCurrentChapterEdits on exit creatorMode failed', e) }
            })()
          } catch (e) { console.warn('trigger persist on exit creatorMode failed', e) }
          
          if (creatorEntry.sceneIndex != null) {
            currentSceneIndex.value = creatorEntry.sceneIndex
            currentDialogueIndex.value = creatorEntry.dialogueIndex != null ? creatorEntry.dialogueIndex : 0
            showText.value = true
          }
          allowAdvance.value = true
          try { if (autoPlayEnabled.value) startAutoPlayTimer() } catch (e) {}
          
          try {
            if (pendingNextChapter.value != null) {
              const chap = pendingNextChapter.value
              pendingNextChapter.value = null
              (async () => {
                try {
                  startLoading()
                  await fetchNextChapter(work.value.id, chap)
                } catch (e) { console.warn('load pending next chapter failed', e) }
                try { await stopLoading() } catch (e) {}
              })()
            }
          } catch (e) { console.warn('trigger pending next chapter failed', e) }
          
          try {
            if (previewSnapshot.value) {
              console.log('Restoring previewSnapshot on exit creatorMode')
              try { storyScenes.value = deepClone(previewSnapshot.value.storyScenes || []) } catch(e) { storyScenes.value = previewSnapshot.value.storyScenes || [] }
              currentSceneIndex.value = previewSnapshot.value.currentSceneIndex || 0
              currentDialogueIndex.value = previewSnapshot.value.currentDialogueIndex || 0
              try { attributes.value = deepClone(previewSnapshot.value.attributes || {}) } catch(e) { attributes.value = previewSnapshot.value.attributes || {} }
              try { statuses.value = deepClone(previewSnapshot.value.statuses || {}) } catch(e) { statuses.value = previewSnapshot.value.statuses || {} }
              try { choiceHistory.value = deepClone(previewSnapshot.value.choiceHistory || []) } catch(e) { choiceHistory.value = previewSnapshot.value.choiceHistory || [] }
              previewSnapshot.value = null
              try { restoreChoiceFlagsFromHistory() } catch(e) {}
            }
          } catch(e) { console.warn('restore previewSnapshot failed', e) }
        } catch (e) { console.warn('exit creatorMode failed', e) }
      }
    })
  }
  
  const setDependencies = (deps) => {
    if (deps.stopAutoPlayTimer) dependencies.stopAutoPlayTimer = deps.stopAutoPlayTimer
    if (deps.startAutoPlayTimer) dependencies.startAutoPlayTimer = deps.startAutoPlayTimer
    if (deps.autoPlayEnabled) dependencies.autoPlayEnabled = deps.autoPlayEnabled
    if (deps.persistCurrentChapterEdits) dependencies.persistCurrentChapterEdits = deps.persistCurrentChapterEdits
    if (deps.creatorFeatureEnabled) dependencies.creatorFeatureEnabled = deps.creatorFeatureEnabled
    if (deps.showMenu) dependencies.showMenu = deps.showMenu
    if (deps.showText) dependencies.showText = deps.showText
    if (deps.currentDialogue) dependencies.currentDialogue = deps.currentDialogue
    if (deps.currentScene) dependencies.currentScene = deps.currentScene
    if (deps.nextDialogue) dependencies.nextDialogue = deps.nextDialogue
  }
  
  return {
    creatorMode,
    showOutlineEditor,
    outlineEdits,
    outlineCurrentPage,  
    outlineUserPrompt,
    originalOutlineSnapshot,
    editingDialogue,
    editableText,
    editableDiv,
    isComposing,
    imgInput,
    allowAdvance,
    creatorEntry,
    pendingNextChapter,
    previewSnapshot,
    pendingOutlineTargetChapter,
    overrides,
    outlineEditorResolver,
    
    // 方法
    toggleCreatorMode,
    openOutlineEditorManual,
    cancelOutlineEdits,
  confirmOutlineEdits,
    startEdit,
    finishEdit,
    cancelEdit,
    triggerImagePicker,
    onImageSelected,
    playNextAfterEdit,
    onEditableInput,
    onCompositionStart,
    onCompositionEnd,
  // Narration 新增功能
  addNarration,
  deleteNarration,
  isNarration,
    
    // Overrides 相关
    loadOverrides,
    saveOverrides,
    applyOverridesToScenes,
    
    // Setup
    setupCreatorModeWatch,
    
    // 依赖管理
    setDependencies
  }
}