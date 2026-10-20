const { OrderAPI } = require('../../utils/api')

Page({
  data: {
    statusBarHeight: 0,
    pendingOrders: [],
    ratedOrders: [],
    showRatingModal: false,
    currentOrderId: '',
    currentRating: 5,
    starList: [1, 2, 3, 4, 5],
    selectedTags: [],
    ratingText: '',
    tagOptions: [
      { label: '态度很好', on: false },
      { label: '很专业', on: false },
      { label: '准时到达', on: false },
      { label: '耐心细致', on: false },
      { label: '很满意', on: false }
    ],
    ratingHints: ['非常差', '差', '一般', '好', '非常好']
  },

  onLoad(options) {
    const systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      ratingHint: this.data.ratingHints[4]
    })
    // 从订单页"去评价"进入：只展示该订单并直接弹出评价框
    this._targetOrderId = (options && options.orderId) ? options.orderId : ''
  },

  async onShow() {
    await this.loadCompletedOrders()
  },

  async loadCompletedOrders() {
    wx.showLoading({ title: '加载中...', mask: true })
    try {
      const allOrders = await OrderAPI.getOrders('completed')
      const completedOrders = Array.isArray(allOrders) ? allOrders : []

      // 待评价：完成后未评价的订单
      const pendingOrders = completedOrders.filter(o => !o.evaluated).map(o => ({
        id: o.id,
        type: o.type,
        helper: o.helper || '互助员',
        date: o.time ? o.time.split(' ')[0] : '',
        address: o.address,
        reward: o.reward
      }))

      // 已评价：展示我给互助员写过的评价（星级 + 内容）
      const ratedOrders = completedOrders.filter(o => o.evaluated).map(o => {
        const rating = o.rating || 5
        return {
          id: o.id,
          type: o.type,
          helper: o.helper || '互助员',
          date: o.time ? o.time.split(' ')[0] : '',
          rating: rating,
          stars: this.buildStars(rating),
          comment: o.comment || '未填写评价内容'
        }
      })

      // 定向评价模式：只保留目标订单，并直接弹出其评价框
      let targetOrders = pendingOrders
      if (this._targetOrderId) {
        targetOrders = pendingOrders.filter(function (o) { return o.id === this._targetOrderId }.bind(this))
        if (targetOrders.length > 0) {
          this.onRatingClick({ currentTarget: { dataset: { id: this._targetOrderId } } })
        }
      }

      this.setData({ pendingOrders: targetOrders, ratedOrders })
    } catch (error) {
      console.error('加载订单失败:', error ? (error.stack || error.message || JSON.stringify(error)) : 'unknown')
      this.setData({ pendingOrders: [], ratedOrders: [] })
    } finally {
      wx.hideLoading()
    }
  },

  /** 评分 → 星级字符（已评价记录展示用）：★★★★☆ */
  buildStars(rating) {
    const n = Math.max(1, Math.min(5, parseInt(rating) || 5))
    return '★'.repeat(n) + '☆'.repeat(5 - n)
  },

  goBack() {
    wx.navigateBack()
  },

  onRatingClick(e) {
    const id = e.currentTarget.dataset.id
    // 每次打开弹窗重置标签选中态（WXML 不支持 indexOf，on 标记在 JS 里算好）
    const tagOptions = this.data.tagOptions.map(function (t) {
      return { label: t.label, on: false }
    })
    this.setData({
      showRatingModal: true,
      currentOrderId: id,
      currentRating: 5,
      selectedTags: [],
      ratingText: '',
      ratingHint: this.data.ratingHints[4],
      tagOptions: tagOptions
    })
  },

  onCloseRatingModal() {
    this.setData({
      showRatingModal: false
    })
  },

  preventClose() { },

  onStarClick(e) {
    const score = parseInt(e.currentTarget.dataset.score)
    this.setData({
      currentRating: score,
      ratingHint: this.data.ratingHints[score - 1]
    })
  },

  onTagClick(e) {
    const tag = e.currentTarget.dataset.tag
    const selectedTags = [...this.data.selectedTags]
    const index = selectedTags.indexOf(tag)
    if (index > -1) {
      selectedTags.splice(index, 1)
    } else {
      selectedTags.push(tag)
    }
    const tagOptions = this.data.tagOptions.map(function (t) {
      return { label: t.label, on: selectedTags.indexOf(t.label) > -1 }
    })
    this.setData({
      selectedTags,
      tagOptions
    })
  },

  onRatingInput(e) {
    this.setData({
      ratingText: e.detail.value
    })
  },

  async onSubmitRating() {
    if (this.data.currentRating < 1) {
      wx.showToast({
        title: '请选择服务评分',
        icon: 'none'
      })
      return
    }

    wx.showLoading({ title: '提交中...', mask: true })

    try {
      const comment = this.data.selectedTags.join('、') + (this.data.ratingText ? ' ' + this.data.ratingText : '')

      await OrderAPI.evaluateOrder(this.data.currentOrderId, this.data.currentRating, comment)

      // 评价成功：订单从「待评价」移入「我写过的评价」
      const doneOrder = this.data.pendingOrders.find(item => item.id === this.data.currentOrderId) || {}
      const newRated = {
        id: this.data.currentOrderId,
        type: doneOrder.type || '',
        helper: doneOrder.helper || '互助员',
        date: doneOrder.date || '',
        rating: this.data.currentRating,
        stars: this.buildStars(this.data.currentRating),
        comment: comment || '未填写评价内容'
      }
      this.setData({
        pendingOrders: this.data.pendingOrders.filter(item => item.id !== this.data.currentOrderId),
        ratedOrders: [newRated].concat(this.data.ratedOrders),
        showRatingModal: false
      })

      wx.hideLoading()
      wx.showToast({
        title: '评价成功！谢谢您的反馈',
        icon: 'success',
        duration: 2000
      })
      // 定向评价完成后返回订单页
      if (this._targetOrderId) {
        setTimeout(function () {
          wx.navigateBack()
        }, 1600)
      }
    } catch (error) {
      wx.hideLoading()
      console.error('评价失败:', error ? (error.stack || error.message || JSON.stringify(error)) : 'unknown')
      wx.showToast({
        title: '评价失败',
        icon: 'none'
      })
    }
  }
})