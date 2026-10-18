const { OrderAPI } = require('../../../utils/api')
const { getBaseUrl } = require('../../../utils/request')

Page({
  data: {
    statusBarHeight: 0,
    statusTabs: [
      { key: 'serving', label: '服务中' },
      { key: 'completed', label: '已完成' },
      { key: 'cancelled', label: '已取消' }
    ],
    currentStatus: 'serving',
    currentStatusText: '服务中',
    currentIndex: 0,
    showImageModal: false,
    showLogin: false,
    previewImages: [],
    orders: {
      serving: [],
      completed: [],
      cancelled: []
    },
    tabCounts: [0, 0, 0]
  },

  onLoad() {
    var sysInfo = wx.getSystemInfoSync()
    this.setData({ statusBarHeight: sysInfo.statusBarHeight })
  },

  onShow() {
    var token = wx.getStorageSync('token')
    if (!token) {
      // 游客进入互助员订单页 → 弹出登录提示
      this.setData({ showLogin: true })
      return
    }
    this.loadOrders()
    this.startAutoRefresh()
  },

  onLoginSuccess() {
    this.setData({ showLogin: false })
    this.loadOrders()
    this.startAutoRefresh()
  },

  onLoginClose() {
    this.setData({ showLogin: false })
  },

  loadOrders(silent) {
    var that = this
    if (this._loading) return
    this._loading = true
    if (!silent) wx.showLoading({ title: '加载中...', mask: true })
    OrderAPI.getOrders(null, silent ? { silent: true } : null).then(function (allOrders) {
      var orders = {
        serving: [],
        completed: [],
        cancelled: []
      }

      if (allOrders && Array.isArray(allOrders)) {
        allOrders.forEach(function (order) {
          if (!order.isHelper) return

          var targetKey = order.statusKey
          if (targetKey === 'pending_confirm') {
            targetKey = 'serving'
          }
          if (targetKey && orders[targetKey]) {
            if (order.images && Array.isArray(order.images) && order.images.length > 0) {
              order.images = order.images
            } else {
              order.images = null
            }
            orders[targetKey].push(order)
          }
        })
      }

      orders.serving.sort(function (a, b) {
        var aTime = a.acceptedAt || a.publishTime || ''
        var bTime = b.acceptedAt || b.publishTime || ''
        return bTime.localeCompare(aTime)
      })

      const counts = []
      const countKeys = ['serving', 'completed', 'cancelled']
      countKeys.forEach(function (k) {
        counts.push((orders[k] || []).length)
      })

      that.setData({ orders: orders, tabCounts: counts })
    }).catch(function (error) {
      console.error('加载订单失败:', error)
      that.setData({
        orders: { serving: [], completed: [], cancelled: [] }
      })
      if (!silent) wx.showToast({ title: '加载失败，请重试', icon: 'none' })
    }).finally(function () {
      that._loading = false
      if (!silent) wx.hideLoading()
    })
  },

  // 双端实时同步：页面可见时每 5 秒静默刷新一次订单列表
  startAutoRefresh() {
    var that = this
    this.stopAutoRefresh()
    this._autoTimer = setInterval(function () { that.loadOrders(true) }, 5000)
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

  onStatusTabClick(e) {
    var index = e.currentTarget.dataset.index
    var tabs = this.data.statusTabs
    if (index >= 0 && index < tabs.length) {
      this.setData({
        currentIndex: index,
        currentStatus: tabs[index].key,
        currentStatusText: tabs[index].label
      })
    }
  },

  onSwiperChange(e) {
    var index = e.detail.current
    var tabs = this.data.statusTabs
    if (index >= 0 && index < tabs.length) {
      this.setData({
        currentIndex: index,
        currentStatus: tabs[index].key,
        currentStatusText: tabs[index].label
      })
    }
  },

  onContactHelper(e) {
    wx.showToast({ title: '联系TA功能开发中', icon: 'none' })
  },

  onGoTrace(e) {
    var orderId = e.currentTarget.dataset.id
    var kind = e.currentTarget.dataset.kind === 'end' ? 'end' : 'start'
    wx.navigateTo({
      url: '/pages/helper/trace/trace?orderId=' + orderId + '&kind=' + kind
    })
  },

  findOrder(orderId) {
    var allOrders = this.data.orders
    var keys = ['serving', 'completed', 'cancelled']
    for (var i = 0; i < keys.length; i++) {
      var orderList = allOrders[keys[i]] || []
      for (var j = 0; j < orderList.length; j++) {
        if (orderList[j].id === orderId) return orderList[j]
      }
    }
    return null
  },

  onCompleteService(e) {
    var that = this
    var orderId = e.currentTarget.dataset.id

    // 方案要求：完工打卡（拍照留痕）是完成服务的前置条件
    var order = this.findOrder(orderId)
    if (!order || !order.traceSummary || !order.traceSummary.hasEnd) {
      wx.showModal({
        title: '请先完工打卡',
        content: '按平台要求，完成服务前需要先做"完工打卡"（定位+现场拍照留痕）。',
        confirmText: '去完工打卡',
        confirmColor: '#2D7D46',
        success: function (res) {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/helper/trace/trace?orderId=' + orderId + '&kind=end'
            })
          }
        }
      })
      return
    }

    wx.showModal({
      title: '服务完成',
      content: '确认已完成该项服务？完成后订单将进入待确认状态，等待对方确认。',
      confirmText: '确认完成',
      confirmColor: '#2D7D46',
      success: function (res) {
        if (res.confirm) {
          wx.showLoading({ title: '提交中...', mask: true })
          OrderAPI.completeService(orderId).then(function () {
            wx.hideLoading()
            wx.showToast({ title: '服务已完成', icon: 'success' })
            that.loadOrders()
          }).catch(function (error) {
            wx.hideLoading()
            wx.showToast({ title: error.message || '操作失败', icon: 'none' })
          })
        }
      }
    })
  },

  onViewImages(e) {
    var orderId = e.currentTarget.dataset.orderId
    var images = []
    var allOrders = this.data.orders
    var keys = ['serving', 'completed', 'cancelled']
    for (var i = 0; i < keys.length; i++) {
      var orderList = allOrders[keys[i]] || []
      for (var j = 0; j < orderList.length; j++) {
        var found = orderList[j]
        if (found.id === orderId && found.images && Array.isArray(found.images)) {
          images = found.images
          break
        }
      }
      if (images.length > 0) break
    }

    if (images.length > 0) {
      var baseUrl = getBaseUrl()
      var fixUrl = function (url) {
        if (!url) return url
        return url.replace(/https?:\/\/[^/]+/, baseUrl)
      }
      var fixedImages = images.map(fixUrl)

      this.setData({
        showImageModal: true,
        previewImages: fixedImages
      })

      var sysInfo = wx.getSystemInfoSync()
      if (sysInfo.platform !== 'devtools') {
        this.downloadAndReplace(fixedImages)
      }
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
