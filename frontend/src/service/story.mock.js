/**
 * 本地 Mock 实现，用于前端在无后端可用时进行联调
 * 提供 getScenes, submitChoice, getInitialScenes (兼容性包装器)
 */

const delay = (ms) => new Promise(r => setTimeout(r, ms))

/**
 * 获取指定章节的场景
 * @param {string|number} workId - 作品 ID
 * @param {number} chapterIndex - 章节索引（0-based）
 * @returns {Promise<{generating: boolean, end: boolean, scenes: Array}>}
 */
export async function getScenes(workId, chapterIndex = 0) {
  await delay(200)
  
  // 若第二章（索引=1）已完成，再请求后续章节（索引>=2）则直接宣告结尾
  if (Number(chapterIndex) >= 2) {
    return { generating: false, end: true, scenes: [] }
  }

  // chapterIndex: 0 -> 首章；1 -> 第二章开端；其它返回占位章节
  if (Number(chapterIndex) === 0) {
    return {
      generating: false,
      end: false,
      scenes: [
        // 场景 1000 - 场景描写与系统界面
        {
          sceneId: 1000,
          backgroundImage: '/images/1.jpg',
          dialogues: [
            '———— 第一章：破产的修仙生涯 ————',
            '青云宗，外门弟子居所区。',
            '清晨的薄雾如同轻纱般笼罩着连绵的山峦，一排排简陋的竹屋依山而建。空气中弥漫着淡淡的草木清香和稀薄的灵气。偶尔有弟子御剑划过天空，留下淡淡的流光。'
          ]
        },
        {
          sceneId: 1010,
          backgroundImage: '/images/4.jpg',
          dialogues: [
            '云舒盘腿坐在自己那张硬邦邦的木板床上，对着面前一个只有她能看见的半透明界面，小脸皱成了一团。',
            "云舒：（内心哀叹）「不是吧阿sir，穿越也就算了，给个系统怎么还是个'氪金就能变强'的版本？这玩意儿是企鹅出品的吗？」",
            '界面顶端赫然写着几个大字：【仙道酬勤·充值就变强系统】。',
            '下面则是一排让她血压升高的列表：',
            '【修为提升至炼气四层】：需充值 100 下品灵石。',
            '【习得基础法术·御风诀】：需充值 50 下品灵石。',
            '【获得基础丹药·聚气丹x1】：需充值 10 下品灵石。',
            '云舒：（翻看自己空空如也的储物袋）"五十块！在这里连顿像样的灵兽肉都吃不起，更别说充值了。"'
          ]
        },
        // 场景 1020 - 膳食殿与对话
        {
          sceneId: 1020,
          backgroundImage: '/images/2.jpg',
          dialogues: [
            '青云宗，膳食殿。',
            '大殿宽敞，却显得有些陈旧。众多外门弟子排着长队，领取着统一的餐食——一碗淡而无味的灵米粥，一碟清水煮的灵蔬。',
            '云舒端着属于自己的那一份，找了个角落坐下。看着碗里清可见底的粥，她深刻地理解什么叫做"修仙清苦"。',
            '这时，两道身影坐在了云舒对面。是住在隔壁的两位师姐，林婉儿和王蔷。'
          ]
        },
        // 场景 1030 - 触发选项
        {
          sceneId: 1030,
          backgroundImage: '/images/5.jpg',
          dialogues: [
            "林婉儿：（愁眉苦脸）\"云师妹，你还有余钱吗？我的'凝露'用完了，这个月的份例还没发，感觉修炼速度慢得像乌龟爬。\"",
            '王蔷：（同样叹气）"谁不是呢？宗门任务又难抢，报酬又低。想买柄好点的飞剑，都不知道要攒到猴年马月。"',
            '云舒看着她们，又看了看自己系统界面里那些诱人但昂贵的选项，一个大胆的念头如同闪电般划过脑海。',
            '云舒：（眼睛微微发亮）"二位师姐，你们……想不想快速、合法地，赚点灵石？"'
          ],
          choiceTriggerIndex: 3,
          choices: [
            {
              id: 'opt_A',
              text: 'A. 美食路线：制作新颖美食售卖',
              attributesDelta: { '灵石': 30, '人气': 3, '商业头脑': 2 },
              statusesDelta: { '小有名气的美食家': '餐饮活动吸引力提升' }
            },
            {
              id: 'opt_B',
              text: 'B. 情报路线：编写并售卖生存玉简',
              attributesDelta: { '灵石': 150, '人气': 5, '商业头脑': 3 },
              statusesDelta: { '初露锋芒的信息贩子': '更容易打听到消息' }
            },
            {
              id: 'opt_C',
              text: 'C. 娱乐路线：搭建休闲角并收取租金',
              attributesDelta: { '灵石': 80, '人气': 4, '商业头脑': 2 },
              statusesDelta: { '别出心裁的娱乐策划者': '组织活动成功率提升' }
            }
          ]
        }
      ]
    }
  }

  // 第二章开端
  if (Number(chapterIndex) === 1 ) {
    return {
      generating: false,
      end: false,
      scenes: [
        {
          sceneId: 2000,
          backgroundImage: '/images/3.jpg',
          dialogues: [
            '———— 第二章：名声初显与膳堂刁难 ————',
            '青云宗，任务堂外东侧。',
            '一棵枝叶繁茂的古树下，一个简陋却干净的小摊支了起来。一块木板上写着"云记便民速递"几个还算工整的大字。摊位后，云舒正忙碌地将一串串色泽金黄、滋滋冒油的"烈焰灵肉串"摆上烤架，旁边的大瓦罐里飘出"清心灵茶"的淡淡药香。林婉儿和王蔷在一旁帮忙收钱、打包，忙得不亦乐乎。'
          ]
        },
        {
          sceneId: 2010,
          backgroundImage: '/images/3.jpg',
          dialogues: [
            '"云师妹，来三串灵肉串，一碗茶！"',
            '"师姐，我预订的十串好了吗？急着出任务！"',
            '摊位前聚集了不少弟子，人气比第一天在路边时旺了数倍。便携、美味且能轻微恢复灵力的食物，精准地击中了外出任务弟子的痛点。',
            '云舒：（一边熟练地翻动肉串，一边笑着应答）"好了好了，李师兄您的十串，拿好！小心烫！"',
            "林婉儿：（低声对云舒说，难掩兴奋）\"云师妹，这才半天，我们就收了快四十灵石了！照这个速度，几天就能回本！\"",
            "云舒：（眼神晶亮，压低声音）\"还不够，我们要把'云记'的名声彻底打响！\""
          ]
        },
        {
          sceneId: 2020,
          backgroundImage: '/images/3.jpg',
          dialogues: [
            '她注意到，有些弟子买了食物后，就蹲在路边或靠在树上匆匆进食，显得有些狼狈。',
            '云舒：（心念一动，对王蔷说）"王师姐，麻烦你去找几块平整的大石头，或者砍些粗木桩来，摆在摊位旁边，让师兄师姐们有个歇脚的地方。"',
            '很快，几个简易的"就餐区"就弄好了。虽然简陋，但这份贴心让不少弟子对"云记"好感倍增。'
          ]
        },
        {
          sceneId: 2030,
          backgroundImage: '/images/6.jpg',
          dialogues: [
            '弟子甲：（坐在木桩上，边吃边感慨）"云师姐想得真周到，比膳殿那冷冰冷的桌椅有人情味多了。"',
            '弟子乙："是啊，这灵肉串味道好，吃完感觉灵力都活跃了些。以后出任务就认准你家了！"'
          ],
          choiceTriggerIndex: 1,
          choices: [
            {
              id: 'opt2_A',
              text: 'A. 推出"预订+急速达"服务：制作简单传讯符并安排跑腿送达',
              attributesDelta: { '灵石': 25, '人气': 5, '商业头脑': 3 },
              statusesDelta: { '便捷服务先驱': '后续推出类似服务时，接受度更高' }
            },
            {
              id: 'opt2_B',
              text: 'B. 开发"会员积分"制度：制作木质令牌促进重复消费',
              attributesDelta: { '人气': 4, '商业头脑': 4 },
              statusesDelta: { '忠诚客户群体': '拥有部分稳定客源，抵抗风险能力稍强' }
            },
            {
              id: 'opt2_C',
              text: 'C. 研发"组合套餐"：推出搭配套餐以提升效率与客单价',
              attributesDelta: { '灵石': 35, '商业头脑': 3 },
              statusesDelta: { '营销组合高手': '更容易设计出吸引人的促销方案' }
            }
          ]
        }
      ]
    }
  }

  // 其他章节：在本 Mock 中不存在，统一视为结尾
  return { generating: false, end: true, scenes: [] }
}

