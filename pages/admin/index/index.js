// 管理员工作台（小程序管理员端）：统计概览 + 订单管理入口
// 手机端完成审核/指派，方便管理员不在电脑旁时处理
const app = getApp()
const { AdminAPI } = require('../../../utils/api')

Page({
  data: {
    statusBarHeight: 0,
    role: '',
    stats: {}
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: sysInfo.statusBarHeight })
  },

  onShow() {
    const user = app.globalData.userInfo
    const role = (user && user.role) || ''
    // 非管理角色误入 → 回居民端
    if (['管理员', '民政管理员', '超级管理员'].indexOf(role) < 0) {
      wx.reLaunch({ url: '/pages/index/index' })
      return
    }
    this.setData({ role: role })
    this.loadStats()
  },

  async loadStats() {
    try {
      const stats = await AdminAPI.getAdminStats({ silent: true })
      this.setData({ stats: stats || {} })
    } catch (e) {
      console.error('加载统计失败:', e ? (e.stack || e.message || JSON.stringify(e)) : 'unknown')
    }
  },

  goOrders(e) {
    const status = e.currentTarget.dataset.status || ''
    wx.navigateTo({
      url: '/pages/admin/orders/orders' + (status ? '?status=' + status : '')
    })
  },

  // 互助员注册申请审核（社区管理员）
  goHelperAudit() {
    wx.navigateTo({ url: '/pages/admin/helper-audit/helper-audit' })
  },

  // 系统配置 + 操作日志（社区管理员/超级管理员可改，民政管理员只读查看）
  goConfig() {
    wx.navigateTo({ url: '/pages/admin/config/config' })
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出管理员账号吗？',
      confirmColor: '#E8852E',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('token')
          wx.removeStorageSync('userInfo')
          app.globalData.userInfo = null
          wx.reLaunch({ url: '/pages/index/index' })
        }
      }
    })
  }
})
