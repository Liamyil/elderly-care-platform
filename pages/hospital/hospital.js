// 医院信息页：数据来自 utils/peizhen-data.js（与陪诊页、下单页共用一份）
const { HOSPITALS, HOSPITAL_CITIES } = require('../../utils/peizhen-data')

// 等级→配色类名映射（WXSS 选择器不支持中文，用英文代号：3a橙/3b蓝/2a绿）
const LEVEL_CLASS = {
  '三甲综合': 'lv-3a',
  '三甲中医': 'lv-3a',
  '三乙综合': 'lv-3b',
  '三乙中医': 'lv-3b',
  '二甲综合': 'lv-2a'
}

function decorate(list) {
  return list.map(function (h) {
    return Object.assign({}, h, { levelClass: LEVEL_CLASS[h.level] || '' })
  })
}

Page({
  data: {
    statusBarHeight: 0,
    cities: HOSPITAL_CITIES,
    currentCity: '沈阳',
    hospitals: []
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      hospitals: decorate(HOSPITALS['沈阳'] || [])
    })
  },

  goBack() {
    wx.navigateBack()
  },

  onCityTap(e) {
    const city = e.currentTarget.dataset.city
    this.setData({
      currentCity: city,
      hospitals: decorate(HOSPITALS[city] || [])
    })
  }
})
