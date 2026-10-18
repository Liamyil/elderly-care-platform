const app = getApp()
const { post, get } = require('../../utils/request')

Page({
  data: {
    statusBarHeight: 0,
    timeCoins: 0,
    services: [
      { id: 'S001', name: '家政服务', description: '2小时专业家政清洁', coins: 20, exchanged: false },
      { id: 'S002', name: '陪诊服务', description: '全程陪同就医', coins: 15, exchanged: false },
      { id: 'S003', name: '康复理疗', description: '专业康复师上门理疗', coins: 30, exchanged: false },
      { id: 'S004', name: '代买代办', description: '代买生活用品、代办事务', coins: 10, exchanged: false }
    ]
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight
    })
    this.loadBalance()
  },

  onShow() {
    this.loadBalance()
  },

  async loadBalance() {
    try {
      const balanceData = await get('/api/bank/balance')
      this.setData({
        timeCoins: balanceData.balance || 0
      })
    } catch (error) {
      console.error('加载余额失败:', error ? (error.stack || error.message || JSON.stringify(error)) : 'unknown')
    }
  },

  goBack() {
    wx.navigateBack()
  },

  async onExchange(e) {
    const id = e.currentTarget.dataset.id
    const service = this.data.services.find(s => s.id === id)

    if (!service) return

    if (service.exchanged) {
      return
    }

    if (this.data.timeCoins < service.coins) {
      wx.showToast({
        title: '时间币不足，请先赚取更多时间币',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '确认兑换',
      content: `确认使用${service.coins}时间币兑换该服务吗？`,
      confirmColor: '#2D7D46',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await post('/api/bank/exchange/service', { serviceId: id })

            const newServices = this.data.services.map(s =>
              s.id === id ? { ...s, exchanged: true } : s
            )

            this.setData({
              services: newServices,
              timeCoins: result.balance
            })

            if (app.globalData.userInfo) {
              app.saveUserInfo({
                ...app.globalData.userInfo,
                timeCoins: result.balance
              })
            }

            wx.showToast({
              title: `兑换成功！已扣除${service.coins}时间币`,
              icon: 'success'
            })
          } catch (error) {
            console.error('兑换失败:', error ? (error.stack || error.message || JSON.stringify(error)) : 'unknown')
          }
        }
      }
    })
  }
})
