// Mock: 返回一组报告变体（variants），每个变体包含匹配条件的元数据（minAttributes, requiredStatuses）
export function getPersonalityReportVariants() {
  return [
    {
      id: 'v_machiavelli',
      minAttributes: { '灵石': 100, '商业头脑': 15 },
      requiredStatuses: { '线人网络': true },
      report: {
        title: '宫心计谋家',
        content: '你在深宫中展现了出色的智慧与手段，善于察言观色，步步为营。你的每一个选择都经过深思熟虑，最终在宫斗中占据了有利位置。',
        traits: ['善于谋划', '察言观色', '步步为营', '深谋远虑'],
        scores: { 智慧: 95, 手段: 88, 人缘: 75, 威望: 82 }
      }
    },
    {
      id: 'v_poetess',
      minAttributes: { '灵石': 50 },
      requiredStatuses: {},
      report: {
        title: '才华横溢的文雅佳人',
        content: '你凭借出众的才华和优雅的气质在宫中赢得了众人的赞赏。无论是诗词歌赋还是琴棋书画，你都能信手拈来，成为宫中的一道亮丽风景。',
        traits: ['才华出众', '气质优雅', '博学多才', '温文尔雅'],
        scores: { 才华: 92, 气质: 90, 学识: 85, 魅力: 88 }
      }
    },
    {
      id: 'v_innocent',
      minAttributes: { '灵石': 50, '商业头脑': 0 },
      requiredStatuses: { '美食家称号': '新晋美食家' },
      report: {
        title: '天真烂漫的纯真少女',
        content: '你保持着一颗纯真的心，在复杂的宫廷中依然坚持自己的本心。虽然不善权谋，但你的真诚和善良为你赢得了真心朋友。',
        traits: ['心地善良', '真诚待人', '天真无邪', '坚持本心'],
        scores: { 纯真: 95, 善良: 92, 真诚: 90, 坚韧: 78 }
      }
    }
  ]
}

// 兼容旧接口：直接基于 attributes/statuses 从变体中选择一个报告
export function getPersonalityReport(attributes = {}, statuses = {}) {
  const variants = getPersonalityReportVariants()
  const match = variants.find(v => {
    try {
      const min = v.minAttributes || {}
      for (const k of Object.keys(min)) {
        if ((attributes[k] || 0) < (min[k] || 0)) return false
      }
      const req = v.requiredStatuses || {}
      for (const sk of Object.keys(req)) {
        const val = req[sk]
        if (val === true) {
          if (!statuses || statuses[sk] !== true) return false
        } else {
          if (!statuses || statuses[sk] !== val) return false
        }
      }
      return true
    } catch (e) { return false }
  })

  if (match) return match.report
  return {
    title: '初入宫闱的谨慎新人',
    content: '你在宫中小心翼翼，每一步都走得格外谨慎。虽然还在适应宫廷生活，但你的谨慎和观察力将会是你在深宫中生存的重要武器。',
    traits: ['小心谨慎', '善于观察', '稳重内敛', '厚积薄发'],
    scores: { 谨慎: 85, 观察力: 80, 适应力: 75, 潜力: 82 }
  }
}

export default { getPersonalityReport, getPersonalityReportVariants }
