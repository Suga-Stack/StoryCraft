<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import './GamePage.css'
import { useRouter, useRoute } from 'vue-router'
import { ScreenOrientation } from '@capacitor/screen-orientation'
import { StatusBar, Style } from '@capacitor/status-bar'
import { useUserStore } from '../store/index.js'
import http from '../service/http.js'
import * as storyService from '../service/story.js'
import { getCurrentUserId, deepClone } from '../utils/auth.js'
import { sanitize } from '../utils/sensitiveFilter.js'
import { USE_MOCK_STORY, USE_MOCK_SAVE, FORCE_CREATOR_FOR_TEST, isCreatorIdentity, editorInvocation, creatorFeatureEnabled, modifiableFromCreate } from '../config/gamepage.js'
import { useSaveLoad } from '../composables/useSaveLoad.js'
import { useAutoPlay } from '../composables/useAutoPlay.js'
import { useStoryAPI } from '../composables/useStoryAPI.js'
import { useCreatorMode } from '../composables/useCreatorMode.js'
import { useGameState } from '../composables/useGameStatus.js'
import { INITIAL_SCENES_MAX_RETRIES } from '../config/polling.js'

const router = useRouter()
const route = useRoute()

// 使用 useStoryAPI composable
const storyAPI = useStoryAPI()
let {
  // 状态
  work,
  lastSeq,
  storyEndSignaled,
  isGeneratingSettlement,
  choiceHistory,
  lastChoiceTimestamp,
  currentSceneIndex,
  currentDialogueIndex,
  currentChapterIndex,
  chaptersStatus,
  lastLoadedGeneratedChapter,
  lastSelectedEndingIndex,
  isFetchingNext,
  isFetchingChoice,
  storyScenes,
  generationLocks,
  suppressAutoShowChoices,
  totalChapters,
  // 计算属性
  currentScene,
  currentDialogue,
  currentBackground,
  currentSpeaker,
  // 方法
  fetchNextContent,
  fetchNextChapter,
  pushSceneFromServer,
  getChapterStatus,
  getWorkDetails,
  checkCurrentChapterSaved,
  pollWorkStatus,
  restoreChoiceFlagsFromHistory,
  getDialogueItem,
  // 服务引用
  getScenes,
  setGetScenes,
  generateChapter,
  setGenerateChapter,
  saveChapter,
  setSaveChapter
} = storyAPI

// 从 route 初始化 work
work.value = {
  id: route.params.id || 1,
  title: history.state?.title || (() => { try { return JSON.parse(sessionStorage.getItem('lastWorkMeta'))?.title } catch { return null } })() || '锦瑟深宫',
  coverUrl: history.state?.coverUrl || (() => { try { return JSON.parse(sessionStorage.getItem('lastWorkMeta'))?.coverUrl } catch { return null } })() || '',
  authorId: 'author_001'
}

// 使用 useSaveLoad
const saveLoadAPI = useSaveLoad()
const {
  showSaveModal,
  showLoadModal,
  showAttributesModal,
  slotInfos,
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
  attributes,
  statuses,
  setDependencies: setSaveLoadDependencies,
  AUTO_SAVE_SLOT,
  saveToast,
  loadToast,
  lastSaveInfo
} = saveLoadAPI

// 页面内短时提醒
const noticeToast = ref('')
let noticeTimer = null
const showNotice = (msg, ms = 5000) => {
  try {
    noticeToast.value = msg
    if (noticeTimer) clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => { noticeToast.value = ''; noticeTimer = null }, ms)
  } catch (e) { console.warn('showNotice failed', e) }
}

// 检测是否在 Capacitor 环境中
const isNativeApp = computed(() => {
  return window.Capacitor !== undefined
})

// 使用 useCreatorMode - 需要在 gameState 之前创建
const creatorModeAPI = useCreatorMode({
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
  checkCurrentChapterSaved,
  creatorFeatureEnabled,
  // 添加缺失的依赖
  currentChapterIndex,
  totalChapters
})

const {
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
  // Narration 功能
  addNarration,
  deleteNarration,
  isNarration,
  
  loadOverrides,
  saveOverrides,
  applyOverridesToScenes,
  
  setupCreatorModeWatch,
  setDependencies: setCreatorModeDependencies
} = creatorModeAPI

// 当前对话对象（可能是字符串或对象）
const currentDialogueObject = computed(() => {
  try {
    const scene = storyScenes.value[currentSceneIndex.value]
    if (!scene || !Array.isArray(scene.dialogues)) return null
    const idx = currentDialogueIndex.value
    if (idx < 0 || idx >= scene.dialogues.length) return null
    return scene.dialogues[idx]
  } catch (e) { return null }
})

// 是否为旁白
const currentIsNarration = computed(() => {
  try { return isNarration(currentDialogueObject.value) } catch (e) { return false }
})

// 尝试删除旁白：若不满足条件则给出提示
const attemptDeleteNarration = () => {
  try {
    if (!creatorMode.value) { showNotice('尚未进入创作者模式'); return }
    if (!currentIsNarration.value) { showNotice('当前不是旁白，无法删除'); return }
    deleteNarration()
  } catch (e) { console.warn('attemptDeleteNarration failed', e) }
}

// 先定义 showSettingsModal，因为它被 anyOverlayOpen 使用
const showSettingsModal = ref(false)

// 音乐播放支持（用于菜单设置中的上一首/下一首/暂停按钮）
const playlist = ref([]) // 将来可由外部注入 URL 列表
const currentTrackIndex = ref(0)
const audioEl = ref(null)
const isMusicPlaying = ref(false)
// 用于前后台恢复播放的临时状态
let wasPlayingBeforeHidden = false
let resumePending = false
// 本地音乐（用户选择的文件，保存到 localStorage）
const localTracks = ref([]) // { name, dataUrl }
const musicInput = ref(null)

const LOCAL_MUSIC_KEY = `local_music_${work.value && work.value.id ? work.value.id : 'global'}`

const saveLocalTracksToStorage = () => {
  try {
    localStorage.setItem(LOCAL_MUSIC_KEY, JSON.stringify(localTracks.value || []))
  } catch (e) { console.warn('保存本地音乐到 localStorage 失败', e) }
}

const loadLocalTracksFromStorage = () => {
  try {
    const raw = localStorage.getItem(LOCAL_MUSIC_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      localTracks.value = parsed
    }
  } catch (e) { console.warn('加载本地音乐失败', e) }
}

const onMusicFileSelected = (e) => {
  try {
    const f = (e && e.target && e.target.files && e.target.files[0]) || null
    if (!f) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const dataUrl = ev.target.result
        const item = { name: f.name || 'local-audio', dataUrl }
        // 将新加入的本地曲目放到本地列表最前（与 playlist 前部保持同序）
        localTracks.value.unshift(item)
        // 将本地曲目放到播放列表前面，优先播放
        playlist.value = [item.dataUrl].concat(playlist.value || [])
        saveLocalTracksToStorage()
      } catch (err) { console.warn('处理本地音乐文件失败', err) }
    }
    reader.onerror = (err) => { console.warn('读取文件失败', err) }
    reader.readAsDataURL(f)
    // 清空 input 值，允许重复添加同一文件
    if (e && e.target) e.target.value = null
  } catch (e) { console.warn('onMusicFileSelected 失败', e) }
}

const removeLocalTrack = (idx) => {
  try {
    if (idx < 0 || idx >= localTracks.value.length) return
    const removed = localTracks.value[idx]
    const removedUrl = removed && removed.dataUrl
    // 从本地列表中移除
    localTracks.value.splice(idx, 1)
    // 从 playlist 中移除对应的 dataUrl，并确保本地条目仍排在前面
    const remainingLocalUrls = localTracks.value.map(t => t.dataUrl)
    // 先移除被删除的 url
    let newPlaylist = (playlist.value || []).filter(u => u !== removedUrl)
    // 将本地 urls 放到前面，避免重复
    newPlaylist = remainingLocalUrls.concat(newPlaylist.filter(u => !remainingLocalUrls.includes(u)))
    playlist.value = newPlaylist
    saveLocalTracksToStorage()
    // 如果当前播放的就是被删除的曲目，停止播放并尝试切换到下一首
    try {
      if (audioEl.value && removedUrl && audioEl.value.src === removedUrl) {
        try { pauseMusic() } catch (e) {}
        // 如果仍有曲目，播放当前索引（或 0）
        if (playlist.value.length > 0) {
          const nextIdx = Math.max(0, Math.min(currentTrackIndex.value, playlist.value.length - 1))
          loadTrack(nextIdx)
        } else {
          // 清理 audio 元素
          try { audioEl.value.src = '' } catch (e) {}
        }
      }
    } catch (e) { console.warn('处理被删除曲目正在播放的情况失败', e) }
    // 如果当前索引超出范围，重置为 0
    if (currentTrackIndex.value >= playlist.value.length) currentTrackIndex.value = 0
  } catch (e) { console.warn('removeLocalTrack 失败', e) }
}

const triggerMusicFilePicker = () => {
  try {
    if (musicInput && musicInput.value) musicInput.value.click()
  } catch (e) { console.warn('triggerMusicFilePicker 失败', e) }
}

const playLocal = async (i) => {
  try {
    // 本地曲目按序放在 playlist 前部，直接使用索引
    loadTrack(i)
    await playTrack()
  } catch (e) { console.warn('playLocal 失败', e) }
}
// DEV-only flag
const isDev = !!(import.meta && import.meta.env && import.meta.env.DEV)

const loadTrack = (idx) => {
  try {
    if (!Array.isArray(playlist.value) || playlist.value.length === 0) return
    const limited = Math.max(0, Math.min(idx || 0, playlist.value.length - 1))
    currentTrackIndex.value = limited
    if (!audioEl.value) audioEl.value = new Audio()
    // 配置 audio 元素以增加自动播放兼容性
    try { audioEl.value.crossOrigin = 'anonymous' } catch (e) {}
    try { audioEl.value.preload = 'auto' } catch (e) {}
    try { audioEl.value.setAttribute && audioEl.value.setAttribute('playsinline', '') } catch (e) {}
    audioEl.value.src = playlist.value[limited]
    audioEl.value.loop = false
    // 设置默认音量，避免静音场景
    try { audioEl.value.volume = 0.8 } catch (e) {}
    audioEl.value.load()
    audioEl.value.onended = () => { playNextTrack() }
    // 更详细的事件监听，便于调试
    audioEl.value.onplay = () => { console.log('[GamePage][audio] onplay, src=', audioEl.value.src); isMusicPlaying.value = true }
    audioEl.value.onpause = () => { console.log('[GamePage][audio] onpause'); isMusicPlaying.value = false }
    audioEl.value.onerror = (ev) => { console.error('[GamePage][audio] error event:', ev, 'audioEl:', audioEl.value) }
  } catch (e) { console.warn('loadTrack failed', e) }
}

const playTrack = async (idx) => {
  try {
    if (idx != null) loadTrack(idx)
    if (!audioEl.value) audioEl.value = new Audio()
    try {
      await audioEl.value.play()
      isMusicPlaying.value = true
      console.log('[GamePage][audio] playTrack succeeded, src=', audioEl.value.src)
    } catch (playErr) {
      // 更明确地记录播放失败的信息，方便调试 autoplay 限制或 CORS
      console.error('[GamePage][audio] playTrack failed:', playErr)
      // 尝试静音回退：某些浏览器允许静音自动播放
      try {
        audioEl.value.muted = true
        await audioEl.value.play()
        isMusicPlaying.value = true
        console.log('[GamePage][audio] playTrack succeeded with muted fallback, src=', audioEl.value.src)
        // 尝试在短暂延迟后取消静音并继续播放（若浏览器策略允许）
        setTimeout(async () => {
          try {
            audioEl.value.muted = false
            await audioEl.value.play()
            console.log('[GamePage][audio] unmuted and resumed playback')
          } catch (unmuteErr) {
            console.warn('[GamePage][audio] unmute/resume failed (likely blocked by autoplay policy):', unmuteErr)
          }
        }, 600)
      } catch (mutedErr) {
        console.warn('[GamePage][audio] muted fallback also failed:', mutedErr)
        throw playErr
      }
    }
  } catch (e) { console.warn('playTrack failed', e) }
}

const playNextTrack = () => {
  try {
    if (!Array.isArray(playlist.value) || playlist.value.length === 0) return
    const next = (currentTrackIndex.value + 1) % playlist.value.length
    loadTrack(next)
    playTrack()
  } catch (e) { console.warn('playNextTrack failed', e) }
}

const playPrevTrack = () => {
  try {
    if (!Array.isArray(playlist.value) || playlist.value.length === 0) return
    const prev = (currentTrackIndex.value - 1 + playlist.value.length) % playlist.value.length
    loadTrack(prev)
    playTrack()
  } catch (e) { console.warn('playPrevTrack failed', e) }
}

const pauseMusic = () => {
  try {
    if (audioEl.value) {
      audioEl.value.pause()
      isMusicPlaying.value = false
      console.log('[GamePage][audio] paused')
    }
  } catch (e) { console.warn('pauseMusic failed', e) }
}

// 停止并清理音频（用于切换章节/加载时）
const stopMusic = () => {
  try {
    if (audioEl.value) {
      audioEl.value.pause()
      audioEl.value.currentTime = 0
      isMusicPlaying.value = false
      console.log('[GamePage][audio] stopped and reset')
    }
  } catch (e) { console.warn('stopMusic failed', e) }
}

const toggleMusic = async () => {
  try {
    if (isMusicPlaying.value) {
      pauseMusic()
    } else {
      // 尝试继续播放当前曲目
      await playTrack()
    }
  } catch (e) {
    console.warn('toggleMusic failed', e)
  }
}

// 如果外部（例如页面其他脚本）注入了全局播放列表，则自动使用它
onMounted(() => {
  try {
    if (window.__musicPlaylist && Array.isArray(window.__musicPlaylist) && window.__musicPlaylist.length > 0) {
      playlist.value = window.__musicPlaylist
      loadTrack(0)
    }
  } catch (e) {}
})

// DEV: 临时注入测试音频并预加载（不强制自动播放，以避免被浏览器阻止）
onMounted(() => {
  try {
    if (isDev) {
      const devUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
      try { window.__musicPlaylist = [devUrl] } catch (e) {}
      playlist.value = [devUrl]
      loadTrack(0)
      console.log('[GamePage] DEV audio playlist injected:', devUrl)
    }
  } catch (e) { console.warn('DEV audio injection failed', e) }
})

// 加载并应用本地保存的音乐（如果有）
onMounted(() => {
  try {
    loadLocalTracksFromStorage()
    if (localTracks.value && localTracks.value.length > 0) {
      // 将本地曲目放到播放列表前面
      const localUrls = localTracks.value.map(t => t.dataUrl)
      playlist.value = localUrls.concat(playlist.value || [])
      loadTrack(0)
    }
  } catch (e) { console.warn('初始化本地音乐失败', e) }
})

