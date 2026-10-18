Page({
  data: {
    statusBarHeight: 0,
    isSOSSent: false,
    contacts: [
      { id: '1', name: '张伟', relation: '儿子', phone: '138****1234' },
      { id: '2', name: '王芳', relation: '女儿', phone: '139****5678' },
      { id: '3', name: '李阿姨', relation: '邻居', phone: '137****9012' }
    ]
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight
    })
  },

  goBack() {
    wx.navigateBack()
  },

  onSOSClick() {
    if (this.data.isSOSSent) {
      wx.showToast({
        title: '求助已发出，正在处理中',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '紧急求助',
      content: '确认发起紧急求助吗？将通知您的家属和附近互助员。',
      confirmColor: '#F44336',
      confirmText: '确认求助',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            isSOSSent: true
          })
          wx.showToast({
            title: '⚠️ SOS告警已发出！已通知家属和附近互助员',
            icon: 'none',
            duration: 3000
          })
        }
      }
    })
  }
})