/**
 * 提交选项选择
 * @param {string|number} workId - 作品 ID  
 * @param {string|number} choiceId - 选项 ID
 * @param {Object} context - 上下文信息
 * @returns {Promise<{attributesDelta: Object, statusesDelta: Object, nextScenes: Array, end: boolean}>}
 */
export async function submitChoice(workId, choiceId, context = {}) {
  await delay(600)
  const id = (choiceId || '').toString()

  // 第二章选项处理：opt2_A/opt2_B/opt2_C
  if (/opt2_A|2A|A2/i.test(id)) {
    return {
      attributesDelta: { '灵石': 25, '人气': 5, '商业头脑': 3 },
      statusesDelta: { '便捷服务先驱': '后续推出类似服务时，接受度更高' },
      nextScenes: [
        {
          sceneId: 2101,
          backgroundImage: '/images/7.jpg',
          dialogues: [
            '云舒绘制了一些简单的定向传讯符，虽然只能短距离传递简单的"预订"信息，但足够使用。',
            '她让林婉儿负责在女弟子居所区送货，王蔷负责男弟子居所区外围。',
            '消息一出，立刻受到了那些忙于修炼或不便外出的弟子的欢迎。'
          ]
        },
        {
          sceneId: 2151,
          backgroundImage: '/images/7.jpg',
          dialogues: [
            '林婉儿：（气喘吁吁地跑回来）"云师妹，张师姐订了五串，她在丙字叁号静室！"',
            '云舒：（麻利地打包好）"给，辛苦了林师姐，这单的跑腿费记上。"',
            '这项服务虽然增加了些许工作量，但极大地提升了便利性和覆盖面，甚至吸引了一些原本嫌麻烦的内门弟子尝试。',
            '———— 第二章 完 ————'
          ],
          chapterEnd: true
        }
      ],
      end: false
    }
  }

  if (/opt2_B|2B|B2/i.test(id)) {
    return {
      attributesDelta: { '人气': 4, '商业头脑': 4 },
      statusesDelta: { '忠诚客户群体': '拥有部分稳定客源，抵抗风险能力稍强' },
      nextScenes: [
        {
          sceneId: 2301,
          backgroundImage: '/images/8.jpg',
          dialogues: [
            '云舒刻制了一批粗糙但实用的木质令牌，上面用灵力刻下编号和简单的计数阵法。',
            '这种新鲜的模式和"隐藏菜单"的诱惑，极大地刺激了弟子的重复消费和忠诚度。'
          ]
        },
        {
          sceneId: 2351,
          backgroundImage: '/images/8.jpg',
          dialogues: [
            '"会员制"不仅锁定了客源，还让"云记"有了一批忠实的"自来水"宣传员。',
            '这份稳定的客源让云舒更有底气去面对未来的挑战。',
            '———— 第二章 完 ————'
          ],
          chapterEnd: true
        }
      ],
      end: false
    }
  }

  if (/opt2_C|2C|C2/i.test(id)) {
    return {
      attributesDelta: { '灵石': 35, '商业头脑': 3 },
      statusesDelta: { '营销组合高手': '更容易设计出吸引人的促销方案' },
      nextScenes: [
        {
          sceneId: 2401,
          backgroundImage: '/images/9.jpg',
          dialogues: [
            '云舒精心设计了两种套餐："任务活力套餐"和"修炼续航套餐"。',
            '标准化和捆绑销售带来了效率的提升和额外的利润，点餐速度更快，排队问题得到缓解。'
          ]
        },
        {
          sceneId: 2451,
          backgroundImage: '/images/9.jpg',
          dialogues: [
            '许多弟子一看便觉得划算省事，直接选择套餐。',
            '这让云舒有更多时间专注于品质与扩张策略。',
            '———— 第二章 完 ————'
          ],
          chapterEnd: true
        }
      ],
      end: false
    }
  }

  // 第一章选项 A：显性插入新场景（分支长剧情）
  if (/^opt_A$|^A$/i.test(id)) {
    return {
      attributesDelta: { '灵石': 30, '人气': 3, '商业头脑': 2 },
      statusesDelta: { '小有名气的美食家': '餐饮活动吸引力提升' },
      nextScenes: [
        {
          sceneId: 1101,
          backgroundImage: '/images/2.jpg',
          dialogues: [
            '当晚，云舒的小摊在回宿舍的路上支了起来。诱人的香气瞬间吸引了不少弟子。',
            '灵肉串两块灵石一串，灵茶一块灵石一碗！第一天下来，成本收回，还净赚了三十块灵石！'
          ]
        },
        {
          sceneId: 1151,
          backgroundImage: '/images/1.jpg',
          dialogues: [
            '她将多数收益投入系统。',
            '【充值成功！消耗100下品灵石！】',
            '【修为提升至炼气期四层！】',
            '一股暖流瞬间涌遍全身，疲惫一扫而空，感觉身体更加轻盈，感知也更加敏锐。'
          ]
        },
        {
          sceneId: 1161,
          backgroundImage: '/images/1.jpg',
          dialogues: [
            '云舒：（感受着体内增长的力量，握紧拳头）"成功了！氪金修仙，果然名不虚传！这才是第一步，我云舒的仙商致富路，才刚刚开始！"',
            '她望向窗外皎洁的月光，心中已有了更宏大的商业蓝图。而她没有注意到，在远处一座山峰之上，一位气质清冷、身着核心弟子服饰的青年（大师兄凌清晏），正微微蹙眉望着她这边今日异常热闹的方向。',
            '———— 第一章 完 ————'
          ],
          chapterEnd: true
        }
      ],
      end: false
    }
  }

  // 第一章选项 B：短场景 + 明显属性变化
  if (/^opt_B$|^B$/i.test(id)) {
    return {
      attributesDelta: { '灵石': 150, '人气': 5, '商业头脑': 3 },
      statusesDelta: { '初露锋芒的信息贩子': '更容易打听到消息' },
      nextScenes: [
        {
          sceneId: 1201,
          backgroundImage: '/images/2.jpg',
          dialogues: [
            '她与师姐分工合作，第一版《青云宗生存指南（新人必看）》问世。第一批玉简几乎被抢购一空。',
            '收入可观，你们分配后净得灵石丰厚，事业刚起便人气大增。'
          ]
        },
        {
          sceneId: 1251,
          backgroundImage: '/images/1.jpg',
          dialogues: [
            '云舒毫不犹豫地将大部分收益投入系统。',
            '【充值成功！消耗100下品灵石！】',
            '【修为提升至炼气期四层！】',
            '她感受到体内生机流转，修为骤增。'
          ]
        },
        {
          sceneId: 1261,
          backgroundImage: '/images/1.jpg',
          dialogues: [
            '云舒：（感受着体内增长的力量，握紧拳头）"成功了！氪金修仙，果然名不虚传！这才是第一步，我云舒的仙商致富路，才刚刚开始！"',
            '她望向窗外皎洁的月光，心中已有了更宏大的商业蓝图。而她没有注意到，在远处一座山峰之上，一位气质清冷、身着核心弟子服饰的青年（大师兄凌清晏），正微微蹙眉望着她这边今日异常热闹的方向。',
            '———— 第一章 完 ————'
          ],
          chapterEnd: true
        }
      ],
      end: false
    }
  }

  // 第一章选项 C：替换当前场景的对话（即时反应）
  if (/^opt_C$|^C$/i.test(id)) {
    return {
      attributesDelta: { '灵石': 80, '人气': 4, '商业头脑': 2 },
      statusesDelta: { '别出心裁的娱乐策划者': '组织活动成功率提升' },
      nextScenes: [
        {
          sceneId: 1301,
          backgroundImage: '/images/2.jpg',
          dialogues: [
            '云舒设立了"青云休闲角"，规则是支付一块灵石可以游玩一个时辰。',
            '很快这种新奇有趣的社交娱乐方式在弟子中传播开来，一天下来收入颇丰。'
          ]
        },
        {
          sceneId: 1351,
          backgroundImage: '/images/1.jpg',
          dialogues: [
            '她将大部分收益投入系统。',
            '【充值成功！消耗100下品灵石！】',
            '【修为提升至炼气期四层！】',
            '体内一阵温暖，云舒知道这只是开始。'
          ]
        },
        {
          sceneId: 1361,
          backgroundImage: '/images/1.jpg',
          dialogues: [
            '云舒：（感受着体内增长的力量，握紧拳头）"成功了！氪金修仙，果然名不虚传！这才是第一步，我云舒的仙商致富路，才刚刚开始！"',
            '她望向窗外皎洁的月光，心中已有了更宏大的商业蓝图。而她没有注意到，在远处一座山峰之上，一位气质清冷、身着核心弟子服饰的青年（大师兄凌清晏），正微微蹙眉望着她这边今日异常热闹的方向。',
            '———— 第一章 完 ————'
          ],
          chapterEnd: true
        }
      ],
      end: false
    }
  }

  // 其它/默认：通用轻微变化并返回替换对话
  return {
    attributesDelta: { '声望': 2 },
    statusesDelta: { '谨小慎微': '1日内行动成功率提升' },
    nextScenes: [],
    end: false
  }
}

/**
 * 获取初始场景（兼容性包装器）
 * @param {string|number} workId - 作品 ID
 * @returns {Promise<Array>}
 */
export async function getInitialScenes(workId) {
  const res = await getScenes(workId, 0)
  return res.scenes || []
}

// 导出所有 API
export default {
  getScenes,
  submitChoice,
  getInitialScenes
}
