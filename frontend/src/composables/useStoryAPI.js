import { ref, computed } from 'vue'
import http from '../utils/http.js'
import * as storyService from '../service/story.js'
import { deepClone } from '../utils/auth.js'

// 作品信息 - 导出为共享的 ref,以便在其他 composable 中使用
export const work = ref({})

export function useStoryAPI() {
  // 本地引用,允许在运行时替换为 mock 实现
  let getScenes = storyService.getScenes
  let generateChapter = storyService.generateChapter
  let saveChapter = storyService.saveChapter
  
  // 故事场景数据
  const storyScenes = ref([])
  const currentSceneIndex = ref(0)
  const currentDialogueIndex = ref(0)
  const currentChapterIndex = ref(1)
  const totalChapters = ref(null)
  const lastSeq = ref(0)
  const storyEndSignaled = ref(false)
  const isFetchingNext = ref(false)
  const isGeneratingSettlement = ref(false)
  
  // 章节状态
  const chaptersStatus = ref([])
  const generationLocks = ref({})
  const lastLoadedGeneratedChapter = ref(null)
  
  // 用户交互
  const choiceHistory = ref([])
  const isFetchingChoice = ref(false)
  const lastChoiceTimestamp = ref(0)
  const suppressAutoShowChoices = ref(false)
  
  // 计算属性
  const currentScene = computed(() => {
    return storyScenes.value[currentSceneIndex.value] || null
  })
  
  const getDialogueItem = (scene, idx) => {
    if (!scene) return null
    const item = scene.dialogues?.[idx]
    if (item == null) return null
    if (typeof item === 'string') return { text: item }
    if (typeof item === 'object') return { text: item.text ?? '', backgroundImage: item.backgroundImage, speaker: item.speaker }
    return null
  }
  
  const currentDialogue = computed(() => {
    const scene = currentScene.value
    const item = getDialogueItem(scene, currentDialogueIndex.value)
    return item?.text || ''
  })
  
  const currentBackground = computed(() => {
    const scene = currentScene.value
    const item = getDialogueItem(scene, currentDialogueIndex.value)
    if (item?.backgroundImage) return item.backgroundImage
    return scene?.backgroundImage || ''
  })
  
  const currentSpeaker = computed(() => {
    const scene = currentScene.value
    const item = getDialogueItem(scene, currentDialogueIndex.value)
    return (item && typeof item.speaker === 'string' && item.speaker.trim()) ? item.speaker.trim() : ''
  })
  
  // 辅助方法
  const getChapterStatus = (chapterIdx) => {
    try {
      const found = (chaptersStatus.value || []).find(x => Number(x.chapterIndex) === Number(chapterIdx))
      return found ? (found.status || null) : null
    } catch (e) { return null }
  }
  
  const checkCurrentChapterSaved = async (modifiableFromCreate, aiCallable) => {
    try {
      if (modifiableFromCreate && aiCallable === false) {
        return true
      }
      await getWorkDetails(work.value.id)
      const currentStatus = getChapterStatus(currentChapterIndex.value)
      return currentStatus === 'saved'
    } catch (e) {
      console.warn('checkCurrentChapterSaved failed', e)
      return false
    }
  }
  
  const getWorkDetails = async (workId) => {
    try {
      if (!workId) workId = work.value.id
      const url = `/gameworks/gameworks/${encodeURIComponent(workId)}/`
      const resp = await http.get(url)
      const body = resp && resp.data ? resp.data : resp
      
      const mergeServerStatuses = (serverList) => {
        try {
          const server = Array.isArray(serverList) ? serverList : []
          const local = Array.isArray(chaptersStatus.value) ? chaptersStatus.value : []
          const map = new Map()
          server.forEach(s => map.set(Number(s.chapterIndex), Object.assign({}, s)))
          (local || []).forEach(l => {
            const idx = Number(l.chapterIndex)
            if (map.has(idx)) {
              const existing = map.get(idx)
              if (l.status === 'saved') existing.status = 'saved'
              map.set(idx, existing)
            } else {
              map.set(idx, Object.assign({}, l))
            }
          })
          chaptersStatus.value = Array.from(map.values())
        } catch (e) {
          try { chaptersStatus.value = serverList } catch (err) {}
        }
      }

      if (body && body.data && Array.isArray(body.data.chapters_status)) {
        mergeServerStatuses(body.data.chapters_status)
        return body.data
      }
      if (body && Array.isArray(body.chapters_status)) {
        mergeServerStatuses(body.chapters_status)
        return body
      }
      return body && body.data ? body.data : body
    } catch (e) {
      console.warn('getWorkDetails failed', e)
      return null
    }
  }
  
  const pollWorkStatus = async (workId, targetChapter, opts = { interval: 1500, timeout: 120000 }) => {
    const start = Date.now()
    while (true) {
      try {
        const data = await getWorkDetails(workId)
        const cs = (data && Array.isArray(data.chapters_status)) ? data.chapters_status.find(x => Number(x.chapterIndex) === Number(targetChapter)) : null
        const status = cs ? cs.status : null
        if (Array.isArray(data?.chapters_status)) chaptersStatus.value = data.chapters_status
        if (status === 'generated' || status === 'saved') return status
      } catch (e) {}
      if (Date.now() - start > (opts && opts.timeout ? opts.timeout : 120000)) throw new Error('pollWorkStatus timeout')
      await new Promise(r => setTimeout(r, opts && opts.interval ? opts.interval : 1500))
    }
  }
  
  const pushSceneFromServer = (sceneObj) => {
    try {
      console.log('[pushSceneFromServer] Received sceneObj:', sceneObj)
      const raw = sceneObj.scene ? sceneObj.scene : sceneObj
      if (!raw) {
        console.warn('[pushSceneFromServer] No raw data')
        return
      }

      const id = raw.id ?? raw.sceneId ?? (raw.seq ? `seq-${raw.seq}` : Math.floor(Math.random() * 1000000))
      const backgroundImage = raw && raw.backgroundImage ? raw.backgroundImage : (raw && (raw.bg || ''))

      const dialogues = []
      let extractedChoices = null
      let hasExtractedChoices = false // 标记是否已经提取过选项
      
      for (let i = 0; i < (raw.dialogues || []).length; i++) {
        const d = raw.dialogues[i]
        if (typeof d === 'string') {
          dialogues.push(d)
        } else if (d && typeof d === 'object') {
          const narration = d.narration ?? d.text ?? ''
          const item = { text: narration }
          if (d.backgroundImage) item.backgroundImage = d.backgroundImage
          if (d.speaker) item.speaker = d.speaker
          
          // 只提取第一次出现的 playerChoices
          if (!hasExtractedChoices && Array.isArray(d.playerChoices) && d.playerChoices.length > 0) {
            const pcs = d.playerChoices.map((c, idx) => ({
              id: c.id ?? c.choiceId ?? `${id}-${i}-${idx}`,
              choiceId: c.choiceId ?? c.id ?? (idx + 1),
              text: c.text ?? '',
              attributesDelta: c.attributesDelta ?? {},
              statusesDelta: c.statusesDelta ?? {},
              statuses: c.statuses ?? {},
              subsequentDialogues: c.subsequentDialogues ?? []
            }))
            extractedChoices = { index: dialogues.length, choices: pcs }
            hasExtractedChoices = true
            console.log('[pushSceneFromServer] 提取选项:', { dialogueIndex: i, choiceTriggerIndex: dialogues.length, choicesCount: pcs.length })
          }
          dialogues.push(item)
        } else {
          dialogues.push(String(d))
        }
      }

      const scene = {
        id: id,
        sceneId: id,
        backgroundImage,
        dialogues: dialogues,
        isChapterEnding: raw.isChapterEnding ?? raw.chapterEnd ?? false
      }

      if (raw.chapterIndex || raw.chapterIndex === 0) scene.chapterIndex = raw.chapterIndex
      if (raw.chapterTitle || raw.title) scene.chapterTitle = raw.chapterTitle ?? raw.title

      // 如果从 dialogues 中提取到了选项,使用提取的选项
      if (extractedChoices) {
        scene.choiceTriggerIndex = extractedChoices.index
        scene.choices = extractedChoices.choices
        console.log('[pushSceneFromServer] 设置场景选项:', { 
          sceneId: scene.id, 
          choiceTriggerIndex: scene.choiceTriggerIndex, 
          choicesCount: scene.choices.length 
        })
      }
      // 否则,如果场景级别有 choices,使用场景级别的选项(向后兼容)
      else if (Array.isArray(raw.choices) && raw.choices.length > 0) {
        scene.choices = raw.choices.map((c, idx) => ({ 
          id: c.id ?? c.choiceId ?? `${id}-c-${idx}`,
          choiceId: c.choiceId ?? c.id ?? (idx + 1),
          text: c.text ?? '', 
          attributesDelta: c.attributesDelta ?? {}, 
          statusesDelta: c.statusesDelta ?? {}, 
          subsequentDialogues: c.subsequentDialogues ?? [] 
        }))
        scene.choiceTriggerIndex = typeof raw.choiceTriggerIndex === 'number' ? raw.choiceTriggerIndex : (scene.dialogues.length - 1)
        console.log('[pushSceneFromServer] 使用场景级选项:', { 
          sceneId: scene.id, 
          choiceTriggerIndex: scene.choiceTriggerIndex, 
          choicesCount: scene.choices.length 
        })
      }

      try {
        const toPush = deepClone(scene)
        const baseId = String(toPush.sceneId ?? toPush.id ?? Math.floor(Math.random() * 1000000))
        const chap = toPush.chapterIndex != null ? String(toPush.chapterIndex) : 'nochap'
        toPush._uid = `${chap}-${baseId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        toPush._pushedAt = Date.now()
        console.log('[pushSceneFromServer] Pushing scene:', toPush.id, 'Total scenes before push:', storyScenes.value.length)
        storyScenes.value.push(toPush)
        console.log('[pushSceneFromServer] Total scenes after push:', storyScenes.value.length)
      } catch (e) {
        console.warn('[pushSceneFromServer] deepClone failed, using fallback')
        try { 
          storyScenes.value.push(scene) 
        } catch (err) { console.warn('pushSceneFromServer push failed', err) }
      }
    } catch (e) { console.warn('pushSceneFromServer failed', e) }
  }
  
  const fetchNextContent = async (workId, chapterIndex) => {
    try {
      console.log('[Story] fetchNextContent chapter =', chapterIndex)
      const resp = await getScenes(workId, chapterIndex)
      if (!resp) return null
      if (resp.generating) return { generating: true, end: false, scenes: [] }
      
      const isEnd = (resp.end === true) || (resp.isGameEnding === true) || (resp.isGameEnd === true)
      const scenes = Array.isArray(resp.scenes) ? resp.scenes : (Array.isArray(resp) ? resp : [])
      
      if (scenes.length > 0) {
        const startIdx = storyScenes.value.length
        for (const sc of scenes) {
          try {
            if (resp.chapterIndex || resp.chapterIndex === 0) sc.chapterIndex = resp.chapterIndex
            if (resp.title) sc.chapterTitle = resp.title
            pushSceneFromServer(sc)
          } catch (e) { console.warn('pushSceneFromServer failed while fetching next content', e) }
        }
        
        if (resp.chapterIndex) {
          currentChapterIndex.value = resp.chapterIndex
        }
        
        if (resp.lastSeq) lastSeq.value = Math.max(lastSeq.value, resp.lastSeq)
      }

      return { generating: false, end: !!isEnd, scenes }
    } catch (err) {
      console.warn('fetchNextContent error', err)
      return { generating: false, end: false, scenes: [] }
    }
  }
  
  const restoreChoiceFlagsFromHistory = () => {
    try {
      if (Array.isArray(storyScenes.value)) {
        storyScenes.value.forEach(s => {
          try { if (s) { s.choiceConsumed = false; s.chosenChoiceId = null } } catch (e) {}
        })
      }
      if (Array.isArray(choiceHistory.value)) {
        choiceHistory.value.forEach(h => {
          try {
            const sid = h.sceneId || h.sceneId
            const psid = String(sid)
            const idx = Array.isArray(storyScenes.value) ? storyScenes.value.findIndex(s => s && (String(s.id) === psid || String(s.sceneId) === psid)) : -1
            if (idx >= 0 && storyScenes.value[idx]) {
              try { storyScenes.value[idx].chosenChoiceId = h.choiceId || h.choiceId } catch (e) {}
              try { storyScenes.value[idx].choiceConsumed = true } catch (e) {}
              console.log('[restoreChoiceFlagsFromHistory] 恢复场景选项标记:', idx, '选项ID:', h.choiceId)
            }
          } catch (e) {}
        })
      }
      try {
        const cur = storyScenes.value && storyScenes.value[currentSceneIndex.value]
        if (cur && cur.choiceConsumed && typeof cur.choiceTriggerIndex === 'number') {
          if (typeof currentDialogueIndex.value === 'number' && currentDialogueIndex.value < cur.choiceTriggerIndex) {
            try { cur.choiceConsumed = false; cur.chosenChoiceId = null } catch (e) {}
            console.log('[restoreChoiceFlagsFromHistory] 当前场景尚未到选项触发点,清除choiceConsumed标记')
          }
        }
      } catch (e) {}
    } catch (e) {
      console.warn('restoreChoiceFlagsFromHistory failed', e)
    }
  }
  
  return {
    // 状态
    work,
    storyScenes,
    currentSceneIndex,
    currentDialogueIndex,
    currentChapterIndex,
    totalChapters,
    lastSeq,
    storyEndSignaled,
    isFetchingNext,
    isGeneratingSettlement,
    chaptersStatus,
    generationLocks,
    lastLoadedGeneratedChapter,
    choiceHistory,
    isFetchingChoice,
    lastChoiceTimestamp,
    suppressAutoShowChoices,
    
    // 计算属性
    currentScene,
    currentDialogue,
    currentBackground,
    currentSpeaker,
    
    // 方法
    getDialogueItem,
    getChapterStatus,
    checkCurrentChapterSaved,
    getWorkDetails,
    pollWorkStatus,
    pushSceneFromServer,
    fetchNextContent,
    restoreChoiceFlagsFromHistory,
    
    // 服务引用
    getScenes: () => getScenes,
    setGetScenes: (fn) => { getScenes = fn },
    generateChapter: () => generateChapter,
    setGenerateChapter: (fn) => { generateChapter = fn },
    saveChapter: () => saveChapter,
    setSaveChapter: (fn) => { saveChapter = fn }
  }
}