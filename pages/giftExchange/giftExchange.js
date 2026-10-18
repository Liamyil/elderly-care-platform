const app = getApp()
const { post, get } = require('../../utils/request')

Page({
  data: {
    statusBarHeight: 0,
    timeCoins: 0,
    gifts: [
      { id: 'G001', name: '大米', emoji: '🍚', coins: 10, exchanged: false },
      { id: 'G002', name: '食用油', emoji: '🫒', coins: 15, exchanged: false },
      { id: 'G003', name: '洗衣液', emoji: '🧴', coins: 8, exchanged: false },
      { id: 'G004', name: '保温杯', emoji: '🥤', coins: 20, exchanged: false }
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
    const gift = this.data.gifts.find(g => g.id === id)

    if (!gift) return

    if (gift.exchanged) {
      return
    }

    if (this.data.timeCoins < gift.coins) {
      wx.showToast({
        title: '时间币不足，请先赚取更多时间币',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '确认兑换',
      content: `确认使用${gift.coins}时间币兑换该商品吗？`,
      confirmColor: '#2D7D46',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await post('/api/bank/exchange/gift', { giftId: id })

            const newGifts = this.data.gifts.map(g =>
              g.id === id ? { ...g, exchanged: true } : g
            )

            this.setData({
              gifts: newGifts,
              timeCoins: result.balance
            })

            if (app.globalData.userInfo) {
              app.saveUserInfo({
                ...app.globalData.userInfo,
                timeCoins: result.balance
              })
            }

            wx.showToast({
              title: `兑换成功！已扣除${gift.coins}时间币`,
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