// 如果后端通过作品详情提供了播放列表（通过 useStoryAPI.musicPlaylist），同步到本地 playlist
try {
    if (typeof storyAPI !== 'undefined' && storyAPI.musicPlaylist) {
    watch(() => storyAPI.musicPlaylist.value, (val) => {
      try {
        if (Array.isArray(val) && val.length > 0) {
          playlist.value = val
          console.log('[GamePage][audio] musicPlaylist loaded:', playlist.value.length, 'tracks')
        }
      } catch (e) { console.warn('sync musicPlaylist watch handler failed', e) }
    }, { immediate: true })
  }
} catch (e) {}
// 每当章节变化时，停止当前音乐并切换到该章对应的音乐
  try {
    watch(currentChapterIndex, (val, oldVal) => {
      try {
        if (!Array.isArray(playlist.value) || playlist.value.length === 0) return
        
        // 🔑 关键：章节变化时停止当前音乐
        if (val !== oldVal) {
          console.log('[GamePage][audio] chapter changed from', oldVal, 'to', val, '- stopping current music')
          stopMusic()
        }
        
        const chap = Number(val || 1)
        const idx = ((chap - 1) % playlist.value.length + playlist.value.length) % playlist.value.length
        loadTrack(idx)
        console.log('[GamePage][audio] loaded track for chapter', chap, '- track index:', idx)
        
        // 章节切换时不立即播放，等待进入阅读状态后统一触发
      } catch (e) { console.warn('chapter change music switch failed', e) }
    }, { immediate: false })
  } catch (e) {}

    // 当应用切到后台或页面不可见时，自动暂停音乐
    onMounted(() => {
      try {
        const handleVisibilityChange = async () => {
          try {
            if (document.hidden) {
              try {
                wasPlayingBeforeHidden = !!isMusicPlaying.value
              } catch (e) { wasPlayingBeforeHidden = false }
              console.log('[GamePage][audio] document hidden -> pause music, wasPlayingBeforeHidden=', wasPlayingBeforeHidden)
              pauseMusic()
            } else {
              console.log('[GamePage][audio] document visible -> try resume if needed, wasPlayingBeforeHidden=', wasPlayingBeforeHidden)
              if (wasPlayingBeforeHidden) {
                try {
                  await playTrack()
                  wasPlayingBeforeHidden = false
                  resumePending = false
                  console.log('[GamePage][audio] resumed playback on visibilitychange')
                } catch (e) {
                  console.warn('[GamePage][audio] resume on visibilitychange blocked, will resume on user interaction', e)
                  resumePending = true
                }
              }
            }
          } catch (e) { console.warn('handleVisibilityChange failed', e) }
        }

        const handleBlur = () => {
          try {
            wasPlayingBeforeHidden = !!isMusicPlaying.value
            console.log('[GamePage][audio] window blur -> pause music, wasPlayingBeforeHidden=', wasPlayingBeforeHidden)
            pauseMusic()
          } catch (e) { console.warn('handleBlur failed', e) }
        }

        const handleFocus = async () => {
          try {
            console.log('[GamePage][audio] window focus -> try resume if needed, wasPlayingBeforeHidden=', wasPlayingBeforeHidden)
            if (wasPlayingBeforeHidden) {
              try {
                await playTrack()
                wasPlayingBeforeHidden = false
                resumePending = false
                console.log('[GamePage][audio] resumed playback on focus')
              } catch (e) {
                console.warn('[GamePage][audio] resume on focus blocked, will resume on user interaction', e)
                resumePending = true
              }
            }
          } catch (e) { console.warn('handleFocus failed', e) }
        }

        const tryResumeOnUserInteraction = async () => {
          try {
            if (!resumePending) return
            console.log('[GamePage][audio] user interaction -> attempting resume')
            try {
              await playTrack()
              resumePending = false
              wasPlayingBeforeHidden = false
              document.removeEventListener('click', tryResumeOnUserInteraction)
              console.log('[GamePage][audio] resumed playback after user interaction')
            } catch (e) {
              console.warn('[GamePage][audio] resume after user interaction failed', e)
            }
          } catch (e) { console.warn('tryResumeOnUserInteraction failed', e) }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        window.addEventListener('blur', handleBlur)
        window.addEventListener('focus', handleFocus)
        document.addEventListener('click', tryResumeOnUserInteraction)

        // 尝试使用 Capacitor App 插件（若存在）来监听原生前后台切换
        let capacitorAppListener = null
        try {
          if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
            import('@capacitor/app').then(({ App }) => {
              try {
                capacitorAppListener = App.addListener('appStateChange', async (state) => {
                  try {
                    if (!state.isActive) {
                      try { wasPlayingBeforeHidden = !!isMusicPlaying.value } catch (e) { wasPlayingBeforeHidden = false }
                      console.log('[GamePage][audio] Capacitor appStateChange inactive -> pause music, wasPlayingBeforeHidden=', wasPlayingBeforeHidden)
                      pauseMusic()
                    } else {
                      console.log('[GamePage][audio] Capacitor appStateChange active -> try resume if needed, wasPlayingBeforeHidden=', wasPlayingBeforeHidden)
                      if (wasPlayingBeforeHidden) {
                        try {
                          await playTrack()
                          wasPlayingBeforeHidden = false
                          resumePending = false
                          console.log('[GamePage][audio] resumed playback on appStateChange active')
                        } catch (e) {
                          console.warn('[GamePage][audio] resume on appStateChange blocked, will resume on user interaction', e)
                          resumePending = true
                        }
                      }
                    }
                  } catch (e) { console.warn('App.appStateChange handler failed', e) }
                })
              } catch (e) { console.warn('register App.addListener failed', e) }
            }).catch((e) => { console.warn('optional @capacitor/app import failed', e) })
          }
        } catch (e) { console.warn('Capacitor app listener setup failed', e) }

        onUnmounted(() => {
          try {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            window.removeEventListener('blur', handleBlur)
            window.removeEventListener('focus', handleFocus)
            try {
              if (capacitorAppListener && typeof capacitorAppListener.remove === 'function') capacitorAppListener.remove()
            } catch (e) { /* ignore */ }
          } catch (e) { console.warn('remove visibility/app listeners failed', e) }
        })
      } catch (e) { console.warn('audio background handling onMounted failed', e) }
    })

// 是否正在进入结局判定的特殊加载（在跳转到结算/结局前显示）
const isEndingLoading = ref(false)

// 🔑 新增：标记是否等待用户点击以显示选项
// 当用户阅读到带有选项的narration时，不立即显示选项，而是等待用户再点击一次
const waitingForClickToShowChoices = ref(false)

// 定义 fetchReport 函数（需要在 useGameState 之前定义）
// 最后一章结束后,向后端请求个性化报告：POST /api/settlement/report/:workId/
const fetchReport = async (workId) => {
  try {
    console.log('[GamePage] fetchReport 被调用 - workId:', workId)
    
    // 🔑 关键重构：使用 story.js 服务层的网络请求，传递当前达成的结局索引（endingIndex）
    const chosenEndingIdx = (typeof lastSelectedEndingIndex !== 'undefined' && lastSelectedEndingIndex && lastSelectedEndingIndex.value) ? Number(lastSelectedEndingIndex.value) : 1
    const data = await storyService.fetchSettlementReport(workId, {
      attributes: attributes.value || {},
      statuses: statuses.value || {},
      endingIndex: chosenEndingIdx
    })
    
    if (!data) {
      console.warn('[GamePage] fetchReport 返回空数据')
      return null
    }
    
    // 🔑 关键修复：确保后端返回的数据包含 work 信息
    if (!data.work) {
      console.warn('[GamePage] fetchReport 返回的数据缺少 work 信息，添加当前 work')
      data.work = work.value
    }
    
    try { 
      sessionStorage.setItem('settlementData', JSON.stringify(data))
      console.log('[GamePage] fetchReport 保存 settlementData 到 sessionStorage:', data)
    } catch (e) {
      console.error('[GamePage] 保存 settlementData 失败:', e)
    }
    
    return data
  } catch (e) { 
    console.error('[GamePage] fetchReport 失败:', e)
    return null 
  }
}


// 现在创建 gameState - 传递所有需要的依赖
const gameStateAPI = useGameState({
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
  lastSelectedEndingIndex,
  allowAdvance,
  editingDialogue,  // 🔑 关键修复：添加编辑状态依赖
  creatorFeatureEnabled,
  isCreatorIdentity,
  modifiableFromCreate,
  USE_MOCK_STORY,
  isNativeApp,
  showNotice,
  deepClone,
  fetchReport,
  pendingNextChapter,
  AUTO_SAVE_SLOT,
  autoSaveToSlot,
  previewSnapshot,
  waitingForClickToShowChoices  // 🔑 新增：传递等待点击显示选项的标记
})

// 解构 gameState 返回的方法和状态
const gameStateResult = gameStateAPI

const {
  isLoading,
  loadingProgress,
  isLandscapeReady,
  showText,
  showMenu,
  choicesVisible,
  readingProgress,
  isLastDialogue,
  toggleMenu,
  goBack,
  nextDialogue,
  chooseOption,
  requestLandscape,
  simulateLoadTo100,
  startLoading,
  stopLoading,
  handleGameEnd,
  cleanup: cleanupGameState
} = gameStateResult
const {
  endingEditorVisible,
  endingEditorBusy,
  endingEditorForm,
  openEndingEditor,
  submitEndingEditor,
  cancelEndingEditor
} = gameStateResult
// 如果当前场景是后端返回的结局场景且尚未被保存，我们在创作者模式下需要显示特殊的编辑/保存按钮
const isPlayingBackendGeneratedEnding = computed(() => {
  try {
    const cs = currentScene.value
    const cf = (creatorFeatureEnabled && creatorFeatureEnabled.value) || false
    return cf && cs && cs._isBackendEnding && (cs._endingSaved !== true)
  } catch (e) { return false }
})

// 保存当前正在播放的后端结局（将其 scenes PUT 到 /api/game/storyending/{workId}/{endingIndex}/）
const saveCurrentEnding = async () => {
  try {
    try { if (typeof startLoading === 'function') startLoading() } catch (e) {}
    const workId = work && work.value && work.value.id
    if (!workId) { showNotice('无法识别作品 ID，保存失败'); try { if (typeof stopLoading === 'function') stopLoading() } catch (e) {}; return }
    const endingIdx = (lastSelectedEndingIndex && lastSelectedEndingIndex.value) ? Number(lastSelectedEndingIndex.value) : 1
    // Helper: 将前端内部的 dialogue 项规范化为后端期望的格式
    const normalizeDialogue = (item) => {
      try {
        // 如果已有后端格式（包含 narration 字段），保留
        if (item && typeof item === 'object' && (typeof item.narration !== 'undefined' || typeof item.narration === 'string')) {
          // 确保 narration 为字符串
          return { narration: String(item.narration), playerChoices: item.playerChoices ?? null }
        }
        // 如果是字符串，直接作为 narration
        if (typeof item === 'string') return { narration: item, playerChoices: null }
        // 如果是对象且有 text 字段（我们内部常用 text），使用 text
        if (item && typeof item === 'object' && typeof item.text === 'string') return { narration: item.text, playerChoices: item.playerChoices ?? null }
        // 如果是对象且有 content 或 narrationText 等字段，尝试兜底
        if (item && typeof item === 'object') {
          const txt = item.text ?? item.content ?? item.narrationText ?? ''
          return { narration: String(txt || ''), playerChoices: item.playerChoices ?? null }
        }
        // 其它情况返回空串，避免后端校验失败
        return { narration: '', playerChoices: null }
      } catch (e) { return { narration: '', playerChoices: null } }
    }

    // 🔑 过滤掉"结局选项"场景的辅助函数
    const isEndingSelectionScene = (scene) => {
      try {
        // 检查场景是否包含多个结局选择（通常是"请选择一个结局"的场景）
        if (!Array.isArray(scene.dialogues) || scene.dialogues.length === 0) return false
        
        for (const dialogue of scene.dialogues) {
          // 如果有 playerChoices 且选项数量 >= 2，并且 narration 包含"结局"关键字
          const choices = dialogue.playerChoices || dialogue.choices
          if (Array.isArray(choices) && choices.length >= 2) {
            const narration = String(dialogue.narration || dialogue.text || '').toLowerCase()
            // 检查是否为结局选择场景
            if (narration.includes('结局') || narration.includes('选择')) {
              return true
            }
            // 检查选项文本是否都包含结局名称特征
            const endingChoiceCount = choices.filter(c => {
              const text = String(c.text || '').toLowerCase()
              return text.includes('>=') || text.includes('结局') || /\(.+\)/.test(text)
            }).length
            // 如果超过一半的选项看起来像结局选择，则判定为结局选项场景
            if (endingChoiceCount >= Math.max(2, choices.length / 2)) {
              return true
            }
          }
        }
      } catch (e) {
        console.warn('isEndingSelectionScene check failed:', e)
      }
      return false
    }

    // 从 storyScenes 中收集所有标记为 _isBackendEnding 的场景，过滤掉结局选项场景，并规范化 dialogues
    const scenesToSave = (storyScenes.value || [])
      .filter(s => s && s._isBackendEnding && !isEndingSelectionScene(s))
      .map(s => ({
        id: s.id ?? s.sceneId ?? undefined,
        backgroundImage: s.backgroundImage || s.background || s.bg || '',
        dialogues: Array.isArray(s.dialogues) ? s.dialogues.map(d => normalizeDialogue(d)) : []
      }))
    const title = (sessionStorage.getItem(`selectedEndingTitle_${workId}`) || (currentScene.value && currentScene.value._endingTitle) || `结局 ${endingIdx}`)
    const body = { endingIndex: endingIdx, title, scenes: scenesToSave }
    try {
      await storyService.saveEnding(workId, body)
      showNotice('已保存结局内容')
      // 标记前端缓存为已保存
      try { for (const s of storyScenes.value) { if (s && s._isBackendEnding) s._endingSaved = true } } catch (e) {}
      try { await getWorkDetails(workId) } catch (e) {}
    } catch (e) {
      console.error('saveCurrentEnding failed', e)
      showNotice('保存结局失败，请检查网络或控制台', 8000)
      throw e
    }
  } catch (e) {
    console.warn('saveCurrentEnding error', e)
  } finally {
    try { if (typeof stopLoading === 'function') stopLoading() } catch (e) {}
  }
}
// 从 gameState 导出 playingEndingScenes 与 endingsAppended
const { playingEndingScenes, endingsAppended } = gameStateResult

// 全局点击处理：当没有选项/菜单/编辑时，点击屏幕任意不在交互控件上的位置进入下一句
const onGlobalClick = (e) => {
  try {
    // 如果编辑中、菜单/模态/保存等覆盖层打开、或选项可见，则不要在根容器处理为 next
    if (editingDialogue?.value) return
    if (showMenu?.value) return
    if (choicesVisible?.value) return
    if (anyOverlayOpen?.value) return

    // 忽略点击在表单或交互元素上的情况（按钮、链接、输入框等）
    const tag = (e.target && e.target.tagName) ? String(e.target.tagName).toLowerCase() : ''
    if (['button','a','input','select','textarea','label'].includes(tag)) return

    // 忽略点击发生在可能的交互面板内（例如选项容器、菜单面板、编辑控件、模态面板等）
    if (e.target && e.target.closest) {
      const ignore = e.target.closest('.choices-container, .menu-panel, .menu-button, .edit-controls, .choice-btn, .edit-btn, .modal-panel, .modal-backdrop, .save-load-modal')
      if (ignore) return
    }

    // 如果当前处于等待点击以显示选项的状态，nextDialogue 会在内部将其转换为显示选项
    nextDialogue()
  } catch (err) {
    console.warn('onGlobalClick failed', err)
  }
}

// 计算任意弹窗是否打开 - 在 showMenu 解构之后定义
const anyOverlayOpen = computed(() =>
  showMenu.value ||
  showSaveModal.value ||
  showLoadModal.value ||
  showAttributesModal.value ||
  showSettingsModal.value ||
  showOutlineEditor.value ||
  (endingEditorVisible && endingEditorVisible.value)
)

// 初始化自动播放功能 - 在 gameState 之后创建，使用 getter 获取 nextDialogue
const autoPlayAPI = useAutoPlay({
  getNextDialogue: () => nextDialogue,
  isLandscapeReady,
  isLoading,
  isFetchingNext,
  isGeneratingSettlement,
  showMenu,
  showText,
  choicesVisible,
  anyOverlayOpen
})

const {
  showSettingsModal: autoPlaySettingsModal,
  autoPlayEnabled,
  autoPlayIntervalMs,
  startAutoPlayTimer,
  stopAutoPlayTimer,
  saveAutoPlayPrefs,
  loadAutoPlayPrefs
} = autoPlayAPI

// 🔑 关键修复：统一的音乐播放控制
// - 加载状态停止音乐
// - 离开加载状态自动播放当前章节对应音乐（含读档进入的章节）
watch([isLandscapeReady, isLoading, currentChapterIndex, () => playlist.value.length], async ([land, loading, chapIdx, playlistLen]) => {
  try {
    // 进入加载状态时立即停止音乐
    if (loading) {
      if (isMusicPlaying.value) {
        console.log('[GamePage][audio] entering loading state - stopping music')
        stopMusic()
      }
      return
    }
    
    // 离开加载状态，进入游戏或读档后的章节时自动播放音乐（只在横屏就绪且有播放列表时）
    if (land && !loading && playlistLen > 0) {
      if (!isMusicPlaying.value) {
        console.log('[GamePage][audio] entering game - auto-playing music, chapter:', chapIdx, 'track:', currentTrackIndex.value)
        try {
          await playTrack(currentTrackIndex.value || 0)
          console.log('[GamePage][audio] auto-play succeeded')
        } catch (err) {
          console.warn('[GamePage][audio] auto-play failed:', err)
          // 只在第一次失败时提示，避免频繁通知
          if (!window.__musicAutoPlayFailedNotified) {
            window.__musicAutoPlayFailedNotified = true
            try { showNotice('自动播放被阻止，请在菜单中手动播放', 3000) } catch (e) {}
          }
        }
      }
    }
  } catch (e) { console.warn('[GamePage][audio] unified music control failed', e) }
}, { immediate: false })

// 本地引用，允许在运行时替换为 mock 实现
let didLoadInitialMock = false
let creatorEditorHandled = false

