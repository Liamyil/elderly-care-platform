Component({
  properties: {
    selected: {
      type: Number,
      value: 0
    }
  },

  data: {
    tabs: [
      { pagePath: '/pages/helper/index/index', text: '订单广场', icon: '/images/tab/home.png', activeIcon: '/images/tab/home_active.png' },
      { pagePath: '/pages/helper/order/order', text: '我的订单', icon: '/images/tab/order.png', activeIcon: '/images/tab/order_active.png' },
      { pagePath: '/pages/helper/bank/bank', text: '时间银行', icon: '/images/tab/bank.png', activeIcon: '/images/tab/bank_active.png' },
      { pagePath: '/pages/helper/mine/mine', text: '我的', icon: '/images/tab/mine.png', activeIcon: '/images/tab/mine_active.png' }
    ]
  },

  methods: {
    onTabTap(e) {
      var index = e.currentTarget.dataset.index
      var path = this.data.tabs[index].pagePath
      if (index === this.data.selected) return
      wx.reLaunch({ url: path })
    }
  }
})
