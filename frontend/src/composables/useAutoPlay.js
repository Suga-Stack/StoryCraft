import { ref, computed, watch } from 'vue'

export function useAutoPlay(options = {}) {
  const {
    isLandscapeReady,
    isLoading,
    isFetchingNext,
    isGeneratingSettlement,
    showMenu,
    showText,
    choicesVisible,
    nextDialogue,
    anyOverlayOpen
  } = options

  const showSettingsModal = ref(false)
  const autoPlayEnabled = ref(false)
  const autoPlayIntervalMs = ref(2000)
  let autoPlayTimer = null

  const canAutoAdvance = computed(() => {
    return autoPlayEnabled.value &&
        isLandscapeReady?.value &&
        !isLoading?.value &&
        !isFetchingNext?.value &&
        !isGeneratingSettlement?.value &&
        !showMenu?.value &&
        showText?.value &&
        !choicesVisible?.value
  })

  const tickAutoPlay = () => {
    if (canAutoAdvance.value) {
        try { nextDialogue() } catch (e) { console.warn('auto-play next failed', e) }
    }
  }

  const clampInterval = (ms) => {
    const val = Number(ms) || 2000
    return Math.min(10000, Math.max(2000, val))
  }

  const startAutoPlayTimer = () => {
    stopAutoPlayTimer()
    // 不在弹窗打开时才启动自动播放
    try {
        if (anyOverlayOpen && anyOverlayOpen.value) return
    } catch (e) {}
    autoPlayTimer = setInterval(tickAutoPlay, clampInterval(autoPlayIntervalMs.value))
  }

  const stopAutoPlayTimer = () => {
    if (autoPlayTimer) {
        clearInterval(autoPlayTimer)
        autoPlayTimer = null
    }
  }

  const saveAutoPlayPrefs = () => {
    try {
        localStorage.setItem('autoPlayEnabled', JSON.stringify(!!autoPlayEnabled.value))
        localStorage.setItem('autoPlayIntervalMs', JSON.stringify(clampInterval(autoPlayIntervalMs.value)))
    } catch {}
  }

    const loadAutoPlayPrefs = () => {
    try {
        const en = JSON.parse(localStorage.getItem('autoPlayEnabled'))
        const ms = JSON.parse(localStorage.getItem('autoPlayIntervalMs'))
        if (typeof en === 'boolean') autoPlayEnabled.value = en
        if (typeof ms === 'number' && !Number.isNaN(ms)) autoPlayIntervalMs.value = clampInterval(ms)
    } catch {}
  }
  
  // 监听设置变化
  watch([autoPlayEnabled, autoPlayIntervalMs], () => {
    saveAutoPlayPrefs()
    if (autoPlayEnabled.value) {
        // 如果存在任一弹窗打开，则不要启动自动播放
        try {
        if (anyOverlayOpen && anyOverlayOpen.value) return
        } catch (e) {}
        startAutoPlayTimer()
    } else {
        stopAutoPlayTimer()
    }
  })
  
  return {
    showSettingsModal,
    autoPlayEnabled,
    autoPlayIntervalMs,
    autoPlayTimer,
    startAutoPlayTimer,
    stopAutoPlayTimer,
    saveAutoPlayPrefs,
    loadAutoPlayPrefs
  }
}