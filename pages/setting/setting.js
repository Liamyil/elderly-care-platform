const app = getApp()

Page({
  data: {
    statusBarHeight: 0,
    userName: '张大爷',
    emergencyCount: 2,
    addressCount: 3,
    notificationOn: true,
    cacheSize: '12.5MB'
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight
    })
    this.loadUserInfo()
  },

  onShow() {
    this.loadUserInfo()
  },

  loadUserInfo() {
    const userInfo = app.globalData.userInfo
    if (userInfo) {
      this.setData({
        userName: userInfo.name || '张大爷'
      })
    }
  },

  goBack() {
    wx.navigateBack()
  },

  goToProfile() {
    wx.navigateTo({
      url: '/pages/profile/profile'
    })
  },

  goToEmergency() {
    wx.navigateTo({
      url: '/pages/emergency/emergency'
    })
  },

  goToAddress() {
    wx.navigateTo({
      url: '/pages/address/address'
    })
  },

  onNotificationChange(e) {
    const checked = e.detail.value
    this.setData({
      notificationOn: checked
    })
    wx.showToast({
      title: checked ? '消息通知已开启' : '消息通知已关闭',
      icon: 'none'
    })
  },

  goToAbout() {
    wx.navigateTo({
      url: '/pages/about/about'
    })
  },

  onClearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除缓存吗？',
      confirmColor: '#2D7D46',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            cacheSize: '0MB'
          })
          wx.showToast({
            title: '缓存已清除',
            icon: 'success'
          })
        }
      }
    })
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      confirmColor: '#E8852E',
      success: (res) => {
        if (res.confirm) {
          app.clearUserInfo()
          wx.removeStorageSync('token')
          wx.reLaunch({
            url: '/pages/index/index'
          })
        }
      }
    })
  }
})