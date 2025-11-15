import { ref, watch } from 'vue'
import { deepClone, getCurrentUserId } from '../utils/auth.js'
import http from '../utils/http.js'

export function useCreatorMode() {
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
  const editorInvocation = ref('auto')
  
  // Overrides for local editing
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
  
  const applyOverridesToScenes = (storyScenes, showText) => {
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
  
  const toggleCreatorMode = async (modifiableFromCreate, work, currentChapterIndex, checkCurrentChapterSaved, creatorFeatureEnabled, showNotice, stopAutoPlayTimer, startAutoPlayTimer, autoPlayEnabled, persistCurrentChapterEdits, deepClone, storyScenes, currentSceneIndex, currentDialogueIndex, attributes, statuses, choiceHistory, showText, restoreChoiceFlagsFromHistory, pendingNextChapter, fetchNextChapter, startLoading, stopLoading, previewSnapshot) => {
    try {
      if (!modifiableFromCreate.value) {
        showNotice('创作者功能当前不可用：您不是本作品作者或创建时未开启创作者模式。')
        return
      }
      
      if (!creatorMode.value) {
        if (work.value.ai_callable !== false) {
          const isSaved = await checkCurrentChapterSaved()
          if (!isSaved) {
            showNotice('当前章节未保存(saved)状态，无法进入创作者模式')
            return
          }
        }
        
        if (!creatorFeatureEnabled.value) {
          showNotice('注意：作品设置不允许 AI 自动生成，进入后为手动编辑模式，确认后保存会直接覆盖章节内容。')
        }
      }
      
      creatorMode.value = !creatorMode.value
    } catch (e) { console.warn('toggleCreatorMode failed', e) }
  }
  
  const openOutlineEditorManual = async (modifiableFromCreate, showNotice, currentChapterIndex, totalChapters, outlineEdits, outlineUserPrompt, originalOutlineSnapshot, editorInvocation, pendingOutlineTargetChapter, showOutlineEditor) => {
    try {
      if (!modifiableFromCreate.value) {
        try { showNotice('您无权编辑本作品的大纲（非作者或未开启创作者模式）。') } catch(e){}
        return
      }
      
      let createRaw = null
      try { createRaw = JSON.parse(sessionStorage.getItem('createResult') || 'null') } catch (e) { createRaw = null }
      const rawOutlines = (createRaw && Array.isArray(createRaw.chapterOutlines)) ? createRaw.chapterOutlines : []
      const start = Number(currentChapterIndex.value) || 1
      
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
      const total = Math.max((Number(totalChapters.value) || 5), maxIdx)
      outlineEdits.value = []
      for (let j = start; j <= total; j++) {
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
  
  const cancelOutlineEdits = (showOutlineEditor, editorInvocation, creatorMode, work, originalOutlineSnapshot, outlineUserPrompt, generateChapter, generationLocks, pendingOutlineTargetChapter, outlineEditorResolver) => {
    try { showOutlineEditor.value = false } catch (e) {}
    
    (async () => {
      try {
        const workId = work.value.id
        if (editorInvocation.value === 'auto' || creatorMode.value) {
          const payloadOutlines = (originalOutlineSnapshot.value || []).map(o => ({ chapterIndex: o.chapterIndex, summary: o.outline }))
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
  
  const confirmOutlineEdits = async (/* 需要大量参数，从 GamePage 传入 */) => {
    // ...existing code from GamePage confirmOutlineEdits...
    // 由于这个函数非常复杂且依赖很多状态，建议保留在 GamePage 中
    // 或者通过依赖注入的方式传入所有需要的引用
  }
  
  const startEdit = async (creatorMode, showMenu, work, checkCurrentChapterSaved, currentDialogue, editableText, editingDialogue, editableDiv, showNotice) => {
    if (!creatorMode.value) {
      showMenu.value = true
      return
    }
    
    if (work.value.ai_callable !== false) {
      const isSaved = await checkCurrentChapterSaved()
      if (!isSaved) {
        showNotice('当前章节未保存(saved)状态，无法进行手动编辑')
        return
      }
    }
    
    editableText.value = currentDialogue.value || ''
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
  
  const onEditableInput = (e, isComposing, editableText) => {
    try {
      if (!isComposing.value) editableText.value = e.target.innerText
    } catch (err) { console.warn('onEditableInput failed', err) }
  }
  
  const onCompositionStart = (isComposing) => {
    try { isComposing.value = true } catch (err) { console.warn('onCompositionStart failed', err) }
  }
  
  const onCompositionEnd = (e, isComposing, editableText) => {
    try { 
      isComposing.value = false
      editableText.value = e.target.innerText 
    } catch (err) { console.warn('onCompositionEnd failed', err) }
  }
  
  const cancelEdit = (currentDialogue, editableText, editingDialogue) => {
    editableText.value = currentDialogue.value || ''
    editingDialogue.value = false
  }
  
  const finishEdit = (currentScene, currentSceneIndex, currentDialogueIndex, storyScenes, overrides, saveOverrides, applyOverridesToScenes, previewSnapshot, editingDialogue, allowAdvance, showText, editableText) => {
    try {
      const scene = currentScene.value
      if (!scene) return
      
      const sid = (scene._uid || scene.sceneId || scene.id || `idx_${currentSceneIndex.value}`)
      
      try {
        const sceneIdx = currentSceneIndex.value
        const curScene = storyScenes.value[sceneIdx]
        const curItem = curScene && Array.isArray(curScene.dialogues) ? curScene.dialogues[currentDialogueIndex.value] : null
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

      overrides.value.scenes = overrides.value.scenes || {}
      overrides.value.scenes[sid] = overrides.value.scenes[sid] || { dialogues: {} }
      overrides.value.scenes[sid].dialogues = overrides.value.scenes[sid].dialogues || {}
      overrides.value.scenes[sid].dialogues[currentDialogueIndex.value] = editableText.value
      saveOverrides()
      applyOverridesToScenes()
      
      try { previewSnapshot.value = null } catch (e) {}
    } catch (e) { console.warn('finishEdit failed', e) }
    
    console.log('dialogue edit finished', overrides.value)
    editingDialogue.value = false
    allowAdvance.value = false
    
    try {
      showText.value = false
      setTimeout(() => { showText.value = true }, 60)
    } catch (e) {}
  }
  
  const triggerImagePicker = async (creatorMode, showMenu, modifiableFromCreate, showNotice, work, checkCurrentChapterSaved, imgInput) => {
    if (!creatorMode.value) { showMenu.value = true; return }
    if (!modifiableFromCreate.value) { showNotice('您无权替换图片：非作者或未开启创作者模式'); return }
    
    if (work.value.ai_callable !== false) {
      const isSaved = await checkCurrentChapterSaved()
      if (!isSaved) {
        showNotice('当前章节未保存(saved)状态，无法进行手动编辑')
        return
      }
    }
    
    try { imgInput.value && imgInput.value.click() } catch (e) {}
  }
  
  const onImageSelected = async (ev, currentScene, currentSceneIndex, overrides, saveOverrides, applyOverridesToScenes, showNotice, previewSnapshot, showText) => {
    try {
      const f = ev?.target?.files?.[0]
      if (!f) return
      if (!/^image\//.test(f.type)) return
      
      const reader = new FileReader()
      reader.onload = async () => {
        const data = reader.result
        const scene = currentScene.value
        if (!scene) return
        const sid = (scene._uid || scene.sceneId || scene.id || `idx_${currentSceneIndex.value}`)
        
        overrides.value.scenes = overrides.value.scenes || {}
        overrides.value.scenes[sid] = overrides.value.scenes[sid] || { dialogues: {} }
        overrides.value.scenes[sid].backgroundImage = data
        saveOverrides()
        applyOverridesToScenes()
        
        try {
          const form = new FormData()
          form.append('file', f)
          try {
            const resp = await http.post('/game/upload-image/', form, { headers: { 'Content-Type': 'multipart/form-data' } })
            const imageUrl = (resp && resp.data && (resp.data.imageUrl || resp.data.imageUrl)) || (resp && resp.imageUrl) || null
            if (imageUrl) {
              overrides.value.scenes[sid].backgroundImage = imageUrl
              saveOverrides()
              applyOverridesToScenes()
              showNotice('图片已上传并替换为服务器 URL')
            } else {
              console.warn('upload returned no imageUrl', resp)
              showNotice('图片已本地替换，但上传未返回 URL')
            }
          } catch (uploadErr) {
            console.error('upload image failed', uploadErr)
            showNotice('图片上传失败，请稍后重试（已保留本地预览）')
          }
        } catch (e) { console.warn('image upload flow failed', e) }

        try { previewSnapshot.value = null } catch (e) {}
        try { showText.value = false; setTimeout(() => { showText.value = true }, 40) } catch (e) {}
      }
      reader.readAsDataURL(f)
    } catch (e) { console.warn('onImageSelected failed', e) }
  }
  
  const playNextAfterEdit = (allowAdvance, showMenu, nextDialogue) => {
    try {
      allowAdvance.value = true
      try { showMenu.value = false } catch (e) {}
      setTimeout(() => { nextDialogue() }, 60)
    } catch (e) { console.warn('playNextAfterEdit failed', e) }
  }
  
  const persistCurrentChapterEdits = async (/* 需要大量参数 */) => {
    // ...existing code from GamePage persistCurrentChapterEdits...
    // 这个函数也非常复杂，建议保留在 GamePage 或通过依赖注入
  }
  
  // Watch creatorMode changes
  const setupCreatorModeWatch = (creatorMode, creatorEntry, currentSceneIndex, currentDialogueIndex, allowAdvance, stopAutoPlayTimer, startAutoPlayTimer, autoPlayEnabled, showText, persistCurrentChapterEdits, pendingNextChapter, fetchNextChapter, startLoading, stopLoading, work, previewSnapshot, deepClone, storyScenes, attributes, statuses, choiceHistory, restoreChoiceFlagsFromHistory) => {
    watch(creatorMode, (val) => {
      if (val) {
        try {
          creatorEntry.sceneIndex = currentSceneIndex.value
          creatorEntry.dialogueIndex = 0
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
            currentDialogueIndex.value = creatorEntry.dialogueIndex || 0
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
    editorInvocation,
    overrides,
    
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
    persistCurrentChapterEdits,
    onEditableInput,
    onCompositionStart,
    onCompositionEnd,
    
    // Overrides 相关
    loadOverrides,
    saveOverrides,
    applyOverridesToScenes,
    
    // Setup
    setupCreatorModeWatch
  }
}