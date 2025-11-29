/**
 * 服务框架测试文件
 * 用于验证各个服务模块是否正常工作
 * 
 * 使用方法:
 * 1. 在浏览器控制台中运行这个文件
 * 2. 或在组件中导入并调用测试函数
 */

import { http, getUserId } from './http.js'
import { mockSaveService, mockStoryService } from './mock.js'
import { 
  mergeAttributes, 
  mergeStatuses, 
  formatTimestamp,
  deepClone,
  validateRequired
} from './utils.js'

/**
 * 测试 HTTP 客户端
 */
export async function testHttpClient() {
  console.log('=== 测试 HTTP 客户端 ===')
  
  try {
    // 测试 getUserId
    const userId = getUserId()
    console.log('✓ 用户 ID:', userId)
    
    // 测试 URL 构建
    const url = http.buildURL('/api/test', { param1: 'value1', param2: 'value2' })
    console.log('✓ URL 构建:', url)
    
    // 测试请求头构建
    const headers = http.buildHeaders({ 'Custom-Header': 'test' })
    console.log('✓ 请求头:', headers)
    
    console.log('✅ HTTP 客户端测试通过\n')
    return true
  } catch (error) {
    console.error('❌ HTTP 客户端测试失败:', error)
    return false
  }
}

/**
 * 测试工具函数
 */
export function testUtils() {
  console.log('=== 测试工具函数 ===')
  
  try {
    // 测试属性合并
    const attributes = mergeAttributes(
      { 心计: 30, 才情: 60 },
      { 心计: 5, 声望: 10 }
    )
    console.assert(attributes.心计 === 35, '属性合并失败')
    console.assert(attributes.才情 === 60, '属性合并失败')
    console.assert(attributes.声望 === 10, '属性合并失败')
    console.log('✓ 属性合并测试通过')
    
    // 测试状态合并
    const statuses = mergeStatuses(
      { 姓名: '林微月', 位份: '选侍', 好感度: 50 },
      { 位份: '嫔', 好感度: 10, 敌意: null }
    )
    console.assert(statuses.姓名 === '林微月', '状态合并失败')
    console.assert(statuses.位份 === '嫔', '状态合并失败')
    console.assert(statuses.好感度 === 60, '状态合并失败')
    console.assert(statuses.敌意 === undefined, '状态合并失败')
    console.log('✓ 状态合并测试通过')
    
    // 测试时间格式化
    const now = Date.now()
    const dateStr = formatTimestamp(now, 'date')
    const timeStr = formatTimestamp(now, 'time')
    const datetimeStr = formatTimestamp(now, 'datetime')
    const relativeStr = formatTimestamp(now - 3600000, 'relative')
    console.log('✓ 时间格式化:', { dateStr, timeStr, datetimeStr, relativeStr })
    
    // 测试深拷贝
    const original = { a: 1, b: { c: 2 }, d: [1, 2, 3] }
    const cloned = deepClone(original)
    cloned.b.c = 999
    console.assert(original.b.c === 2, '深拷贝失败')
    console.assert(cloned.b.c === 999, '深拷贝失败')
    console.log('✓ 深拷贝测试通过')
    
    // 测试字段验证
    const valid = validateRequired({ name: 'test', age: 20 }, ['name', 'age'])
    const invalid = validateRequired({ name: 'test' }, ['name', 'age'])
    console.assert(valid === true, '字段验证失败')
    console.assert(invalid === false, '字段验证失败')
    console.log('✓ 字段验证测试通过')
    
    console.log('✅ 工具函数测试通过\n')
    return true
  } catch (error) {
    console.error('❌ 工具函数测试失败:', error)
    return false
  }
}

/**
 * 测试 Mock 服务
 */
export async function testMockServices() {
  console.log('=== 测试 Mock 服务 ===')
  
  try {
    const workId = 'test_work_1'
    const slot = 'slot1'
    
    // 测试 Mock 故事服务
    console.log('测试 Mock 故事服务...')
    const work = await mockStoryService.getWorkInfo(workId)
    console.log('✓ 获取作品信息:', work)
    
    const initialScenes = await mockStoryService.getInitialScenes(workId)
    console.log('✓ 获取初始场景:', initialScenes.length, '个场景')
    
    const nextScenes = await mockStoryService.getNextScenes(workId, 'scene_1')
    console.log('✓ 获取后续场景:', nextScenes)
    
    const choiceResult = await mockStoryService.submitChoice(workId, 'choice_1', {})
    console.log('✓ 提交选择:', choiceResult)
    
    // 测试 Mock 存档服务
    console.log('测试 Mock 存档服务...')
    const saveData = {
      work: { id: workId, title: '测试作品' },
      currentSceneIndex: 0,
      currentDialogueIndex: 0,
      attributes: { 心计: 30 },
      statuses: { 姓名: '测试' },
      storyScenes: [],
      timestamp: Date.now()
    }
    
    await mockSaveService.saveGame(workId, slot, saveData)
    console.log('✓ 保存游戏成功')
    
    const loadedData = await mockSaveService.loadGame(workId, slot)
    console.log('✓ 读取存档成功:', loadedData)
    
    const savesList = await mockSaveService.getSavesList(workId)
    console.log('✓ 获取存档列表:', savesList)
    
    await mockSaveService.deleteSave(workId, slot)
    console.log('✓ 删除存档成功')
    
    const deletedData = await mockSaveService.loadGame(workId, slot)
    console.assert(deletedData === null, 'Mock 存档删除失败')
    console.log('✓ 验证存档已删除')
    
    console.log('✅ Mock 服务测试通过\n')
    return true
  } catch (error) {
    console.error('❌ Mock 服务测试失败:', error)
    return false
  }
}

