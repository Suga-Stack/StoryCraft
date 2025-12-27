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
  let saveEnding = storyService.saveEnding

  // 故事场景数据
  const storyScenes = ref([])
  // 音乐播放列表（由后端作品详情返回）
  const musicPlaylist = ref([])
  const currentSceneIndex = ref(0)
  const currentDialogueIndex = ref(0)
  const currentChapterIndex = ref(1)
  const totalChapters = ref(null)
  const lastSeq = ref(0)
  const storyEndSignaled = ref(false)
  const isFetchingNext = ref(false)
  const isGeneratingSettlement = ref(false)
  // 记录后端返回并被选中的结局索引（1-based），用于存档/读档定位
  const lastSelectedEndingIndex = ref(null)

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

    if (typeof item === 'object') {
      const text = item.text ?? item.narration ?? ''
      const result = { text }
      if (item.backgroundImage) result.backgroundImage = item.backgroundImage
      if (item.speaker) result.speaker = item.speaker
      return result
    }
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
    return item && typeof item.speaker === 'string' && item.speaker.trim()
      ? item.speaker.trim()
      : ''
  })

  // 辅助方法
  const getChapterStatus = (chapterIdx) => {
    try {
      const found = (chaptersStatus.value || []).find(
        (x) => Number(x.chapterIndex) === Number(chapterIdx)
      )
      return found ? found.status || null : null
    } catch (e) {
      return null
    }
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
      const url = `/api/gameworks/gameworks/${encodeURIComponent(workId)}/`
      const resp = await http.get(url)
      const body = resp.data || resp

      const mergeServerStatuses = (serverList) => {
        try {
          const server = Array.isArray(serverList) ? serverList : []
          const local = Array.isArray(chaptersStatus.value) ? chaptersStatus.value : []
          const map = new Map()
          server
            .forEach((s) => map.set(Number(s.chapterIndex), Object.assign({}, s)))(local || [])
            .forEach((l) => {
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
          try {
            chaptersStatus.value = serverList
          } catch (err) {}
        }
      }

      if (body && body.data && Array.isArray(body.data.chapters_status)) {
        mergeServerStatuses(body.data.chapters_status)
        // 如果后端在作品详情中返回了音乐列表，尝试提取
        try {
          const musicCandidates =
            body.data.music ||
            body.data.music_playlist ||
            body.data.musicUrls ||
            body.data.music_urls ||
            body.data.musicList ||
            body.data.music_list ||
            body.data.background_music_urls ||
            body.data.backgroundMusicUrls ||
            body.data.backgroundMusic ||
            body.data.background_music
          if (Array.isArray(musicCandidates) && musicCandidates.length > 0) {
            const normalizeMusicUrl = (u) => {
              try {
                if (!u || typeof u !== 'string') return null
                const base =
                  import.meta && import.meta.env && import.meta.env.VITE_API_BASE_URL
                    ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, '')
                    : ''
                // 如果后端返回的是以后端基址开头的绝对 URL，则改为相对路径，便于本地 dev proxy 转发
                if (base && u.startsWith(base)) {
                  try {
                    const urlObj = new URL(u)
                    return urlObj.pathname + (urlObj.search || '')
                  } catch (e) {
                    // 回退：移除 base 前缀
                    return u.slice(base.length) || u
                  }
                }
                return u
              } catch (e) {
                return u
              }
            }
            musicPlaylist.value = musicCandidates
              .map((m) => {
                const raw = m && typeof m === 'string' ? m : m && m.url ? m.url : null
                return normalizeMusicUrl(raw)
              })
              .filter(Boolean)
          }
        } catch (e) {
          /* ignore */
        }
        // 将后端可能返回的可编辑与 AI 可调用标志写入共享 work
        try {
          if (typeof body.data.modifiable !== 'undefined')
            work.value.modifiable = !!body.data.modifiable
          if (typeof body.data.ai_callable !== 'undefined')
            work.value.ai_callable = !!body.data.ai_callable
        } catch (e) {}
        return body.data
      }
      if (body && Array.isArray(body.chapters_status)) {
        mergeServerStatuses(body.chapters_status)
        try {
          const musicCandidates =
            body.music ||
            body.music_playlist ||
            body.musicUrls ||
            body.music_urls ||
            body.musicList ||
            body.music_list ||
            body.background_music_urls ||
            body.backgroundMusicUrls ||
            body.backgroundMusic ||
            body.background_music
          if (Array.isArray(musicCandidates) && musicCandidates.length > 0) {
            const normalizeMusicUrl = (u) => {
              try {
                if (!u || typeof u !== 'string') return null
                const base =
                  import.meta && import.meta.env && import.meta.env.VITE_API_BASE_URL
                    ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, '')
                    : ''
                if (base && u.startsWith(base)) {
                  try {
                    const urlObj = new URL(u)
                    return urlObj.pathname + (urlObj.search || '')
                  } catch (e) {
                    return u.slice(base.length) || u
                  }
                }
                return u
              } catch (e) {
                return u
              }
            }
            musicPlaylist.value = musicCandidates
              .map((m) => {
                const raw = m && typeof m === 'string' ? m : m && m.url ? m.url : null
                return normalizeMusicUrl(raw)
              })
              .filter(Boolean)
          }
        } catch (e) {
          /* ignore */
        }
        // 将后端可能返回的可编辑与 AI 可调用标志写入共享 work
        try {
          if (typeof body.modifiable !== 'undefined') work.value.modifiable = !!body.modifiable
          if (typeof body.ai_callable !== 'undefined') work.value.ai_callable = !!body.ai_callable
        } catch (e) {}
        return body
      }
      // 兜底：从 body 顶层或 body.data 中尝试提取音乐列表
      try {
        const musicCandidates =
          (body &&
            (body.music ||
              body.music_playlist ||
              body.musicUrls ||
              body.music_urls ||
              body.musicList ||
              body.music_list ||
              body.background_music_urls ||
              body.backgroundMusicUrls ||
              body.backgroundMusic ||
              body.background_music)) ||
          (body &&
            body.data &&
            (body.data.music ||
              body.data.music_playlist ||
              body.data.musicUrls ||
              body.data.music_urls ||
              body.data.musicList ||
              body.data.music_list ||
              body.data.background_music_urls ||
              body.data.backgroundMusicUrls ||
              body.data.backgroundMusic ||
              body.data.background_music))
        if (Array.isArray(musicCandidates) && musicCandidates.length > 0) {
          const normalizeMusicUrl = (u) => {
            try {
              if (!u || typeof u !== 'string') return null
              const base =
                import.meta && import.meta.env && import.meta.env.VITE_API_BASE_URL
                  ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, '')
                  : ''
              if (base && u.startsWith(base)) {
                try {
                  const urlObj = new URL(u)
                  return urlObj.pathname + (urlObj.search || '')
                } catch (e) {
                  return u.slice(base.length) || u
                }
              }
              return u
            } catch (e) {
              return u
            }
          }
          musicPlaylist.value = musicCandidates
            .map((m) => {
              const raw = m && typeof m === 'string' ? m : m && m.url ? m.url : null
              return normalizeMusicUrl(raw)
            })
            .filter(Boolean)
        }
      } catch (e) {}
      // 兜底：将可能存在的 modifiable/ai_callable 写入 shared work
      try {
        const src = body && body.data ? body.data : body
        if (src) {
          if (typeof src.modifiable !== 'undefined') work.value.modifiable = !!src.modifiable
          if (typeof src.ai_callable !== 'undefined') work.value.ai_callable = !!src.ai_callable
        }
      } catch (e) {}
      return body && body.data ? body.data : body
    } catch (e) {
      console.warn('getWorkDetails failed', e)
      return null
    }
  }

  const pollWorkStatus = async (
    workId,
    targetChapter,
    opts = { interval: 1500, timeout: 600000 }
  ) => {
    const start = Date.now()
    const interval = opts && opts.interval ? opts.interval : 1500
    // If timeout is provided and > 0 use it; if timeout === 0 or < 0 treat as infinite (no timeout)
    const timeout = opts && typeof opts.timeout === 'number' ? opts.timeout : 600000 // 默认10分钟（600秒）
    while (true) {
      try {
        const data = await getWorkDetails(workId)
        const cs =
          data && Array.isArray(data.chapters_status)
            ? data.chapters_status.find((x) => Number(x.chapterIndex) === Number(targetChapter))
            : null
        const status = cs ? cs.status : null
        if (Array.isArray(data?.chapters_status)) chaptersStatus.value = data.chapters_status
        if (status === 'generated' || status === 'saved') return status
      } catch (e) {}
      // Only enforce timeout if timeout > 0
      if (timeout > 0 && Date.now() - start > timeout) throw new Error('pollWorkStatus timeout')
      await new Promise((r) => setTimeout(r, interval))
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

      const id =
        raw.id ?? raw.sceneId ?? (raw.seq ? `seq-${raw.seq}` : Math.floor(Math.random() * 1000000))
      const backgroundImage =
        raw && raw.backgroundImage ? raw.backgroundImage : raw && (raw.bg || '')

      const dialogues = []
      let extractedChoices = null
      let hasExtractedChoices = false

      for (let i = 0; i < (raw.dialogues || []).length; i++) {
        const d = raw.dialogues[i]
        if (typeof d === 'string') {
          dialogues.push(d)
        } else if (d && typeof d === 'object') {
          const narration = d.narration ?? d.text ?? ''
          const item = { text: narration }
          if (d.backgroundImage) item.backgroundImage = d.backgroundImage
          if (d.speaker) item.speaker = d.speaker

          if (
            !hasExtractedChoices &&
            Array.isArray(d.playerChoices) &&
            d.playerChoices.length > 0
          ) {
            // 触发索引应该是当前对话在 dialogues 数组中的位置
            const choiceDialogueIndex = dialogues.length
            const pcs = d.playerChoices.map((c, idx) => {
              console.log(`[pushSceneFromServer] 处理选项 ${idx}:`, c)
              console.log(`[pushSceneFromServer] - attributesDelta:`, c.attributesDelta)
              console.log(`[pushSceneFromServer] - statusesDelta:`, c.statusesDelta)
              return {
                id: c.id ?? c.choiceId ?? `${id}-${i}-${idx}`,
                choiceId: c.choiceId ?? c.id ?? idx + 1,
                text: c.text ?? '',
                attributesDelta: c.attributesDelta ?? {},
                statusesDelta: c.statusesDelta ?? {},
                statuses: c.statuses ?? {},
                subsequentDialogues: c.subsequentDialogues ?? []
              }
            })
            extractedChoices = { index: choiceDialogueIndex, choices: pcs }
            hasExtractedChoices = true
            console.log('[pushSceneFromServer] 提取选项:', {
              originalDialogueIndex: i,
              choiceTriggerIndex: choiceDialogueIndex,
              choicesCount: pcs.length,
              dialoguesLengthBefore: dialogues.length,
              extractedChoices: pcs
            })
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
        isChapterEnding: raw.isChapterEnding ?? raw.chapterEnd ?? false,
        choiceConsumed: false,
        chosenChoiceId: null
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
          choicesCount: scene.choices.length,
          dialoguesCount: scene.dialogues.length,
          // 打印触发句的内容以便调试
          triggerDialogue: scene.dialogues[scene.choiceTriggerIndex],
          // 打印完整的选项数据以便调试
          choices: scene.choices.map((c) => ({
            id: c.id,
            text: c.text,
            hasAttributesDelta: !!c.attributesDelta && Object.keys(c.attributesDelta).length > 0,
            hasStatusesDelta: !!c.statusesDelta && Object.keys(c.statusesDelta).length > 0,
            attributesDelta: c.attributesDelta,
            statusesDelta: c.statusesDelta
          }))
        })
      }
      // 否则,如果场景级别有 choices,使用场景级别的选项(向后兼容)
      else if (Array.isArray(raw.choices) && raw.choices.length > 0) {
        scene.choices = raw.choices.map((c, idx) => ({
          id: c.id ?? c.choiceId ?? `${id}-c-${idx}`,
          choiceId: c.choiceId ?? c.id ?? idx + 1,
          text: c.text ?? '',
          attributesDelta: c.attributesDelta ?? {},
          statusesDelta: c.statusesDelta ?? {},
          subsequentDialogues: c.subsequentDialogues ?? []
        }))
        scene.choiceTriggerIndex =
          typeof raw.choiceTriggerIndex === 'number'
            ? raw.choiceTriggerIndex
            : scene.dialogues.length - 1
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
        console.log(
          '[pushSceneFromServer] Pushing scene:',
          toPush.id,
          'Total scenes before push:',
          storyScenes.value.length
        )
        storyScenes.value.push(toPush)
        console.log('[pushSceneFromServer] Total scenes after push:', storyScenes.value.length)
      } catch (e) {
        console.warn('[pushSceneFromServer] deepClone failed, using fallback')
        try {
          storyScenes.value.push(scene)
        } catch (err) {
          console.warn('pushSceneFromServer push failed', err)
        }
      }
    } catch (e) {
      console.warn('pushSceneFromServer failed', e)
    }
  }
  const fetchNextChapter = async (workId, chapterIndex = null, opts = { replace: true }) => {
    try {
      if (!workId) workId = work.value.id
      // 计算希望请求的章节索引（1-based）
      let idx = Number(chapterIndex) || null
      if (!idx || idx <= 0) idx = currentChapterIndex.value || 1

      console.log(`[fetchNextChapter] 开始获取第 ${idx} 章内容...`)

      // 如果当前已有其他章节的获取正在进行，忽略对不同章节的并发请求，避免覆盖/回退场景数据
      if (currentFetchingChapter !== null && Number(currentFetchingChapter) !== Number(idx)) {
        console.warn(
          `[fetchNextChapter] 已在获取第 ${currentFetchingChapter} 章，忽略对第 ${idx} 章的请求以避免冲突`
        )
        return null
      }
      // 标记当前正在获取的章节，和全局 isFetchingNext
      currentFetchingChapter = Number(idx)
      try {
        isFetchingNext.value = true
      } catch (e) {}

      // 对于创作者身份，在加载新章节前检查上一章是否已保存
      if (_creatorFeatureEnabled?.value && idx > 1) {
        try {
          await getWorkDetails(workId)
          const prevChapterStatus = getChapterStatus(idx - 1)
          console.log(`[fetchNextChapter] 检查上一章 ${idx - 1} 的状态:`, prevChapterStatus)

          if (prevChapterStatus !== 'saved') {
            console.warn(
              `[fetchNextChapter] 上一章 ${idx - 1} 状态为 ${prevChapterStatus}，阻止加载第 ${idx} 章`
            )
            if (_showToast) _showToast(`第 ${idx - 1} 章尚未保存`, 1000)
            // 不抛出异常，只是返回 null，让调用方知道加载被阻止
            return null
          }
        } catch (e) {
          console.warn('[fetchNextChapter] 检查上一章状态失败:', e)
        }
      }

      // 若后端/创建页标记允许创作功能（creatorFeatureEnabled），则在每一章加载前弹出大纲编辑器供创作者确认/修改后再真正请求章节内容
      // 注意：menu 中的 creatorMode 仍然负责页面内手动编辑权限；这里的 creatorFeatureEnabled 用于在进入每章前自动弹出可编辑大纲
      // 但如果调用时传递了 suppressAutoEditor: true，则跳过自动编辑器
      if (_creatorFeatureEnabled?.value && !(opts && opts.suppressAutoEditor)) {
        try {
          // Only auto-open outline editor when chapter is not yet generated (not_generated or unknown)
          const chapterStatus = getChapterStatus(idx)
          if (!chapterStatus || chapterStatus === 'not_generated') {
            let rawOutlines = []
            try {
              console.log('[fetchNextChapter] 从后端获取最新大纲数据')
              const workDetailsData = await getWorkDetails(work.value.id)
              if (workDetailsData) {
                // 从后端返回的数据中提取大纲
                if (
                  Array.isArray(workDetailsData.outlines) &&
                  workDetailsData.outlines.length > 0
                ) {
                  rawOutlines = workDetailsData.outlines
                } else if (
                  workDetailsData.data &&
                  Array.isArray(workDetailsData.data.outlines) &&
                  workDetailsData.data.outlines.length > 0
                ) {
                  rawOutlines = workDetailsData.data.outlines
                }
              }
              console.log('[fetchNextChapter] 已从后端加载大纲数据，共', rawOutlines.length, '章')
            } catch (e) {
              console.warn('[fetchNextChapter] 从后端获取大纲失败:', e)
              rawOutlines = []
            }

            // 展示从当前请求章节 idx 到末章的所有大纲供编辑（若后端未返回则合成到 total_chapters）
            // 构建一个基于 chapterIndex 的映射，避免当 rawOutlines 是从某章截取或不包含完整序列时发生后移或提前的问题
            const outlinesMap = {}
            let maxIdx = 0
            if (Array.isArray(rawOutlines)) {
              for (let i = 0; i < rawOutlines.length; i++) {
                const ch = rawOutlines[i]

                if (ch && typeof ch.endingIndex !== 'undefined') {
                  continue
                }

                let ci = null
                try {
                  if (ch && typeof ch.chapterIndex !== 'undefined') ci = Number(ch.chapterIndex)
                  else if (ch && typeof ch.chapter_index !== 'undefined')
                    ci = Number(ch.chapter_index)
                  else ci = i + 1
                } catch (e) {
                  ci = i + 1
                }
                // 合并标题与大纲正文：title + 空行 + outline/summary
                try {
                  const title = (ch && (ch.title ?? ch.chapter_title)) || ''
                  const body = (ch && (ch.outline ?? ch.summary)) || ''
                  outlinesMap[ci] =
                    title && body ? `${title}\n\n${body}` : title || body || JSON.stringify(ch)
                } catch (e) {
                  outlinesMap[ci] = JSON.stringify(ch)
                }
                if (ci > maxIdx) maxIdx = ci
              }
            }
            const total = Math.max(Number(totalChapters.value) || 5, maxIdx)
            if (_outlineEdits) {
              _outlineEdits.value = []
              for (let j = idx; j <= total; j++) {
                if (typeof outlinesMap[j] !== 'undefined') {
                  _outlineEdits.value.push({ chapterIndex: j, outline: outlinesMap[j] })
                } else {
                  _outlineEdits.value.push({
                    chapterIndex: j,
                    outline: `第${j}章：请在此编辑/补充本章大纲以指导生成。`
                  })
                }
              }
            }
            // 清空 userPrompt（不再从缓存读取）
            if (_outlineUserPrompt) {
              _outlineUserPrompt.value = ''
            }
          } else {
            // chapter already generating/generated/saved => skip auto editor
            if (_outlineEdits) _outlineEdits.value = []
            if (_outlineUserPrompt) _outlineUserPrompt.value = ''
          }
        } catch (e) {
          console.warn('[fetchNextChapter] 准备大纲数据失败:', e)
          if (_outlineEdits) {
            _outlineEdits.value = [
              { chapterIndex: idx, outline: `第${idx}章：请在此编辑/补充本章大纲以指导生成。` }
            ]
          }
          if (_outlineUserPrompt) _outlineUserPrompt.value = ''
        }

        // 自动触发的编辑器（章节前弹出）应以 auto 模式打开，允许编辑并生成（仅当章节未生成时）
        if (_editorInvocation) _editorInvocation.value = 'auto'
        // 记录原始大纲快照（用于取消时按原始大纲生成）
        if (_originalOutlineSnapshot && _outlineEdits) {
          try {
            _originalOutlineSnapshot.value = JSON.parse(JSON.stringify(_outlineEdits.value || []))
          } catch (e) {
            _originalOutlineSnapshot.value = (_outlineEdits.value || []).slice()
          }
        }

        // 检查章节状态，只有 not_generated 时才弹出编辑器
        const chapterStatus = getChapterStatus(idx)
        if (!chapterStatus || chapterStatus === 'not_generated') {
          // 标记 pending target 为当前自动弹出的章节
          if (_pendingOutlineTargetChapter) _pendingOutlineTargetChapter.value = idx
          if (_showOutlineEditor) {
            console.log(
              '[useStoryAPI] 打开大纲编辑器: reason=chapter-not-generated (auto), targetChapter=',
              idx
            )
            _showOutlineEditor.value = true
          }
          const confirmed = await new Promise((resolve) => {
            if (_outlineEditorResolver) _outlineEditorResolver = resolve
          })

          if (confirmed) {
            // confirmOutlineEdits 已经处理了所有逻辑（包括显示加载界面、生成章节、轮询、加载内容）
            return null
          } else {
            // 用户取消了，不生成章节
            return null
          }
        } else {
          // 章节已经生成或正在生成中，直接跳过编辑器，只加载内容
          console.log(`[fetchNextChapter] 章节 ${idx} 状态为 ${chapterStatus}，跳过编辑器直接加载`)
        }
      }

      let data = null

      // 在真正发起请求前：清空本地缓存的场景，保留选择历史。
      // 这样在加载新章节过程中不会跳回旧章节内容（例如 websocket 推送或旧场景残留）。
      try {
        if (Array.isArray(storyScenes.value) && storyScenes.value.length > 0) {
          console.log(`[fetchNextChapter] 清空本地缓存场景以等待第 ${idx} 章加载 (保留选择历史)`)
          storyScenes.value = []
        }
        // 重置播放位置到等待新章节的起点
        currentSceneIndex.value = 0
        currentDialogueIndex.value = 0
        // 标记正在获取下一章，外部 UI/逻辑可以用此标记阻止跳转
        isFetchingNext.value = true
      } catch (e) {
        console.warn('[fetchNextChapter] 在清理本地场景时发生错误', e)
      }
      if (opts && opts.singleRequest) {
        // 只进行一次 GET 请求，避免 getScenes 的重试逻辑在已经由 generate POST 发起生成后再次触发不必要的行为
        try {
          // 注意：utils/http.js 已经配置了 baseURL='/api'，此处不要再加 '/api' 前缀，避免出现 '/api/api/...'
          const resp = await http.get(`/api/game/chapter/${workId}/${idx}/`)
          // 规范化响应：优先使用 resp.data（Axios 返回的实际 payload），否则使用 resp
          data = resp && typeof resp === 'object' && 'data' in resp ? resp.data : resp
          console.log('[fetchNextChapter] singleRequest response:', data)

          // 验证返回的数据格式
          if (!data) {
            console.error('[fetchNextChapter] singleRequest 返回空数据')
            throw new Error('后端返回空数据')
          }

          const status = data.status || (data.chapter && data.chapter.status)
          if (status === 'generating' || status === 'pending' || data.generating === true) {
            console.log('[fetchNextChapter] singleRequest 返回生成中状态，将进入轮询逻辑:', status)
            // 不抛出错误，让 data 保持当前值，继续执行到后面的轮询分支
          } else {
            // 只有当状态不是 generating/pending 时，才检查是否有场景数据
            const hasScenes =
              (data.chapter &&
                Array.isArray(data.chapter.scenes) &&
                data.chapter.scenes.length > 0) ||
              (Array.isArray(data.scenes) && data.scenes.length > 0)

            if (!hasScenes) {
              console.error('[fetchNextChapter] singleRequest 返回数据中没有场景:', data)
              throw new Error('后端返回数据中没有场景内容')
            }
          }
        } catch (e) {
          console.error('[fetchNextChapter] singleRequest http.get failed', e)
          throw e
        }
      } else {
        data = await getScenes(workId, idx, {
          onProgress: (progress) => {
            // 进度回调：仅用于记录或触发完成事件，不直接修改全局 loadingProgress（由 useGameState 的计时器统一控制）
            try {
              console.log(`[Story] 章节 ${idx} 生成进度:`, progress)
              // 如果后端明确返回完成状态，可以在这里做记录或触发事件
              // 但不要直接修改 _loadingProgress（以确保所有进度条遵循统一的 5 分钟匀速策略）
            } catch (e) {
              console.warn('onProgress handler error', e)
            }
          }
        })
      }

      console.log(`[fetchNextChapter] getScenes返回数据:`, data)
      console.log(`[fetchNextChapter] 数据类型检查:`, {
        data: typeof data,
        dataIsObject: data && typeof data === 'object',
        hasScenes: data && 'scenes' in data,
        scenesType: data && data.scenes ? typeof data.scenes : 'undefined',
        scenesIsArray: data && Array.isArray(data.scenes),
        scenesLength: data && data.scenes ? data.scenes.length : 'undefined'
      })

      // 支持多种后端返回格式：
      // - 传统 polling 接口返回 { status: 'generating'|'ready', chapter: { chapterIndex, title, scenes } }
      // - 旧版或兼容格式可能直接返回 { scenes: [...] } 或 { generating: true }
      if (
        data &&
        (data.generating === true || data.status === 'generating' || data.status === 'pending')
      ) {
        console.log(`[fetchNextChapter] 后端返回生成中状态`, data)
        // 后端正在生成：改为轮询作品章节状态直到目标章节为 'generated' 或 'saved'，然后再真正去拉取章节内容。
        try {
          console.log(`[fetchNextChapter] 开始轮询章节 ${idx} 状态，直到 generated...`)
          // 使用无限超时（timeout=0）以一直等待，除非调用方传入特定 timeout
          await pollWorkStatus(workId, idx, { interval: 1500, timeout: 0 })
          console.log(`[fetchNextChapter] 章节 ${idx} 已标记为 generated/saved，重新请求 scenes`)
          // 重新请求章节内容（单次请求以避开 getScenes 的内部重试行为）
          try {
            const resp = await http.get(`/api/game/chapter/${workId}/${idx}/`)
            data = resp && typeof resp === 'object' && 'data' in resp ? resp.data : resp
            console.log('[fetchNextChapter] poll后 singleRequest response:', data)

            const status = data.status || (data.chapter && data.chapter.status)
            const hasValidScenes =
              (data.chapter &&
                Array.isArray(data.chapter.scenes) &&
                data.chapter.scenes.length > 0) ||
              (Array.isArray(data.scenes) && data.scenes.length > 0)
            const isReady = status === 'ready'

            // 如果状态不是 ready 或没有场景数据，继续等待
            if (!isReady || !hasValidScenes) {
              console.warn(
                '[fetchNextChapter] 轮询完成但数据不完整 - 状态:',
                status,
                '有场景:',
                hasValidScenes
              )

              // 如果仍在生成中，抛出错误让外层保持加载状态
              if (status === 'generating' || status === 'pending') {
                throw new Error(`章节仍在生成中，状态: ${status}`)
              }

              // 否则等待额外时间后重试
              console.log('[fetchNextChapter] 等待2秒后重试获取章节数据')
              await new Promise((r) => setTimeout(r, 2000))
              const retryResp = await http.get(`/api/game/chapter/${workId}/${idx}/`)
              data =
                retryResp && typeof retryResp === 'object' && 'data' in retryResp
                  ? retryResp.data
                  : retryResp
              console.log('[fetchNextChapter] 延迟重试后的 response:', data)

              // 再次验证重试后的数据
              const retryStatus = data.status || (data.chapter && data.chapter.status)
              const retryHasScenes =
                (data.chapter &&
                  Array.isArray(data.chapter.scenes) &&
                  data.chapter.scenes.length > 0) ||
                (Array.isArray(data.scenes) && data.scenes.length > 0)

              if (retryStatus !== 'ready' || !retryHasScenes) {
                console.error(
                  '[fetchNextChapter] 重试后数据仍不完整 - 状态:',
                  retryStatus,
                  '有场景:',
                  retryHasScenes
                )
                throw new Error(`章节数据不完整，状态: ${retryStatus}`)
              }
            }

            console.log(
              '[fetchNextChapter] ✓ 数据验证通过 - 状态:',
              status,
              '场景数:',
              data.chapter?.scenes?.length || data.scenes?.length
            )
          } catch (e) {
            console.warn('[fetchNextChapter] poll后请求章节失败，回退使用 getScenes()', e)
            data = await getScenes(workId, idx, {
              onProgress: (progress) => {
                try {
                  console.log(`[Story] 章节 ${idx} 生成进度 (post-poll):`, progress)
                } catch (e) {}
              }
            })
          }
        } catch (pollErr) {
          console.warn(
            '[fetchNextChapter] pollWorkStatus 出错或超时，返回当前数据以便调用方处理',
            pollErr
          )
          return data
        }
      }

      // 规范化 scenes 来源：
      // - 优先支持结局格式：{ endings: [ { title, summary, scenes: [...] }, ... ] }
      //   我们只解析第一个 ending 并将其 scenes 推入 storyScenes，同时标记为结局。
      // - 否则使用 data.chapter.scenes（新接口）或 data.scenes（兼容）
      let scenesArray = null
      if (data && Array.isArray(data.endings) && data.endings.length > 0) {
        // 支持多个 endings，根据属性/状态条件选择合适的一个
        const evaluateCondition = (condition = {}, attrsRef, statusesRef) => {
          try {
            if (!condition || Object.keys(condition).length === 0) return true
            const attrs = attrsRef && attrsRef.value ? attrsRef.value : attrsRef || {}
            const statuses =
              statusesRef && statusesRef.value ? statusesRef.value : statusesRef || {}

            for (const [key, expr] of Object.entries(condition)) {
              // 优先从 attributes 中读取其值，否则从 statuses 中读取
              const raw =
                attrs && key in attrs
                  ? attrs[key]
                  : statuses && key in statuses
                    ? statuses[key]
                    : undefined
              const actualRaw = raw
              const actual = Number(actualRaw)

              if (typeof expr === 'number') {
                if (Number.isNaN(actual) || actual !== expr) return false
                continue
              }

              if (typeof expr === 'string') {
                const trimmed = expr.trim()
                const m = trimmed.match(/^(>=|<=|>|<|==|=)\s*(-?\d+(?:\.\d+)?)$/)
                if (m) {
                  const op = m[1]
                  const num = Number(m[2])
                  if (Number.isNaN(actual)) return false
                  switch (op) {
                    case '>':
                      if (!(actual > num)) return false
                      break
                    case '<':
                      if (!(actual < num)) return false
                      break
                    case '>=':
                      if (!(actual >= num)) return false
                      break
                    case '<=':
                      if (!(actual <= num)) return false
                      break
                    case '==':
                      if (!(actual == num)) return false
                      break
                    case '=':
                      if (!(actual == num)) return false
                      break
                    default:
                      return false
                  }
                  continue
                }

                if (String(actualRaw) !== trimmed) return false
                continue
              }

              if (actualRaw !== expr) return false
            }
            return true
          } catch (e) {
            console.warn('evaluateCondition error', e)
            return false
          }
        }

        const pickEnding = (endingsArray, attrsRef, statusesRef) => {
          if (!Array.isArray(endingsArray)) return null
          for (const e of endingsArray) {
            const cond = e?.condition || {}
            if (evaluateCondition(cond, attrsRef, statusesRef)) return e
          }
          // 如果没有匹配任意条件，回退到第一个结局（兼容旧行为）
          return endingsArray[0] || null
        }

        const chosen = pickEnding(data.endings, _attributes, _statuses)
        if (chosen && Array.isArray(chosen.scenes) && chosen.scenes.length > 0) {
          try {
            // 优先使用后端显式提供的 `endingIndex` 值（与后端保持一致）
            if (
              typeof chosen.endingIndex === 'number' ||
              (chosen.endingIndex != null && !isNaN(Number(chosen.endingIndex)))
            ) {
              lastSelectedEndingIndex.value = Number(chosen.endingIndex)
            } else {
              // 回退：记录 chosen 在原始列表中的索引（1-based），若找不到则置为1
              const idx = Array.isArray(data.endings)
                ? data.endings.findIndex((e) => e === chosen)
                : -1
              lastSelectedEndingIndex.value = idx >= 0 ? idx + 1 : 1
            }
          } catch (e) {
            lastSelectedEndingIndex.value = 1
          }
          scenesArray = chosen.scenes.map((s) => {
            try {
              if (!s || typeof s !== 'object') return s
              const out = Object.assign({}, s)
              // 将后端的 endingIndex（若存在）挂到场景上，便于调试与兼容性检查
              if (chosen && chosen.endingIndex != null) out.endingIndex = chosen.endingIndex
              out.isEnding = true
              out.endingTitle = chosen.title || null
              out.endingSummary = chosen.summary || null
              return out
            } catch (e) {
              return s
            }
          })
          storyEndSignaled.value = true
          console.log('[fetchNextChapter] Selected ending:', chosen.title)
        } else {
          scenesArray = null
        }
      } else {
        scenesArray =
          data && data.chapter && Array.isArray(data.chapter.scenes)
            ? data.chapter.scenes
            : data && Array.isArray(data.scenes)
              ? data.scenes
              : null
      }
      console.log(
        `[fetchNextChapter] 检查scenes: data=${!!data}, scenesLength=${scenesArray ? scenesArray.length : 'null'}`
      )
      if (scenesArray && scenesArray.length > 0) {
        console.log(
          '[fetchNextChapter] Processing scenes:',
          scenesArray.length,
          'opts.replace=',
          opts && opts.replace
        )

        // 当检测到这是后端返回的结局（storyEndSignaled=true 且后端提供 endings 列表）时，
        // 按照新规则：将用户选择并进入的结局覆盖掉“前一章”的缓存场景（chapter idx-1），而不是追加到最后。
        const isEndingResponse = storyEndSignaled.value === true && Array.isArray(data?.endings)
        if (isEndingResponse) {
          const replaceChapter = Number(idx) > 1 ? Number(idx) - 1 : Number(idx)
          console.log(
            '[fetchNextChapter] Ending response detected — will replace chapter',
            replaceChapter
          )

          // 在现有 storyScenes 中查找属于 replaceChapter 的连续区间
          const firstIndex = storyScenes.value.findIndex(
            (s) => Number(s.chapterIndex) === replaceChapter
          )
          if (firstIndex >= 0) {
            let lastIndex = firstIndex
            for (let i = firstIndex; i < storyScenes.value.length; i++) {
              if (Number(storyScenes.value[i].chapterIndex) === replaceChapter) lastIndex = i
              else break
            }

            const before = storyScenes.value.slice(0, firstIndex)
            const after = storyScenes.value.slice(lastIndex + 1)

            // 用前段 + 结局 scenes + 后段 重建 storyScenes
            storyScenes.value = before.slice()
            for (const sc of scenesArray) {
              try {
                pushSceneFromServer(sc)
              } catch (e) {
                console.warn('pushSceneFromServer failed for one ending entry', e)
              }
            }
            for (const s of after) {
              try {
                storyScenes.value.push(s)
              } catch (e) {
                console.warn('re-append after segment failed', e)
              }
            }

            // 将播放位置指向被覆盖章节的开头
            currentChapterIndex.value = replaceChapter
            currentSceneIndex.value = storyScenes.value.findIndex(
              (s) => Number(s.chapterIndex) === replaceChapter
            )
            if (currentSceneIndex.value < 0) currentSceneIndex.value = 0
            currentDialogueIndex.value = 0

            console.log(
              '[fetchNextChapter] 已用结局覆盖前一章缓存，新的 scene count=',
              storyScenes.value.length
            )
          } else {
            // 未找到对应章节，回退为覆盖全部场景（兼容）
            console.log('[fetchNextChapter] 未找到要替换的章节，回退为覆盖全部场景')
            storyScenes.value = []
            for (const sc of scenesArray) {
              try {
                pushSceneFromServer(sc)
              } catch (e) {
                console.warn('pushSceneFromServer failed for one entry', e)
              }
            }
            currentSceneIndex.value = 0
            currentDialogueIndex.value = 0
            currentChapterIndex.value = idx
          }
        } else {
          // 非结局场景：保持原本的覆盖当前章节行为
          storyScenes.value = []
          for (const sc of scenesArray) {
            try {
              pushSceneFromServer(sc)
            } catch (e) {
              console.warn('pushSceneFromServer failed for one entry', e)
            }
          }
          currentSceneIndex.value = 0
          currentDialogueIndex.value = 0
          currentChapterIndex.value = idx
          console.log(`[Story] 成功加载第 ${idx} 章，场景数=${scenesArray.length}`)
        }

        // 如果我们已请求了超出 totalChapters 的章节（totalChapters 可用），视为已到结尾并不再继续请求下一章。
        // 注意：不要在请求到等于 totalChapters 时立即标记结束 —— 只有在请求超出范围或后端显式返回 end 时才认为结束。
        if (totalChapters.value && idx > Number(totalChapters.value)) {
          storyEndSignaled.value = true
        }

        // 新章节已完成加载，清除加载标记
        try {
          isFetchingNext.value = false
        } catch (e) {}

        return data
      } else {
        console.error(`[Story] 第 ${idx} 章返回空场景数据`, data)
        throw new Error(`第 ${idx} 章没有可用的场景数据`)
      }
    } catch (e) {
      console.error('fetchNextChapter error', e)
      throw e // 重新抛出错误以便调用方处理
    } finally {
      // 确保无论成功或失败都会清理状态
      try {
        isFetchingNext.value = false
      } catch (err) {}
      currentFetchingChapter = null
    }
  }
  const fetchNextContent = async (workId, chapterIndex) => {
    try {
      console.log('[Story] fetchNextContent chapter =', chapterIndex)
      const resp = await getScenes(workId, chapterIndex)
      if (!resp) return null
      if (resp.generating) return { generating: true, end: false, scenes: [] }

      const isEnd = resp.end === true || resp.isGameEnding === true || resp.isGameEnd === true
      const scenes = Array.isArray(resp.scenes) ? resp.scenes : Array.isArray(resp) ? resp : []

      if (scenes.length > 0) {
        const startIdx = storyScenes.value.length
        for (const sc of scenes) {
          try {
            if (resp.chapterIndex || resp.chapterIndex === 0) sc.chapterIndex = resp.chapterIndex
            if (resp.title) sc.chapterTitle = resp.title
            pushSceneFromServer(sc)
          } catch (e) {
            console.warn('pushSceneFromServer failed while fetching next content', e)
          }
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
      console.log('[restoreChoiceFlagsFromHistory] 开始恢复选项标记')
      console.log(
        '[restoreChoiceFlagsFromHistory] 当前场景数:',
        storyScenes.value ? storyScenes.value.length : 0
      )
      console.log(
        '[restoreChoiceFlagsFromHistory] 选择历史数:',
        choiceHistory.value ? choiceHistory.value.length : 0
      )
      console.log('[restoreChoiceFlagsFromHistory] 当前场景索引:', currentSceneIndex.value)
      console.log('[restoreChoiceFlagsFromHistory] 当前对话索引:', currentDialogueIndex.value)

      if (Array.isArray(storyScenes.value)) {
        storyScenes.value.forEach((s) => {
          try {
            if (s) {
              s.choiceConsumed = false
              s.chosenChoiceId = null
            }
          } catch (e) {}
        })
      }
      if (Array.isArray(choiceHistory.value)) {
        console.log('[restoreChoiceFlagsFromHistory] 处理选择历史记录...')
        choiceHistory.value.forEach((h, idx) => {
          try {
            const sid = h.sceneId || h.sceneId
            const psid = String(sid)
            const foundIdx = Array.isArray(storyScenes.value)
              ? storyScenes.value.findIndex(
                  (s) => s && (String(s.id) === psid || String(s.sceneId) === psid)
                )
              : -1
            console.log(
              `[restoreChoiceFlagsFromHistory] 历史记录 ${idx}: sceneId=${sid}, 找到场景索引=${foundIdx}, choiceId=${h.choiceId}, triggerIndex=${h.choiceTriggerIndex}`
            )
            if (foundIdx >= 0 && storyScenes.value[foundIdx]) {
              const scene = storyScenes.value[foundIdx]
              try {
                scene.chosenChoiceId = h.choiceId || h.choiceId
              } catch (e) {}
              try {
                scene.choiceConsumed = true
                // 保存历史记录中的 choiceTriggerIndex 到场景对象，用于后续判断
                if (typeof h.choiceTriggerIndex === 'number') {
                  scene.historyChoiceTriggerIndex = h.choiceTriggerIndex
                  if (typeof scene.choiceTriggerIndex !== 'number') {
                    scene.choiceTriggerIndex = h.choiceTriggerIndex
                    console.log(
                      `[restoreChoiceFlagsFromHistory] 场景 ${foundIdx} 没有 choiceTriggerIndex，使用历史记录值: ${h.choiceTriggerIndex}`
                    )
                  }
                }
              } catch (e) {}
              console.log(
                '[restoreChoiceFlagsFromHistory] 恢复场景选项标记:',
                foundIdx,
                '选项ID:',
                h.choiceId,
                '触发索引:',
                h.choiceTriggerIndex,
                '场景有choices:',
                Array.isArray(scene.choices),
                '场景有choiceTriggerIndex:',
                typeof scene.choiceTriggerIndex === 'number'
              )
            } else {
              console.warn(`[restoreChoiceFlagsFromHistory] 未找到 sceneId=${sid} 对应的场景`)
            }
          } catch (e) {
            console.warn('[restoreChoiceFlagsFromHistory] 处理历史记录出错:', e)
          }
        })
      }
      // 对当前场景的特殊处理：
      // 只有当读档位置确实在选项触发点之前时，才清除 choiceConsumed 标记
      // 如果读档位置在选项触发点或之后，则保持 choiceConsumed = true（选项不应再次显示）
      try {
        const cur = storyScenes.value && storyScenes.value[currentSceneIndex.value]
        if (cur) {
          // 查找当前场景在 choiceHistory 中的记录
          const historyRecord = choiceHistory.value.find((h) => {
            const sid = String(h.sceneId)
            const curId = String(cur.id || cur.sceneId)
            return sid === curId
          })

          // 确定选项的触发索引（优先使用历史记录中的，其次使用场景自身的）
          let triggerIndex = null
          if (historyRecord && typeof historyRecord.choiceTriggerIndex === 'number') {
            triggerIndex = historyRecord.choiceTriggerIndex
          } else if (typeof cur.choiceTriggerIndex === 'number') {
            triggerIndex = cur.choiceTriggerIndex
          }

          // 如果能确定触发索引，根据当前对话位置决定选项状态
          if (triggerIndex !== null && typeof currentDialogueIndex.value === 'number') {
            if (currentDialogueIndex.value < triggerIndex) {
              // 读档位置在触发点之前，清除选项标记（用户还未到达选项）
              if (historyRecord) {
                // 如果历史中有这个场景的选择记录，但读档位置在触发点之前，
                // 说明是回到了选择之前的状态，应清除标记
                try {
                  cur.choiceConsumed = false
                  cur.chosenChoiceId = null
                } catch (e) {}
                console.log(
                  '[restoreChoiceFlagsFromHistory] 读档位置(' +
                    currentDialogueIndex.value +
                    ')在选项触发点(' +
                    triggerIndex +
                    ')之前，清除选项标记'
                )
              }
            } else if (currentDialogueIndex.value === triggerIndex) {
              // 读档位置正好在触发点
              if (historyRecord) {
                try {
                  cur.choiceConsumed = true
                  cur.chosenChoiceId = historyRecord.choiceId
                } catch (e) {}
                console.log(
                  '[restoreChoiceFlagsFromHistory] ✅ 读档位置(' +
                    currentDialogueIndex.value +
                    ')等于触发点(' +
                    triggerIndex +
                    ')，且已有选择记录，确保choiceConsumed=true'
                )
              } else {
                // 如果历史中没有选择记录，说明用户可能存档在触发点但还未选择，清除标记
                try {
                  cur.choiceConsumed = false
                  cur.chosenChoiceId = null
                } catch (e) {}
                console.log(
                  '[restoreChoiceFlagsFromHistory] 读档位置(' +
                    currentDialogueIndex.value +
                    ')等于触发点(' +
                    triggerIndex +
                    ')，但无选择记录，清除选项标记'
                )
              }
            } else {
              // 读档位置在触发点之后
              if (historyRecord) {
                try {
                  cur.choiceConsumed = true
                  cur.chosenChoiceId = historyRecord.choiceId
                } catch (e) {}
                console.log(
                  '[restoreChoiceFlagsFromHistory] ✅ 读档位置(' +
                    currentDialogueIndex.value +
                    ')在触发点(' +
                    triggerIndex +
                    ')之后，且已有选择记录，确保choiceConsumed=true'
                )
              } else {
                // 如果历史中没有选择记录但位置在触发点之后，这是异常情况
                // 为安全起见，标记为已消费，不显示选项
                try {
                  cur.choiceConsumed = true
                } catch (e) {}
                console.warn(
                  '[restoreChoiceFlagsFromHistory] ⚠️ 读档位置(' +
                    currentDialogueIndex.value +
                    ')在触发点(' +
                    triggerIndex +
                    ')之后，但无选择记录（异常），强制设置choiceConsumed=true'
                )
              }
            }
          } else if (!historyRecord && !cur.choiceConsumed) {
            // 如果当前场景在历史中没有记录，且 choiceConsumed 为 false，保持原状
            console.log('[restoreChoiceFlagsFromHistory] 当前场景无选择历史记录，保持原状')
          }
        }
      } catch (e) {
        console.warn('[restoreChoiceFlagsFromHistory] 处理当前场景状态时出错:', e)
      }
    } catch (e) {
      console.warn('restoreChoiceFlagsFromHistory failed', e)
    }
  }

  // 添加依赖项的存储
  let _creatorFeatureEnabled = null
  let _showToast = null
  let _showOutlineEditor = null
  let _outlineEdits = null
  let _outlineUserPrompt = null
  let _originalOutlineSnapshot = null
  let _editorInvocation = null
  let _pendingOutlineTargetChapter = null
  let _outlineEditorResolver = null
  // 当前正在获取的章节索引（用于防止并发请求导致回退/覆盖）
  let currentFetchingChapter = null
  let _loadingProgress = null
  // attributes / statuses refs（由 useGameState 或页面传入）
  let _attributes = null
  let _statuses = null

  // 提供设置依赖的方法
  const setDependencies = (deps) => {
    _creatorFeatureEnabled = deps.creatorFeatureEnabled
    _showToast = deps.showToast
    _showOutlineEditor = deps.showOutlineEditor
    _outlineEdits = deps.outlineEdits
    _outlineUserPrompt = deps.outlineUserPrompt
    _originalOutlineSnapshot = deps.originalOutlineSnapshot
    _editorInvocation = deps.editorInvocation
    _pendingOutlineTargetChapter = deps.pendingOutlineTargetChapter
    _outlineEditorResolver = deps.outlineEditorResolver
    _loadingProgress = deps.loadingProgress
    // 可选传入 attributes/statuses 的 refs，供 endings condition 匹配使用
    if (deps.attributes) _attributes = deps.attributes
    if (deps.statuses) _statuses = deps.statuses
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
    fetchNextChapter, // 确保导出
    restoreChoiceFlagsFromHistory,

    // 服务引用（改为直接返回函数而不是getter）
    getScenes,
    setGetScenes: (fn) => {
      getScenes = fn
    },
    generateChapter,
    setGenerateChapter: (fn) => {
      generateChapter = fn
    },
    saveChapter,
    setSaveChapter: (fn) => {
      saveChapter = fn
    },
    saveEnding,
    setSaveEnding: (fn) => {
      saveEnding = fn
    },
    // 记录并导出最后选中的结局索引（1-based）
    lastSelectedEndingIndex,

    // 添加设置依赖的方法
    setDependencies,
    // 音乐播放列表（由后端作品详情填充）
    musicPlaylist
  }
}
