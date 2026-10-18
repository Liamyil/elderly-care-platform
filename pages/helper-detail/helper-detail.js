// 互助员详情页：档案（helper-data.js）+ 真实接单数（用户接口）+ 真实评价（本人订单中对该互助员的评价）
const { OrderAPI, UserAPI } = require('../../utils/api')
const { HELPER_PROFILES } = require('../../utils/helper-data')

Page({
  data: {
    statusBarHeight: 0,
    name: '',
    profile: {},
    serviceCount: 0,
    avgRating: 0,
    avgStarText: '暂无评价',
    reviews: []
  },

  onLoad(options) {
    const systemInfo = wx.getSystemInfoSync()
    const name = options && options.name ? decodeURIComponent(options.name) : ''
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      name: name,
      profile: HELPER_PROFILES[name] || {}
    })
    this.loadData(name)
  },

  async loadData(name) {
    // 真实接单数
    try {
      const users = await UserAPI.listUsers({ silent: true })
      const found = (users || []).find(function (u) { return u.name === name })
      this.setData({ serviceCount: found ? (found.service_count || 0) : 0 })
    } catch (e) {
      console.error('加载互助员数据失败:', e)
    }

    // 真实评价：从我的已完成订单中汇总对该互助员的评价
    try {
      const orders = await OrderAPI.getOrders(null, { silent: true })
      const reviews = (orders || [])
        .filter(function (o) { return o.helper === name && o.rating })
        .map(function (o) {
          return {
            rating: o.rating,
            comment: o.comment || '用户未填写评价内容',
            time: o.publishTime || '',
            starText: '⭐'.repeat(o.rating)
          }
        })
      let avgRating = 0
      let avgStarText = '暂无评价'
      if (reviews.length > 0) {
        const sum = reviews.reduce(function (s, r) { return s + r.rating }, 0)
        avgRating = Math.round((sum / reviews.length) * 10) / 10
        avgStarText = '⭐'.repeat(Math.round(avgRating)) + ' ' + avgRating + '分'
      }
      this.setData({ reviews: reviews, avgRating: avgRating, avgStarText: avgStarText })
    } catch (e) {
      console.error('加载评价失败:', e)
    }
  },

  goBack() {
    wx.navigateBack()
  }
})
