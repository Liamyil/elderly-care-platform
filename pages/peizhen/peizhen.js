// 陪诊服务选择页：左侧分类（全程陪诊/专项陪诊）+ 右侧服务列表
// 数据来自 utils/peizhen-data.js（补充真实数据只改那个文件）
// 销量为真实订单自动累计（GET /api/orders/type-stats），不再使用编造数字
const { PEIZHEN_TYPES, HOSPITAL_CITIES } = require('../../utils/peizhen-data')
const { OrderAPI } = require('../../utils/api')

Page({
  data: {
    statusBarHeight: 0,
    categories: ['全程陪诊', '专项陪诊'],
    currentCategory: '全程陪诊',
    cities: HOSPITAL_CITIES,
    currentCity: '宁波',
    showCityPicker: false,
    showLogin: false,
    items: []
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    const app = getApp()
    const savedCity = (app && app.globalData && app.globalData.peizhenCity) || '宁波'
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      currentCity: savedCity
    })
    this.loadStats()
  },

  loadItems() {
    const items = PEIZHEN_TYPES.filter(function (t) {
      return t.category === this.data.currentCategory
    }.bind(this)).map(function (t) {
      // 销量 = 真实已完成订单累计（无数据显示 0）
      const count = (this._typeStats && this._typeStats[t.name] != null) ? this._typeStats[t.name] : 0
      return Object.assign({}, t, { sales: '已售 ' + count })
    }.bind(this))
    this.setData({ items: items })
  },

  async loadStats() {
    try {
      const res = await OrderAPI.getTypeStats('陪诊服务', { silent: true })
      this._typeStats = (res && res.counts) || {}
    } catch (e) {
      console.error('加载销量失败:', e ? (e.stack || e.message || JSON.stringify(e)) : 'unknown')
      this._typeStats = {}
    }
    this.loadItems()
  },

  onCategoryTap(e) {
    const cat = e.currentTarget.dataset.category
    this.setData({ currentCategory: cat })
    this.loadItems()
  },

  onSubHeaderTap() {
    this.setData({ showCityPicker: !this.data.showCityPicker })
  },

  onCitySelect(e) {
    const city = e.currentTarget.dataset.city
    this.setData({
      currentCity: city,
      showCityPicker: false
    })
    const app = getApp()
    if (app && app.globalData) {
      app.globalData.peizhenCity = city
    }
  },

  preventClose() { },

  onItemTap(e) {
    // 游客点服务类型 → 弹出登录提示（登录后可继续浏览下单）
    if (!wx.getStorageSync('token')) {
      this.setData({ showLogin: true })
      return
    }
    const name = e.currentTarget.dataset.name
    wx.navigateTo({
      url: '/pages/peizhen-type/peizhen-type?name=' + encodeURIComponent(name)
    })
  },

  onLoginSuccess() {
    this.setData({ showLogin: false })
  },

  onLoginClose() {
    this.setData({ showLogin: false })
  },

  goBack() {
    wx.navigateBack()
  },

  goHospital() {
    wx.navigateTo({
      url: '/pages/hospital/hospital'
    })
  },

  goHelpers() {
    wx.navigateTo({
      url: '/pages/helpers/helpers'
    })
  }
})
