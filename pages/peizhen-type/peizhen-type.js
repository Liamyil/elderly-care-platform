// 陪诊类型详情页：数据来自 utils/peizhen-data.js（补充真实数据只改那个文件）
// 客服热线为演示占位号码，正式号码确定后替换 KEFU_PHONE
const { PEIZHEN_TYPES } = require('../../utils/peizhen-data')
const { OrderAPI } = require('../../utils/api')
const KEFU_PHONE = '4000000000'

Page({
  data: {
    statusBarHeight: 0,
    type: {
      name: '',
      category: '',
      icon: '🏥',
      image: '',
      baseInfo: '',
      sales: '',
      price: ''
    },
    assessStatus: '',
    evaluations: []
  },

  onLoad(options) {
    const systemInfo = wx.getSystemInfoSync()
    const name = options && options.name ? decodeURIComponent(options.name) : ''
    const found = PEIZHEN_TYPES.find(function (t) { return t.name === name })
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      type: found || { name: name, category: '陪诊服务', icon: '🏥', image: '', baseInfo: '', sales: '', price: '' }
    })
  },

  onShow() {
    // 从健康评估问卷返回后刷新状态；评价数据也实时刷新
    const saved = wx.getStorageSync('peizhenAssessment')
    this.setData({
      assessStatus: saved && saved.risk ? saved.risk : ''
    })
    this.loadEvaluations()
  },

  async loadEvaluations() {
    try {
      // 按子类型精准展示：该服务项自己的评价
      const list = await OrderAPI.getEvaluations('陪诊服务', this.data.type.name, { silent: true })
      const evaluations = (Array.isArray(list) ? list : []).map(function (o) {
        return {
          stars: '★★★★★'.slice(0, o.rating || 5),
          helper: o.helper || '互助员',
          comment: (o.comment && String(o.comment).trim()) ? o.comment : '用户未填写评价内容，默认好评',
          date: o.serviceTime ? o.serviceTime.split(' ')[0] : ''
        }
      })
      this.setData({ evaluations: evaluations })
    } catch (e) {
      console.error('加载评价失败:', e ? (e.stack || e.message || JSON.stringify(e)) : 'unknown')
    }
  },

  goBack() {
    wx.navigateBack()
  },

  goAssessment() {
    wx.navigateTo({
      url: '/pages/health-assessment/health-assessment'
    })
  },

  onContact() {
    wx.showModal({
      title: '联系客服',
      content: '客服热线：400-000-0000\n服务时间 9:00-18:00',
      confirmText: '拨打',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          wx.makePhoneCall({ phoneNumber: KEFU_PHONE })
        }
      }
    })
  },

  onOrder() {
    wx.navigateTo({
      url: '/pages/peizhen-order/peizhen-order?type=' + encodeURIComponent(this.data.type.name)
    })
  }
})
