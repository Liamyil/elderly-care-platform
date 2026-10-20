const { OrderAPI, UserAPI } = require('../../utils/api')
const { getBaseUrl } = require('../../utils/request')

Page({
  data: {
    statusBarHeight: 0,
    statusTabs: [
      { key: 'pending', label: '待接单' },
      { key: 'serving', label: '服务中' },
      { key: 'completed', label: '已完成' },
      { key: 'cancelled', label: '已取消' }
    ],
    currentStatus: 'pending',
    currentStatusText: '待接单',
    currentIndex: 0,
    showCancelModal: false,
    showLogin: false,
    cancelOrderId: '',
    selectedReason: '',
    showImageModal: false,
    previewImages: [],
    showRewardModal: false,
    rewardModalOrderId: '',
    rewardModalBase: 0,
    rewardModalExtra: 0,
    rewardModalInput: 0,
    rewardModalTotal: 0,
    cancelReasons: [
      { label: '我不需要服务了', value: '我不需要服务了' },
      { label: '发布信息有误', value: '发布信息有误' },
      { label: '已找到其他互助员', value: '已找到其他互助员' },
      { label: '服务时间需要更改', value: '服务时间需要更改' },
      { label: '其他原因', value: '其他原因' }
    ],
    orders: {
      pending: [],
      serving: [],
      pending_confirm: [],
      completed: [],
      cancelled: []
    },
    tabCounts: [0, 0, 0, 0],
    // 完工通知定位：目标订单卡片滚动锚点（scroll-into-view，定位后 3 秒清空）
    scrollIntoView: ''
  },

  onLoad() {
    var sysInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight
    })
  },

  onShow() {
    var token = wx.getStorageSync('token')
    if (!token) {
      // 游客进入订单页 → 弹出登录提示
      this.setData({ showLogin: true })
      return
    }

    var needRefresh = wx.getStorageSync('needRefreshOrders')
    if (needRefresh) {
      wx.removeStorageSync('needRefreshOrders')
      this.setData({
        currentStatus: 'pending',
        currentStatusText: '待接单',
        currentIndex: 0
      })
    }

    var goToCancelled = wx.getStorageSync('goToCancelledTab')
    if (goToCancelled) {
      wx.removeStorageSync('goToCancelledTab')
      this.setData({
        currentStatus: 'cancelled',
        currentStatusText: '已取消',
        currentIndex: 3
      })
    }

    // 完工通知点击定位：读取悬浮窗写入的全局标记（消费后立即清空防重复触发）
    this.handleTargetOrderFlag()

    this.loadOrders()
    this.startAutoRefresh()
  },

  onLoginSuccess() {
    this.setData({ showLogin: false })
    // 游客被登录弹窗拦截后登录成功：补一次完工通知定位检查
    this.handleTargetOrderFlag()
    this.loadOrders()
    this.startAutoRefresh()
  },

  onLoginClose() {
    this.setData({ showLogin: false })
  },

  // ===== 完工通知点击定位：悬浮窗写入全局标记 → 订单页切页签 + 滚动定位 + 呼吸灯高亮 =====

  /** 读取悬浮窗写入的全局标记（onShow / 登录成功后调用），消费后立即清空防重复触发 */
  handleTargetOrderFlag() {
    var app = getApp()
    var orderId = app.globalData && app.globalData.targetOrderId
    if (!orderId) return
    var tabKey = app.globalData.targetTab || 'serving'
    app.globalData.targetOrderId = ''
    app.globalData.targetTab = ''
    // onShow 流程马上就会 loadOrders，无需额外刷新
    this.locateTargetOrder(orderId, tabKey, true)
  },

  /** 定位并高亮指定订单（悬浮窗在当前订单页时直调）：
   *  切到目标页签 → 挂起定位任务，列表加载渲染完成后自动滚动 + 高亮
   *  skipReload=true 表示马上就有一次 loadOrders（onShow 流程），无需额外刷新 */
  locateTargetOrder(orderId, tabKey, skipReload) {
    var tabs = this.data.statusTabs
    var index = -1
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].key === tabKey) { index = i; break }
    }
    if (index < 0) {
      // 非法页签兜底：「服务中」页签（pending_confirm 订单展示页签）
      tabKey = 'serving'
      for (var j = 0; j < tabs.length; j++) {
        if (tabs[j].key === tabKey) { index = j; break }
      }
    }
    this.setData({
      currentStatus: tabKey,
      currentStatusText: tabs[index].label,
      currentIndex: index
    })
    this._pendingLocate = { orderId: orderId, tabKey: tabKey }
    if (!skipReload) {
      // 静默刷新拿最新状态（如订单刚转待确认），完成后 _afterOrdersLoaded 自动滚动
      this.loadOrders(true)
    }
  },

  /** 列表加载渲染完成后的收尾：有挂起的定位任务则执行（自动刷新时为空操作） */
  _afterOrdersLoaded() {
    if (!this._pendingLocate) return
    var target = this._pendingLocate
    this._pendingLocate = null
    this._scrollToTargetOrder(target.orderId, target.tabKey)
  },

  /** 滚动到目标订单卡片并呼吸灯高亮 3 秒：
   *  目标页签找不到时跨页签兜底（如已被老人确认 → 已完成页签，自动切过去）；
   *  滚动必须等渲染完成：setData 回调 + 350ms 延时（覆盖 swiper 300ms 切换动画） */
  _scrollToTargetOrder(orderId, tabKey) {
    var that = this
    var keys = ['pending', 'serving', 'completed', 'cancelled']
    var orderedKeys = [tabKey].concat(keys.filter(function (k) { return k !== tabKey }))
    var foundKey = null
    var foundIndex = -1
    for (var i = 0; i < orderedKeys.length; i++) {
      var list = this.data.orders[orderedKeys[i]] || []
      for (var j = 0; j < list.length; j++) {
        if (list[j].id === orderId) {
          foundKey = orderedKeys[i]
          foundIndex = j
          break
        }
      }
      if (foundKey) break
    }
    if (!foundKey) return // 订单已不存在（已删除等），静默放弃

    // 订单在其他页签（如已完成）：切过去再定位
    if (foundKey !== this.data.currentStatus) {
      var tabs = this.data.statusTabs
      var index = 0
      for (var t = 0; t < tabs.length; t++) {
        if (tabs[t].key === foundKey) { index = t; break }
      }
      this.setData({
        currentStatus: foundKey,
        currentStatusText: tabs[index].label,
        currentIndex: index
      })
    }

    var highlightKey = 'orders.' + foundKey + '[' + foundIndex + '].isHighlight'
    var patch = {}
    patch[highlightKey] = true
    this.setData(patch, function () {
      // setData 渲染完成后再滚动（延时覆盖 swiper 切换动画，确保目标 scroll-view 已就位）
      if (that._scrollTimer) clearTimeout(that._scrollTimer)
      that._scrollTimer = setTimeout(function () {
        that.setData({ scrollIntoView: 'order-' + orderId })
      }, 350)
    })

    // 3 秒后移除高亮与滚动锚点，防止下次进入重复触发
    if (this._highlightTimer) clearTimeout(this._highlightTimer)
    this._highlightTimer = setTimeout(function () {
      var clearPatch = {}
      clearPatch[highlightKey] = false
      clearPatch.scrollIntoView = ''
      that.setData(clearPatch)
    }, 3000)
  },

  loadOrders(silent) {
    var that = this
    if (this._loading) return
    this._loading = true
    if (!silent) wx.showLoading({ title: '加载中...', mask: true })
    OrderAPI.getOrders(null, silent ? { silent: true } : null).then(function (allOrders) {
      return UserAPI.listUsers(silent ? { silent: true } : null).then(function (users) {
        return { allOrders: allOrders, users: users }
      })
    }).then(function (result) {
      var allOrders = result.allOrders
      var users = result.users
      // 互助员姓名 → 完成单数映射（用于服务中订单展示互助员详情）
      var countMap = {}
      ;(users || []).forEach(function (u) {
        countMap[u.name] = u.service_count || 0
      })

      var orders = {
        pending: [],
        serving: [],
        completed: [],
        cancelled: []
      }

      if (allOrders && Array.isArray(allOrders)) {
        allOrders.forEach(function (order) {
          if (order.helper && countMap[order.helper] !== undefined) {
            order.helperCount = countMap[order.helper]
          }
          var targetKey = order.statusKey
          if (targetKey === 'pending_confirm') {
            targetKey = 'serving'
          }
          // 待派单订单归入"待接单"页签显示（提示等待管理员指派）
          if (targetKey === 'dispatch_pool') {
            targetKey = 'pending'
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

      const counts = []
      const countKeys = ['pending', 'serving', 'completed', 'cancelled']
      countKeys.forEach(function (k) {
        counts.push((orders[k] || []).length)
      })

      that.setData({ orders: orders, tabCounts: counts })
      // 列表渲染完成收尾：有挂起的完工通知定位任务则执行滚动 + 高亮
      that._afterOrdersLoaded()
      if (!silent) {
        wx.showToast({
          title: '加载成功',
          icon: 'none',
          duration: 1500
        })
      }
    }).catch(function (error) {
      console.error('加载订单失败:', error)
      that.setData({
        orders: { pending: [], serving: [], completed: [], cancelled: [] }
      })
      if (!silent) {
        wx.showToast({
          title: '加载失败，请重试',
          icon: 'none'
        })
      }
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
    if (this._scrollTimer) clearTimeout(this._scrollTimer)
    if (this._highlightTimer) clearTimeout(this._highlightTimer)
    this._scrollTimer = null
    this._highlightTimer = null
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

  onCancelOrder(e) {
    var orderId = e.currentTarget.dataset.id
    this.setData({
      showCancelModal: true,
      cancelOrderId: orderId,
      selectedReason: ''
    })
  },

  onCloseCancelModal() {
    this.setData({
      showCancelModal: false,
      cancelOrderId: '',
      selectedReason: ''
    })
  },

  preventClose() { },

  onSelectReason(e) {
    var value = e.currentTarget.dataset.value
    this.setData({
      selectedReason: value
    })
  },

  onConfirmCancel() {
    var that = this
    if (!this.data.selectedReason || !this.data.cancelOrderId) {
      return
    }

    var orderId = this.data.cancelOrderId
    var reason = this.data.selectedReason

    wx.showLoading({ title: '取消中...', mask: true })

    OrderAPI.cancelOrder(orderId, reason).then(function () {
      wx.hideLoading()
      that.setData({
        showCancelModal: false,
        cancelOrderId: '',
        selectedReason: ''
      })
      wx.showToast({
        title: '取消成功',
        icon: 'success',
        duration: 1500
      })
      that.loadOrders()
    }).catch(function (error) {
      wx.hideLoading()
      wx.showToast({
        title: error.message || '取消失败',
        icon: 'none'
      })
    })
  },

  /** 卡片点击 → 订单详情页（时间轴 + 双方联系方式） */
  goOrderDetail(e) {
    var orderId = e.currentTarget.dataset.id
    if (!orderId) return
    wx.navigateTo({
      url: '/pages/order-detail/order-detail?id=' + orderId
    })
  },

  goHelperDetail(e) {
    const name = e.currentTarget.dataset.helper
    if (!name) return
    wx.navigateTo({
      url: '/pages/helper-detail/helper-detail?name=' + encodeURIComponent(name)
    })
  },

  onCompleteService(e) {
    var that = this
    var orderId = e.currentTarget.dataset.id
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

  onAddReward(e) {
    var orderId = e.currentTarget.dataset.id
    var targetOrder = null
    var allOrders = this.data.orders
    var keys = ['pending', 'serving', 'completed', 'cancelled']
    for (var i = 0; i < keys.length; i++) {
      var orderList = allOrders[keys[i]] || []
      for (var j = 0; j < orderList.length; j++) {
        if (orderList[j].id === orderId) {
          targetOrder = orderList[j]
          break
        }
      }
      if (targetOrder) break
    }
    if (!targetOrder) return

    var baseReward = targetOrder.originalReward || targetOrder.reward || 0
    var existingExtra = targetOrder.extraReward || 0
    this.setData({
      showRewardModal: true,
      rewardModalOrderId: orderId,
      rewardModalBase: baseReward,
      rewardModalExtra: existingExtra,
      rewardModalInput: 0,
      rewardModalTotal: baseReward + existingExtra
    })
  },

  onRewardInput(e) {
    var input = parseInt(e.detail.value) || 0
    var total = this.data.rewardModalBase + this.data.rewardModalExtra + input
    this.setData({
      rewardModalInput: input,
      rewardModalTotal: total
    })
  },

  onCloseRewardModal() {
    this.setData({
      showRewardModal: false,
      rewardModalOrderId: '',
      rewardModalBase: 0,
      rewardModalExtra: 0,
      rewardModalInput: 0,
      rewardModalTotal: 0
    })
  },

  onConfirmAddReward() {
    var that = this
    var data = this.data
    if (!data.rewardModalInput || data.rewardModalInput <= 0) {
      wx.showToast({ title: '请输入有效的时间币数量', icon: 'none' })
      return
    }

    wx.showLoading({ title: '添加中...', mask: true })
    OrderAPI.addReward(data.rewardModalOrderId, data.rewardModalInput).then(function () {
      wx.hideLoading()
      that.setData({ showRewardModal: false })
      wx.showToast({ title: '添加成功', icon: 'success' })
      that.loadOrders()
    }).catch(function (error) {
      wx.hideLoading()
      wx.showToast({ title: error.message || '添加失败', icon: 'none' })
    })
  },

  onConfirmComplete(e) {
    var that = this
    var orderId = e.currentTarget.dataset.id
    var targetOrder = null
    var allOrders = this.data.orders
    var keys = ['pending', 'serving', 'completed', 'cancelled']
    for (var i = 0; i < keys.length; i++) {
      var orderList = allOrders[keys[i]] || []
      for (var j = 0; j < orderList.length; j++) {
        if (orderList[j].id === orderId) {
          targetOrder = orderList[j]
          break
        }
      }
      if (targetOrder) break
    }
    if (!targetOrder) return

    if (targetOrder.statusKey === 'serving') {
      wx.showModal({
        title: '请先联系互助员',
        content: '订单还在服务中，请先让互助员点击"服务完成"，待订单进入待确认状态后再点击"确认完成"。',
        showCancel: false,
        confirmText: '我知道了'
      })
      return
    }

    wx.showModal({
      title: '确认完成',
      content: '确认本次服务已完成？确认后将自动结算时间币。',
      confirmText: '确认完成',
      confirmColor: '#2D7D46',
      success: function (res) {
        if (res.confirm) {
          wx.showLoading({ title: '提交中...', mask: true })
          OrderAPI.confirmComplete(orderId).then(function () {
            wx.hideLoading()
            wx.showToast({ title: '订单已完成', icon: 'success' })
            that.loadOrders()
          }).catch(function (error) {
            wx.hideLoading()
            wx.showToast({ title: error.message || '操作失败', icon: 'none' })
          })
        }
      }
    })
  },

  onGoReview(e) {
    // 定向评价：跳转该订单的评价，而不是全部待评价列表
    var orderId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/rating/rating?orderId=' + orderId
    })
  },

  onViewImages(e) {
    var orderId = e.currentTarget.dataset.orderId
    var images = []
    var allOrders = this.data.orders
    // 页签数据键：待接单/服务中(含待确认)/已完成/已取消
    var keys = ['pending', 'serving', 'completed', 'cancelled']
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
      this._remoteImages = fixedImages
      this.setData({
        showImageModal: true,
        previewImages: fixedImages
      })

      var sysInfo = wx.getSystemInfoSync()
      if (sysInfo.platform !== 'devtools') {
        this.downloadAndReplace(fixedImages)
      }
    } else {
      wx.showToast({ title: '暂无图片', icon: 'none' })
    }
  },

  downloadAndReplace(remoteUrls) {
    var that = this
    wx.showLoading({ title: '加载图片中...', mask: true })
    var results = []
    var loaded = 0

    var tryDownload = function (url, idx) {
      wx.downloadFile({
        url: url,
        success: function (res) {
          if (res.statusCode === 200) {
            results[idx] = res.tempFilePath
          } else {
            results[idx] = url
          }
        },
        fail: function () {
          results[idx] = url
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
    }

    remoteUrls.forEach(function (url, i) { tryDownload(url, i) })
  },

  onCloseImageModal() {
    this.setData({
      showImageModal: false,
      previewImages: []
    })
    this._remoteImages = null
  },

  onPreviewImage(e) {
    var index = e.currentTarget.dataset.index
    var urls = this._remoteImages || this.data.previewImages
    wx.previewImage({
      current: urls[index],
      urls: urls
    })
  },

  onImageError(e) {
    console.error('图片加载失败:', e)
  },

  onDeleteOrder(e) {
    var that = this
    var orderId = e.currentTarget.dataset.id

    wx.showModal({
      title: '删除订单',
      content: '确定要删除这个订单吗？删除后将不在订单列表中显示。',
      confirmText: '删除',
      confirmColor: '#FF4D4F',
      success: function (res) {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...', mask: true })
          OrderAPI.deleteOrder(orderId).then(function () {
            var cancelledOrders = that.data.orders.cancelled.slice()
            var orderIndex = -1
            for (var i = 0; i < cancelledOrders.length; i++) {
              if (cancelledOrders[i].id === orderId) {
                orderIndex = i
                break
              }
            }
            if (orderIndex > -1) {
              cancelledOrders.splice(orderIndex, 1)
              that.setData({
                'orders.cancelled': cancelledOrders
              })
            }
            wx.hideLoading()
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            })
          }).catch(function (error) {
            wx.hideLoading()
            wx.showToast({
              title: error.message || '删除失败',
              icon: 'none'
            })
          })
        }
      }
    })
  }
})
