import { ref, computed, watch, unref } from 'vue'

/**
 * 自动播放功能 Composable
 * @param {Object} dependencies - 依赖项对象
 * @param {Function} dependencies.getNextDialogue - 获取 nextDialogue 函数的 getter
 * @param {Ref} dependencies.isLandscapeReady - 是否横屏就绪
 * @param {Ref} dependencies.isLoading - 是否加载中
 * @param {Ref} dependencies.isFetchingNext - 是否正在获取下一段内容
 * @param {Ref} dependencies.isGeneratingSettlement - 是否正在生成结算
 * @param {Ref} dependencies.showMenu - 是否显示菜单
 * @param {Ref} dependencies.showText - 是否显示文本
 * @param {Ref} dependencies.choicesVisible - 是否显示选项
 * @param {Ref} dependencies.anyOverlayOpen - 是否有任何弹窗打开
 */
export function useAutoPlay(dependencies = {}) {
  const showSettingsModal = ref(false)
  const autoPlayEnabled = ref(false)
  const autoPlayIntervalMs = ref(2000)
  let autoPlayTimer = null

  // 计算是否可以自动前进
  const canAutoAdvance = computed(() => {
    if (!autoPlayEnabled.value) return false

    const isLandscapeReady = unref(dependencies.isLandscapeReady)
    const isLoading = unref(dependencies.isLoading)
    const isFetchingNext = unref(dependencies.isFetchingNext)
    const isGeneratingSettlement = unref(dependencies.isGeneratingSettlement)
    const showMenu = unref(dependencies.showMenu)
    const showText = unref(dependencies.showText)
    const choicesVisible = unref(dependencies.choicesVisible)
    const anyOverlayOpen = unref(dependencies.anyOverlayOpen)

    return (
      isLandscapeReady &&
      !isLoading &&
      !isFetchingNext &&
      !isGeneratingSettlement &&
      !showMenu &&
      showText &&
      !choicesVisible &&
      !anyOverlayOpen
    )
  })

  // 限制间隔时间在 2000-10000ms 之间
  const clampInterval = (ms) => {
    const val = Number(ms) || 1000
    return Math.min(10000, Math.max(1000, val))
  }

  // 自动播放的执行函数
  const tickAutoPlay = () => {
    if (!canAutoAdvance.value) {
      return
    }

    // 获取 nextDialogue 函数
    const getNextDialogue = dependencies.getNextDialogue
    if (typeof getNextDialogue !== 'function') {
      return
    }

    const nextDialogueFn = getNextDialogue()
    if (typeof nextDialogueFn !== 'function') {
      return
    }

    try {
      nextDialogueFn()
    } catch (error) {
      console.error('[AutoPlay] Error executing nextDialogue:', error)
    }
  }

  // 启动自动播放定时器
  const startAutoPlayTimer = () => {
    stopAutoPlayTimer()
    
    if (!autoPlayEnabled.value) {
      return
    }

    const interval = clampInterval(autoPlayIntervalMs.value)
    autoPlayTimer = setInterval(tickAutoPlay, interval)
  }

  // 停止自动播放定时器
  const stopAutoPlayTimer = () => {
    if (autoPlayTimer) {
      clearInterval(autoPlayTimer)
      autoPlayTimer = null
    }
  }

  // 保存自动播放偏好设置
  const saveAutoPlayPrefs = () => {
    try {
      localStorage.setItem('autoPlayEnabled', JSON.stringify(autoPlayEnabled.value))
      localStorage.setItem('autoPlayIntervalMs', JSON.stringify(clampInterval(autoPlayIntervalMs.value)))
    } catch (error) {
      console.warn('[AutoPlay] Failed to save preferences:', error)
    }
  }

  // 加载自动播放偏好设置
  const loadAutoPlayPrefs = () => {
    try {
      const enabled = JSON.parse(localStorage.getItem('autoPlayEnabled'))
      const interval = JSON.parse(localStorage.getItem('autoPlayIntervalMs'))
      
      if (typeof enabled === 'boolean') {
        autoPlayEnabled.value = enabled
      }
      if (typeof interval === 'number' && !isNaN(interval)) {
        autoPlayIntervalMs.value = clampInterval(interval)
      }
    } catch (error) {
      console.warn('[AutoPlay] Failed to load preferences:', error)
    }
  }

  // 监听自动播放状态和间隔变化
  watch([autoPlayEnabled, autoPlayIntervalMs], () => {
    saveAutoPlayPrefs()
    
    if (autoPlayEnabled.value) {
      startAutoPlayTimer()
    } else {
      stopAutoPlayTimer()
    }
  })

  // 监听关键状态变化,在条件满足时重启定时器
  watch(
    () => ({
      canAdvance: canAutoAdvance.value,
      showText: unref(dependencies.showText),
      anyOverlay: unref(dependencies.anyOverlayOpen),
      choices: unref(dependencies.choicesVisible)
    }),
    (newState, oldState) => {
      // 如果自动播放未启用,不做处理
      if (!autoPlayEnabled.value) return
      
      // 如果从不能自动前进变为可以自动前进,重启定时器
      if (newState.canAdvance && !oldState?.canAdvance) {
        startAutoPlayTimer()
      }
      // 如果弹窗关闭或选项消失,重启定时器
      else if (
        (oldState?.anyOverlay && !newState.anyOverlay) ||
        (oldState?.choices && !newState.choices)
      ) {
        if (newState.canAdvance) {
          startAutoPlayTimer()
        }
      }
      // 如果文本显示出来,重启定时器
      else if (newState.showText && !oldState?.showText && newState.canAdvance) {
        startAutoPlayTimer()
      }
    },
    { deep: true }
  )

  return {
    showSettingsModal,
    autoPlayEnabled,
    autoPlayIntervalMs,
    startAutoPlayTimer,
    stopAutoPlayTimer,
    saveAutoPlayPrefs,
    loadAutoPlayPrefs,
    canAutoAdvance
  }
}