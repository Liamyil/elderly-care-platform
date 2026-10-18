// 健康评估问卷（陪诊专项）：下单前评估身体状况，帮互助员提前了解照护需求
// 结果存本地（storage + globalData），发布陪诊订单时自动附带在需求描述里
// 注意：WXML 不支持方法调用（如 indexOf）和 obj[key] 动态取值，
// 选中态必须在 JS 里预先算好平铺到每个选项上（opt.on），模板只做简单三元判断
const QUESTIONS = [
  {
    key: 'mobility', title: '行动能力',
    options: [
      { label: '能自主行走', score: 0 },
      { label: '需搀扶或拐杖', score: 1 },
      { label: '需轮椅', score: 2 },
      { label: '卧床不便', score: 3 }
    ]
  },
  {
    key: 'selfcare', title: '自理能力',
    options: [
      { label: '完全自理', score: 0 },
      { label: '部分需要帮助', score: 1 },
      { label: '基本无法自理', score: 2 }
    ]
  },
  {
    key: 'hearing', title: '听力情况',
    options: [
      { label: '正常', score: 0 },
      { label: '较差，需大声交流', score: 1 },
      { label: '很差，需手势或写字', score: 2 }
    ]
  },
  {
    key: 'vision', title: '视力情况',
    options: [
      { label: '正常', score: 0 },
      { label: '较差，能看清大字', score: 1 },
      { label: '很差，需口述指引', score: 2 }
    ]
  },
  {
    key: 'chronic', title: '慢性疾病（可多选）', multi: true,
    options: [
      { label: '无', score: 0 },
      { label: '高血压', score: 1 },
      { label: '糖尿病', score: 1 },
      { label: '心脏病', score: 2 },
      { label: '其他慢病', score: 1 }
    ]
  },
  {
    key: 'allergy', title: '过敏史（可多选）', multi: true,
    options: [
      { label: '无', score: 0 },
      { label: '药物过敏', score: 1 },
      { label: '食物过敏', score: 1 }
    ]
  }
]

// 风险分级：0-3 低风险 / 4-6 中风险 / 7 及以上高风险
function riskLevel(score) {
  if (score <= 3) return { key: '低风险', color: '#2D7D46' }
  if (score <= 6) return { key: '中风险', color: '#E8852E' }
  return { key: '高风险', color: '#E23B3B' }
}

// 根据题目的选中状态，给每个选项计算 on 标记（模板渲染用）
function decorate(q) {
  return Object.assign({}, q, {
    options: q.options.map(function (opt, i) {
      const on = q.multi ? q.selectedArr.indexOf(i) > -1 : q.selected === i
      return Object.assign({}, opt, { on: on })
    })
  })
}

Page({
  data: {
    statusBarHeight: 0,
    questions: [],    // 每题：单选 selected（下标，-1 未选）/ 多选 selectedArr（下标数组）；选项带 on 标记
    note: '',
    submitted: false,
    result: null,
    summaryText: ''
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    const saved = wx.getStorageSync('peizhenAssessment')

    // 上次填过的答案回填到题目对象上
    const questions = QUESTIONS.map(function (q) {
      const savedVal = saved && saved.answers ? saved.answers[q.key] : undefined
      let base
      if (q.multi) {
        const arr = Array.isArray(savedVal) ? savedVal.map(Number) : []
        base = Object.assign({}, q, { selectedArr: arr })
      } else {
        base = Object.assign({}, q, { selected: savedVal === undefined ? -1 : Number(savedVal) })
      }
      return decorate(base)
    })

    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      questions: questions,
      note: saved && saved.note ? saved.note : ''
    })
  },

  goBack() {
    wx.navigateBack()
  },

  onOptionTap(e) {
    const qi = Number(e.currentTarget.dataset.qi)
    const idx = Number(e.currentTarget.dataset.idx)
    const questions = this.data.questions.map(function (q) { return q })
    const q = questions[qi]
    if (!q) return

    if (q.multi) {
      let arr = q.selectedArr.slice()
      const label = q.options[idx].label
      if (label === '无') {
        // 选「无」时清空其他选项
        arr = [idx]
      } else {
        const noneIdx = q.options.findIndex(function (o) { return o.label === '无' })
        arr = arr.filter(function (i) { return i !== noneIdx })
        const pos = arr.indexOf(idx)
        if (pos > -1) {
          arr.splice(pos, 1)
        } else {
          arr.push(idx)
        }
      }
      questions[qi] = decorate(Object.assign({}, q, { selectedArr: arr }))
    } else {
      questions[qi] = decorate(Object.assign({}, q, { selected: idx }))
    }
    this.setData({ questions: questions })
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value })
  },

  onSubmit() {
    const qs = this.data.questions

    // 校验：单选必须全答；多选未答按「无」处理
    for (const q of qs) {
      if (!q.multi && q.selected < 0) {
        wx.showToast({ title: '请完成「' + q.title + '」后再提交', icon: 'none' })
        return
      }
    }

    // 计分 + 汇总关键情况 + 组装存储格式（key -> 下标/下标数组）
    let score = 0
    const parts = []
    const answers = {}
    for (const q of qs) {
      const shortTitle = q.title.replace(/（.*）/, '')
      if (q.multi) {
        const arr = (q.selectedArr && q.selectedArr.length > 0)
          ? q.selectedArr
          : [q.options.findIndex(function (o) { return o.label === '无' })]
        answers[q.key] = arr
        for (const i of arr) {
          const opt = q.options[i]
          score += opt.score
          if (opt.label !== '无') parts.push(opt.label)
        }
      } else {
        const opt = q.options[q.selected]
        answers[q.key] = q.selected
        score += opt.score
        if (opt.score > 0) parts.push(shortTitle + '：' + opt.label)
      }
    }

    const risk = riskLevel(score)
    const summaryText = parts.length > 0 ? parts.join('、') : '身体状况良好，无特殊照护需求'
    const result = {
      risk: risk.key,
      color: risk.color,
      score: score,
      summaryText: summaryText,
      answers: answers,
      note: this.data.note,
      time: new Date().toLocaleString('zh-CN', { hour12: false })
    }

    wx.setStorageSync('peizhenAssessment', result)
    const app = getApp()
    if (app && app.globalData) {
      app.globalData.peizhenAssessment = result
    }

    this.setData({
      submitted: true,
      result: result,
      summaryText: summaryText
    })
  },

  onRedo() {
    this.setData({ submitted: false, result: null })
  },

  onFinish() {
    wx.navigateBack()
  }
})
