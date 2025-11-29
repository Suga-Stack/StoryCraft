// apply_imported_story.js
// Lightweight helper to load the converted mock story and set sessionStorage.createResult
// Usage: open this file in the browser (served by dev server) or paste its content into the console.

(async function(){
  try {
    const res = await fetch('/mock/imported_story.json');
    if(!res.ok) throw new Error('无法加载 /mock/imported_story.json');
    const story = await res.json();

    // 如果 story.storyScenes 中包含与 firstChapter.scene.sceneId 相同的场景，优先使用该完整场景（以保留 choices 等字段）
    let firstChapter = story.firstChapter || null
    try {
      if (firstChapter && Array.isArray(story.storyScenes)) {
        const targetId = firstChapter.scene?.sceneId ?? firstChapter.sceneId ?? null
        if (targetId != null) {
          const match = story.storyScenes.find(s => String(s.sceneId) === String(targetId))
          if (match) {
            // 合并：用 match（包含 choices 等）替换 firstChapter.scene
            firstChapter = Object.assign({}, firstChapter, { scene: match })
          }
        }
      }
    } catch (e) { console.warn('apply_imported_story merge scene failed', e) }

    const createResult = {
      fromCreate: false,
      backendWork: {
        id: story.work.id || 'imported-001',
        title: story.work.title || '',
        coverUrl: story.work.coverUrl || '',
        tags: story.work.tags || []
      },
      firstChapter: firstChapter,
      streamUrl: null,
      generationComplete: true
    };

    sessionStorage.setItem('createResult', JSON.stringify(createResult));
    console.log('sessionStorage.createResult 已写入：', createResult);

    // navigate to works/introduction page
    const target = '/works';
    console.log('跳转到', target);
    window.location.href = target;
  } catch (e) {
    console.error('apply_imported_story 发生错误:', e);
    alert('apply_imported_story 错误: ' + e.message);
  }
})();