// 新增初始化函数
const initializeGame = async () => {
  // 检查用户是否已登录
  const userStore = useUserStore()
  if (!userStore.isAuthenticated) {
    console.log('用户未登录，重定向到登录页面')
    // 保存当前页面，登录后可以返回
    sessionStorage.setItem('redirectAfterLogin', router.currentRoute.value.fullPath)
    router.push('/login')
    return
  }
  
  isLoading.value = true
  try { if (typeof startLoading === 'function') startLoading() } catch (e) {}
  
  try {
    // 若启用本地 mock，则在组件挂载时异步加载 mock 实现
    if (USE_MOCK_STORY) {
      try {
        const mock = await import('../service/story.mock.js')
        getScenes = mock.getScenes
        setGetScenes(mock.getScenes)
        try { window.__USE_MOCK_STORY__ = true } catch (e) {}
      } catch (e) {
        console.warn('加载 story.mock.js 失败，将回退到真实 service：', e)
      }
    }
    
    let initOk = false
    try {
      // 测试模式：强制在进入游戏前弹出创作者大纲编辑器（若尚未处理）
      if (FORCE_CREATOR_FOR_TEST && !creatorEditorHandled) {
        try {
          // 构造一个临时的 createResult 对象（从路由 或 session 的 lastWorkMeta 获取基础信息）
          const temp = {
            fromCreate: true,
            backendWork: { id: work.value.id, title: work.value.title },
            modifiable: true,
            total_chapters: Number(totalChapters.value) || 5,
            chapterOutlines: null
          }
          // 仅在 sessionStorage 中尚无 createResult 时写入临时对象，避免覆盖后端或创建页写入的真实数据
          try {
            const existing = sessionStorage.getItem('createResult')
            if (!existing) sessionStorage.setItem('createResult', JSON.stringify(temp))
          } catch (e) {}
          // 标记为已处理，避免重复弹窗
          creatorEditorHandled = true
        } catch (e) { console.warn('prepare FORCE_CREATOR_FOR_TEST failed', e) }
      }

      const ok = await initFromCreateResult()
      initOk = !!ok
      if (!ok) {
        // 没有来自创建页的首章，尝试获取第一章
        if (USE_MOCK_STORY && typeof getScenes === 'function') {
          try {
            const resp = await getScenes(work.value.id, 1, {
              onProgress: (progress) => {
                console.log(`[Story] 首章生成进度:`, progress)
                // 进度由全局计时器控制；当后端不再处于生成状态时结束加载
                if (progress && progress.status && progress.status !== 'generating') {
                  try { if (typeof stopLoading === 'function') stopLoading() } catch (e) {}
                }
              }
            })
            const initial = (resp && resp.scenes) ? resp.scenes : (Array.isArray(resp) ? resp : [])
            if (Array.isArray(initial) && initial.length > 0) {
              storyScenes.value = []
              for (const s of initial) {
                if (s && Array.isArray(s.choices)) {
                  const seen = new Set()
                  s.choices = s.choices.filter(c => {
                    const id = c?.id ?? JSON.stringify(c)
                    if (seen.has(id)) return false
                    seen.add(id)
                    return true
                  })
                }
                storyScenes.value.push(s)
              }
              try { didLoadInitialMock = true } catch (e) {}
              currentSceneIndex.value = 0
              currentDialogueIndex.value = 0
              currentChapterIndex.value = 1
            } else {
              // mock 未返回初始场景，回退到后端请求
              console.log('[GamePage] mock未返回场景，回退到fetchNextChapter...')
              const result = await fetchNextChapter(work.value.id, 1, {
                onProgress: (progress) => {
                  console.log(`[Story] 首章生成进度:`, progress)
                  if (progress && progress.status && progress.status !== 'generating') {
                    try { if (typeof stopLoading === 'function') stopLoading() } catch (e) {}
                  }
                }
              })
              console.log('[GamePage] fetchNextChapter返回结果:', result)
            }
          } catch (e) {
            console.warn('getInitialScenes failed, fallback to fetchNextChapter', e)
            console.log('[GamePage] getInitialScenes失败，尝试fetchNextChapter...')
              const result = await fetchNextChapter(work.value.id, 1, {
                onProgress: (progress) => {
                  console.log(`[Story] 首章生成进度:`, progress)
                  if (progress && progress.status === 'generating') {
                    try { if (typeof startLoading === 'function') startLoading() } catch (e) {}
                  } else if (progress && progress.status && progress.status !== 'generating') {
                    try { if (typeof stopLoading === 'function') stopLoading() } catch (e) {}
                  }
                }
              })
            console.log('[GamePage] fetchNextChapter返回结果:', result)
          }
        } else {
          console.log('[GamePage] 调用fetchNextChapter获取第一章...')
          const result = await fetchNextChapter(work.value.id, 1, {
            onProgress: (progress) => {
              console.log(`[Story] 首章生成进度:`, progress)
              if (progress && progress.status && progress.status !== 'generating') {
                try { if (typeof stopLoading === 'function') stopLoading() } catch (e) {}
              }
            }
          })
          console.log('[GamePage] fetchNextChapter返回结果:', result)
          console.log('[GamePage] 当前storyScenes数量:', storyScenes.value?.length || 0)
        }
      }
    } catch (e) { 
      console.warn('initFromCreateResult failed', e)
      // 如果 initFromCreateResult 失败，尝试直接获取第一章
      try {
        console.log('[GamePage] initFromCreateResult失败，尝试fetchNextChapter...')
        const result = await fetchNextChapter(work.value.id, 1, {
              onProgress: (progress) => {
                console.log(`[Story] 首章生成进度:`, progress)
                if (progress && progress.status && progress.status !== 'generating') {
                  try { if (typeof stopLoading === 'function') stopLoading() } catch (e) {}
                }
              }
        })
        console.log('[GamePage] fetchNextChapter返回结果:', result)
      } catch (err) {
        console.warn('fetchNextChapter failed in initializeGame', err)
      }
    }

    // 绑定退出处理
    try {
      await ScreenOrientation.lock({ type: 'portrait' }).catch(() => {})
    } catch (e) {}

    // 检查是否已经有场景数据（从fetchNextChapter加载的）
    console.log('[initializeGame] 检查场景数据 - storyScenes长度:', storyScenes.value?.length || 0)
    
    if (Array.isArray(storyScenes.value) && storyScenes.value.length > 0) {
      console.log(`[initializeGame] 场景数据已加载，跳过等待循环。场景数量: ${storyScenes.value.length}`)
      // 确保索引有效
      if (currentSceneIndex.value >= storyScenes.value.length) {
        currentSceneIndex.value = 0
      }
      if (currentDialogueIndex.value >= (storyScenes.value[currentSceneIndex.value]?.dialogues?.length || 0)) {
        currentDialogueIndex.value = 0
      }
    } else {
      // 如果没有场景数据，才进入等待循环
      console.log('[initializeGame] 场景数据未加载，进入等待循环')
      let retryCount = 0
      // 采用全局轮询配置，延长等待时间（默认约 5 分钟）
      const maxRetries = INITIAL_SCENES_MAX_RETRIES
      
      while ((!Array.isArray(storyScenes.value) || storyScenes.value.length === 0) && retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000)) // 每秒检查一次
        retryCount++
        console.log(`[initializeGame] 等待场景数据加载... 重试 ${retryCount}/${maxRetries}`)
        
        // 如果进度超过50%，显示更详细的状态
        if (loadingProgress.value > 50) {
          console.log(`[initializeGame] 生成进度: ${loadingProgress.value}%`)
        }
      }
      
      // 如果仍然没有场景，使用一个默认场景避免黑屏
      if (!Array.isArray(storyScenes.value) || storyScenes.value.length === 0) {
        console.warn('[initializeGame] 等待超时，使用默认场景')
        storyScenes.value = [{
          sceneId: 'fallback',
          backgroundImage: work.value.coverUrl || 'https://picsum.photos/1920/1080?random=1',
          dialogues: ['故事正在加载中，请稍候...']
        }]
        currentSceneIndex.value = 0
        currentDialogueIndex.value = 0
      }
    }

    // 现在可以安全关闭加载界面，显示进度和剧情
    console.log('[initializeGame] 场景加载完成，准备显示剧情。场景数量:', storyScenes.value.length)
    console.log('[initializeGame] 当前索引 - scene:', currentSceneIndex.value, 'dialogue:', currentDialogueIndex.value)
    console.log('[initializeGame] 当前场景内容:', storyScenes.value[currentSceneIndex.value])
    
    // 🔑 关键修复：确保先完成进度动画，再关闭加载界面
    await simulateLoadTo100(800)
    
    // 🔑 关键修复：确保所有状态正确设置
    isLoading.value = false
    showText.value = true
    
    console.log('[initializeGame] 加载状态更新完成 - isLoading:', isLoading.value, 'showText:', showText.value)
    
  } catch (error) {
    console.error('[initializeGame] Initialize game failed:', error)
    // 即使出错也要确保有场景显示
    if (!Array.isArray(storyScenes.value) || storyScenes.value.length === 0) {
      storyScenes.value = [{
        sceneId: 'error',
        backgroundImage: work.value.coverUrl || 'https://picsum.photos/1920/1080?random=1',
        dialogues: ['故事加载失败，请返回重试。']
      }]
      currentSceneIndex.value = 0
      currentDialogueIndex.value = 0
    }
    await simulateLoadTo100(500)
    isLoading.value = false
    showText.value = true
  }
}

// 计算用于展示的封面 URL：优先使用完整 URL；若后端返回相对路径则补齐本地开发后端地址；若不存在则返回内置占位图
const effectiveCoverUrl = computed(() => {
  try {
    const raw = work.value.coverUrl || ''
    const defaultImg = 'https://images.unsplash.com/photo-1587614387466-0a72ca909e16?w=1600&h=900&fit=crop'
    if (!raw) return defaultImg
    if (/^https?:\/\//i.test(raw)) return raw
    // 如果是相对路径（例如 /media/xxx），为开发环境补齐后端地址
    return 'https://storycraft.work.gd' + (raw.startsWith('/') ? raw : ('/' + raw))
  } catch (e) {
    return 'https://images.unsplash.com/photo-1587614387466-0a72ca909e16?w=1600&h=900&fit=crop'
  }
})

const initFromCreateResult = async (opts = {}) => {
  try {
    const raw = sessionStorage.getItem('createResult')
    if (!raw) return false
    const obj = JSON.parse(raw)
    if (!obj) return false
    if (obj.backendWork) {
      work.value.id = obj.backendWork.id || work.value.id
      work.value.title = obj.backendWork.title || work.value.title
      work.value.coverUrl = obj.backendWork.coverUrl || work.value.coverUrl
      // 后端可能返回 ai_callable 字段，标识是否允许调用 AI 生成
      if (typeof obj.backendWork.ai_callable !== 'undefined') {
        work.value.ai_callable = obj.backendWork.ai_callable
      }
    }
    // 从 createResult 或 history.state 获取初始属性和状态
    // 兼容两种写法：createResult 可能直接包含 initialAttributes/initialStatuses，
    // 也可能只包含 backendWork（其中包含 initialAttributes/statuses 字段）
  // attributes/statuses: 支持多种命名与嵌套位置（camelCase / snake_case / backendWork.data）
  if (obj.initialAttributes) {
    attributes.value = obj.initialAttributes
    console.log('[initFromCreateResult] 初始化 attributes (从 initialAttributes):', attributes.value)
  } else if (obj.initial_attributes) {
    attributes.value = obj.initial_attributes
    console.log('[initFromCreateResult] 初始化 attributes (从 initial_attributes):', attributes.value)
  } else if (obj.backendWork && obj.backendWork.initialAttributes) {
    attributes.value = obj.backendWork.initialAttributes
    console.log('[initFromCreateResult] 初始化 attributes (从 backendWork.initialAttributes):', attributes.value)
  } else if (obj.backendWork && obj.backendWork.initial_attributes) {
    attributes.value = obj.backendWork.initial_attributes
    console.log('[initFromCreateResult] 初始化 attributes (从 backendWork.initial_attributes):', attributes.value)
  } else if (obj.backendWork && obj.backendWork.data && obj.backendWork.data.initialAttributes) {
    attributes.value = obj.backendWork.data.initialAttributes
    console.log('[initFromCreateResult] 初始化 attributes (从 backendWork.data.initialAttributes):', attributes.value)
  } else if (obj.backendWork && obj.backendWork.data && obj.backendWork.data.initial_attributes) {
    attributes.value = obj.backendWork.data.initial_attributes
    console.log('[initFromCreateResult] 初始化 attributes (从 backendWork.data.initial_attributes):', attributes.value)
  } else {
    console.log('[initFromCreateResult] 未找到初始属性，使用空对象')
  }

  if (obj.initialStatuses) {
    statuses.value = obj.initialStatuses
    console.log('[initFromCreateResult] 初始化 statuses (从 initialStatuses):', statuses.value)
  } else if (obj.initial_statuses) {
    statuses.value = obj.initial_statuses
    console.log('[initFromCreateResult] 初始化 statuses (从 initial_statuses):', statuses.value)
  } else if (obj.backendWork && obj.backendWork.initialStatuses) {
    statuses.value = obj.backendWork.initialStatuses
    console.log('[initFromCreateResult] 初始化 statuses (从 backendWork.initialStatuses):', statuses.value)
  } else if (obj.backendWork && obj.backendWork.initial_statuses) {
    statuses.value = obj.backendWork.initial_statuses
    console.log('[initFromCreateResult] 初始化 statuses (从 backendWork.initial_statuses):', statuses.value)
  } else if (obj.backendWork && obj.backendWork.data && obj.backendWork.data.initialStatuses) {
    statuses.value = obj.backendWork.data.initialStatuses
    console.log('[initFromCreateResult] 初始化 statuses (从 backendWork.data.initialStatuses):', statuses.value)
  } else if (obj.backendWork && obj.backendWork.data && obj.backendWork.data.initial_statuses) {
    statuses.value = obj.backendWork.data.initial_statuses
    console.log('[initFromCreateResult] 初始化 statuses (从 backendWork.data.initial_statuses):', statuses.value)
  } else {
    console.log('[initFromCreateResult] 未找到初始状态，使用空对象')
  }

    // total_chapters（若提供）
    if (obj.total_chapters) totalChapters.value = obj.total_chapters
    else if (obj.backendWork && (obj.backendWork.total_chapters || obj.backendWork.total_chapters === 0)) totalChapters.value = obj.backendWork.total_chapters || null
    
    // 根据 createResult 与 backendWork 决定是否启用创作者功能
    try {
      creatorFeatureEnabled.value = !!(obj.modifiable && !(obj.backendWork && obj.backendWork.ai_callable === false))
    } catch (e) { creatorFeatureEnabled.value = !!obj.modifiable }
    // 记录 createResult.modifiable，用于决定是否允许菜单触发的手动创作编辑（即使 ai_callable 为 false）
    try { modifiableFromCreate.value = !!obj.modifiable } catch (e) { modifiableFromCreate.value = !!obj.modifiable }

    // 尝试获取作品详情以初始化章节状态（chapters_status）
    try { 
      await getWorkDetails(work.value.id)
      console.log('[initFromCreateResult] 获取作品详情后的章节状态:', chaptersStatus.value)
    } catch (e) { 
      console.warn('[initFromCreateResult] 获取作品详情失败:', e)
    }

    // 从后端获取首章内容（chapterIndex = 1，后端为 1-based）
    try {
      const workId = work.value.id
      // 如果当前 createResult 同时表示为创作者模式且后端允许 AI 调用，先让用户编辑大纲再触发生成（即使后端尚未返回大纲）
      // 但只在第一章状态为 not_generated 时才弹出编辑器
      if (creatorFeatureEnabled.value && !(opts && opts.suppressAutoEditor)) {
        // 检查第一章的状态
        const firstChapterStatus = getChapterStatus(1)
        console.log(`[initFromCreateResult] 第一章状态: ${firstChapterStatus}，所有章节状态:`, chaptersStatus.value)
        
        // 只在状态为 not_generated 或 null (未知状态) 时才弹出编辑器
        if (!firstChapterStatus || firstChapterStatus === 'not_generated') {
          // 如果当前进入者是作品创建者身份（isCreatorIdentity），我们需要自动弹出编辑器用于生成大纲
          if (isCreatorIdentity.value && !creatorEditorHandled) {
            editorInvocation.value = 'auto'
            creatorEditorHandled = true
          } else {
            // 仅标识该作品支持创作者功能，但不自动启用菜单创作者模式
            // 菜单中的 creatorMode 由用户在页面手动切换
          }

          // 将后端可能返回的 chapterOutlines 映射为编辑器使用的格式：{ chapterIndex, outline }
          try {
            // 支持后端在多种字段位置返回大纲：优先使用 createResult.chapterOutlines，其次尝试 backendWork.outlines / data.outlines / outlines
            let rawOutlines = []
            if (Array.isArray(obj.chapterOutlines) && obj.chapterOutlines.length > 0) rawOutlines = obj.chapterOutlines
            else if (obj.backendWork && Array.isArray(obj.backendWork.outlines) && obj.backendWork.outlines.length > 0) rawOutlines = obj.backendWork.outlines
            else if (Array.isArray(obj.outlines) && obj.outlines.length > 0) rawOutlines = obj.outlines
            else if (obj.data && Array.isArray(obj.data.outlines) && obj.data.outlines.length > 0) rawOutlines = obj.data.outlines

            if (rawOutlines.length > 0) {
              // 合并标题与大纲正文：title + 空行 + outline/summary
              const mapped = rawOutlines.map((ch, i) => {
                const ci = (ch && (ch.chapterIndex ?? ch.chapter_index)) || (i + 1)
                const title = (ch && (ch.title ?? ch.chapter_title)) || ''
                const body = (ch && (ch.outline ?? ch.summary)) || ''
                const combined = (title && body) ? `${title}\n\n${body}` : (title || body || JSON.stringify(ch))
                return { chapterIndex: Number(ci), outline: combined }
              })
              outlineEdits.value = mapped
            } else {
              // 不再合成本地 mock：如果后端未返回大纲，则使用空数组，让编辑器呈现空状态由用户或后端生成
              outlineEdits.value = []
            }

            // 若 createResult 中包含 userPrompt 字段，则带入编辑器供用户修改
            outlineUserPrompt.value = obj.userPrompt || ''
          } catch (mapErr) {
            console.warn('map chapterOutlines failed', mapErr)
            outlineEdits.value = []
          }

          // 记录原始大纲快照（用于取消时按原始大纲生成）
          try { originalOutlineSnapshot.value = JSON.parse(JSON.stringify(outlineEdits.value || [])) } catch(e) { originalOutlineSnapshot.value = (outlineEdits.value || []).slice() }
          // 标记 pending target 为首章（createResult 路径用于首章生成，target = 1）
          pendingOutlineTargetChapter.value = 1
          showOutlineEditor.value = true
          
          // 🔑 修复：不直接赋值 outlineEditorResolver，而是通过 watch 等待编辑器关闭
          // 等待用户确认或取消（监听 showOutlineEditor 的变化）
          await new Promise((resolve) => {
            const unwatch = watch(showOutlineEditor, (newVal) => {
              if (!newVal) {
                unwatch()
                resolve()
              }
            })
          })
          // 如果用户确认，confirmOutlineEdits 已调用 generateChapter，后端可能仍在生成，getScenes 会轮询等待
        } else {
          // 第一章已经生成或保存，跳过编辑器直接加载
          console.log(`[initFromCreateResult] 第一章状态为 ${firstChapterStatus}，跳过编辑器直接加载`)
        }
      }
      const result = await getScenes(workId, 1, {
        onProgress: (progress) => {
          console.log(`[Story] 首章生成进度:`, progress)
          // 使用集中式加载控制：生成中启动集中进度，非生成中停止并完成进度
          if (progress && progress.status === 'generating') {
            try { if (typeof startLoading === 'function') startLoading() } catch (e) {}
          } else if (progress && progress.status && progress.status !== 'generating') {
            try { if (typeof stopLoading === 'function') stopLoading() } catch (e) {}
          }
        }
      })
      if (result && result.scenes && result.scenes.length > 0) {
        storyScenes.value = []
        for (const sc of result.scenes) {
          try { pushSceneFromServer(sc) } catch (e) { console.warn('pushSceneFromServer failed for one entry', e) }
        }
        // 尝试使用最后一个场景的 seq
        try { 
          const last = result.scenes[result.scenes.length - 1]
          if (last && last.seq) lastSeq.value = last.seq 
        } catch (e) {}
        // 重置播放索引，确保从首条对话开始
        currentSceneIndex.value = 0
        currentDialogueIndex.value = 0
        // 明确设置当前章节为首章（1-based）
        currentChapterIndex.value = 1
        
        console.log(`[Story] 从 createResult 成功加载首章，共 ${result.scenes.length} 个场景`)
        return true
      } else {
        console.warn('[Story] createResult 返回空场景数据')
        return false
      }
    } catch (e) { 
      console.warn('Failed to fetch first chapter from backend:', e)
      return false
    }
    
  } catch (e) { 
    console.warn('initFromCreateResult failed', e); 
    return false 
  }
}

// 防止重复调用 requestNextIfNeeded
let isRequestingNext = false

// fetchReport 已在前面定义（在 useGameState 之前）


// 当用户开始进入页面或重新加载时，尝试从 createResult 初始化；否则请求第一章
onMounted(async () => {
  // 隐藏状态栏，实现全屏游戏体验
  try {
    await StatusBar.hide()
    console.log('[GamePage] 状态栏已隐藏，进入全屏模式')
  } catch (e) {
    console.warn('[GamePage] 隐藏状态栏失败（可能在浏览器环境）:', e)
  }
  
  if (USE_MOCK_STORY) {
    try {
      const mock = await import('../service/story.mock.js')
      getScenes = mock.getScenes
      setGetScenes(mock.getScenes)
      try { window.__USE_MOCK_STORY__ = true } catch (e) {}
    } catch (e) {
      console.warn('加载 story.mock.js 失败，将回退到真实 service：', e)
    }
  }
  
  // 检查用户是否已登录
  const userStore = useUserStore()
  if (!userStore.isAuthenticated) {
    console.log('用户未登录，重定向到登录页面')
    router.push('/login')
    return
  }
  
  // 加载自动播放偏好（watch 会自动处理启动定时器）
  loadAutoPlayPrefs()
  // 🔧 注释掉手动启动，因为 watch 监听器会在 autoPlayEnabled 变化时自动启动
  // if (autoPlayEnabled.value) startAutoPlayTimer()
  
  // 检查是否从结算页面跳回来并携带了加载数据
  if (history.state?.loadedData) {
    const loadedData = history.state.loadedData
    // 恢复游戏状态（注意：loadedData 可能不包含完整的 storyScenes）
    // 优先尝试根据 sceneId 定位到已加载的 storyScenes，否则回退到首个场景
      try {
      if (loadedData.sceneId != null && Array.isArray(storyScenes.value)) {
        // 使用字符串比较以兼容 number/string id 的差异
        const lsid = String(loadedData.sceneId)
        let idx = storyScenes.value.findIndex(s => s && (String(s.id) === lsid || String(s.sceneId) === lsid))
        // 如果没有找到，但提供了 chapterIndex，则尝试拉取该章节以恢复场景列表
        if (idx < 0 && typeof loadedData.chapterIndex === 'number') {
          try {
            const fetched = await fetchNextContent(work.value.id, loadedData.chapterIndex)
            if (fetched && Array.isArray(fetched.scenes) && fetched.scenes.length > 0) {
              for (const s of fetched.scenes) {
                try { pushSceneFromServer(s) } catch (e) { console.warn('pushSceneFromServer failed when restoring chapter (mounted):', e) }
              }
              idx = storyScenes.value.findIndex(s => s && (String(s.id) === lsid || String(s.sceneId) === lsid))
            }
          } catch (e) { console.warn('fetchNextContent failed while restoring loadedData chapter:', e) }
        }
        currentSceneIndex.value = (idx >= 0) ? idx : 0
      } else if (typeof loadedData.currentSceneIndex === 'number') {
        currentSceneIndex.value = loadedData.currentSceneIndex
      } else if (typeof loadedData.chapterIndex === 'number' && Array.isArray(storyScenes.value)) {
        const idx = storyScenes.value.findIndex(s => s && (s.chapterIndex === loadedData.chapterIndex || s.chapter === loadedData.chapterIndex))
        currentSceneIndex.value = (idx >= 0) ? idx : 0
      } else {
        currentSceneIndex.value = 0
      }
      if (typeof loadedData.currentDialogueIndex === 'number') currentDialogueIndex.value = loadedData.currentDialogueIndex
      else if (loadedData.dialogueIndex != null) currentDialogueIndex.value = loadedData.dialogueIndex
    } catch (e) { /* ignore */ }
  attributes.value = loadedData.attributes || {}
  statuses.value = loadedData.statuses || {}
  choiceHistory.value = loadedData.choiceHistory || []
  try { restoreChoiceFlagsFromHistory() } catch (e) { console.warn('restoreChoiceFlagsFromHistory error (loadedData):', e) }
    
    // 直接进入游戏
    isLandscapeReady.value = true
    // 即便数据已恢复，为了视觉一致性仍然执行一次平滑加载到 100% 的动画
    try {
      const dur = USE_MOCK_STORY ? 10000 : 900
      await simulateLoadTo100(dur)
    } catch (e) {
      isLoading.value = false
    }
    showText.value = true
    return
  }

  if (isNativeApp.value) {
    // APP 环境：直接进入横屏
    isLandscapeReady.value = true
    await requestLandscape()
    await initializeGame()
  } else {
    // 浏览器环境：在开发模式下自动进入阅读以便测试选项；生产模式仍显示进入阅读按钮
    try {
      if (import.meta.env && import.meta.env.DEV) {
        isLandscapeReady.value = true
        await initializeGame()
      } else {
        // 生产/正式环境：显示进入阅读按钮
      }
    } catch (e) {
      // 某些构建环境可能不支持 import.meta.env，这里保守处理
    }
  }
  // 页面可见性变化：隐藏→暂停自动播放并尝试自动存档；可见→如开启自动播放则恢复
  const onVisibility = () => {
    if (document.hidden) {
      // 后台：暂停自动播放，避免后台计时推进
      stopAutoPlayTimer()
      autoSaveToSlot()
    }
    // 回到前台时,自动播放会通过内部 watch 自动恢复,不需要手动启动
  }
  document.addEventListener('visibilitychange', onVisibility)
  // 卸载/刷新前的本地快速存档
  const onBeforeUnload = () => {
    quickLocalAutoSave(AUTO_SAVE_SLOT)
  }
  window.addEventListener('beforeunload', onBeforeUnload)
  // 存储清理函数到实例上，便于卸载时移除
  ;(onMounted._cleanup = () => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('beforeunload', onBeforeUnload)
  })
})



