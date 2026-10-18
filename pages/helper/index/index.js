const app = getApp()
const { IndexAPI, BankAPI, OrderAPI } = require('../../../utils/api')
const { getBaseUrl } = require('../../../utils/request')
const { requestSubscribe } = require('../../../utils/subscribe')

Page({
  data: {
    statusBarHeight: 0,
    orders: [],
    userTimeCoins: 0,
    serviceCount: 0,
    hasUnreadMessages: true,
    showImageModal: false,
    showLogin: false,
    previewImages: []
  },

  onLoad() {
    var sysInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight
    })
  },

  onShow() {
    if (!app.globalData.userInfo) {
      // 游客进入互助员端 → 弹出登录提示
      this.setData({ showLogin: true })
      return
    }
    this.loadHomeData()
    this.startAutoRefresh()
  },

  onLoginSuccess() {
    this.setData({ showLogin: false })
    this.loadHomeData()
    this.startAutoRefresh()
  },

  onLoginClose() {
    this.setData({ showLogin: false })
  },

  async loadHomeData(silent) {
    if (this._loading) return
    this._loading = true
    try {
      var silentOpts = silent ? { silent: true } : null
      var homeData = await IndexAPI.getHomeData(silentOpts)
      var balanceData = await BankAPI.getBalance(silentOpts)

      this.setData({
        orders: this.processOrders(homeData.nearbyOrders || []),
        userTimeCoins: balanceData.balance || 0
      })
    } catch (error) {
      console.error('加载首页数据失败:', error)
    } finally {
      this._loading = false
    }
  },

  // 双端实时同步：页面可见时每 5 秒静默刷新一次订单广场
  startAutoRefresh() {
    var that = this
    this.stopAutoRefresh()
    this._autoTimer = setInterval(function () { that.loadHomeData(true) }, 5000)
  },

  stopAutoRefresh() {
    if (this._autoTimer) {
      clearInterval(this._autoTimer)
      this._autoTimer = null
    }
  },

  onHide() {
    this.stopAutoRefresh()
  },

  onUnload() {
    this.stopAutoRefresh()
  },

  processOrders(orders) {
    if (!Array.isArray(orders)) return []
    return orders.map(function (order) {
      if (!order.images || !Array.isArray(order.images)) {
        order.images = []
      }
      if (!order.distance) {
        order.distance = ''
      }
      if (!order.userNickname) {
        order.userNickname = '匿名用户'
      }
      return order
    })
  },

  goToNotice() {
    this.setData({ hasUnreadMessages: false })
    wx.navigateTo({ url: '/pages/notice/notice' })
  },

  grabOrder(e) {
    var orderId = e.currentTarget.dataset.orderId
    var order = this.data.orders.find(function (o) { return o.id === orderId })

    if (!order) {
      wx.showToast({ title: '订单信息有误', icon: 'none' })
      return
    }

    wx.showModal({
      title: '确认接单',
      content: '服务类型：' + order.type + '\n地址：' + order.address + '\n' + (order.priceText ? '价格：¥' + order.priceText : '奖励：' + order.reward + '时间币'),
      confirmText: '确认接单',
      confirmColor: '#2D7D46',
      success: (res) => {
        if (res.confirm) {
          // 接单后引导订阅服务提醒（指派/超时/结算到账）
          requestSubscribe()
          this.handleAcceptOrder(order)
        }
      }
    })
  },

  handleAcceptOrder(order) {
    wx.showLoading({ title: '接单中...', mask: true })
    OrderAPI.acceptOrder(order.id)
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: '接单成功', icon: 'success' })
        this.loadHomeData()
      })
      .catch((error) => {
        wx.hideLoading()
        wx.showToast({
          title: (error && error.message) ? String(error.message) : '接单失败',
          icon: 'none'
        })
      })
  },

  onViewImages(e) {
    var orderId = e.currentTarget.dataset.orderId
    var order = this.data.orders.find(function (o) { return o.id === orderId })
    if (!order || !order.images || order.images.length === 0) return

    var baseUrl = getBaseUrl()
    var fixUrl = function (url) {
      if (!url) return url
      return url.replace(/https?:\/\/[^/]+/, baseUrl)
    }
    var fixedImages = order.images.map(fixUrl)

    this.setData({
      showImageModal: true,
      previewImages: fixedImages
    })

    var sysInfo = wx.getSystemInfoSync()
    if (sysInfo.platform !== 'devtools') {
      this.downloadAndReplace(fixedImages)
    }
  },

  downloadAndReplace(remoteUrls) {
    var that = this
    wx.showLoading({ title: '加载图片中...', mask: true })
    var results = []
    var loaded = 0

    remoteUrls.forEach(function (url, i) {
      wx.downloadFile({
        url: url,
        success: function (res) {
          results[i] = res.statusCode === 200 ? res.tempFilePath : url
        },
        fail: function () {
          results[i] = url
        },
        complete: function () {
          loaded++
          if (loaded === remoteUrls.length) {
            wx.hideLoading()
            var finalPaths = remoteUrls.map(function (_, i) { return results[i] || remoteUrls[i] })
            that.setData({ previewImages: finalPaths })
          }
        }
      })
    })
  },

  onCloseImageModal() {
    this.setData({ showImageModal: false, previewImages: [] })
  },

  onPreviewImage(e) {
    var index = e.currentTarget.dataset.index
    wx.previewImage({
      current: this.data.previewImages[index],
      urls: this.data.previewImages
    })
  },

  onImageError(e) {
    console.error('图片加载失败:', e.detail)
  },

  preventClose() { }
})
