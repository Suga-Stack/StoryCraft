import { ref, computed, watch } from 'vue'

export function useAutoPlay(dependencies = {}) {
  // 🔧 修复：使用 getter 函数来获取依赖，确保总是访问最新的值
  const getIsLandscapeReady = () => dependencies.isLandscapeReady?.value ?? false
  const getIsLoading = () => dependencies.isLoading?.value ?? true
  const getIsFetchingNext = () => dependencies.isFetchingNext?.value ?? false
  const getIsGeneratingSettlement = () => dependencies.isGeneratingSettlement?.value ?? false
  const getShowMenu = () => dependencies.showMenu?.value ?? false
  const getShowText = () => dependencies.showText?.value ?? false
  const getChoicesVisible = () => dependencies.choicesVisible?.value ?? false
  const getAnyOverlayOpen = () => dependencies.anyOverlayOpen?.value ?? false
  const getAutoPlayEnabled = () => autoPlayEnabled.value

  const {
    nextDialogue
  } = dependencies

  const showSettingsModal = ref(false)
  const autoPlayEnabled = ref(false)
  const autoPlayIntervalMs = ref(2000)
  let autoPlayTimer = null

  const canAutoAdvance = computed(() => {
    // 🔑 关键修复：使用 getter 函数获取最新值
    const result = getAutoPlayEnabled() &&
        getIsLandscapeReady() &&
        !getIsLoading() &&
        !getIsFetchingNext() &&
        !getIsGeneratingSettlement() &&
        !getShowMenu() &&
        getShowText() &&
        !getChoicesVisible()
    
    // 调试日志 - 总是输出，不只是在 autoPlayEnabled 时
    console.log('[canAutoAdvance] evaluated', {
      result,
      autoPlayEnabled: getAutoPlayEnabled(),
      isLandscapeReady: getIsLandscapeReady(),
      isLoading: getIsLoading(),
      isFetchingNext: getIsFetchingNext(),
      isGeneratingSettlement: getIsGeneratingSettlement(),
      showMenu: getShowMenu(),
      showText: getShowText(),
      choicesVisible: getChoicesVisible()
    })
    
    return result
  })

  const tickAutoPlay = () => {
    console.log('[tickAutoPlay] called, canAutoAdvance:', canAutoAdvance.value)
    if (!canAutoAdvance.value) return
    
    // 支持三种形式: 1) 普通函数 2) ref(() => {}) 3) 通过 getNextDialogue getter 传入
    let fn = null
    if (typeof nextDialogue === 'function') {
      console.log('[tickAutoPlay] nextDialogue is a plain function')
      fn = nextDialogue
    } else if (nextDialogue && typeof nextDialogue.value === 'function') {
      console.log('[tickAutoPlay] nextDialogue is a ref with function value')
      fn = nextDialogue.value
    } else if (dependencies.getNextDialogue) {
      console.log('[tickAutoPlay] using getNextDialogue from dependencies')
      try {
        const maybe = dependencies.getNextDialogue()
        if (typeof maybe === 'function') fn = maybe
      } catch (e) { console.warn('getNextDialogue failed', e) }
    }
    
    console.log('[tickAutoPlay] fn:', fn ? 'found' : 'NOT FOUND')
    
    if (fn) {
      try { 
        console.log('[tickAutoPlay] executing nextDialogue function')
        fn() 
      } catch (e) { console.warn('auto-play next failed', e) }
    } else {
      console.warn('[tickAutoPlay] No nextDialogue function available!')
    }
  }

  const clampInterval = (ms) => {
    const val = Number(ms) || 2000
    return Math.min(10000, Math.max(2000, val))
  }

  const startAutoPlayTimer = () => {
    console.log('[startAutoPlayTimer] called')
    stopAutoPlayTimer()
    try {
        if (getAnyOverlayOpen()) {
          console.log('[startAutoPlayTimer] overlay is open, not starting')
          return
        }
    } catch (e) {}
    console.log('[startAutoPlayTimer] setting interval with', clampInterval(autoPlayIntervalMs.value), 'ms')
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
  
  watch([autoPlayEnabled, autoPlayIntervalMs], () => {
    console.log('[watch autoPlayEnabled] changed to:', autoPlayEnabled.value)
    saveAutoPlayPrefs()
    if (autoPlayEnabled.value) {
        // 不管 overlay 是否打开都尝试启动
        // startAutoPlayTimer 内部会检查条件
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