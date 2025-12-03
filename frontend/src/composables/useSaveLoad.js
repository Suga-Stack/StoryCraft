import { ref } from 'vue'
import { saveGameData, loadGameData, deleteGameData, refreshSlotInfosUtil } from '../utils/saveLoad.js'
import { work } from './useStoryAPI.js'

import { http } from '../service/http.js'

export function useSaveLoad() {
  const showSaveModal = ref(false)
  const showLoadModal = ref(false)
  const showAttributesModal = ref(false)
  const slotInfos = ref({ slot1: null, slot2: null, slot3: null, slot4: null, slot5: null, slot6: null })
  const attributes = ref({})
  const statuses = ref({})
  
  // 存档/读档提示信息
  const saveToast = ref('')
  const loadToast = ref('')
  const lastSaveInfo = ref(null)
  
  // 这些依赖将在GamePage.vue中通过闭包访问
  let _checkCurrentChapterSaved
  let _getChapterStatus
  let _currentChapterIndex
  let _creatorFeatureEnabled
  let _showNotice
  let _stopAutoPlayTimer
  let _autoPlayEnabled
  let _anyOverlayOpen
  let _startAutoPlayTimer
  let _currentScene
  let _currentSceneIndex
  let _currentDialogueIndex
  let _storyScenes
  let _choiceHistory
  let _fetchNextChapter
  let _pushSceneFromServer
  let _deepClone
  let _currentBackground
  let _effectiveCoverUrl
  let _showText
  let _choicesVisible
  let _suppressAutoShowChoices
  let _restoreChoiceFlagsFromHistory
  let _getCurrentUserId
  let _lastSelectedEndingIndex
  let _playingEndingScenes
  let _endingsAppended
  
  // 深拷贝工具函数
  const deepClone = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj
    if (obj instanceof Date) return new Date(obj.getTime())
    if (obj instanceof Array) return obj.map(item => deepClone(item))
    if (obj instanceof Object) {
      const clonedObj = {}
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          clonedObj[key] = deepClone(obj[key])
        }
      }
      return clonedObj
    }
  }
  
  // 提供方法来设置依赖
  const setDependencies = (deps) => {
    _checkCurrentChapterSaved = deps.checkCurrentChapterSaved
    _getChapterStatus = deps.getChapterStatus
    _currentChapterIndex = deps.currentChapterIndex
    _creatorFeatureEnabled = deps.creatorFeatureEnabled
    _showNotice = deps.showNotice
    _stopAutoPlayTimer = deps.stopAutoPlayTimer
    _autoPlayEnabled = deps.autoPlayEnabled
    _anyOverlayOpen = deps.anyOverlayOpen
    _startAutoPlayTimer = deps.startAutoPlayTimer
    _currentScene = deps.currentScene
    _currentSceneIndex = deps.currentSceneIndex
    _currentDialogueIndex = deps.currentDialogueIndex
    _storyScenes = deps.storyScenes
    _choiceHistory = deps.choiceHistory
    _fetchNextChapter = deps.fetchNextChapter
    _pushSceneFromServer = deps.pushSceneFromServer
    _deepClone = deps.deepClone
    _currentBackground = deps.currentBackground
    _effectiveCoverUrl = deps.effectiveCoverUrl
    _showText = deps.showText
    _choicesVisible = deps.choicesVisible
    _suppressAutoShowChoices = deps.suppressAutoShowChoices
    _restoreChoiceFlagsFromHistory = deps.restoreChoiceFlagsFromHistory
    _getCurrentUserId = deps.getCurrentUserId
    _lastSelectedEndingIndex = deps.lastSelectedEndingIndex
    _playingEndingScenes = deps.playingEndingScenes
    _endingsAppended = deps.endingsAppended
  }

  // 检查当前（或已追加的）后端结局是否为已保存状态
  const isCurrentBackendEndingSaved = () => {
    try {
      // 仅在创作者模式下生效
      if (!(_creatorFeatureEnabled && _creatorFeatureEnabled.value)) return true

      // 优先检查当前场景标记
      if (_currentScene && _currentScene.value && (_currentScene.value._isBackendEnding || _currentScene.value.isEnding)) {
        return _currentScene.value._endingSaved === true
      }

      // 其次根据 lastSelectedEndingIndex 在已加载场景中查找对应结局标记
      if (_lastSelectedEndingIndex && _lastSelectedEndingIndex.value && _storyScenes && Array.isArray(_storyScenes.value)) {
        const target = Number(_lastSelectedEndingIndex.value)
        for (const s of _storyScenes.value) {
          if (!s) continue
          const sIdx = s._endingIndex != null ? Number(s._endingIndex) : (s.endingIndex != null ? Number(s.endingIndex) : null)
          if (s._isBackendEnding && sIdx === target) {
            return s._endingSaved === true
          }
        }
      }

      // 默认允许
      return true
    } catch (e) {
      return true
    }
  }
    
  // 本地回退存档 key（包含 userId，避免不同用户冲突）
  const localSaveKey = (userId, workId, slot = 'default') => `storycraft_save_${userId}_${workId}_${slot}`


  // 自动存档槽位（退出时写入）
  const AUTO_SAVE_SLOT = 'slot6'

  // 防止频繁自动存档的节流控制
  let lastAutoSaveTime = 0
  const AUTO_SAVE_THROTTLE_MS = 3000 // 3秒内最多自动存档一次

  
  const SLOTS = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6']
  
  // 打开存档弹窗 / 读档弹窗，并刷新槽位信息
  const openSaveModal = async () => {
  // 检查当前章节状态是否为 saved
  // 如果是阅读者身份（modifiable=true, ai_callable=false），不受章节状态限制
  if (work.value.ai_callable !== false) {
      if (_checkCurrentChapterSaved) {
        const isSaved = await _checkCurrentChapterSaved()
        if (!isSaved) {
          if (_showNotice) _showNotice('当前章节未保存(saved)状态，无法进行存档操作')
          return
        }
      }
  }

  // 在创作者模式下，如果当前为后端结局且不是 saved，则禁止打开存档弹窗
  try {
    if (_creatorFeatureEnabled && _creatorFeatureEnabled.value) {
      const endingSaved = isCurrentBackendEndingSaved()
      if (!endingSaved) {
        if (_showNotice) _showNotice('当前结局尚未保存，无法进行存档操作')
        return
      }
    }
  } catch (e) {}
  
  showSaveModal.value = true
  if (_stopAutoPlayTimer) _stopAutoPlayTimer()
  await refreshSlotInfos()
  }
  const openLoadModal = async () => {
  showLoadModal.value = true
  if (_stopAutoPlayTimer) _stopAutoPlayTimer()
  await refreshSlotInfos()
  }
  const closeSaveModal = () => { 
    showSaveModal.value = false
    try { 
      if (_autoPlayEnabled && _autoPlayEnabled.value && _anyOverlayOpen && !(_anyOverlayOpen.value) && _startAutoPlayTimer) {
        _startAutoPlayTimer()
      }
    } catch (e) {}
  }
  const closeLoadModal = () => { 
    showLoadModal.value = false
    try { 
      if (_autoPlayEnabled && _autoPlayEnabled.value && _anyOverlayOpen && !(_anyOverlayOpen.value) && _startAutoPlayTimer) {
        _startAutoPlayTimer()
      }
    } catch (e) {}
  }

  const openAttributes = () => {
    showAttributesModal.value = true
    // 打开属性面板时暂停自动播放
    if (_stopAutoPlayTimer) _stopAutoPlayTimer()
  }

  const closeAttributes = () => {
    showAttributesModal.value = false
    // 关闭后在没有其它弹窗且用户开启自动播放时恢复
    try { 
      if (_autoPlayEnabled && _autoPlayEnabled.value && _anyOverlayOpen && !(_anyOverlayOpen.value) && _startAutoPlayTimer) {
        _startAutoPlayTimer()
      }
    } catch (e) {}
  }

  
  const saveGame = async (slot = 'default') => {
    try {
      // 如果当前为创作者身份，则仅允许在章节已被标记为 saved 时进行存档
      try {
        if (_creatorFeatureEnabled && _creatorFeatureEnabled.value) {
          if (_getChapterStatus && _currentChapterIndex) {
            const st = _getChapterStatus(_currentChapterIndex.value)
            if (st !== 'saved') {
              if (_showNotice) _showNotice('创作者身份下，仅在章节状态为 saved 时允许存档')
              console.log('saveGame blocked for creator: chapter status is', st)
              return
            }
          }
        }
      } catch (e) { console.warn('saveGame: chapter status check failed', e) }
      // 构建 gameData 对象,包含所有游戏状态
      // 构建 gameData 并把最终 state 放到 gameData.state 中，saveGameData 会优先使用该 state（支持 endingindex）
      const gameData = {
        work: work.value,
        state: buildSavePayload().state,
        // 仍保留缩略图以便 UI/后端使用
        thumbnail: (_currentBackground && _currentBackground.value) ? _currentBackground.value : (_effectiveCoverUrl && _effectiveCoverUrl.value) ? _effectiveCoverUrl.value : (work.value && work.value.coverUrl) ? work.value.coverUrl : null
      }
  
      // 使用 saveLoad.js 中的统一存档函数
      console.log('saveGame: preparing to save. save type:', gameData.state && gameData.state.endingindex ? 'ENDING' : 'CHAPTER')
      const result = await saveGameData(gameData, slot)
      
      if (result.success) {
        lastSaveInfo.value = (_deepClone || deepClone)(result.payload || result.data)
        saveToast.value = result.message || `存档成功（${new Date().toLocaleString()}）`
        setTimeout(() => (saveToast.value = ''), 2000)
        console.log('✅ 存档成功:', result)
      } else {
        throw new Error(result.message || '存档失败')
      }
    } catch (err) {
      console.error('❌ 保存失败:', err)
      alert('保存失败：' + err.message)
    }
  }

  // 构建当前存档快照，格式符合 API 文档要求
  const buildSavePayload = () => {
    // 清理 choiceHistory，只保留 API 需要的字段
    const cleanedChoiceHistory = (_choiceHistory && _choiceHistory.value ? _choiceHistory.value : []).map(choice => {
      // 确保 choiceId 是整数(后端要求)
      let choiceId = choice.choiceId
      if (typeof choiceId === 'string') {
        // 如果是字符串,尝试解析为整数
        choiceId = parseInt(choiceId, 10)
      }
      if (isNaN(choiceId)) {
        choiceId = null
      }
      
      return {
        chapterIndex: choice.chapterIndex || (_currentChapterIndex ? _currentChapterIndex.value : 1),
        sceneId: choice.sceneId,
        choiceTriggerIndex: choice.choiceTriggerIndex || 0,
        choiceId: choiceId
      }
    })

    // 构建 state：如果当前场景是结局（或由 lastSelectedEndingIndex 指示）则使用 endingindex 字段
    const state = {
      sceneId: (_currentScene && _currentScene.value && (_currentScene.value.id || _currentScene.value.sceneId)) 
        ? Number(_currentScene.value.id ?? _currentScene.value.sceneId) 
        : (_currentSceneIndex ? _currentSceneIndex.value : 0),
      dialogueIndex: _currentDialogueIndex ? _currentDialogueIndex.value : 0,
      attributes: _deepClone ? _deepClone(attributes.value) : attributes.value,
      statuses: _deepClone ? _deepClone(statuses.value) : statuses.value,
      choiceHistory: cleanedChoiceHistory
    }

    // 检查是否为结局存档：严格依据是否存在后端提供的 `endings` 信息
    // 规则：仅当当前剧情流中包含后端返回的结局相关标记（例如：场景有 `_isEndingChoiceScene` 或选项包含 `_endingScenes`）
    // 才认为这是结局存档；否则一律视为普通章节存档（不做兼容处理）。
    try {
      let hasBackendEndings = false
      try {
        if (_storyScenes && Array.isArray(_storyScenes.value)) {
          for (const s of _storyScenes.value) {
            if (!s) continue
            if (s._isEndingChoiceScene || s._isBackendEnding) { hasBackendEndings = true; break }
            if (Array.isArray(s.choices)) {
              for (const c of s.choices) {
                if (!c) continue
                if (Array.isArray(c._endingScenes) && c._endingScenes.length > 0) { hasBackendEndings = true; break }
              }
              if (hasBackendEndings) break
            }
          }
        }
      } catch (scanErr) { console.warn('buildSavePayload: scanning storyScenes for backend endings failed', scanErr) }

      if (hasBackendEndings) {
        // 确定进入的是第几个结局（逻辑上的第 N 个结局，1-based）
        // 规则：如果当前场景包含已选结局选项（currentChoiceIdx），优先使用该选项的 endingIndex；
        // 否则使用上一次记录的 _lastSelectedEndingIndex（可能来自读档或之前的选择）。如果都不存在则回退到 1。
        let recordedIdx = null
        if (_lastSelectedEndingIndex && _lastSelectedEndingIndex.value) recordedIdx = Number(_lastSelectedEndingIndex.value)

        let currentChoiceIdx = null
        try {
          if (_currentScene && _currentScene.value && Array.isArray(_currentScene.value.choices)) {
            const chosenId = _currentScene.value.chosenChoiceId ?? null
            if (chosenId != null) {
              const choicesArr = _currentScene.value.choices
              const found = choicesArr.findIndex(c => (c && (String(c.id) === String(chosenId) || c.choiceId == chosenId)))
              if (found >= 0) {
                const choiceObj = choicesArr[found]
                if (choiceObj && (choiceObj._endingIndex != null)) currentChoiceIdx = Number(choiceObj._endingIndex)
                else currentChoiceIdx = found + 1
              }
            }
          }
        } catch (e) { console.warn('buildSavePayload: derive currentChoiceIdx failed', e) }

        let idx = (currentChoiceIdx != null) ? currentChoiceIdx : (recordedIdx != null ? recordedIdx : null)
        if (!idx || isNaN(idx)) idx = 1
        // 为了兼容不同命名约定，保存时同时写入小写和驼峰两种字段
        state.endingindex = idx
        state.endingIndex = idx
          console.log('buildSavePayload: detected BACKEND endings — creating ENDING save with endingindex=', state.endingindex)
          // 尝试从结局场景中选取缩略图
          try {
            let endingThumb = null
            for (const s of (_storyScenes && Array.isArray(_storyScenes.value) ? _storyScenes.value : [])) {
              if (!s) continue
              if (s._isBackendEnding || s._isEndingChoiceScene) {
                if (s.backgroundImage) { endingThumb = s.backgroundImage; break }
                if (Array.isArray(s.dialogues) && s.dialogues.length > 0) {
                  const first = s.dialogues[0]
                  if (first && (first.backgroundImage || first.bg)) { endingThumb = first.backgroundImage || first.bg; break }
                }
              }
            }
            if (endingThumb) {
              console.log('buildSavePayload: using ending scene thumbnail for save:', endingThumb)
              // 覆盖返回值中的 thumbnail
              return {
                work: work.value,
                state,
                thumbnail: endingThumb,
                timestamp: Date.now()
              }
            }
          } catch (thumbErr) { console.warn('buildSavePayload: selecting ending thumbnail failed', thumbErr) }
      } else {
        state.chapterIndex = _currentChapterIndex ? _currentChapterIndex.value : 1
        console.log('buildSavePayload: no backend endings detected — creating NORMAL chapter save for chapterIndex=', state.chapterIndex)
      }
    } catch (e) {
      state.chapterIndex = _currentChapterIndex ? _currentChapterIndex.value : 1
    }

    return {
      work: work.value,
      state,
      // 缩略图：优先使用当前对话或场景提供的背景图，回退到作品封面
      thumbnail: (_currentBackground && _currentBackground.value) ? _currentBackground.value : (_effectiveCoverUrl && _effectiveCoverUrl.value) ? _effectiveCoverUrl.value : (work.value && work.value.coverUrl) ? work.value.coverUrl : null,
      timestamp: Date.now()
    }
  }


  // 静默自动存档（退出时使用，不弹 toast）
  const autoSaveToSlot = async (slot = AUTO_SAVE_SLOT) => {
    // 节流：如果距离上次自动存档不到 3 秒，跳过本次存档
    const now = Date.now()
    if (now - lastAutoSaveTime < AUTO_SAVE_THROTTLE_MS) {
      console.log('⏱️ 自动存档节流：跳过（距离上次存档 <3秒）')
      return
    }
    lastAutoSaveTime = now
    
    try {
      // 当以创作者身份进入时，禁止自动存档除非当前章节已被标记为 saved
      try {
        if (_creatorFeatureEnabled && _creatorFeatureEnabled.value) {
          if (_getChapterStatus && _currentChapterIndex) {
            const st = _getChapterStatus(_currentChapterIndex.value)
            if (st !== 'saved') {
              console.log('autoSaveToSlot skipped for creator: chapter status is', st)
              return
            }
          }
        }
      } catch (e) { console.warn('autoSaveToSlot: chapter status check failed', e) }
      // 构建 gameData 对象
      const gameData = {
        work: work.value,
        state: buildSavePayload().state,
        thumbnail: (_currentBackground && _currentBackground.value) ? _currentBackground.value : (_effectiveCoverUrl && _effectiveCoverUrl.value) ? _effectiveCoverUrl.value : (work.value && work.value.coverUrl) ? work.value.coverUrl : null
      }
  
      // 使用 saveLoad.js 中的统一存档函数
      console.log('autoSaveToSlot: preparing to auto-save. save type:', gameData.state && gameData.state.endingindex ? 'ENDING' : 'CHAPTER')
      const result = await saveGameData(gameData, slot)
      
      if (result.success) {
        console.log('✅ 自动存档成功:', result.message)
      } else {
        console.warn('⚠️ 自动存档失败:', result.message)
      }
    } catch (err) {
      console.error('❌ 自动存档失败:', err)
    }
  }
  
  // 快速本地存档（用于 beforeunload 场景，不进行网络请求）
  const quickLocalAutoSave = (slot = AUTO_SAVE_SLOT) => {
    try {
      // 对于创作者身份，快速本地存档也只在章节状态为 'saved' 时允许
      try {
        if (_creatorFeatureEnabled && _creatorFeatureEnabled.value) {
          if (_getChapterStatus && _currentChapterIndex) {
            const st = _getChapterStatus(_currentChapterIndex.value)
            if (st !== 'saved') {
              console.log('quickLocalAutoSave skipped for creator: chapter status is', st)
              return
            }
          }
        }
      } catch (e) { console.warn('quickLocalAutoSave: chapter status check failed', e) }
      const payload = buildSavePayload()
      const userId = _getCurrentUserId ? _getCurrentUserId() : null
      const workId = work.value.id
      const key = localSaveKey(userId, workId, slot)
      // 直接写入完整 payload（包含 state，支持 endingindex）
      console.log('quickLocalAutoSave: saving locally. save type:', payload && payload.state && payload.state.endingindex ? 'ENDING' : 'CHAPTER')
      localStorage.setItem(key, JSON.stringify(payload))
    } catch (e) {}
  }
  
  const loadGame = async (slot = 'default') => {
    try {
      const workId = work.value.id
      
      // 使用 saveLoad.js 中的统一读档函数
      const result = await loadGameData(workId, slot)
      
      if (!result.success) {
        loadToast.value = result.message || '未找到存档'
        setTimeout(() => (loadToast.value = ''), 1500)
        return
      }
  
      // 从读取的数据中恢复游戏状态
      const savedData = result.data
      let remote = savedData.state || savedData
      
      // 🔑 关键修改：读档后必须向后端请求相应章节或结局的剧情内容
      const savedChapterIndex = typeof remote.chapterIndex === 'number' ? remote.chapterIndex : null
      const savedEndingIndex = typeof remote.endingindex === 'number' ? remote.endingindex : (remote.endingIndex != null ? Number(remote.endingIndex) : null)

      try {
        // 清空当前场景列表，准备加载存档的内容
        if (_storyScenes) _storyScenes.value = []

        if (savedEndingIndex) {
          // 读档为结局：直接请求单个结局详情接口以确保拿到完整 scenes（兼容生成中状态）
          console.log(`📖 读档为结局 (endingindex=${savedEndingIndex})，请求单个结局详情...`)
          try {
            const resp = await http.get(`/api/game/storyending/${workId}/${savedEndingIndex}/`)
            // axios 响应拦截器已经返回 response.data,不需要再访问 .data
            const payload = resp
            // 处理可能的生成中状态
            if (payload && (payload.status === 'generating' || payload.status === 'not_generated')) {
              console.warn(`⚠️ 结局 ${savedEndingIndex} 尚未生成 (status=${payload.status})`)
              // 若未生成或正在生成，仍尝试从 payload.ending 中读取 scenes（若有）
            }
            const endingObj = payload && (payload.ending || payload) ? (payload.ending || payload) : null
            // 如果结局详情中包含 state，则该 state 应视为结局的官方保存状态，覆盖当前 remote
            try {
              const endingState = payload && (payload.state || (payload.ending && payload.ending.state)) ? (payload.state || payload.ending.state) : null
              if (endingState) {
                remote = endingState
                console.log('loadGame: 使用结局详情中的 state 作为恢复状态')
              }
            } catch (e) { console.warn('loadGame: 合并结局 state 失败', e) }
            // 优先使用 payload.ending.status 决定是否为已保存的结局
            const endingStatus = payload?.ending?.status ?? payload?.status ?? null
            const endingSavedFlag = (endingStatus === 'saved')
            const scenes = Array.isArray(endingObj?.scenes) ? endingObj.scenes : (Array.isArray(payload?.scenes) ? payload.scenes : null)
            if (!scenes || scenes.length === 0) {
              console.warn('⚠️ 未能从结局详情中提取 scenes，尝试回退到结局列表请求')
              // 退回到原先的列表请求逻辑以提高兼容性
              const listResp = await http.get(`/api/game/storyending/${workId}/`)
              // axios 响应拦截器已经返回 response.data,不需要再访问 .data
              const listPayload = listResp
              const list = Array.isArray(listPayload) ? listPayload : (Array.isArray(listPayload?.endings) ? listPayload.endings : [])
              const idx = Math.max(0, Math.min(list.length - 1, Number(savedEndingIndex) - 1))
              const chosen = list[idx]
              // 如果从结局列表项中能拿到 state，也把它作为恢复状态
              try {
                if (chosen && (chosen.state || chosen.ending?.state)) {
                  remote = chosen.state || chosen.ending.state
                  console.log('loadGame: 使用结局列表项中的 state 作为恢复状态 (fallback)')
                }
              } catch (e) {}
              if (chosen && Array.isArray(chosen.scenes)) {
                for (const scene of chosen.scenes) {
                  try {
                    if (_pushSceneFromServer) _pushSceneFromServer(scene)
                    try {
                      const lastIdx = (_storyScenes && Array.isArray(_storyScenes.value)) ? _storyScenes.value.length - 1 : null
                      const pushed = (lastIdx != null && lastIdx >= 0) ? _storyScenes.value[lastIdx] : null
                      if (pushed) {
                        pushed._isBackendEnding = true
                        pushed.isEnding = true
                        pushed._endingSaved = endingSavedFlag
                        pushed.endingIndex = savedEndingIndex
                      }
                    } catch (tagErr) { console.warn('tagging pushed ending scene failed (fallback)', tagErr) }
                  } catch (e) { console.warn('pushSceneFromServer failed when loading ending scene (fallback):', e) }
                }
              }
            } else {
              console.log(`✅ 加载结局 #${savedEndingIndex}，场景数: ${scenes.length}`)
              for (const scene of scenes) {
                try {
                  if (_pushSceneFromServer) _pushSceneFromServer(scene)
                  try {
                    const lastIdx = (_storyScenes && Array.isArray(_storyScenes.value)) ? _storyScenes.value.length - 1 : null
                    const pushed = (lastIdx != null && lastIdx >= 0) ? _storyScenes.value[lastIdx] : null
                    if (pushed) {
                      pushed._isBackendEnding = true
                      pushed.isEnding = true
                      pushed._endingSaved = endingSavedFlag
                      pushed.endingIndex = savedEndingIndex
                    }
                  } catch (tagErr) { console.warn('tagging pushed ending scene failed', tagErr) }
                } catch (e) { console.warn('pushSceneFromServer failed when loading ending scene:', e) }
              }
            }

            // 标记推入的场景为后端结局场景，并记录逻辑上的 endingIndex，同时标注是否为已保存结局
            try {
              if (_storyScenes && Array.isArray(_storyScenes.value) && _storyScenes.value.length > 0) {
                for (let i = 0; i < _storyScenes.value.length; i++) {
                  try {
                    const pushed = _storyScenes.value[i]
                    if (pushed) {
                      pushed._isBackendEnding = true
                      pushed.isEnding = true
                      pushed.endingIndex = savedEndingIndex
                      if (typeof pushed._endingSaved === 'undefined') pushed._endingSaved = endingSavedFlag
                    }
                  } catch (e) {}
                }
              }
            } catch (tagErr) { console.warn('marking loaded ending scenes failed', tagErr) }

            // 记录到 lastSelectedEndingIndex，后续存档将优先使用此值
            try {
              if (_lastSelectedEndingIndex) {
                _lastSelectedEndingIndex.value = savedEndingIndex
                console.log('loadGame: set _lastSelectedEndingIndex =', _lastSelectedEndingIndex.value)
              }
            } catch (e) { console.warn('loadGame: set lastSelectedEndingIndex failed', e) }

            // 标记为正在播放后端结局场景，及已追加结局，避免后续再次请求下一章
            try {
              if (_playingEndingScenes) {
                _playingEndingScenes.value = true
                console.log('loadGame: set _playingEndingScenes = true')
              }
            } catch (e) { console.warn('loadGame: set playingEndingScenes failed', e) }

            try {
              if (_endingsAppended) {
                _endingsAppended.value = true
                console.log('loadGame: set _endingsAppended = true')
              }
            } catch (e) { console.warn('loadGame: set endingsAppended failed', e) }

          } catch (err) {
            console.error('读取单个结局详情失败，回退到章节加载: ', err)
          }
        } else {
          // 普通章节读档
          const chapterToLoad = savedChapterIndex || 1
          console.log(`📖 读档后请求章节 ${chapterToLoad} 的剧情内容...`)
          const chapterData = _fetchNextChapter ? await _fetchNextChapter(workId, chapterToLoad) : null
          if (chapterData && chapterData.chapter && Array.isArray(chapterData.chapter.scenes)) {
            console.log(`✅ 成功获取章节 ${chapterToLoad} 的内容，共 ${chapterData.chapter.scenes.length} 个场景`)
            for (const scene of chapterData.chapter.scenes) {
              try { if (_pushSceneFromServer) _pushSceneFromServer(scene) } catch (e) { console.warn('pushSceneFromServer failed when loading chapter:', e) }
            }
          } else {
            console.warn('⚠️ 未能获取章节内容，场景数据可能不完整')
          }
        }
      } catch (e) {
        console.error('❌ 请求章节/结局内容失败:', e)
        alert('读档成功，但未能加载场景内容，可能影响游戏体验')
      }
      
      // 辅助函数：根据 sceneId 或 chapterIndex 定位场景索引
      const deriveIndexFromPayload = (p) => {
        try {
          if (!p) return null
          // 优先使用 sceneId 来定位
          if (p.sceneId != null && _storyScenes && Array.isArray(_storyScenes.value)) {
            const pid = String(p.sceneId)
            const idx = _storyScenes.value.findIndex(s => s && (String(s.id) === pid || String(s.sceneId) === pid))
            if (idx >= 0) return idx
            // 如果找不到对应的 sceneId，返回 0（章节开头）
            console.warn(`⚠️ 未找到 sceneId=${pid} 对应的场景，将从章节开头开始`)
            return 0
          }
          // 兼容老字段 currentSceneIndex
          if (typeof p.currentSceneIndex === 'number') return p.currentSceneIndex
          if (typeof p.chapterIndex === 'number' && _storyScenes) {
            const idx = _storyScenes.value.findIndex(s => s && (s.chapterIndex === p.chapterIndex || s.chapter === p.chapterIndex))
            if (idx >= 0) return idx
          }
        } catch (e) {}
        return null
      }
  
      // 恢复场景索引
      let derived = deriveIndexFromPayload(remote)
      if (derived != null && _currentSceneIndex) {
        _currentSceneIndex.value = derived
      } else if (_currentSceneIndex) {
        // 如果无法定位到具体场景，从章节开头开始
        _currentSceneIndex.value = 0
      }
  
      // 恢复对话索引
      if (_currentDialogueIndex) {
        if (typeof remote.currentDialogueIndex === 'number') {
          _currentDialogueIndex.value = remote.currentDialogueIndex
        } else if (remote.dialogueIndex != null) {
          _currentDialogueIndex.value = remote.dialogueIndex
        } else {
          _currentDialogueIndex.value = 0
        }
      }
  
      // 恢复章节索引
      if (_currentChapterIndex && typeof remote.chapterIndex === 'number') {
        _currentChapterIndex.value = remote.chapterIndex
      }
  
      // 恢复属性和状态
      attributes.value = deepClone(remote.attributes || {})
      statuses.value = deepClone(remote.statuses || {})
      
      // 恢复选择历史
      if (_choiceHistory) _choiceHistory.value = deepClone(remote.choiceHistory || [])
      
      console.log('📍 读档状态详情:', {
        chapterIndex: _currentChapterIndex ? _currentChapterIndex.value : null,
        sceneIndex: _currentSceneIndex ? _currentSceneIndex.value : null,
        dialogueIndex: _currentDialogueIndex ? _currentDialogueIndex.value : null,
        totalScenes: _storyScenes ? _storyScenes.value.length : 0,
        choiceHistoryCount: _choiceHistory ? _choiceHistory.value.length : 0,
        choiceHistory: _choiceHistory ? _choiceHistory.value : []
      })
      
      // 输出当前场景的初始状态（在调用 restoreChoiceFlagsFromHistory 之前）
      if (_currentSceneIndex && _storyScenes && _storyScenes.value) {
        const curScene = _storyScenes.value[_currentSceneIndex.value]
        if (curScene) {
          console.log('📍 读档前当前场景状态:', {
            sceneId: curScene.id || curScene.sceneId,
            choiceConsumed: curScene.choiceConsumed,
            chosenChoiceId: curScene.chosenChoiceId,
            choiceTriggerIndex: curScene.choiceTriggerIndex,
            currentDialogueIndex: _currentDialogueIndex ? _currentDialogueIndex.value : null,
            hasChoices: Array.isArray(curScene.choices) && curScene.choices.length > 0,
            choicesCount: Array.isArray(curScene.choices) ? curScene.choices.length : 0
          })
        }
      }
      
      // 根据选择历史恢复场景的已选标记
      // 🔑 修复：确保在恢复标记前所有索引都已正确设置
      try { 
        if (_restoreChoiceFlagsFromHistory) {
          _restoreChoiceFlagsFromHistory()
          console.log('📍 读档后恢复选项标记完成')
          // 输出当前场景的状态以便调试
          if (_currentSceneIndex && _storyScenes && _storyScenes.value) {
            const curScene = _storyScenes.value[_currentSceneIndex.value]
            if (curScene) {
              console.log('📍 读档后当前场景状态:', {
                sceneId: curScene.id || curScene.sceneId,
                choiceConsumed: curScene.choiceConsumed,
                chosenChoiceId: curScene.chosenChoiceId,
                choiceTriggerIndex: curScene.choiceTriggerIndex,
                currentDialogueIndex: _currentDialogueIndex ? _currentDialogueIndex.value : null,
                hasChoices: Array.isArray(curScene.choices) && curScene.choices.length > 0,
                choicesCount: Array.isArray(curScene.choices) ? curScene.choices.length : 0
              })
            }
          }
        }
      } catch (e) { 
        console.warn('restoreChoiceFlagsFromHistory error:', e) 
      }
  
      // 恢复显示状态
      // 🔑 修复：读档后先不显示选项，让 watch 根据当前状态判断是否应该显示
      try { if (_suppressAutoShowChoices) _suppressAutoShowChoices.value = false } catch (e) {}
      if (_showText) _showText.value = true
      if (_choicesVisible) _choicesVisible.value = false
      lastSaveInfo.value = deepClone(remote)
      
      loadToast.value = result.message || `读档成功（${new Date(savedData.timestamp).toLocaleString()}）`
      setTimeout(() => (loadToast.value = ''), 2000)
      
      console.log('✅ 读档成功:', result)
      if (_currentChapterIndex && _currentSceneIndex && _currentDialogueIndex) {
        console.log(`📍 当前位置: 章节${_currentChapterIndex.value}, 场景${_currentSceneIndex.value}, 对话${_currentDialogueIndex.value}`)
      }
      
      // 读档成功后自动关闭读档弹窗
      showLoadModal.value = false
    } catch (err) {
      console.error('❌ 读档失败:', err)
      alert('读档失败：' + err.message)
    }
  }
  
  const deleteGame = async (slot = 'default') => {
    if (!confirm(`确定要删除 ${slot.toUpperCase()} 的存档吗？此操作不可撤销。`)) {
      return
    }
  
    try {
      const workId = work.value.id
      
      // 使用 saveLoad.js 中的统一删除函数
      const result = await deleteGameData(workId, slot)
      
      if (result.success) {
        saveToast.value = result.message || '存档已删除'
        setTimeout(() => (saveToast.value = ''), 2000)
        console.log('✅ 删除存档成功:', result)
        
        // 刷新槽位信息
        await refreshSlotInfos()
      } else {
        throw new Error(result.message || '删除失败')
      }
    } catch (err) {
      console.error('❌ 删除存档失败:', err)
      alert('删除存档失败：' + err.message)
    }
  }
  
  const refreshSlotInfos = async () => {
    try {
      const workId = work.value.id
      const info = await refreshSlotInfosUtil(workId, SLOTS)
      slotInfos.value = info
      console.log('✅ 刷新槽位信息成功:', info)
    } catch (e) {
      console.warn('⚠️ 刷新槽位信息失败：', e)
    }
  }
  
  return {
    showSaveModal,
    showLoadModal,
    showAttributesModal,
    slotInfos,
    attributes,
    statuses,
    saveToast,
    loadToast,
    lastSaveInfo,
    SLOTS,
    openSaveModal,
    openLoadModal,
    closeSaveModal,
    closeLoadModal,
    openAttributes,
    closeAttributes,
    saveGame,
    loadGame,
    deleteGame,
    refreshSlotInfos,
    autoSaveToSlot,
    quickLocalAutoSave,
    setDependencies
  }
}