import { ref, watch } from 'vue'
import { deepClone, getCurrentUserId } from '../utils/auth.js'
import { editorInvocation } from '../config/gamepage.js'
import http from '../utils/http.js'

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
    showNotice,
    isCreatorIdentity,
    modifiableFromCreate,
    // 添加缺失的依赖
    currentChapterIndex,
    totalChapters,
    checkCurrentChapterSaved
  } = dependencies

  const creatorMode = ref(false)
  const showOutlineEditor = ref(false)
  const outlineEdits = ref([])
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
              if (typeof orig === 'string') storyScenes.value[sIdx].dialogues[idx] = ov.dialogues[k]
              else if (typeof orig === 'object') storyScenes.value[sIdx].dialogues[idx] = { ...orig, text: ov.dialogues[k] }
            }
          }
        }
      }
      try {
        storyScenes.value = JSON.parse(JSON.stringify(storyScenes.value || []))
        try { showText.value = false; setTimeout(() => { showText.value = true }, 40) } catch (e) {}
      } catch (e) { console.warn('force refresh after applyOverridesToScenes failed', e) }
    } catch (e) { console.warn('applyOverridesToScenes failed', e) }
  }
  
  const toggleCreatorMode = async (params = {}) => {
    try {
      // 🔑 修复：优先使用 params，如果没有则从依赖中获取
      const _work = params.work || work
      const _checkCurrentChapterSaved = params.checkCurrentChapterSaved || checkCurrentChapterSaved
      const _creatorFeatureEnabled = params.creatorFeatureEnabled || dependencies.creatorFeatureEnabled
      const _stopAutoPlayTimer = params.stopAutoPlayTimer || dependencies.stopAutoPlayTimer
      const _startAutoPlayTimer = params.startAutoPlayTimer || dependencies.startAutoPlayTimer
      const _autoPlayEnabled = params.autoPlayEnabled || dependencies.autoPlayEnabled
      const _persistCurrentChapterEdits = params.persistCurrentChapterEdits || dependencies.persistCurrentChapterEdits

      const allowed = (isCreatorIdentity?.value || modifiableFromCreate?.value)
      if (!allowed) {
        if (showNotice) showNotice('创作者功能不可用：当前身份不是作者或作品未开启编辑权限。')
        return
      }

      if (!creatorMode.value) {
        // 检查当前章节是否已保存
        if (_work?.value?.ai_callable !== false) {
          if (_checkCurrentChapterSaved) {
            const isSaved = await _checkCurrentChapterSaved()
            if (!isSaved) {
              if (showNotice) showNotice('当前章节未保存(saved)状态，无法进入创作者模式')
              return
            }
          }
        }
        if (_creatorFeatureEnabled && !_creatorFeatureEnabled.value) {
          if (showNotice) showNotice('进入手动编辑：当前作品未开启 AI 自动生成，仅支持人工调整后保存。')
        }
        // 进入创作者模式时停止自动播放
        if (_stopAutoPlayTimer) {
          try { _stopAutoPlayTimer() } catch (e) {}
        }
      } else {
        // 退出创作者模式时，如果开启了自动播放则恢复
        if (_autoPlayEnabled?.value && _startAutoPlayTimer) {
          try { _startAutoPlayTimer() } catch (e) {}
        }
        // 退出时持久化当前章节编辑
        if (_persistCurrentChapterEdits) {
          try { await _persistCurrentChapterEdits({ auto: true }) } catch (e) {}
        }
      }
      creatorMode.value = !creatorMode.value
    } catch (e) { console.warn('toggleCreatorMode failed', e) }
  }
  
  // 修改：不再从调用方传入各个 ref，避免模板自动解包导致传入原始值（string/array）而出现 "Cannot create property 'value' on string ''"。
  // 直接使用闭包中的 outlineEdits/outlineUserPrompt 等 refs。
  const openOutlineEditorManual = async (params = {}) => {
    try {
      const allowed = (isCreatorIdentity?.value || modifiableFromCreate?.value)
      if (!allowed) {
        try { showNotice('您无权编辑本作品的大纲（非作者或作品未开启编辑）。') } catch(e){}
        return
      }

      // 🔑 关键修复：使用依赖中的 currentChapterIndex 和 totalChapters
      const start = Number(currentChapterIndex?.value || params.currentChapterIndex?.value || 1) || 1
      const total = Math.max((Number(totalChapters?.value || params.totalChapters?.value || 0) || 5), 0)

      let createRaw = null
      try { createRaw = JSON.parse(sessionStorage.getItem('createResult') || 'null') } catch (e) { createRaw = null }
      const rawOutlines = (createRaw && Array.isArray(createRaw.chapterOutlines)) ? createRaw.chapterOutlines : []

      const outlinesMap = {}
      let maxIdx = 0
      if (Array.isArray(rawOutlines)) {
        for (let i = 0; i < rawOutlines.length; i++) {
          const ch = rawOutlines[i]
          let ci = null
          try {
            if (ch && (typeof ch.chapterIndex !== 'undefined')) ci = Number(ch.chapterIndex)
            else if (ch && (typeof ch.chapter_index !== 'undefined')) ci = Number(ch.chapter_index)
            else ci = i + 1
          } catch (e) { ci = i + 1 }
          outlinesMap[ci] = (ch && (ch.summary || ch.title || ch.outline)) ? (ch.summary || ch.title || ch.outline) : JSON.stringify(ch)
          if (ci > maxIdx) maxIdx = ci
        }
      }

      const finalTotal = Math.max(total, maxIdx)
      outlineEdits.value = []
      for (let j = start; j <= finalTotal; j++) {
        if (typeof outlinesMap[j] !== 'undefined') {
          outlineEdits.value.push({ chapterIndex: j, outline: outlinesMap[j] })
        } else {
          outlineEdits.value.push({ chapterIndex: j, outline: `第${j}章：请在此编辑/补充本章大纲以指导生成。` })
        }
      }
      outlineUserPrompt.value = createRaw?.userPrompt || ''
      try { originalOutlineSnapshot.value = JSON.parse(JSON.stringify(outlineEdits.value || [])) } catch(e) { originalOutlineSnapshot.value = (outlineEdits.value || []).slice() }
      editorInvocation.value = 'manual'
      pendingOutlineTargetChapter.value = start
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
    
    try {
      // 关闭编辑器界面
      showOutlineEditor.value = false
      
      // 立即显示加载界面
      if (startLoading) {
        try {
          startLoading()
        } catch (e) {
          console.warn('startLoading failed', e)
        }
      }

      const workId = work?.value?.id
      if (!workId) {
        showNotice?.('无法确定作品 ID，生成失败')
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
        showNotice?.('该章节正在生成中，请稍候...')
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
      try {
        await generateChapter(workId, targetChapter, { chapterOutlines: payloadOutlines, userPrompt: outlineUserPrompt.value })
        showNotice?.('已提交大纲，开始生成中…')
        // 轮询作品详情，直到目标章节状态为 generated/saved
        try {
          await pollWorkStatus?.(workId, targetChapter, { interval: 1500, timeout: 120000 })
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
        showNotice?.('提交生成失败，请稍后重试')
        if (typeof outlineEditorResolver === 'function') { outlineEditorResolver(false); outlineEditorResolver = null }
      } finally {
        try { delete generationLocks.value[lockKey] } catch (e) {}
        // 生成完成后关闭加载界面
        if (stopLoading) {
          try {
            await stopLoading()
          } catch (e) {}
        }
      }
      pendingOutlineTargetChapter.value = null
    } catch (e) {
      console.warn('confirmOutlineEdits failed', e)
      showNotice?.('确认大纲时发生错误')
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
    // 🔑 修复：优先使用 params，如果没有则从依赖中获取
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
          if (showNotice) showNotice('当前章节未保存(saved)状态，无法进行手动编辑')
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
    // 🔑 修复：优先使用 params，如果没有则从依赖中获取
    const _currentDialogue = params.currentDialogue || params || dependencies.currentDialogue
    editableText.value = (_currentDialogue?.value || _currentDialogue || '')
    editingDialogue.value = false
  }
  
  const finishEdit = (params = {}) => {
    // 🔑 修复：优先使用 params，如果没有则从依赖中获取
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
      
      try {
        const sceneIdx = _currentSceneIndex.value
        const curScene = _storyScenes.value[sceneIdx]
        const curItem = curScene && Array.isArray(curScene.dialogues) ? curScene.dialogues[_currentDialogueIndex.value] : null
        if (curItem && typeof curItem === 'object' && curItem._fromChoiceId != null) {
          try {
            const cid = curItem._fromChoiceId
            const cidx = Number(curItem._fromChoiceIndex)
            const ch = curScene.choices && curScene.choices.find(cc => String(cc.id) === String(cid))
            if (ch) {
              ch.subsequentDialogues = ch.subsequentDialogues || []
              ch.subsequentDialogues[cidx] = editableText.value
            }
          } catch (e) { console.warn('sync back to choice.subsequentDialogues failed', e) }
        }
      } catch (e) { console.warn('finishEdit sync check failed', e) }

      _overrides.value.scenes = _overrides.value.scenes || {}
      _overrides.value.scenes[sid] = _overrides.value.scenes[sid] || { dialogues: {} }
      _overrides.value.scenes[sid].dialogues = _overrides.value.scenes[sid].dialogues || {}
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
  
  const triggerImagePicker = async (params = {}) => {
    // 🔑 修复：优先使用 params，如果没有则从依赖中获取
    const _work = params.work || work
    const _checkCurrentChapterSaved = params.checkCurrentChapterSaved || checkCurrentChapterSaved
    const _showMenu = params.showMenu || dependencies.showMenu
    
    const allowed = (isCreatorIdentity?.value || modifiableFromCreate?.value)
    if (!creatorMode.value) { 
      if (_showMenu) _showMenu.value = true
      return 
    }
    if (!allowed) { 
      if (showNotice) showNotice('您无权替换图片：非作者或作品未开启编辑')
      return 
    }
    
    if (_work?.value?.ai_callable !== false) {
      if (_checkCurrentChapterSaved) {
        const isSaved = await _checkCurrentChapterSaved()
        if (!isSaved) {
          if (showNotice) showNotice('当前章节未保存(saved)状态，无法进行手动编辑')
          return
        }
      }
    }
    
    try { imgInput.value && imgInput.value.click() } catch (e) {}
  }
  
  const onImageSelected = async (ev, params = {}) => {
    // 🔑 修复：优先使用 params，如果没有则从依赖中获取
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
            const resp = await http.post('/game/upload-image/', form, { headers: { 'Content-Type': 'multipart/form-data' } })
            const imageUrl = (resp && resp.data && (resp.data.imageUrl || resp.data.imageUrl)) || (resp && resp.imageUrl) || null
            if (imageUrl) {
              _overrides.value.scenes[sid].backgroundImage = imageUrl
              if (_saveOverrides) _saveOverrides(work.value.id)
              if (_applyOverridesToScenes) _applyOverridesToScenes(_showText)
              if (showNotice) showNotice('图片已上传并替换为服务器 URL')
            } else {
              console.warn('upload returned no imageUrl', resp)
              if (showNotice) showNotice('图片已本地替换，但上传未返回 URL')
            }
          } catch (uploadErr) {
            console.error('upload image failed', uploadErr)
            if (showNotice) showNotice('图片上传失败，请稍后重试（已保留本地预览）')
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
    // 🔑 修复：优先使用 params，如果没有则从依赖中获取
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
          // 修改：记录进入时的对话索引，而不是强制设为0
          creatorEntry.dialogueIndex = currentDialogueIndex.value
          allowAdvance.value = false
          try { stopAutoPlayTimer() } catch (e) {}
        } catch (e) { console.warn('enter creatorMode failed', e) }
      } else {
        try {
          try {
            (async () => {
              try {
                await persistCurrentChapterEdits({ auto: false, allowSaveGenerated: false })
              } catch (e) { console.warn('persistCurrentChapterEdits on exit creatorMode failed', e) }
            })()
          } catch (e) { console.warn('trigger persist on exit creatorMode failed', e) }
          
          if (creatorEntry.sceneIndex != null) {
            currentSceneIndex.value = creatorEntry.sceneIndex
            // 修改：恢复到进入时记录的对话索引
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
  
  // 提供方法来更新依赖（类似 useSaveLoad 和 useStoryAPI）
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