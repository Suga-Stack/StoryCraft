import { ref } from 'vue'
import { saveGameData, loadGameData, deleteGameData, refreshSlotInfosUtil } from '../utils/saveLoad.js'
import { work } from './useStoryAPI.js'

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
      const gameData = {
        work: work.value,
        chapterIndex: _currentChapterIndex ? _currentChapterIndex.value : 1,
        sceneId: _currentScene && _currentScene.value ? (_currentScene.value.sceneId || _currentScene.value.id || null) : null,
        currentDialogueIndex: _currentDialogueIndex ? _currentDialogueIndex.value : 0,
        dialogueIndex: _currentDialogueIndex ? _currentDialogueIndex.value : 0,
        currentSceneIndex: _currentSceneIndex ? _currentSceneIndex.value : 0,
        attributes: attributes.value,
        statuses: statuses.value,
        choiceHistory: _choiceHistory ? _choiceHistory.value : []
      }
  
      // 使用 saveLoad.js 中的统一存档函数
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

    return {
      work: work.value,
      // API 文档要求的 state 结构
      state: {
        chapterIndex: _currentChapterIndex ? _currentChapterIndex.value : 1,
        sceneId: (_currentScene && _currentScene.value && (_currentScene.value.id || _currentScene.value.sceneId)) 
          ? Number(_currentScene.value.id ?? _currentScene.value.sceneId) 
          : (_currentSceneIndex ? _currentSceneIndex.value : 0),
        dialogueIndex: _currentDialogueIndex ? _currentDialogueIndex.value : 0,
        attributes: _deepClone ? _deepClone(attributes.value) : attributes.value,
        statuses: _deepClone ? _deepClone(statuses.value) : statuses.value,
        choiceHistory: cleanedChoiceHistory
      },
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
        chapterIndex: _currentChapterIndex ? _currentChapterIndex.value : 1,
        sceneId: _currentScene && _currentScene.value ? (_currentScene.value.sceneId || _currentScene.value.id || null) : null,
        currentDialogueIndex: _currentDialogueIndex ? _currentDialogueIndex.value : 0,
        dialogueIndex: _currentDialogueIndex ? _currentDialogueIndex.value : 0,
        currentSceneIndex: _currentSceneIndex ? _currentSceneIndex.value : 0,
        attributes: attributes.value,
        statuses: statuses.value,
        choiceHistory: _choiceHistory ? _choiceHistory.value : []
      }
  
      // 使用 saveLoad.js 中的统一存档函数
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
      const remote = savedData.state || savedData
      
      // 🔑 关键修改：读档后必须向后端请求相应章节的剧情内容
      const savedChapterIndex = typeof remote.chapterIndex === 'number' ? remote.chapterIndex : 1
      
      console.log(`📖 读档后请求章节 ${savedChapterIndex} 的剧情内容...`)
      
      try {
        // 清空当前场景列表，准备加载存档章节的内容
        if (_storyScenes) _storyScenes.value = []
        
          // 向后端请求存档中保存的章节内容
        const chapterData = _fetchNextChapter ? await _fetchNextChapter(workId, savedChapterIndex) : null
        
        if (chapterData && chapterData.chapter && Array.isArray(chapterData.chapter.scenes)) {
          console.log(`✅ 成功获取章节 ${savedChapterIndex} 的内容，共 ${chapterData.chapter.scenes.length} 个场景`)
          
          // 将场景内容推入 storyScenes
          for (const scene of chapterData.chapter.scenes) {
            try {
              if (_pushSceneFromServer) _pushSceneFromServer(scene)
            } catch (e) {
              console.warn('pushSceneFromServer failed when loading chapter:', e)
            }
          }
        } else {
          console.warn('⚠️ 未能获取章节内容，场景数据可能不完整')
        }
      } catch (e) {
        console.error('❌ 请求章节内容失败:', e)
        alert('读档成功，但未能加载章节内容，可能影响游戏体验')
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
      
      // 根据选择历史恢复场景的已选标记
      try { 
        if (_restoreChoiceFlagsFromHistory) {
          _restoreChoiceFlagsFromHistory()
          console.log('📍 读档后恢复选项标记完成')
          // 输出当前场景的状态以便调试
          if (_currentSceneIndex && _storyScenes && _storyScenes.value) {
            const curScene = _storyScenes.value[_currentSceneIndex.value]
            if (curScene) {
              console.log('📍 当前场景状态:', {
                sceneId: curScene.id || curScene.sceneId,
                choiceConsumed: curScene.choiceConsumed,
                chosenChoiceId: curScene.chosenChoiceId,
                choiceTriggerIndex: curScene.choiceTriggerIndex,
                currentDialogueIndex: _currentDialogueIndex ? _currentDialogueIndex.value : null,
                hasChoices: Array.isArray(curScene.choices) && curScene.choices.length > 0
              })
            }
          }
        }
      } catch (e) { 
        console.warn('restoreChoiceFlagsFromHistory error:', e) 
      }
  
      // 恢复显示状态
      // 抑制自动展示选项,要求用户再点击一次以显示（避免读档后选项丢失）
      try { if (_suppressAutoShowChoices) _suppressAutoShowChoices.value = true } catch (e) {}
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