// 互助员展示页：数据来自用户列表接口（按角色过滤），星级按完成订单数推导
const { UserAPI } = require('../../utils/api')

function starsFor(count) {
  if (count >= 10) return 5
  if (count >= 4) return 4
  if (count >= 1) return 3
  return 0
}

Page({
  data: {
    statusBarHeight: 0,
    helpers: []
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight
    })
    this.loadHelpers()
  },

  async loadHelpers() {
    try {
      const users = await UserAPI.listUsers()
      const helpers = (users || [])
        .filter(function (u) { return u.role === '互助员' })
        .map(function (u) {
          const count = u.service_count || 0
          const stars = starsFor(count)
          return {
            name: u.name,
            serviceCount: count,
            starText: stars > 0 ? '⭐'.repeat(stars) : '暂无服务记录'
          }
        })
        .sort(function (a, b) { return b.serviceCount - a.serviceCount })
      this.setData({ helpers: helpers })
    } catch (error) {
      console.error('加载互助员失败:', error)
      wx.showToast({ title: '加载失败，请重试', icon: 'none' })
    }
  },

  goBack() {
    wx.navigateBack()
  },

  goDetail(e) {
    const name = e.currentTarget.dataset.name
    wx.navigateTo({
      url: '/pages/helper-detail/helper-detail?name=' + encodeURIComponent(name)
    })
  }
})
