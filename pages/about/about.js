Page({
  data: {
    statusBarHeight: 0
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight
    })
  },

  goBack() {
    wx.navigateBack()
  }
})