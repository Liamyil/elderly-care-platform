const app = getApp()
const { BankAPI, OrderAPI, UserAPI } = require('../../../utils/api')

Page({
  data: {
    statusBarHeight: 0,
    userInfo: {
      name: '',
      phone: '',
      role: '互助员',
      avatar: '',
      timeCoins: 0,
      rmbBalance: 0,
      serviceCount: 0,
      evaluationScore: '5.0'
    },
    showLogin: false
  },

  onLoad() {
    var sysInfo = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: sysInfo.statusBarHeight })
  },

  onShow() {
    if (!app.globalData.userInfo) {
      // 游客进入互助员我的页 → 弹出登录提示
      this.setData({ showLogin: true })
      return
    }
    this.loadUserInfo()
  },

  onLoginSuccess() {
    this.setData({ showLogin: false })
    this.loadUserInfo()
  },

  onLoginClose() {
    this.setData({ showLogin: false })
  },

  async loadUserInfo() {
    try {
      var user = app.globalData.userInfo
      var balanceData = await BankAPI.getBalance()
      var rmbBalance = 0
      try {
        // 人民币余额（元）：来自 /api/user/info 的 rmbBalance 字段（双轨制，陪诊单结算入账）
        var infoData = await UserAPI.getUserInfo()
        rmbBalance = infoData.rmbBalance || 0
      } catch (e) {
        console.error('获取人民币余额失败:', e)
      }

      this.setData({
        userInfo: {
          name: user.name || user.nickname || '互助员',
          phone: user.phone || '',
          role: '互助员',
          avatar: user.avatar || '',
          timeCoins: balanceData.balance || 0,
          rmbBalance: rmbBalance,
          serviceCount: user.serviceCount || 0,
          evaluationScore: user.evaluationScore || '5.0'
        }
      })
    } catch (error) {
      console.error('加载用户信息失败:', error)
      var user = app.globalData.userInfo
      this.setData({
        userInfo: {
          name: user.name || user.nickname || '互助员',
          phone: user.phone || '',
          role: '互助员',
          avatar: user.avatar || '',
          timeCoins: 0,
          rmbBalance: 0,
          serviceCount: 0,
          evaluationScore: '5.0'
        }
      })
    }
  },

  goToSettings() {
    wx.navigateTo({ url: '/pages/setting/setting' })
  },

  goToOrderList() {
    wx.reLaunch({ url: '/pages/helper/order/order' })
  },

  /** 切换至发单端（双重身份共存）：写模式缓存 → 有服务中订单给弱提示 → 进入普通用户首页 */
  onSwitchToUser() {
    app.setCurrentMode('user')
    OrderAPI.getOrders('serving', { silent: true }).then((list) => {
      if (list && list.length > 0) {
        wx.showToast({ title: '您有正在进行的服务订单，请注意时间', icon: 'none', duration: 2000 })
        setTimeout(() => {
          wx.reLaunch({ url: '/pages/index/index' })
        }, 1200)
      } else {
        wx.reLaunch({ url: '/pages/index/index' })
      }
    }).catch(() => {
      wx.reLaunch({ url: '/pages/index/index' })
    })
  },

  goToAccount() {
    wx.navigateTo({ url: '/pages/account/account' })
  },

  goToBank() {
    wx.reLaunch({ url: '/pages/helper/bank/bank' })
  },

  goToEvaluation() {
    wx.showToast({ title: '服务评价功能开发中', icon: 'none' })
  },

  goToAbout() {
    wx.navigateTo({ url: '/pages/about/about' })
  },

  goToCredit() {
    wx.showToast({ title: '信用积分功能开发中', icon: 'none' })
  },

  onProfileClick() {
    // 与居民端一致：点头像进入个人信息页
    wx.navigateTo({ url: '/pages/profile/profile' })
  },

  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      confirmText: '退出',
      confirmColor: '#E8852E',
      success: function (res) {
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
