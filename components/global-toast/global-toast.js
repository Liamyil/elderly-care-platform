// 全局悬浮消息横幅（站内信闭环）：
// app.json 全局注册 + 每个页面根部挂 <global-toast id="globalToast" />，由 app.js 轮询驱动 show(msg)。
// 顶部 180rpx 避开微信胶囊按钮，停留 3 秒自动收起；点击 → 标记已读并跳转（完工通知特殊处理：直接进订单 Tab 定位高亮）。
// 动画用 CSS transition（.show 类切换），不用 wx.createAnimation——避免起始帧 opacity 0 卡住导致横幅不可见。
const { put } = require('../../utils/request')

Component({
  data: {
    rendered: false,  // 是否渲染横幅节点（wx:if 控制，收起后移除）
    visible: false,   // 是否展开（切换 .show 类触发 CSS 过渡滑入/滑出）
    title: '',
    content: '',
    orderId: '',
    messageId: '',
    type: ''
  },

  lifetimes: {
    attached() {
      console.log('[global-toast] attached: 组件实例已创建')
    },
    ready() {
      console.log('[global-toast] ready: 组件已渲染就绪')
    },
    detached() {
      console.log('[global-toast] detached: 组件实例销毁')
      this.clearTimers()
    }
  },

  methods: {
    /** 展示横幅（app.js 轮询到新未读消息时调用；已有横幅展示中则忽略本次，下个周期再补） */
    show(message) {
      console.log('[global-toast] show() 被调用, message =', JSON.stringify(message), ', 当前 _showing =', !!this._showing)
      if (!message || this._showing) return
      this._showing = true
      this.clearTimers()
      // 元素先以隐藏态渲染（CSS 默认 transform 上移 + opacity 0），下一帧再加 .show 类触发过渡滑入
      this.setData({
        title: message.title || '',
        content: message.content || '',
        orderId: message.orderId || '',
        messageId: message.id || '',
        type: message.type || '',
        rendered: true,
        visible: false
      }, () => {
        setTimeout(() => {
          this.setData({ visible: true })
          console.log('[global-toast] 已加 show 类, visible =', this.data.visible)
        }, 30)
      })

      // 停留 3 秒后自动收起
      this._hideTimer = setTimeout(() => { this.hide() }, 3000)
    },

    /** 滑出收起（自动消失与点击关闭共用） */
    hide() {
      console.log('[global-toast] hide() 被调用, 当前 _showing =', !!this._showing)
      if (!this._showing) return
      this.setData({ visible: false }) // 移除 .show 类 → CSS 过渡滑出
      this._finishTimer = setTimeout(() => {
        this._showing = false
        this.setData({ rendered: false })
      }, 320)
    },

    /** 点击横幅：静默标记已读 → 完工通知直进订单 Tab 定位高亮；其他关联订单跳详情，否则进消息中心 */
    onTap() {
      console.log('[global-toast] onTap 被点击, messageId =', this.data.messageId, ', orderId =', this.data.orderId)
      if (!this._showing) return
      const messageId = this.data.messageId
      const orderId = this.data.orderId
      this.hide()
      if (messageId) {
        put('/api/messages/read', { messageId }, { silent: true }).catch(() => {})
      }
      // 适老化交互：互助员完工通知（服务已完成）→ 不跳详情，直接进订单 Tab 的「服务中」页签定位高亮该订单
      if (this.data.type === 'order' && this.data.title === '服务已完成' && orderId) {
        const pages = getCurrentPages()
        const current = pages[pages.length - 1]
        if (current && current.route === 'pages/order/order' && current.locateTargetOrder) {
          // 悬浮窗就挂在订单页上：switchTab 到当前 Tab 不会重触发 onShow，直接调页面方法定位
          current.locateTargetOrder(orderId, 'serving')
          return
        }
        getApp().globalData.targetOrderId = orderId
        getApp().globalData.targetTab = 'serving'
        wx.switchTab({ url: '/pages/order/order' })
        return
      }
      if (orderId) {
        wx.navigateTo({ url: '/pages/order-detail/order-detail?id=' + orderId })
      } else {
        wx.navigateTo({ url: '/pages/notice/notice' })
      }
    },

    clearTimers() {
      if (this._hideTimer) clearTimeout(this._hideTimer)
      if (this._finishTimer) clearTimeout(this._finishTimer)
      this._hideTimer = null
      this._finishTimer = null
    }
  }
})
