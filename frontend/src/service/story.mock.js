// ...existing code...
/**
 * 本地 Mock 实现（game-api.md 兼容版）
 * - getScenes(workId, chapterIndex) -> 返回 { chapterIndex, title, scenes, isGameEnding }
 * - submitChoice(workId, choiceId, context) -> 返回 { attributesDelta, statusesDelta, nextScenes, end }
 *
 * scene 结构严格使用 game-api.md：{ id, backgroundImage, dialogues: [{ narration, playerChoices }], isChapterEnding }
 * dialogue 结构：{ narration, playerChoices }，playerChoices 可为 null 或数组
 * playerChoice 结构：{ id, text, attributesDelta, subsequentDialogues }
 */

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

const RAW_CHAPTERS = {
  1: {
    title: '第一章：破产的修仙生涯',
    scenes: [
      {
        id: 1000,
        backgroundImage: '/images/1.jpg',
        dialogues: [
          { narration: '———— 第一章：破产修仙生涯 ————', playerChoices: null },
          { narration: '青云宗，外门弟子居所区。', playerChoices: null },
          { narration: '清晨的薄雾如同轻纱般笼罩着连绵的山峦，一排排简陋的竹屋依山而建。空气中弥漫着淡淡的草木清香和稀薄的灵气。偶尔有弟子御剑划过天空，留下淡淡的流光。', playerChoices: null }
        ],
        isChapterEnding: false
      },
      {
        id: 1010,
        backgroundImage: '/images/4.jpg',
        dialogues: [
          { narration: '云舒盘腿坐在自己那张硬邦邦的木板床上，对着面前一个只有她能看见的半透明界面，小脸皱成了一团。', playerChoices: null },
          { narration: '界面顶端赫然写着几个大字：【仙道酬勤·充值就变强系统】。', playerChoices: null }
        ],
        isChapterEnding: false
      },
      {
        id: 1030,
        backgroundImage: '/images/5.jpg',
        dialogues: [
          { narration: '林婉儿：（愁眉苦脸）"云师妹，你还有余钱吗？我的\'凝露\'用完了，这个月的份例还没发，感觉修炼速度慢得像乌龟爬。"', playerChoices: null },
          { narration: '王蔷：（同样叹气）"谁不是呢？宗门任务又难抢，报酬又低。想买柄好点的飞剑，都不知道要攒到猴年马月。"', playerChoices: null },
          { narration: '云舒看着她们，又看了看自己系统界面里那些诱人但昂贵的选项，一个大胆的念头如同闪电般划过脑海。', playerChoices: null },
          {
            narration: '云舒：（眼睛微微发亮）"二位师姐，你们……想不想快速、合法地，赚点灵石？"',
            playerChoices: [
              { id: 'opt_A', text: 'A. 美食路线：制作新颖美食售卖', attributesDelta: { '灵石': 30, '人气': 3, '商业头脑': 2 }, statusesDelta: { '美食家称号': '新晋美食家' }, subsequentDialogues: ["当晚，云舒的小摊在回宿舍的路上支了起来。诱人的香气瞬间吸引了不少弟子。","第一天下来，成本收回，还净赚了三十块灵石！"] },
              { id: 'opt_B', text: 'B. 情报路线：编写并售卖生存玉简', attributesDelta: { '灵石': 150, '人气': 5, '商业头脑': 3 }, statusesDelta: { '线人网络': true }, subsequentDialogues: [] },
              { id: 'opt_C', text: 'C. 娱乐路线：搭建休闲角并收取租金', attributesDelta: { '灵石': 80, '人气': 4, '商业头脑': 2 }, statusesDelta: { '摊主名声': 1 }, subsequentDialogues: [] }
            ]
          }
        ],
        isChapterEnding: true
      }
    ],
    isGameEnding: false
  },
  2: {
    chapterIndex: 2,
    title: '第二章：名声初显与膳堂刁难',
    scenes: [
      {
        id: 2000,
        backgroundImage: '/images/3.jpg',
        dialogues: [
          { narration: '———— 第二章：名声初显与膳堂刁难 ————', playerChoices: null },
          { narration: '青云宗，任务堂外东侧。', playerChoices: null }
        ],
        isChapterEnding: false
      },
      {
        id: 2030,
        backgroundImage: '/images/6.jpg',
        dialogues: [
          { narration: '弟子甲：（坐在木桩上，边吃边感慨）"云师姐想得真周到，比膳殿那冷冰冷的桌椅有人情味多了。"', playerChoices: null },
          { narration: '弟子乙："是啊，这灵肉串味道好，吃完感觉灵力都活跃了些。以后出任务就认准你家了！"', playerChoices: null },
          {
            narration: '此时你可以选择进阶方向：',
            playerChoices: [
              { "id": "opt2_A", text: 'A. 推出"预订+急速达"服务', attributesDelta: { '灵石': 25, '人气': 5, '商业头脑': 3 }, statusesDelta: { '预约服务': true }, subsequentDialogues: ["当晚云舒的小摊在回宿舍的路上支了起来。诱人的香气瞬间吸引了不少弟子。","第一天下来，成本收回，还净赚了三十块灵石！"] },
              { "id": "opt2_B", text: 'B. 开发"会员积分"制度', attributesDelta: { '人气': 4, '商业头脑': 4 }, statusesDelta: { '会员体系': true }, subsequentDialogues: [] },
              { "id": "opt2_C", text: 'C. 研发"组合套餐"', attributesDelta: { '灵石': 35, '商业头脑': 3 }, statusesDelta: { '套餐创新': '吸睛' }, subsequentDialogues: [] }
            ]
          }
        ],
        isChapterEnding: true
      }
    ],
    isGameEnding: true
  }
}

export async function getScenes(workId, chapterIndex = 1) {
  await delay(200)
  const idx = Number(chapterIndex) || 1
  const ch = RAW_CHAPTERS[idx]
  if (!ch) {
    return { chapterIndex: idx, title: `第${idx}章`, scenes: [], isGameEnding: true }
  }
  // 返回深拷贝，避免外部修改 mock 数据
  return JSON.parse(JSON.stringify(ch))
}

// submitChoice removed from mock — choices should include subsequentDialogues/nextScenes in getScenes response

export async function getInitialScenes(workId) {
  return getScenes(workId, 1)
}

// Mock: 接收创作者确认的大纲并启动章节生成（立即返回 ok）
export async function generateChapter(gameworkId, chapterIndex, body = {}) {
  await delay(200)
  console.log('[mock] generateChapter called', gameworkId, chapterIndex, body)
  return { ok: true }
}

// Mock: 保存章节到后端（PUT）
export async function saveChapter(gameworkId, chapterIndex, chapterData = {}) {
  await delay(200)
  console.log('[mock] saveChapter called', gameworkId, chapterIndex, chapterData)
  return { ok: true }
}
// ...existing code...