/**
 * 测试配置加载
 */
export function testConfig() {
  console.log('=== 测试配置 ===')
  
  try {
    // 动态导入配置
    import('./config.js').then(config => {
      console.log('✓ API 端点:', Object.keys(config.API_ENDPOINTS))
      console.log('✓ 存档槽位:', config.SAVE_SLOTS)
      console.log('✓ 自动存档槽位:', config.AUTO_SAVE_SLOT)
      console.log('✓ 环境配置:', config.ENV_CONFIG)
      console.log('✅ 配置加载测试通过\n')
    })
    
    return true
  } catch (error) {
    console.error('❌ 配置加载测试失败:', error)
    return false
  }
}

/**
 * 测试类型定义
 */
export function testTypes() {
  console.log('=== 测试类型定义 ===')
  
  try {
    // 类型定义文件应该能被正常导入
    import('./types.js').then(() => {
      console.log('✓ 类型定义文件加载成功')
      console.log('✅ 类型定义测试通过\n')
    })
    
    return true
  } catch (error) {
    console.error('❌ 类型定义测试失败:', error)
    return false
  }
}

/**
 * 运行所有测试
 */
export async function runAllTests() {
  console.log('\n🧪 开始运行 StoryCraft 服务框架测试...\n')
  
  const results = []
  
  // 同步测试
  results.push(await testHttpClient())
  results.push(testUtils())
  results.push(testConfig())
  results.push(testTypes())
  
  // 异步测试
  results.push(await testMockServices())
  
  // 汇总结果
  const passed = results.filter(r => r).length
  const total = results.length
  
  console.log('\n' + '='.repeat(50))
  console.log(`测试完成: ${passed}/${total} 通过`)
  
  if (passed === total) {
    console.log('🎉 所有测试通过!')
  } else {
    console.log('⚠️ 部分测试失败,请检查错误信息')
  }
  console.log('='.repeat(50) + '\n')
  
  return passed === total
}

/**
 * 快速健康检查
 */
export async function healthCheck() {
  console.log('🏥 执行快速健康检查...\n')
  
  const checks = {
    'HTTP 客户端': false,
    '工具函数': false,
    'Mock 服务': false
  }
  
  try {
    // 检查 HTTP 客户端
    const userId = getUserId()
    checks['HTTP 客户端'] = !!userId
    
    // 检查工具函数
    const merged = mergeAttributes({ a: 1 }, { b: 2 })
    checks['工具函数'] = merged.a === 1 && merged.b === 2
    
    // 检查 Mock 服务
    const work = await mockStoryService.getWorkInfo('test')
    checks['Mock 服务'] = !!work
    
  } catch (error) {
    console.error('健康检查出错:', error)
  }
  
  // 打印结果
  console.log('健康检查结果:')
  Object.keys(checks).forEach(key => {
    const status = checks[key] ? '✅' : '❌'
    console.log(`  ${status} ${key}`)
  })
  
  const allHealthy = Object.values(checks).every(v => v)
  console.log('\n' + (allHealthy ? '✅ 系统健康' : '⚠️ 发现问题') + '\n')
  
  return allHealthy
}

// 如果在浏览器环境,将测试函数挂载到 window 对象
if (typeof window !== 'undefined') {
  window.StoryCraftTests = {
    runAllTests,
    healthCheck,
    testHttpClient,
    testUtils,
    testMockServices,
    testConfig,
    testTypes
  }
  
  console.log('💡 提示: 在浏览器控制台运行以下命令进行测试:')
  console.log('  - window.StoryCraftTests.healthCheck()     // 快速健康检查')
  console.log('  - window.StoryCraftTests.runAllTests()     // 运行所有测试')
}

// 默认导出
export default {
  runAllTests,
  healthCheck,
  testHttpClient,
  testUtils,
  testMockServices,
  testConfig,
  testTypes
}