onUnmounted(() => {
  // 关闭 SSE
  try { if (eventSource) eventSource.close() } catch (e) {}
  stopAutoPlayTimer()
  // 🔑 关键修复：卸载时停止并清理音乐
  try { stopMusic() } catch (e) {}
  try { if (audioEl.value) audioEl.value.src = '' } catch (e) {}
})

// 打开菜单时会自动暂停,关闭菜单后会自动恢复(由 useAutoPlay 内部的 watch 处理)
// 不需要额外的 watch

// 注意：其它弹窗的监听需放在相关 ref 定义之后（见下文）

// 以下变量已从 useStoryAPI 导入: 
// currentScene, currentDialogue, currentBackground, currentSpeaker, isFetchingNext

// --------- 用户可编辑 / 图片替换支持（前端优先，本地持久化） ---------
// 存储 key：storycraft_overrides_{userId}_{workId}
const overridesKey = (userId, workId) => `storycraft_overrides_${userId}_${workId}`
const userId = getCurrentUserId()

// 将当前章节（currentChapterIndex）中前端当前 scenes 的修改持久化到后端（PUT /api/game/chapter/{id}/{chapterIndex}/）
// opts:
//  - auto: boolean (默认 true) 表示调用是否为自动保存（卸载/切换/退出创作者模式），自动保存不应把已生成但未确认的章节标记为 saved
//  - allowSaveGenerated: boolean 手动确认时应传 true，以允许将 generated -> saved
//  - chapterIndex: number 可选，指定要保存的章节
const persistCurrentChapterEdits = async (opts = {}) => {
  try {
    if (!(modifiableFromCreate.value || isCreatorIdentity.value)) {
      console.log('persistCurrentChapterEdits skipped: no edit permission')
      return
    }
    const workId = work.value && (work.value.id || work.value.gameworkId || work.value.workId)
    if (!workId) return
    
    const auto = (typeof opts.auto === 'undefined') ? true : !!opts.auto
    const allowSaveGenerated = !!opts.allowSaveGenerated
    // 控制是否对后端执行网络保存（PUT）。默认 true（兼容旧逻辑）。
    // 在自动触发的持久化（退出创作模式、unmount、toggle creator 自动持久化）时传入 performNetworkSave:false
    const performNetworkSave = (typeof opts.performNetworkSave === 'boolean') ? opts.performNetworkSave : true
    const chapterIndex = Number(opts.chapterIndex || currentChapterIndex.value) || 1

    // 如果是自动保存且当前章节处于 generated（未确认）状态，则跳过自动保存
    try {
      const st = getChapterStatus(chapterIndex)
      if (auto && st === 'generated') {
        console.log('persistCurrentChapterEdits: skipping auto-save for generated chapter', { chapterIndex })
        return
      }
    } catch (e) { /* ignore errors from getChapterStatus */ }

    // 简化逻辑：storyScenes 现在只包含当前章节，直接使用全部内容
    if (!storyScenes.value || storyScenes.value.length === 0) {
      console.log('persistCurrentChapterEdits: no scenes to persist')
      return
    }

    // 🔑 关键修复：首先应用 overrides 中的编辑到 storyScenes
    // 这样后续的 normalizeDialogue 才能正确处理编辑后的内容
    const scenesWithOverrides = storyScenes.value.map(scene => {
      const sceneId = String(scene._uid ?? scene.sceneId ?? scene.id ?? '')
      const ov = overrides.value?.scenes?.[sceneId]
      if (!ov) return scene
      
      // 克隆场景以避免修改原始数据
      const clonedScene = JSON.parse(JSON.stringify(scene))
      
      // 应用背景图覆盖
      if (ov.backgroundImage) {
        clonedScene.backgroundImage = ov.backgroundImage
      }
      
      // 应用对话覆盖
      if (ov.dialogues) {
        for (const k in ov.dialogues) {
          const idx = Number(k)
          if (!isNaN(idx) && idx < clonedScene.dialogues.length) {
            const orig = clonedScene.dialogues[idx]
            const overrideText = ov.dialogues[k]
            // 立即对覆盖文本进行 sanitize，保证保存后前端立刻显示替换后的内容
            const overrideTextSan = (typeof overrideText === 'string') ? sanitize(overrideText) : overrideText
            
            // 🔑 关键修复：检查这个对话是否来自 subsequentDialogues
            if (typeof orig === 'object' && orig._fromChoiceId != null && orig._fromChoiceIndex != null) {
              // 找到对应的选项，更新其 subsequentDialogues
              const choiceId = orig._fromChoiceId
              const choiceIdx = orig._fromChoiceIndex
              
              if (Array.isArray(clonedScene.choices)) {
                const choice = clonedScene.choices.find(c => String(c.id) === String(choiceId))
                if (choice && Array.isArray(choice.subsequentDialogues)) {
                  // 直接更新 subsequentDialogues 中的对应项，并 sanitize
                  choice.subsequentDialogues[choiceIdx] = (typeof overrideText === 'string') ? sanitize(overrideText) : overrideText
                  console.log(`[persistCurrentChapterEdits] 更新选项 ${choiceId} 的 subsequentDialogues[${choiceIdx}]`)
                }
              }
              // 更新对话本身的显示文本
              if (typeof orig === 'string') {
                clonedScene.dialogues[idx] = overrideTextSan
              } else {
                clonedScene.dialogues[idx] = {
                  ...orig,
                  text: overrideTextSan
                }
              }
            } else {
              // 普通对话，直接替换
              if (typeof orig === 'string') {
                clonedScene.dialogues[idx] = overrideTextSan
              } else if (typeof orig === 'object') {
                clonedScene.dialogues[idx] = {
                  text: overrideTextSan,
                  backgroundImage: orig.backgroundImage,
                  speaker: orig.speaker
                }
              }
            }
          }
        }
      }
      
      return clonedScene
    })

    // 构建对话数据的规范化函数
    const normalizeDialogue = (d, scene, dIdx) => {
      try {
        // 🔑 关键修复：如果对话标记为来自 subsequentDialogues，则跳过它
        // 因为它已经被更新到对应选项的 subsequentDialogues 中了
        if (typeof d === 'object' && d._fromChoiceId != null && d._fromChoiceIndex != null) {
          // 返回 null 表示这个对话不应该作为独立的 narration 输出
          return null
        }
        
        // 如果是字符串，包装为 narration
        if (typeof d === 'string') {
          const playerChoicesFromScene = (scene && Array.isArray(scene.choices) && Number(scene.choiceTriggerIndex) === Number(dIdx)) ? scene.choices.map((c, idx) => {
            const pc = { text: sanitize(c.text ?? c.label ?? ''), attributesDelta: c.attributesDelta || c.delta || {}, statusesDelta: c.statusesDelta || c.statuses || {}, subsequentDialogues: Array.isArray(c.subsequentDialogues || c.nextLines) ? (c.subsequentDialogues || c.nextLines).map(sd => (typeof sd === 'string' ? sanitize(sd) : sd)) : [] }
            const maybeId = Number(c.choiceId ?? c.id)
            pc.choiceId = Number.isInteger(maybeId) ? maybeId : (idx + 1)
            return pc
          }) : []
          return { narration: sanitize(d), playerChoices: playerChoicesFromScene }
        }
        // 如果是对象，规范化 playerChoices
        if (d && typeof d === 'object') {
          const narration = (typeof d.narration === 'string') ? d.narration : (d.text || d.content || '')
          let playerChoices = []
          if (Array.isArray(d.playerChoices) && d.playerChoices.length > 0) {
            playerChoices = d.playerChoices.map((c, idx) => {
              const pc = { text: sanitize(c.text ?? c.label ?? ''), attributesDelta: c.attributesDelta || c.delta || {}, statusesDelta: c.statusesDelta || c.statuses || {}, subsequentDialogues: Array.isArray(c.subsequentDialogues || c.nextLines) ? (c.subsequentDialogues || c.nextLines).map(sd => (typeof sd === 'string' ? sanitize(sd) : sd)) : [] }
              const maybeId = Number(c.choiceId ?? c.id)
              pc.choiceId = Number.isInteger(maybeId) ? maybeId : (idx + 1)
              return pc
            })
          } else if (Array.isArray(d.choices) && d.choices.length > 0) {
            playerChoices = d.choices.map((c, idx) => {
              const pc = { text: sanitize(c.text ?? c.label ?? ''), attributesDelta: c.attributesDelta || c.delta || {}, statusesDelta: c.statusesDelta || c.statuses || {}, subsequentDialogues: Array.isArray(c.subsequentDialogues || c.nextLines) ? (c.subsequentDialogues || c.nextLines).map(sd => (typeof sd === 'string' ? sanitize(sd) : sd)) : [] }
              const maybeId = Number(c.choiceId ?? c.id)
              pc.choiceId = Number.isInteger(maybeId) ? maybeId : (idx + 1)
              return pc
            })
          } else if (scene && Array.isArray(scene.choices) && Number(scene.choiceTriggerIndex) === Number(dIdx)) {
            playerChoices = scene.choices.map((c, idx) => {
              const pc = { text: sanitize(c.text ?? c.label ?? ''), attributesDelta: c.attributesDelta || c.delta || {}, statusesDelta: c.statusesDelta || c.statuses || {}, subsequentDialogues: Array.isArray(c.subsequentDialogues || c.nextLines) ? (c.subsequentDialogues || c.nextLines).map(sd => (typeof sd === 'string' ? sanitize(sd) : sd)) : [] }
              const maybeId = Number(c.choiceId ?? c.id)
              pc.choiceId = Number.isInteger(maybeId) ? maybeId : (idx + 1)
              return pc
            })
          }
          return { narration: sanitize(narration || ''), playerChoices }
        }
      } catch (e) { console.warn('normalizeDialogue failed', e) }
      return { narration: '', playerChoices: [] }
    }

    // 构建场景数据
    const scenesPayload = scenesWithOverrides.map((s, idx) => {
      let sid = Number(s.sceneId ?? s.id)
      if (!Number.isInteger(sid) || sid <= 0) sid = idx + 1
      const bg = (s.backgroundImage || s.background_image || s.background || '')
      const rawDialogues = Array.isArray(s.dialogues) ? s.dialogues : []
      // 🔑 关键修复：过滤掉 null 值（来自 subsequentDialogues 的对话）
      let dialogues = rawDialogues
        .map((d, dIdx) => normalizeDialogue(d, s, dIdx))
        .filter(d => d !== null)

      // 额外过滤：保证每个 dialogue 的 narration 非空或至少包含 playerChoices
      dialogues = dialogues.map(d => {
        const narration = (d.narration || '')
        const hasChoices = Array.isArray(d.playerChoices) && d.playerChoices.length > 0
        if (!String(narration).trim() && !hasChoices) {
          // 如果既没有叙述也没有选项，丢弃该 dialogue（后续 .filter 会移除）
          return null
        }
        if (!String(narration).trim() && hasChoices) {
          // 如果没有叙述但存在选项，设置为单个空格以满足后端非空校验
          d.narration = ' '
        }
        return d
      }).filter(d => d !== null)
      return { id: Number(sid), backgroundImage: bg || '', dialogues }
    })

    // 🔑 硬检查：场景ID去重，每个ID只保留最后一次出现
    // 使用 Map 来追踪每个 ID 最后出现的场景，自动覆盖之前的重复项
    const deduplicatedScenesMap = new Map()
    for (const scene of scenesPayload) {
      deduplicatedScenesMap.set(scene.id, scene)
    }
    const deduplicatedScenes = Array.from(deduplicatedScenesMap.values())
    
    // 🔑 记录去重结果
    if (scenesPayload.length !== deduplicatedScenes.length) {
      const removedCount = scenesPayload.length - deduplicatedScenes.length
      console.warn(`[persistCurrentChapterEdits] 场景ID去重：移除了 ${removedCount} 个重复场景`)
      console.warn('[persistCurrentChapterEdits] 原始场景ID列表:', scenesPayload.map(s => s.id))
      console.warn('[persistCurrentChapterEdits] 去重后场景ID列表:', deduplicatedScenes.map(s => s.id))
      
      // 找出哪些ID是重复的
      const sceneIds = scenesPayload.map(s => s.id)
      const duplicateIds = sceneIds.filter((id, index) => sceneIds.indexOf(id) !== index)
      const uniqueDuplicateIds = [...new Set(duplicateIds)]
      console.warn('[persistCurrentChapterEdits] 重复的场景ID:', uniqueDuplicateIds)
    } else {
      console.log('[persistCurrentChapterEdits] 场景ID检查通过：无重复')
    }
    
    // 🔑 对于结局场景，额外过滤掉"结局选项"场景
    const isEndingSelectionScene = (scene) => {
      try {
        if (!Array.isArray(scene.dialogues) || scene.dialogues.length === 0) return false
        
        for (const dialogue of scene.dialogues) {
          const choices = dialogue.playerChoices
          if (Array.isArray(choices) && choices.length >= 2) {
            const narration = String(dialogue.narration || '').toLowerCase()
            if (narration.includes('结局') || narration.includes('选择')) {
              return true
            }
            const endingChoiceCount = choices.filter(c => {
              const text = String(c.text || '').toLowerCase()
              return text.includes('>=') || text.includes('结局') || /\(.+\)/.test(text)
            }).length
            if (endingChoiceCount >= Math.max(2, choices.length / 2)) {
              return true
            }
          }
        }
      } catch (e) {}
      return false
    }

    // 检测是否为结局场景
    const isEndingChapterCheck = (Array.isArray(scenesWithOverrides) && scenesWithOverrides.some(s => s.isChapterEnding || s.isGameEnding || s.isGameEnd || s.chapterEnd || s.end || s.isEnding))
    
    // 如果是结局场景，过滤掉结局选项场景
    const finalScenesPayload = isEndingChapterCheck 
      ? deduplicatedScenes.filter(s => !isEndingSelectionScene(s))
      : deduplicatedScenes
    
    // 记录过滤结果
    if (isEndingChapterCheck && deduplicatedScenes.length !== finalScenesPayload.length) {
      const removedCount = deduplicatedScenes.length - finalScenesPayload.length
      console.log(`[persistCurrentChapterEdits] 结局场景过滤：移除了 ${removedCount} 个结局选项场景`)
    }

    // 使用过滤和去重后的场景列表

    // 获取章节标题
    const getFallbackTitle = () => {
      try {
        const byOutline = (outlineEdits.value && outlineEdits.value.length) ? (outlineEdits.value.find(x => Number(x.chapterIndex) === Number(chapterIndex))?.outline || '') : ''
        if (byOutline && String(byOutline).trim()) return String(byOutline).trim()
        
        try {
          const prev = JSON.parse(sessionStorage.getItem('createResult') || '{}')
          const bwOut = prev && prev.backendWork && Array.isArray(prev.backendWork.outlines) ? prev.backendWork.outlines : []
          const found = (bwOut || []).find(x => Number(x.chapterIndex) === Number(chapterIndex))
          if (found && (found.outline || found.summary || found.title)) return String(found.outline || found.summary || found.title).trim()
        } catch (e) {}
        
        if (work && work.value && work.value.title) return String(work.value.title)
      } catch (e) { console.warn('getFallbackTitle failed', e) }
      return `第${Number(chapterIndex)}章`
    }

    // 在将章节数据发送到后端之前，移除用于展示“请选择一个结局”选择的场景。
    // 这些场景只是 UI 用于让玩家选择结局，不应作为章节内容保存到后端。
    const isEndingChoicePrompt = (scene) => {
      try {
        if (!scene || !Array.isArray(scene.dialogues)) return false
        for (const d of scene.dialogues) {
          const text = (typeof d === 'string') ? d : (d.narration || d.text || '')
          if (!text) continue
          const t = String(text).trim()
          // 精确或开始匹配“请选择一个结局”以及包含“请选择”和“结局”的组合
          if (t === '请选择一个结局：' || t === '请选择一个结局' || t.startsWith('请选择一个结局') || (t.includes('请选择') && t.includes('结局'))) return true
        }
      } catch (e) { /* ignore */ }
      return false
    }

    const postedScenes = (finalScenesPayload || []).filter(s => !isEndingChoicePrompt(s))

    const chapterData = {
      chapterIndex: Number(chapterIndex),
      title: getFallbackTitle(),
      scenes: postedScenes  // 🔑 使用过滤掉结局选择场景后的列表
    }

    // 检测是否为结局场景：只有当场景数据本身被标记为结局时才认为是结局，
    // 避免单纯依赖 storyEndSignaled 导致普通章节被误判为结局而走错保存接口。
    const isEndingChapter = (Array.isArray(scenesWithOverrides) && scenesWithOverrides.some(s => s.isChapterEnding || s.isGameEnding || s.isGameEnd || s.chapterEnd || s.end || s.isEnding))
    if (isEndingChapter) {
      console.log('persistCurrentChapterEdits: Detected ending chapter — will call storyending save endpoint', { workId, chapterIndex })
      if (!performNetworkSave) {
        console.log('persistCurrentChapterEdits: performNetworkSave=false — skip network save for ending')
        try { await stopLoading() } catch (e) {}
        try { showNotice && showNotice('结局已在本地生效（未发送到后端）') } catch (e) {}
        return
      }
      try {
        // 尝试获取后端已存在的结局列表，以便定位 endingId 与 title（兼容没有 id 的实现）
        let endingId = null
        // 🔑 修改：优先从 sessionStorage 或 currentScene._endingTitle 获取结局 title，而不是使用章节的 outline
        let endingTitle = (sessionStorage.getItem(`selectedEndingTitle_${workId}`) || (currentScene.value && currentScene.value._endingTitle) || '')
        try {
          const resp = await storyService.getWorkInfo(workId)
          // 如果 getWorkInfo 包含 endings 字段（某些后端可能返回在作品详情里），尝试读取
          // axios 响应拦截器已经返回 response.data
          const payload = resp
          const endingsFromWork = Array.isArray(payload?.endings) ? payload.endings : []
          if (endingsFromWork.length > 0) {
            const idx = (lastSelectedEndingIndex && lastSelectedEndingIndex.value) ? (Number(lastSelectedEndingIndex.value) - 1) : 0
            const chosen = endingsFromWork[idx] || endingsFromWork[0]
            if (chosen) {
              endingId = chosen.id ?? chosen.endingId ?? null
              // 只在 endingTitle 为空时才使用后端返回的 title
              endingTitle = endingTitle || chosen.title || chosen.name
            }
          } else {
            // 否则再尝试直接读取 /api/game/storyending 接口
            try {
              const resp2 = await http.get(`/api/game/storyending/${workId}`)
              // axios 响应拦截器已经返回 response.data
              const payload2 = resp2
              const endings2 = Array.isArray(payload2?.endings) ? payload2.endings : []
              if (endings2.length > 0) {
                const idx2 = (lastSelectedEndingIndex && lastSelectedEndingIndex.value) ? (Number(lastSelectedEndingIndex.value) - 1) : 0
                const chosen2 = endings2[idx2] || endings2[0]
                endingId = chosen2.id ?? chosen2.endingId ?? null
                endingTitle = endingTitle || chosen2.title || chosen2.name || endingTitle
              }
            } catch (e) { /* ignore */ }
          }
        } catch (e) { /* ignore */ }

        // 我们要把所有结局按后端 GET 返回的结构逐个 PUT 回去（包含不可进入的结局）
        // 1) 先尝试读取后端现有的 endings 列表
        let existingEndings = []
        try {
          // 优先使用作品详情中的 endings 字段
          const resp = await storyService.getWorkInfo(workId)
          // axios 响应拦截器已经返回 response.data
          const payload = resp
          existingEndings = Array.isArray(payload?.endings) ? payload.endings : []
        } catch (e) {
          // 如果作品详情没有返回 endings，尝试直接读取 storyending 列表接口
          try {
            const resp2 = await http.get(`/api/game/storyending/${workId}/`)
            // axios 响应拦截器已经返回 response.data
            const p2 = resp2
            existingEndings = Array.isArray(p2?.endings) ? p2.endings : []
          } catch (e2) {
            // 忽略，后面会至少保存当前编辑的结局
            existingEndings = []
          }
        }

        // helper: 限制 title 长度到 255
        const safeTitle = (t) => {
          if (!t && t !== 0) return ''
          const s = String(t)
          return s.length > 255 ? s.slice(0, 255) : s
        }

        // 确定当前要保存的 endingIndex（以 1 为基数）
        // 优先策略：如果当前编辑来自于一个已读/加载的存档并且该存档包含 `endingindex`，
        // 则使用该 `endingindex` 来定位要覆盖的逻辑结局（确保我们覆盖的是用户实际修改的结局）。
        // 否则再回退到 UI 中选中的 lastSelectedEndingIndex，或最终回退到 1。
        // 注意：不要把后端 DB 的 `id` 当作逻辑上的 endingIndex 使用。
        let currentEndingIndex = 1
        try {
          if (lastSaveInfo && lastSaveInfo.value && lastSaveInfo.value.state) {
            const s = lastSaveInfo.value.state
            const si = (typeof s.endingindex === 'number') ? s.endingindex : (s.endingIndex != null ? Number(s.endingIndex) : null)
            if (si != null && !isNaN(si)) {
              currentEndingIndex = Number(si)
            } else if (lastSelectedEndingIndex && lastSelectedEndingIndex.value) {
              currentEndingIndex = Number(lastSelectedEndingIndex.value)
            }
          } else if (lastSelectedEndingIndex && lastSelectedEndingIndex.value) {
            currentEndingIndex = Number(lastSelectedEndingIndex.value)
          }
        } catch (e) {
          // 发生异常时安全回退
          try { if (lastSelectedEndingIndex && lastSelectedEndingIndex.value) currentEndingIndex = Number(lastSelectedEndingIndex.value) } catch (ee) { currentEndingIndex = 1 }
        }

        // 如果没有任何 existingEndings，至少构建一个基于当前编辑的结局以保证保存
        if (!existingEndings || existingEndings.length === 0) {
          const single = {
            endingIndex: currentEndingIndex,
            // 🔑 修改：结局 title 始终使用自己的 title，不使用章节 outline
            title: safeTitle(endingTitle || `结局 ${currentEndingIndex}`),
            scenes: finalScenesPayload  // 🔑 使用去重后的场景列表
          }
          try {
            await storyService.saveEnding(workId, single)
            showNotice('已保存结局内容')
          } catch (saveErr) {
            console.error('persistCurrentChapterEdits: saveEnding API failed', saveErr, saveErr?.data || (saveErr?.response && saveErr.response.data))
            showNotice('保存结局失败: ' + (saveErr?.data || saveErr?.message || '未知错误'), 8000)
            throw saveErr
          }
        } else {
          // 遍历所有 existingEndings，构造与 GET 时相同的 payload 并 PUT
          const errors = []
          // Build a map of existing endings by their logical endingIndex (if provided).
          // We will try to match and replace by that logical index. If an existing ending
          // does not expose a logical endingIndex (only has DB id), we will fallback to
          // preserving its scenes but will not treat that DB id as the logical index.
          const existingByIndex = {}
          const fallbackList = []
          for (let i = 0; i < existingEndings.length; i++) {
            const e = existingEndings[i]
            // Prefer an explicit `endingIndex` field; if not present, try `endingId`.
            const logicalIdx = (e.endingIndex != null) ? Number(e.endingIndex) : (e.endingId != null ? Number(e.endingId) : null)
            if (logicalIdx != null && !isNaN(logicalIdx)) {
              existingByIndex[logicalIdx] = e
            } else {
              // Unknown-index endings are kept in fallback order
              fallbackList.push(e)
            }
          }

          // Prepare payloads: for all logical indices found, preserve order by ascending index
          const indices = Object.keys(existingByIndex).map(x => Number(x)).sort((a,b)=>a-b)
          const payloads = []

          // helper: try to resolve backend-provided title for a logical ending index
          const getBackendTitle = (idx) => {
            try {
              if (!existingEndings || existingEndings.length === 0) return null
              // check explicit mapping first
              const byIdx = existingByIndex[idx]
              if (byIdx && (byIdx.title || byIdx.name)) return byIdx.title || byIdx.name
              // fallback: search full list for matching logical fields
              for (const ee of existingEndings) {
                const logical = (ee.endingIndex != null) ? Number(ee.endingIndex) : (ee.endingId != null ? Number(ee.endingId) : null)
                if (logical === idx) return ee.title || ee.name || null
              }
              // last resort: if idx maps to array position
              const pos = idx - 1
              if (pos >=0 && pos < existingEndings.length) {
                const cand = existingEndings[pos]
                if (cand && (cand.title || cand.name)) return cand.title || cand.name
              }
            } catch (e) { /* ignore */ }
            return null
          }
          // Add logical-indexed endings first
          for (const idx of indices) {
            const e = existingByIndex[idx]
            const backendTitle = getBackendTitle(idx)
            payloads.push({
              endingIndex: idx,
              // 🔑 修改：当前结局使用自己的 title，其他结局使用后端 title，不使用章节 outline
              title: safeTitle( backendTitle || (idx === currentEndingIndex ? (endingTitle || `结局 ${idx}`) : (e.title || e.name || `结局 ${idx}`)) ),
              scenes: (idx === currentEndingIndex) ? finalScenesPayload : (Array.isArray(e.scenes) ? e.scenes : [])  // 🔑 使用去重后的场景列表
            })
          }
          // Append fallback (unknown-index) endings preserving their original scenes
          for (let j = 0; j < fallbackList.length; j++) {
            const e = fallbackList[j]
            // For unknown-index entries, do not attempt to reassign the logical index.
            payloads.push({
              // We do not set a logical endingIndex here if backend didn't expose one;
              // keep whatever fields backend expects by passing through its scenes and title.
              endingIndex: e.endingIndex != null ? Number(e.endingIndex) : (e.endingId != null ? Number(e.endingId) : (j + 1)),
              title: safeTitle(e.title || e.name || `结局 ${j + 1}`),
              scenes: Array.isArray(e.scenes) ? e.scenes : []
            })
          }

          // If there is no existing ending matching currentEndingIndex, append it
          if (!indices.includes(currentEndingIndex)) {
            const backendTitleForCurrent = getBackendTitle(currentEndingIndex)
            payloads.push({
              endingIndex: currentEndingIndex,
              // 🔑 修改：结局 title 始终使用自己的 title，不使用章节 outline
              title: safeTitle( backendTitleForCurrent || endingTitle || `结局 ${currentEndingIndex}` ),
              scenes: finalScenesPayload  // 🔑 使用去重后的场景列表
            })
          }

          // Send payloads in order
          while (payloads.length > 0) {
            const p = payloads.shift()
            try {
              await storyService.saveEnding(workId, p)
              console.log('persistCurrentChapterEdits: saved ending', p.endingIndex)
            } catch (saveErr) {
              console.error('persistCurrentChapterEdits: failed saving an ending', saveErr, saveErr?.data || (saveErr?.response && saveErr.response.data))
              errors.push({ endingIndex: p.endingIndex, error: saveErr })
            }
          }

          if (errors.length === 0) {
            showNotice('已保存全部结局内容')
          } else {
            showNotice('部分结局保存失败，请检查控制台错误', 8000)
            throw errors[0].error
          }
        }

        // 刷新作品详情
        try { await getWorkDetails(workId) } catch (e) { /* ignore */ }
        try { await stopLoading() } catch (e) {}
        return
      } catch (e) {
        console.warn('persistCurrentChapterEdits: failed saving ending, falling back to abort', e, e?.data || (e?.response && e.response.data))
        try { await stopLoading() } catch (err) {}
        throw e
      }
    }

    console.log('persistCurrentChapterEdits: saving chapter', { workId, chapterIndex, scenesCount: scenesPayload.length })
    
    try {
      // 特殊处理：创作者身份下，手动确认已生成章节（allowSaveGenerated）
      // 需要调用后端 API 将章节状态更新为 saved
  if (allowSaveGenerated && (creatorFeatureEnabled.value || isCreatorIdentity.value || modifiableFromCreate.value)) {
        // 1) 调用后端 API 保存章节并更新状态为 saved
        try {
          if (!performNetworkSave) {
            console.log('persistCurrentChapterEdits: performNetworkSave=false — skip saveChapter network call')
            showNotice('已在本地应用修改（未发送到后端）')
          } else {
            console.log('persistCurrentChapterEdits: calling saveChapter API to mark as saved', { workId, chapterIndex })
            await saveChapter(workId, chapterIndex, chapterData)
            console.log('persistCurrentChapterEdits: saveChapter API succeeded')
            showNotice('已将本章保存并标记为 saved')
          }
          } catch (saveErr) {
          console.error('persistCurrentChapterEdits: saveChapter API failed', saveErr, saveErr?.data || (saveErr?.response && saveErr.response.data))
          showNotice('保存章节失败: ' + (saveErr?.data || saveErr?.message || '未知错误'), 5000)
          throw saveErr
        }
        
        // 🔑 关键修复：保存成功后立即获取作品详情以获取最新章节状态
        try {
          console.log('persistCurrentChapterEdits: 立即获取作品详情以刷新状态')
          await getWorkDetails(workId)
          const updatedStatus = getChapterStatus(chapterIndex)
          console.log('persistCurrentChapterEdits: 刷新后的章节状态:', updatedStatus)
        } catch (e) {
          console.warn('persistCurrentChapterEdits: failed to refresh work details', e)
        }

        // 2) 清除已生成但未保存标记
        try { lastLoadedGeneratedChapter.value = null } catch (e) {}

        // 🔑 关键修复：基于更新后的状态判断后续操作
        // 3) 检查是否已读到当前章的末尾
        const isAtChapterEnd = (currentSceneIndex.value >= (storyScenes.value.length - 1)) &&
                               (currentDialogueIndex.value >= ((storyScenes.value[currentSceneIndex.value]?.dialogues?.length || 1) - 1))
        
        console.log('保存后检查章节状态 - 已读到章末:', isAtChapterEnd, '当前场景:', currentSceneIndex.value, '总场景数:', storyScenes.value.length)
        
        // 4) 检查当前章是否为末章
        const isLastChapter = totalChapters.value && Number(chapterIndex) === Number(totalChapters.value)
        console.log('保存后检查是否为末章 - 当前章:', chapterIndex, '总章数:', totalChapters.value, '是否末章:', isLastChapter)

        // 🔑 新功能：如果是末章保存成功，检测并删除结局选项场景
        if (isLastChapter && performNetworkSave) {
          try {
            const beforeCount = storyScenes.value.length
            // 过滤掉结局选项场景
            storyScenes.value = storyScenes.value.filter(scene => !isEndingSelectionScene(scene))
            const afterCount = storyScenes.value.length
            
            if (beforeCount !== afterCount) {
              const removedCount = beforeCount - afterCount
              console.log(`[persistCurrentChapterEdits] 末章保存成功，已从前端缓存中删除 ${removedCount} 个结局选项场景`)
              
              // 调整当前场景索引，防止越界
              if (currentSceneIndex.value >= storyScenes.value.length) {
                currentSceneIndex.value = Math.max(0, storyScenes.value.length - 1)
                currentDialogueIndex.value = 0
                console.log(`[persistCurrentChapterEdits] 场景索引已调整为 ${currentSceneIndex.value}`)
              }
            }
          } catch (e) {
            console.warn('[persistCurrentChapterEdits] 删除结局选项场景时出错', e)
          }
        }

        if (!isAtChapterEnd) {
          // 情况1: 未读到章末 - 设置 pendingNextChapter，使后续到达章末时能正常触发加载/编辑器流程
          const nextChap = Number(chapterIndex) + 1
          try {
            pendingNextChapter.value = nextChap
          } catch (e) { console.warn('set pendingNextChapter failed', e) }
          showNotice('已保存本章，阅读至本章末尾后将弹出下一章大纲编辑器')
          try { await stopLoading() } catch (e) {}
          return
        }

        // 已读到章末的情况
        if (isLastChapter) {
          // 情况2: 末章已保存且已读完 - 进入结算页面
          console.log('末章已保存并读完，准备进入结算')
          showNotice('作品已完结，即将进入结算页面', 3000)
          setTimeout(async () => {
            try {
              // 标记将在进入结局判定时显示特殊加载界面
              storyEndSignaled.value = true
              isEndingLoading.value = true
              // 启动常规加载界面（复用现有加载逻辑）
              try { startLoading() } catch (e) { /* ignore */ }
              // 平滑显示进度
              try { await simulateLoadTo100(800) } catch (e) { /* ignore */ }
              // 调用结局处理（可能会导航到结算页面）
              await handleGameEnd()
            } catch (e) {
              console.warn('进入结算处理失败', e)
            } finally {
              // 关闭结局专用加载标记（如果组件还在）
              try { isEndingLoading.value = false } catch (e) {}
              try { await stopLoading() } catch (e) {}
            }
          }, 3000)
          return
        }

        // 情况3: 非末章已保存且已读完 - 弹出下一章的大纲编辑器
        console.log('非末章已保存并读完，准备弹出下一章大纲编辑器')
        const nextChap = Number(chapterIndex) + 1
        
        // 构建下一章的大纲占位（尽量复用已有 createResult 或 outlineEdits）
        let createRaw = null
        try { createRaw = JSON.parse(sessionStorage.getItem('createResult') || 'null') } catch (e) { createRaw = null }
        let rawOutlines = []
        if (createRaw && Array.isArray(createRaw.chapterOutlines) && createRaw.chapterOutlines.length) rawOutlines = createRaw.chapterOutlines
        else if (createRaw && createRaw.backendWork && Array.isArray(createRaw.backendWork.outlines) && createRaw.backendWork.outlines.length) rawOutlines = createRaw.backendWork.outlines
        else rawOutlines = []

        // 尝试找到 nextChap 对应的大纲，否则使用占位文本
        let nextOutlineText = `第${nextChap}章：请在此编辑/补充本章大纲以指导生成。`
        try {
          if (Array.isArray(rawOutlines) && rawOutlines.length) {
            const found = rawOutlines.find(x => Number(x.chapterIndex) === Number(nextChap)) || rawOutlines[nextChap - 1]
            if (found) {
              const title = (found && (found.title ?? found.chapter_title)) || ''
              const body = (found && (found.outline ?? found.summary)) || ''
              const combined = (title && body) ? `${title}\n\n${body}` : (title || body)
              if (combined) nextOutlineText = combined
            }
          }
        } catch (e) { console.warn('prepare next outline failed', e) }

        // 构建 nextChap 以及其后的所有章节大纲（若 totalChapters 不可用则至少包含 nextChap）
        const outlinesToShow = []
        const total = Math.max((Number(totalChapters.value) || 5), nextChap)
        for (let c = nextChap; c <= total; c++) {
          let text = `第${c}章：请在此编辑/补充本章大纲以指导生成。`
          try {
            if (Array.isArray(rawOutlines) && rawOutlines.length) {
              const foundC = rawOutlines.find(x => Number(x.chapterIndex) === Number(c)) || rawOutlines[c - 1]
              if (foundC) {
                const title = (foundC && (foundC.title ?? foundC.chapter_title)) || ''
                const body = (foundC && (foundC.outline ?? foundC.summary)) || ''
                const combined = (title && body) ? `${title}\n\n${body}` : (title || body)
                if (combined) text = combined
              }
            }
          } catch (e) { console.warn('prepare outline for chapter', c, 'failed', e) }
          outlinesToShow.push({ chapterIndex: c, outline: text })
        }

        // 将多个章节的大纲写入编辑器，默认聚焦到 nextChap
        outlineEdits.value = outlinesToShow
        outlineUserPrompt.value = (createRaw && createRaw.userPrompt) ? createRaw.userPrompt : ''
        originalOutlineSnapshot.value = JSON.parse(JSON.stringify(outlineEdits.value || []))
        pendingOutlineTargetChapter.value = nextChap
        editorInvocation.value = 'auto'
        showNotice('即将进入下一章的大纲编辑', 2000)
        
        // 延迟弹出编辑器，给用户一个视觉反馈
        setTimeout(() => {
          showOutlineEditor.value = true
          console.log('persistCurrentChapterEdits: opened outline editor for next chapter range', nextChap, '->', total)
        }, 2000)

        // 结束该分支：已经向后端保存并更新了章节状态
        try { await stopLoading() } catch (e) {}
        return
      }

      // 默认行为：非创作者确认或允许向后端保存的情况，仍然走原先的 PUT 流程
      console.log('persistCurrentChapterEdits: outbound chapterData:', chapterData)
      await saveChapter(workId, chapterIndex, chapterData)
      console.log('persistCurrentChapterEdits: saveChapter succeeded')
      
      showNotice('已将本章修改保存到后端')
      
      // 🔑 关键修复：保存成功后立即获取作品详情以获取最新章节状态
      try {
        console.log('persistCurrentChapterEdits: 立即获取作品详情以刷新状态')
        await getWorkDetails(workId)
        const updatedStatus = getChapterStatus(chapterIndex)
        console.log('persistCurrentChapterEdits: 刷新后的章节状态:', updatedStatus)
      } catch (e) {
        console.warn('persistCurrentChapterEdits: failed to refresh work details', e)
      }
      
      // 如果这是手动确认保存，则清除已生成但未保存标记
      if (allowSaveGenerated) lastLoadedGeneratedChapter.value = null
      
      // 更新 sessionStorage.createResult 中的大纲
      try {
        const prev = JSON.parse(sessionStorage.getItem('createResult') || '{}')
        prev.backendWork = prev.backendWork || {}
        prev.backendWork.outlines = prev.backendWork.outlines || []
        const idx = (prev.backendWork.outlines || []).findIndex(x => Number(x.chapterIndex) === Number(chapterIndex))
        if (idx >= 0 && outlineEdits.value && outlineEdits.value.length) {
          prev.backendWork.outlines[idx].outline = outlineEdits.value.find(x => Number(x.chapterIndex) === Number(chapterIndex))?.outline || prev.backendWork.outlines[idx].outline
        }
        sessionStorage.setItem('createResult', JSON.stringify(prev))
      } catch (e) { console.warn('persistCurrentChapterEdits: update createResult failed', e, e?.data || (e?.response && e.response.data)) }
      
    } catch (e) {
      console.error('persistCurrentChapterEdits: saveChapter failed', e?.response?.data || e)
      showNotice('保存失败，请检查网络或稍后重试')
      throw e
    }
  } catch (e) {
    console.warn('persistCurrentChapterEdits failed', e)
    throw e
  }
}

// 在组件挂载时加载 overrides
onMounted(() => {
  loadOverrides()
  applyOverridesToScenes()
})

// 在组件卸载时自动持久化当前章节（如果可手动编辑）
onUnmounted(() => {
  try {
    (async () => {
      try {
        await persistCurrentChapterEdits({ performNetworkSave: false })
      } catch (e) { console.warn('persistCurrentChapterEdits onUnmount failed', e) }
    })()
  } catch (e) { console.warn('onUnmounted persist failed', e) }
})


// 观察 creatorMode：进入记录位置并禁用 advance；退出回到 entry 的那句话（修改版）并恢复播放权限
watch(creatorMode, (val) => {
  if (val) {
    try {
      // 🔑 进入手动编辑模式：保存完整的状态快照
      console.log('进入手动编辑模式 - 保存状态快照')
      creatorEntry.sceneIndex = currentSceneIndex.value
      creatorEntry.dialogueIndex = currentDialogueIndex.value
      
      // 🔑 关键：保存选择历史的快照，退出时恢复
      try {
        creatorEntry.choiceHistorySnapshot = deepClone(choiceHistory.value || [])
        console.log('保存选择历史快照，长度:', creatorEntry.choiceHistorySnapshot.length)
      } catch (e) {
        creatorEntry.choiceHistorySnapshot = JSON.parse(JSON.stringify(choiceHistory.value || []))
      }
      
      // 🔑 保存场景的 choiceConsumed 状态快照
      try {
        creatorEntry.scenesChoiceStateSnapshot = {}
        storyScenes.value.forEach((scene, idx) => {
          if (scene) {
            creatorEntry.scenesChoiceStateSnapshot[idx] = {
              choiceConsumed: scene.choiceConsumed || false,
              chosenChoiceId: scene.chosenChoiceId || null
            }
          }
        })
        console.log('保存场景选项状态快照')
      } catch (e) {
        console.warn('保存场景选项状态快照失败:', e)
      }
      
      // 🔑 保存属性和状态的快照
      try {
        creatorEntry.attributesSnapshot = deepClone(attributes.value || {})
        creatorEntry.statusesSnapshot = deepClone(statuses.value || {})
        console.log('保存属性快照:', Object.keys(creatorEntry.attributesSnapshot).length, '个属性')
        console.log('保存状态快照:', Object.keys(creatorEntry.statusesSnapshot).length, '个状态')
      } catch (e) {
        try {
          creatorEntry.attributesSnapshot = JSON.parse(JSON.stringify(attributes.value || {}))
          creatorEntry.statusesSnapshot = JSON.parse(JSON.stringify(statuses.value || {}))
        } catch (e2) {
          console.warn('保存属性和状态快照失败:', e2)
        }
      }
      
      allowAdvance.value = false
      // 暂停自动播放
      try { stopAutoPlayTimer() } catch (e) {}
    } catch (e) { console.warn('enter creatorMode failed', e) }
  } else {
    try {
      // 在退出创作者模式前尝试将当前章节的本地修改持久化到后端（仅当 createResult 标记为 modifiable 时）
      try {
        (async () => {
          try {
            // When exiting menu creatorMode (manual editing from menu), persist current chapter edits.
            // If the current scene is a backend-generated ending, we should perform a network save
            // so the edited ending is sent to the backend via PUT /api/game/storyending/{workId}/{endingIndex}/.
            const curScene = currentScene?.value || (Array.isArray(storyScenes.value) ? storyScenes.value[currentSceneIndex.value] : null)
            let shouldPerformNetworkSave = false
            try {
              if (curScene && (curScene._isBackendEnding === true || curScene.isChapterEnding || curScene.isGameEnding || curScene.isEnding || curScene.end || curScene.chapterEnd)) {
                shouldPerformNetworkSave = true
              }
            } catch (e) { /* ignore and fall back to false */ }

            await persistCurrentChapterEdits({ auto: false, allowSaveGenerated: false, chapterIndex: currentChapterIndex.value, performNetworkSave: shouldPerformNetworkSave })
          } catch (e) { console.warn('persistCurrentChapterEdits on exit creatorMode failed', e) }
        })()
      } catch (e) { console.warn('trigger persist on exit creatorMode failed', e) }
      
      // 🔑 退出手动编辑模式：恢复进入时的位置和状态
      console.log('退出手动编辑模式 - 恢复状态快照')
      
      // 🔑 关键：恢复选择历史，撤销手动编辑模式中的所有选择
      if (creatorEntry.choiceHistorySnapshot) {
        try {
          choiceHistory.value = deepClone(creatorEntry.choiceHistorySnapshot)
          console.log('恢复选择历史快照，长度:', choiceHistory.value.length)
          // 恢复后需要重新应用选择标记
          try { restoreChoiceFlagsFromHistory() } catch (e) { console.warn('restoreChoiceFlagsFromHistory failed:', e) }
        } catch (e) {
          choiceHistory.value = JSON.parse(JSON.stringify(creatorEntry.choiceHistorySnapshot))
          try { restoreChoiceFlagsFromHistory() } catch (e) {}
        }
        creatorEntry.choiceHistorySnapshot = null
      }
      
      // 🔑 恢复场景的 choiceConsumed 状态
      if (creatorEntry.scenesChoiceStateSnapshot) {
        try {
          Object.keys(creatorEntry.scenesChoiceStateSnapshot).forEach(idx => {
            const sceneIdx = parseInt(idx)
            if (storyScenes.value[sceneIdx]) {
              const savedState = creatorEntry.scenesChoiceStateSnapshot[idx]
              storyScenes.value[sceneIdx].choiceConsumed = savedState.choiceConsumed
              storyScenes.value[sceneIdx].chosenChoiceId = savedState.chosenChoiceId
            }
          })
          console.log('恢复场景选项状态快照')
        } catch (e) {
          console.warn('恢复场景选项状态快照失败:', e)
        }
        creatorEntry.scenesChoiceStateSnapshot = null
      }
      
      // 🔑 恢复属性和状态
      if (creatorEntry.attributesSnapshot) {
        try {
          attributes.value = deepClone(creatorEntry.attributesSnapshot)
          console.log('恢复属性快照:', Object.keys(attributes.value).length, '个属性')
        } catch (e) {
          try {
            attributes.value = JSON.parse(JSON.stringify(creatorEntry.attributesSnapshot))
          } catch (e2) {
            console.warn('恢复属性快照失败:', e2)
          }
        }
        creatorEntry.attributesSnapshot = null
      }
      
      if (creatorEntry.statusesSnapshot) {
        try {
          statuses.value = deepClone(creatorEntry.statusesSnapshot)
          console.log('恢复状态快照:', Object.keys(statuses.value).length, '个状态')
        } catch (e) {
          try {
            statuses.value = JSON.parse(JSON.stringify(creatorEntry.statusesSnapshot))
          } catch (e2) {
            console.warn('恢复状态快照失败:', e2)
          }
        }
        creatorEntry.statusesSnapshot = null
      }
      
      // 恢复位置
      if (creatorEntry.sceneIndex != null) {
        currentSceneIndex.value = creatorEntry.sceneIndex
        currentDialogueIndex.value = creatorEntry.dialogueIndex != null ? creatorEntry.dialogueIndex : 0
        showText.value = true
        console.log('恢复位置 - 场景:', currentSceneIndex.value, '对话:', currentDialogueIndex.value)
      }
      
      allowAdvance.value = true
      // 自动播放会自动恢复,不需要手动启动
      // 如果之前在创作者模式中到达了本章末并保存了待加载章节，则在退出创作者模式后触发加载
      try {
        if (pendingNextChapter.value != null) {
          const chap = pendingNextChapter.value
          pendingNextChapter.value = null
          // 异步触发加载下一章（与原逻辑一致）
          (async () => {
            try {
              startLoading()
              await fetchNextChapter(workId, chap)
            } catch (e) { console.warn('load pending next chapter failed', e) }
            try { await stopLoading() } catch (e) {}
          })()
        }
      } catch (e) { console.warn('trigger pending next chapter failed', e) }
      // 如果存在预览快照，退出创作者模式时需要恢复到快照状态（移除预览）
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

// Ensure first sentence shows when we have scenes and are ready (entering landscape & not loading).
watch([isLandscapeReady, isLoading, () => storyScenes.value.length], (values) => {
  try {
    const [land, loading, len] = values
    if (land && !loading && Array.isArray(storyScenes.value) && storyScenes.value.length > 0) {
      // clamp scene index
      if (typeof currentSceneIndex.value !== 'number' || currentSceneIndex.value >= storyScenes.value.length) currentSceneIndex.value = 0
      const s = storyScenes.value[currentSceneIndex.value]
      if (!s || !Array.isArray(s.dialogues) || s.dialogues.length === 0) {
        // nothing to show
        showText.value = false
        return
      }
      // clamp dialogue index
      if (typeof currentDialogueIndex.value !== 'number' || currentDialogueIndex.value >= s.dialogues.length) currentDialogueIndex.value = 0
      // show first dialogue immediately
      showText.value = true
    }
  } catch (e) { console.warn('auto-show first dialogue watch failed', e) }
}, { immediate: true })


// 设置 useSaveLoad 的依赖
setSaveLoadDependencies({
  checkCurrentChapterSaved,
  getChapterStatus,
  currentChapterIndex,
  creatorFeatureEnabled,
  showNotice,
  stopAutoPlayTimer,
  autoPlayEnabled,
  anyOverlayOpen,
  startAutoPlayTimer,
  currentScene,
  currentSceneIndex,
  currentDialogueIndex,
  storyScenes,
  choiceHistory,
  fetchNextChapter,
  pushSceneFromServer,
  deepClone,
  currentBackground,
  effectiveCoverUrl
  ,
  lastSelectedEndingIndex,
  // 传入结局播放标记，方便读档时设置
  playingEndingScenes,
  endingsAppended
})

// 设置 useCreatorMode 的依赖（在 autoPlayAPI 创建之后）
setCreatorModeDependencies({
  stopAutoPlayTimer,
  startAutoPlayTimer,
  autoPlayEnabled,
  persistCurrentChapterEdits,
  creatorFeatureEnabled,
  showMenu,
  showText,
  currentDialogue,
  currentScene,
  nextDialogue
})

// 设置 useStoryAPI 的依赖（在所有 composables 创建之后）
storyAPI.setDependencies({
  creatorFeatureEnabled,
  showNotice,
  showOutlineEditor,
  outlineEdits,
  outlineUserPrompt,
  originalOutlineSnapshot,
  editorInvocation,
  pendingOutlineTargetChapter,
  outlineEditorResolver,
  loadingProgress,
  // 传入属性/状态引用，供结局条件匹配使用
  attributes,
  statuses
})

// 自动播放的启动/停止已由 useAutoPlay 内部自动处理,不需要额外的 watch
// useAutoPlay 会监听所有关键状态(showText, anyOverlayOpen, choicesVisible 等)的变化

// 控制选项展示（在某句阅读结束后出现）

// 当从存档/读档恢复到某句带有 playerChoices 的话时，避免立即自动展示选项。

// 当场景或对话索引变动，检查是否应该显示选项
watch([currentSceneIndex, currentDialogueIndex], () => {
  // 如果刚刚处理过一次选项，短时间内不要重新显示选项（防止选项被重复展示）
  try {
    const timeSinceLastChoice = Date.now() - (lastChoiceTimestamp.value || 0)
    if (timeSinceLastChoice < 600) {
      console.log('[watch] 选项刚被处理,抑制重复显示,距上次:', timeSinceLastChoice, 'ms')
      return
    }
  } catch (e) {}
  
  const scene = currentScene.value
  if (!scene) {
    console.log('[watch] 场景不存在，隐藏选项')
    choicesVisible.value = false
    return
  }
  
  // 🔑 关键修复：如果该场景的选项已被消费过（用户已经选择过），不要再次显示
  if (scene.choiceConsumed) {
    console.log('[watch] 场景选项已消费,不显示选项 - 场景:', currentSceneIndex.value, 
      '对话:', currentDialogueIndex.value, 
      '选项触发点:', scene.choiceTriggerIndex,
      '已选ID:', scene.chosenChoiceId,
      '场景有choices:', Array.isArray(scene.choices),
      '场景有choiceTriggerIndex:', typeof scene.choiceTriggerIndex === 'number')
    choicesVisible.value = false
    return
  }
  
  // 🔑 智能检查：检查选择历史，但要考虑当前阅读位置
  // 只有当用户已经通过了选项触发点（选过或跳过）时，才拒绝显示选项
  try {
    const sceneId = String(scene.id || scene.sceneId)
    const historyRecord = choiceHistory.value.find(h => String(h.sceneId) === sceneId)
    if (historyRecord) {
      // 确定触发索引
      const triggerIndex = typeof scene.choiceTriggerIndex === 'number' 
        ? scene.choiceTriggerIndex 
        : (typeof historyRecord.choiceTriggerIndex === 'number' ? historyRecord.choiceTriggerIndex : null)
      
      // 🔑 关键判断：只有当当前对话位置大于触发点时，才说明用户已经"通过"了选项
      // 如果当前位置等于触发点，说明用户正好在这里，可能是从前面阅读过来的，应该显示选项
      // 如果当前位置小于触发点，说明用户还没到，肯定要显示选项
      if (triggerIndex !== null && currentDialogueIndex.value > triggerIndex) {
        console.log('[watch] ⛔ 智能拒绝：用户已通过选项触发点，不再显示 - 场景ID:', sceneId, 
          '当前位置:', currentDialogueIndex.value,
          '触发点:', triggerIndex,
          '历史记录:', historyRecord)
        choicesVisible.value = false
        // 同时标记场景为已消费，避免后续再次检查
        if (!scene.choiceConsumed) {
          scene.choiceConsumed = true
          scene.chosenChoiceId = historyRecord.choiceId
          if (typeof historyRecord.choiceTriggerIndex === 'number' && typeof scene.choiceTriggerIndex !== 'number') {
            scene.choiceTriggerIndex = historyRecord.choiceTriggerIndex
          }
          console.log('[watch] ⛔ 已自动标记场景为已消费')
        }
        return
      } else if (triggerIndex !== null && currentDialogueIndex.value === triggerIndex) {
        // 当前正好在触发点，如果历史中有记录，说明是从后面回退的，应该拒绝
        // 但如果是从前面阅读过来的，应该允许显示
        // 可以通过检查是否刚完成读档来判断
        console.log('[watch] 🤔 在触发点检测到历史记录，但用户可能从前面阅读过来 - 场景ID:', sceneId, 
          '当前位置:', currentDialogueIndex.value,
          '触发点:', triggerIndex)
        // 这里不做拦截，让后续逻辑决定是否显示（可能是用户从前面正常阅读过来的）
      } else {
        console.log('[watch] ✅ 允许：用户还未到达触发点，允许显示选项 - 场景ID:', sceneId, 
          '当前位置:', currentDialogueIndex.value,
          '触发点:', triggerIndex)
        // 用户还未到达触发点，清除可能错误的标记
        if (scene.choiceConsumed) {
          scene.choiceConsumed = false
          scene.chosenChoiceId = null
          console.log('[watch] ✅ 清除错误的消费标记，允许用户正常阅读到选项')
        }
      }
    }
  } catch (e) {
    console.warn('[watch] 检查选择历史时出错:', e)
  }
  
  // 🔑 关键修复：检查是否有有效的选项配置
  // 注意：即使场景没有 choices 配置，如果它被标记为 choiceConsumed=true，
  // 上面的检查已经阻止了选项显示，所以这里只需要检查是否有可显示的选项
  const hasValidChoices = Array.isArray(scene.choices) && 
                          scene.choices.length > 0 && 
                          typeof scene.choiceTriggerIndex === 'number'
  
  if (!hasValidChoices) {
    console.log('[watch] 场景无有效选项配置，隐藏选项 - choiceConsumed:', scene.choiceConsumed)
    choicesVisible.value = false
    return
  }
  
  // 🔑 关键修复：当对话索引等于触发索引时显示选项（停留在触发句）
  const shouldShowChoices = currentDialogueIndex.value === scene.choiceTriggerIndex && 
                            showText.value && 
                            !suppressAutoShowChoices.value
  
  if (shouldShowChoices) {
    // 🔑 修改：不立即显示选项，而是设置标记，等待用户点击
    console.log('[watch] 到达选项触发点 - 场景:', currentSceneIndex.value, 
      '对话:', currentDialogueIndex.value, 
      '触发索引:', scene.choiceTriggerIndex,
      '选项数:', scene.choices.length,
      '触发句内容:', scene.dialogues[currentDialogueIndex.value])
    console.log('[watch] 选项详细数据:', scene.choices.map(c => ({
      id: c.id,
      text: c.text,
      attributesDelta: c.attributesDelta,
      statusesDelta: c.statusesDelta
    })))
    console.log('[watch] 设置等待用户点击标记，不立即显示选项')
    waitingForClickToShowChoices.value = true
    choicesVisible.value = false
    // 自动播放遇到选项时暂停
    stopAutoPlayTimer()
  } else {
    // 只在不是触发点时隐藏选项
    if (currentDialogueIndex.value !== scene.choiceTriggerIndex) {
      choicesVisible.value = false
      // 🔑 清除等待标记（当离开触发点时）
      waitingForClickToShowChoices.value = false
    }
    console.log('[watch] 选项未触发 - suppressAuto:', suppressAutoShowChoices.value, 
      'dialogueIdx:', currentDialogueIndex.value, 
      'triggerIdx:', scene.choiceTriggerIndex, 
      'showText:', showText.value)
  }
}, { immediate: false }) // 🔑 不立即执行，避免初始化时误触发

// 选项的显示/隐藏已由 useAutoPlay 内部自动处理,不需要额外的 watch

// 页面卸载时解锁屏幕方向
onUnmounted(async () => {
  // 停止自动播放计时器
  stopAutoPlayTimer()
  
  // 清理游戏状态的进度定时器
  if (cleanupGameState) {
    cleanupGameState()
  }
  
  try {
    // 卸载前自动存档
    await autoSaveToSlot(AUTO_SAVE_SLOT)
    if (isNativeApp.value) {
      await ScreenOrientation.unlock()
      console.log('组件卸载，已解锁屏幕方向')
    } else if (screen.orientation && screen.orientation.unlock) {
      screen.orientation.unlock()
    }
  } catch (err) {
    console.log('解锁屏幕方向失败:', err)
  }
  
  // 恢复状态栏显示
  try {
    await StatusBar.show()
    console.log('[GamePage] 状态栏已恢复显示')
  } catch (e) {
    console.warn('[GamePage] 恢复状态栏失败:', e)
  }
  
  // 清理挂载时添加的侦听
  if (onMounted._cleanup) try { onMounted._cleanup() } catch {}
})
</script>

<template>
  <div class="game-page" @click="onGlobalClick">
    <!-- 横屏准备界面 -->
    <div v-if="!isLandscapeReady" class="landscape-prompt">
      <div class="prompt-content">
        <h2 class="prompt-title">{{ work.title }}</h2>
        <p class="prompt-text">即将进入横屏阅读模式</p>
        <p class="prompt-hint">为获得最佳阅读体验，请横置您的设备</p>
        <button class="enter-button" @click="requestLandscape">
          <span>进入阅读</span>
        </button>
      </div>
    </div>

    <!-- 加载界面 -->
    <transition name="fade">
      <div v-if="isLandscapeReady && isLoading" class="loading-screen">
        <!-- 封面背景图 -->
  <div class="loading-cover-bg" :style="{ backgroundImage: `url(${effectiveCoverUrl})` }"></div>
        
        <div class="loading-content">
          <!-- 游戏标题（作品名；结局判定时展示特殊标题） -->
          <h1 class="game-title">{{ isEndingLoading ? '结局判定中' : work.title }}</h1>
          
          <!-- 进度条与毛笔（毛笔跟随进度条滑动） -->
          <div class="loading-progress-container">
            <!-- 毛笔：使用 left 绑定使其跟随进度条的 thumb（通过 translateX(-50%) 居中） -->
            <div class="brush-container" :style="{ left: loadingProgress + '%' }">
              <svg class="brush-icon" viewBox="0 0 64 64" fill="none">
                <!-- 毛笔笔杆 -->
                <path 
                  d="M32 8 L32 40" 
                  stroke="#8B4513" 
                  stroke-width="3" 
                  stroke-linecap="round"
                />
                <!-- 毛笔笔头 -->
                <path 
                  d="M32 40 L28 52 L32 56 L36 52 Z" 
                  fill="#2C2C2C"
                  stroke="#1C1C1C"
                  stroke-width="1"
                />
                <!-- 毛笔尖 -->
                <path 
                  d="M32 56 L30 60 L32 62 L34 60 Z" 
                  fill="#1C1C1C"
                />
                <!-- 笔杆装饰 -->
                <circle cx="32" cy="12" r="2" fill="#D4A574"/>
                <circle cx="32" cy="20" r="2" fill="#D4A574"/>
                <circle cx="32" cy="28" r="2" fill="#D4A574"/>
              </svg>
            </div>

            <div class="loading-progress-bg">
              <div class="loading-progress-fill" :style="{ width: loadingProgress + '%' }">
                <div class="progress-shine"></div>
              </div>
            </div>
            <div class="loading-text">{{ Math.floor(loadingProgress) }}%</div>
          </div>
          
          <!-- 加载提示 -->
          <div class="loading-tips">
            <p class="tip-text">
              {{ isEndingLoading ? '结局判定中，请稍候...' : (isGeneratingSettlement ? '结算页面生成中...' : '正在准备故事...') }}
            </p>
          </div>
        </div>
        
        <!-- 背景装饰 -->
        <div class="bg-decoration">
          <div class="decoration-circle"></div>
          <div class="decoration-circle"></div>
          <div class="decoration-circle"></div>
        </div>
      </div>
    </transition>
    
    <!-- 游戏内容（橙光风格） -->
    <div v-show="isLandscapeReady && !isLoading" class="game-content">
      <!-- 中心加载指示：获取后续剧情时显示（非阻塞） -->
      <div v-if="isFetchingNext" class="center-loading" aria-live="polite" aria-label="后续剧情生成中">
        <div class="center-spinner"></div>
      </div>

      <!-- 背景图层 -->
      <div class="background-layer" :style="{ backgroundImage: `url(${currentBackground})` }"></div>
      
      <!-- 遮罩层（让文字更清晰） -->
      <div class="overlay-layer"></div>
      
      <!-- 点击区域（点击进入下一句） - 🔑 修复：编辑状态下阻止点击事件 -->
      <div class="click-area" @click="editingDialogue ? null : nextDialogue"></div>

      <!-- 选项区域（如果当前场景包含 choices） - 放在 text-box 之外，避免被裁剪 -->
      <div 
        v-if="currentScene && currentScene.choices && choicesVisible" 
        class="choices-container" 
        :class="{ disabled: showMenu, 'ending-choices': currentScene._isEndingChoiceScene }"
        @click.stop>
        <div class="choice" v-for="choice in currentScene.choices" :key="choice.id">
          <button 
            class="choice-btn" 
            :disabled="isFetchingChoice || showMenu" 
            @click="chooseOption(choice)">
            {{ choice.text }}
          </button>
        </div>
      </div>
      
      <!-- 文字栏 - 🔑 修复：点击对话框时停止冒泡，避免触发全局点击导致双重跳转 -->
      <div class="text-box" :class="{ editing: editingDialogue, 'creator-mode': creatorMode }" @click.stop="editingDialogue ? null : nextDialogue()">
        <!-- 说话人标签（可选） -->
        <div v-if="currentSpeaker" class="speaker-badge">{{ currentSpeaker }}</div>
        <transition name="text-fade">
          <!-- 非编辑态显示当前对话 -->
          <p v-if="!editingDialogue && showText" class="dialogue-text">{{ currentDialogue }}</p>
          <!-- 编辑态：contenteditable，编辑内容保存在 editableText - 🔑 修复：阻止点击事件冒泡 -->
    <div v-else-if="editingDialogue" ref="editableDiv" class="dialogue-text" contenteditable="true"
      @click.stop
      @input="onEditableInput"
      @compositionstart="onCompositionStart"
      @compositionend="onCompositionEnd"
      @keydown.enter.prevent="finishEdit"
      @blur="finishEdit"></div>
        </transition>

        <!-- 编辑与替换图片按钮：仅在创作者模式可见 -->
        <div v-if="creatorMode" class="edit-controls" aria-hidden="false">
          <template v-if="!editingDialogue">
            <button class="edit-btn" title="编辑文本" @click.stop="startEdit()">编辑</button>
            <button class="edit-btn" title="替换当前背景" @click.stop="triggerImagePicker">替换图片</button>
            <button class="edit-btn" title="播放下一句" @click.stop="playNextAfterEdit">播放下一句</button>
            <!-- 🔧 新增旁白功能按钮 -->
            <button class="edit-btn" title="在当前后插入旁白" @click.stop="addNarration()">新增旁白</button>
            <button class="edit-btn" :class="{ disabled: !currentIsNarration }" :title="currentIsNarration ? '删除当前旁白' : '当前不是旁白'" @click.stop="attemptDeleteNarration">删除旁白</button>
          </template>
          <template v-else>
            <button class="edit-btn" title="确认编辑" @click.stop="finishEdit()">确认</button>
            <button class="edit-btn" title="取消编辑" @click.stop="cancelEdit()">取消</button>
          </template>
        </div>

        <!-- 继续提示箭头 -->
        <div v-if="showText && !isLastDialogue" class="continue-hint">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
          </svg>
        </div>
      </div>
      
      <!-- 顶部进度条 -->
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: readingProgress + '%' }"></div>
      </div>
      
      <!-- 菜单按钮 -->
      <button class="menu-button" @click.stop="toggleMenu">
        <svg viewBox="0 0  24 24" fill="none" stroke="currentColor">
          <line x1="3" y1="12" x2="21" y2="12" stroke-width="2"/>
          <line x1="3" y1="6" x2="21" y2="6" stroke-width="2"/>
          <line x1="3" y1="18" x2="21" y2="18" stroke-width="2"/>
        </svg>
      </button>

      <!-- 创作者模式指示器 -->
      <div v-if="creatorMode" class="creator-badge">创作者模式</div>

      <!-- 顶部不再显示快速操作，相关功能移动到菜单中 -->
      
      <!-- 菜单面板 -->
      <transition name="slide-down">
        <div v-if="showMenu" class="menu-panel" @click.stop>
          <button class="menu-item" @click="goBack" :disabled="creatorMode">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M19 12H5M12 19l-7-7 7-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>返回作品页</span>
          </button>
          
          <button class="menu-item" @click="toggleMenu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M18 6L6 18M6 6l12 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>继续阅读</span>
          </button>

          <!-- 整合功能入口：存档 / 读档 / 属性 / 设置（并列网格） -->
          <div class="menu-grid">
            <button class="menu-item" @click="showMenu = false; openSaveModal()" :disabled="creatorMode">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M5 20h14a1 1 0 0 0 1-1V7l-4-4H6a1 1 0 0 0-1 1v16zM8 8h8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>存档</span>
            </button>
            <button class="menu-item" @click="showMenu = false; openLoadModal()" :disabled="creatorMode">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 9l5 5 5-5M12 14V3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>读档</span>
            </button>
            <button class="menu-item" @click="showMenu = false; openAttributes()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14" stroke-width="2"/>
                <path d="M3 7h18M8 11l2.5 3L13 11l4 6H7l1-2z" stroke-width="2"/>
              </svg>
              <span>属性</span>
            </button>
            <button class="menu-item" @click="showMenu = false; showSettingsModal = true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" stroke-width="2"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.27.27a2 2 0 1 1-2.83 2.83l-.27-.27a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V22a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.27.27a2 2 0 1 1-2.83-2.83l.27-.27a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.27-.27a2 2 0 1 1 2.83-2.83l.27.27a1.65 1.65 0 0 0 1.82.33h0A1.65 1.65 0 0 0 9 2.09V2a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.27-.27a2 2 0 1 1 2.83 2.83l-.27.27a1.65 1.65 0 0 0-.33 1.82v0A1.65 1.65 0 0 0 21.91 11H22a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>设置</span>
            </button>
            <!-- 创作者模式开关 -->
            <button class="menu-item" @click="toggleCreatorMode(); showMenu = false">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" stroke-width="1.5"/>
                <circle cx="12" cy="12" r="3" stroke-width="1.5"/>
              </svg>
              <span>{{ creatorMode ? '退出手动编辑模式' : '进入手动编辑模式' }}</span>
            </button>
          </div>
          
          <div class="menu-progress">
            <span>阅读进度：{{ Math.floor(readingProgress) }}%</span>
            <span>场景 {{ currentSceneIndex + 1 }} / {{ storyScenes.length }}</span>
          </div>
        </div>
      </transition>
    </div>

    <!-- 存档弹窗（3个槽位） -->
    <div v-if="showSaveModal" class="modal-backdrop" @click.self="closeSaveModal">
      <div class="modal-panel save-load-modal">
        <div class="modal-header">
          <h3>选择存档槽位</h3>
          <button class="modal-close" @click="closeSaveModal">×</button>
        </div>
        <div class="slot-list">
          <div v-for="slot in SLOTS" :key="slot" class="slot-card">
            <div class="slot-title">{{ slot.toUpperCase() }}</div>
            <div v-if="slotInfos[slot]">
                <div class="slot-thumb" v-if="(slotInfos[slot].thumbnailData || slotInfos[slot].thumbnail || (slotInfos[slot].game_state && (slotInfos[slot].game_state.thumbnailData || slotInfos[slot].game_state.thumbnail)))">
                  <img :src="slotInfos[slot].thumbnailData || slotInfos[slot].thumbnail || (slotInfos[slot].game_state && (slotInfos[slot].game_state.thumbnailData || slotInfos[slot].game_state.thumbnail))" alt="thumb" />
                  <div class="thumb-meta">
                    <div class="meta-time">{{ new Date(slotInfos[slot].timestamp || Date.now()).toLocaleString() }}</div>
                  </div>
                </div>
                <div class="slot-meta" v-else>
                  <div>时间：{{ new Date(slotInfos[slot].timestamp || Date.now()).toLocaleString() }}</div>
                </div>
            </div>
            <div class="slot-meta empty" v-else>空槽位</div>
            <div class="slot-actions">
              <button @click="saveGame(slot).then(() => refreshSlotInfos())">保存到 {{ slot.toUpperCase() }}</button>
              <button v-if="slotInfos[slot]" @click="deleteGame(slot)" class="delete-btn">删除</button>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button @click="closeSaveModal">关闭</button>
        </div>
      </div>
    </div>

    <!-- 设置弹窗：自动播放 -->
    <div v-if="showSettingsModal" class="modal-backdrop" @click.self="showSettingsModal = false">
      <div class="modal-panel settings-modal">
        <div class="modal-header">
          <h3>设置</h3>
          <button class="modal-close" @click="showSettingsModal = false">×</button>
        </div>
        <div class="settings-body">
          <label class="row">
            <input type="checkbox" v-model="autoPlayEnabled" />
            <span>自动播放（遇到选项自动暂停）</span>
          </label>
          <div class="row interval-selector-row" style="align-items:center">
            <span>自动播放间隔：</span>
            <div class="interval-dots" style="margin-left:0.5rem">
              <button
                v-for="i in 10"
                :key="i"
                :class="['interval-dot', { selected: i <= (autoPlayIntervalMs / 1000) } ]"
                @click="autoPlayIntervalMs = 1000 + (i-1)*1000"
                :title="(1000 + (i-1)*1000) / 1000 + ' s'"
                :aria-label="'设置自动播放间隔 ' + ((1000 + (i-1)*1000) / 1000) + ' 秒'">
              </button>
            </div>
            <div class="interval-label meta-small" style="margin-left:0.6rem">{{ (autoPlayIntervalMs / 1000) }} s</div>
          </div>
          <p class="hint">点击任意点选择自动播放间隔（1s — 10s）；开启后系统将按间隔自动播放，遇到选项暂停，选择后继续。</p>
          <div class="music-controls" style="margin-top:0.75rem">
            <div class="section-title">音乐控制</div>
            <div class="row" style="gap:0.5rem; margin-top:0.5rem">
              <button class="music-btn" @click="playPrevTrack">上一首</button>
              <button class="music-btn" @click="toggleMusic">{{ isMusicPlaying ? '暂停' : '播放' }}</button>
              <button class="music-btn" @click="playNextTrack">下一首</button>
              <button class="music-btn" @click="triggerMusicFilePicker">添加本地音乐</button>
            </div>
            <div class="modal-row meta-small" style="margin-top:0.5rem">
              当前：{{ playlist.length ? (currentTrackIndex + 1) : 0 }} / {{ playlist.length }}
            </div>
            <div v-if="localTracks.length" class="local-music-list" style="margin-top:0.5rem">
              <div class="section-subtitle">已添加的本地音乐</div>
              <ul>
                <li v-for="(t, i) in localTracks" :key="i" style="display:flex;align-items:center;gap:0.5rem;margin-top:0.25rem">
                  <button class="music-btn" @click="playLocal(i)" title="播放">▶</button>
                  <button class="music-btn" @click="removeLocalTrack(i)" title="删除">✕</button>
                  <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ t.name }}</span>
                </li>
              </ul>
            </div>
            <!-- 隐藏的文件输入（用于选择本地音频） -->
            <input ref="musicInput" type="file" accept="audio/*" style="display:none" @change="onMusicFileSelected" />
          </div>
        </div>
        <div class="modal-actions">
          <button @click="showSettingsModal = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 读档弹窗（3个槽位） -->
    <div v-if="showLoadModal" class="modal-backdrop" @click.self="closeLoadModal">
      <div class="modal-panel save-load-modal">
        <div class="modal-header">
          <h3>选择读档槽位</h3>
          <button class="modal-close" @click="closeLoadModal">×</button>
        </div>
        <div class="slot-list">
          <div v-for="slot in SLOTS" :key="slot" class="slot-card">
            <div class="slot-title">{{ slot.toUpperCase() }}</div>
            <div v-if="slotInfos[slot]">
              <div class="slot-thumb" v-if="(slotInfos[slot].thumbnailData || slotInfos[slot].thumbnail || (slotInfos[slot].game_state && (slotInfos[slot].game_state.thumbnailData || slotInfos[slot].game_state.thumbnail)))">
                <img :src="slotInfos[slot].thumbnailData || slotInfos[slot].thumbnail || (slotInfos[slot].game_state && (slotInfos[slot].game_state.thumbnailData || slotInfos[slot].game_state.thumbnail))" alt="thumb" />
                <div class="thumb-meta">
                  <div class="meta-time">{{ new Date(slotInfos[slot].timestamp || Date.now()).toLocaleString() }}</div>
                </div>
              </div>
              <div class="slot-meta" v-else>
                <div>时间：{{ new Date(slotInfos[slot].timestamp || Date.now()).toLocaleString() }}</div>
              </div>
            </div>
            <div class="slot-meta empty" v-else>空槽位</div>
            <div class="slot-actions">
              <button :disabled="!slotInfos[slot]" @click="loadGame(slot)">读取 {{ slot.toUpperCase() }}</button>
              <button v-if="slotInfos[slot]" @click="deleteGame(slot)" class="delete-btn">删除</button>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button @click="closeLoadModal">关闭</button>
        </div>
      </div>
    </div>

    <!-- 属性模态：两栏属性，无状态栏 -->
    <div v-if="showAttributesModal" class="modal-backdrop" @click.self="closeAttributes">
      <div class="modal-panel attributes-panel">
  <h3>角色信息</h3>

        <div class="attr-status-grid">
          <div class="attr-col">
            <div class="section-title">属性</div>
            <div v-if="Object.keys(attributes).length === 0" class="empty-text">暂无属性</div>
            <ul v-else class="kv-list attr-two-col">
              <li v-for="(val, key) in attributes" :key="key">
                <span class="kv-key">{{ key }}</span>
                <span class="kv-sep">：</span>
                <span class="kv-val">{{ val }}</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- 底部区：将按钮与元信息一起固定在面板底部，元信息保持为最后一行 -->
        <div class="attributes-bottom">
          <div class="modal-row" v-if="isFetchingChoice"><em>正在获取选项后续剧情...</em></div>
          <div class="modal-actions">
            <button @click="saveGame('slot1')">存档到槽1</button>
            <button @click="loadGame('slot1')">从槽1读档</button>
            <button @click="closeAttributes">关闭</button>
          </div>
          <div class="attributes-meta">
            <div class="modal-row meta-small"><strong>作品：</strong> {{ work.title }}</div>
            <div class="modal-row meta-small" v-if="lastSaveInfo"><strong>最后存档：</strong> {{ new Date(lastSaveInfo.timestamp).toLocaleString() }}</div>
          </div>
        </div>
      </div>
    </div>

  <!-- 临时提示（存档/读档/notice） -->
  <div class="toast save-toast" v-if="saveToast">{{ saveToast }}</div>
  <div class="toast load-toast" v-if="loadToast">{{ loadToast }}</div>
  <div class="toast notice-toast" v-if="noticeToast">{{ noticeToast }}</div>
  <!-- 创作者专用：手动打开大纲编辑器按钮（浮动） -->
  <!--
    修复说明：只在创作者身份（isCreatorIdentity）下显示编辑大纲按钮，
    阅读者身份不应该看到此按钮。
  -->

  <button 
    v-if="work.modifiable && work.ai_callable && getChapterStatus(currentChapterIndex) !== 'saved'"
    @click="openOutlineEditorManual()"
    class="creator-outline-btn" 
    title="编辑/生成章节大纲">
    📝 编辑大纲
  </button>
  
  <!-- 创作者在播放后端已生成结局时显示的编辑按钮 -->
  <button
    v-if="work.modifiable && work.ai_callable && isPlayingBackendGeneratedEnding"
    @click="() => openEndingEditor({ _endingIndex: (currentScene && typeof currentScene._endingIndex !== 'undefined' && currentScene._endingIndex !== null) ? Number(currentScene._endingIndex) : ((lastSelectedEndingIndex && lastSelectedEndingIndex.value) ? Number(lastSelectedEndingIndex.value) : null), _endingTitle: (currentScene && currentScene._endingTitle) || (work && work.title) })"
    class="creator-outline-btn"
    title="编辑当前结局的大纲">
    📝 编辑结局大纲
  </button>
  <!-- 创作者专用：当当前章节已由 AI 生成（generated）时，可确认并保存本章，标记为 saved -->
  <button 
    v-if="work.modifiable && work.ai_callable && getChapterStatus(currentChapterIndex) !== 'saved' && !isPlayingBackendGeneratedEnding" 
    @click="persistCurrentChapterEdits({ auto: false, allowSaveGenerated: true })" 
    class="creator-confirm-btn" 
    title="确认并保存本章">
    ✓ 确认保存
  </button>

  <!-- 创作者在播放后端已生成结局时显示的保存按钮 -->
  <button
    v-if="work.modifiable && work.ai_callable && isPlayingBackendGeneratedEnding"
    @click="saveCurrentEnding"
    class="creator-confirm-btn"
    title="保存当前结局">
    ✓ 保存结局
  </button>

  <!-- 创作者大纲编辑器模态（当 createResult.modifiable 且有 chapterOutlines 时显示） -->
  <div v-if="showOutlineEditor" class="modal-backdrop">
      <div class="modal-panel outline-editor-panel">
        <div class="outline-editor-header">
          <h3 class="outline-editor-title">✨ 编辑章节大纲</h3>
          <p class="outline-editor-desc">编辑完成后点击"确认"可以基于此大纲生成章节内容哦~</p>
        </div>

        <div class="outline-editor-body">
          <!-- 左侧：章节大纲（更大文本区） -->
          <div class="outline-left">
            <div class="outline-chapters-container">
              <div v-if="outlineEdits[outlineCurrentPage]" class="outline-chapter-item">
                <div class="chapter-label">📖 第 {{ outlineEdits[outlineCurrentPage].chapterIndex }} 章 大纲</div>
                <textarea 
                  v-model="outlineEdits[outlineCurrentPage].outline" 
                  rows="10" 
                  class="outline-textarea outline-textarea-large" 
                  placeholder="请输入该章节的大纲内容...">
                </textarea>
              </div>
            </div>

            <!-- 分页控制：已移至右侧指令区下方 -->
          </div>

          <!-- 右侧：额外指令 + 操作按钮（紧凑） -->
          <div class="outline-right">
            <div class="outline-prompt-section">
              <div class="chapter-label">💡 指令 (可选)</div>
              <textarea 
                v-model="outlineUserPrompt" 
                rows="8" 
                class="outline-textarea outline-textarea-prompt" 
                placeholder="为本章生成提出您的指令吧...">
              </textarea>
            </div>
            <!-- 分页控制（位于指令输入框下方，取消/确认按钮上方） -->
            <div class="right-pagination">
              <button 
                class="pagination-btn" 
                @click="outlineCurrentPage = Math.max(0, outlineCurrentPage - 1)"
                :disabled="outlineCurrentPage === 0">
                ← 上一章
              </button>
              <span class="pagination-info">{{ outlineCurrentPage + 1 }} / {{ outlineEdits.length }}</span>
              <button 
                class="pagination-btn" 
                @click="outlineCurrentPage = Math.min(outlineEdits.length - 1, outlineCurrentPage + 1)"
                :disabled="outlineCurrentPage === outlineEdits.length - 1">
                下一章 →
              </button>
            </div>

            <div class="outline-editor-actions right-actions">
              <button v-if="editorInvocation !== 'auto'" class="edit-btn btn-cancel" @click="cancelOutlineEdits">取消</button>
              <button 
                class="edit-btn btn-confirm" 
                :disabled="!(editorInvocation === 'auto' || editorInvocation === 'manual' || creatorMode)" 
                @click="confirmOutlineEdits({ startLoading, stopLoading })">
                确认生成
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- 隐藏的文件输入：用于用户替换当前背景图 -->
    <input ref="imgInput" type="file" accept="image/*" style="display:none" @change="onImageSelected" />
  </div>
  
  <!-- 创作者：结局编辑器模态 -->
  <div v-if="endingEditorVisible" class="modal-backdrop">
    <div class="modal-panel outline-editor-panel">
      <div class="outline-editor-header">
        <h3 class="outline-editor-title">✨ 编辑结局大纲</h3>
        <p class="outline-editor-desc">修改结局标题与大纲，提交后会触发结局生成并轮询直到完成哦~</p>
      </div>

      <div class="outline-editor-body">
        <!-- 左侧：结局大纲（更大文本区） -->
        <div class="outline-left">
          <div class="outline-chapters-container">
            <div class="outline-chapter-item">
              <div class="chapter-label">🎬 结局 {{ endingEditorForm.endingIndex || '-' }} 大纲</div>
              <input 
                v-model="endingEditorForm.title" 
                class="outline-textarea outline-title-input" 
                placeholder="结局标题" />
              <textarea 
                v-model="endingEditorForm.outline" 
                rows="10" 
                class="outline-textarea outline-textarea-large" 
                placeholder="结局大纲，例如：你战胜了魔王，成为了王国的英雄...">
              </textarea>
            </div>
          </div>
        </div>

        <!-- 右侧：额外指令 + 操作按钮（紧凑） -->
        <div class="outline-right">
          <div class="outline-prompt-section">
            <div class="chapter-label">💡 指令 (可选)</div>
            <textarea 
              v-model="endingEditorForm.userPrompt" 
              rows="8" 
              class="outline-textarea outline-textarea-prompt" 
              placeholder="例如：请让结局更悲壮一些">
            </textarea>
          </div>

          <div class="outline-editor-actions right-actions">
            <button class="edit-btn btn-cancel" @click="cancelEndingEditor">取消</button>
            <button class="edit-btn btn-confirm" :disabled="endingEditorBusy" @click="submitEndingEditor">提交并生成</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
