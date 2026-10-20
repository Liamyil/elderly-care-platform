const { IndexAPI, BankAPI, OrderAPI } = require('../../utils/api')
const { getBaseUrl, get } = require('../../utils/request')
const app = getApp()

Page({
  data: {
    notices: [],
    orders: [],
    userTimeCoins: 0,
    statusBarHeight: 0,
    city: '',
    district: '',
    showCityPicker: false,
    pickerValue: [0, 0],
    cityNames: ['上海', '北京', '江苏', '浙江'],
    cityData: {
      '上海': ['黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '虹口区', '杨浦区', '闵行区', '宝山区', '嘉定区', '浦东新区', '金山区', '松江区', '青浦区', '奉贤区', '崇明区'],
      '北京': ['东城区', '西城区', '朝阳区', '丰台区', '石景山区', '海淀区', '门头沟区', '房山区', '通州区', '顺义区', '昌平区', '大兴区', '怀柔区', '平谷区', '密云区', '延庆区'],
      '江苏': ['南京市·玄武区', '南京市·秦淮区', '南京市·建邺区', '南京市·鼓楼区', '南京市·栖霞区', '南京市·雨花台区', '苏州市·姑苏区', '苏州市·虎丘区', '苏州市·吴中区', '苏州市·相城区', '苏州市·吴江区', '无锡市·梁溪区', '无锡市·锡山区', '无锡市·惠山区', '无锡市·滨湖区', '无锡市·新吴区', '常州市·天宁区', '常州市·武进区', '常州市·新北区', '常州市·金坛区', '常州市·钟楼区', '镇江市·京口区', '镇江市·润州区', '镇江市·丹徒区'],
      '浙江': ['杭州市·上城区', '杭州市·拱墅区', '杭州市·西湖区', '杭州市·滨江区', '杭州市·萧山区', '杭州市·余杭区', '杭州市·临平区', '杭州市·钱塘区', '宁波市·海曙区', '宁波市·江北区', '宁波市·北仑区', '宁波市·镇海区', '宁波市·鄞州区', '宁波市·奉化区', '温州市·鹿城区', '温州市·龙湾区', '温州市·瓯海区', '温州市·洞头区', '嘉兴市·南湖区', '嘉兴市·秀洲区', '绍兴市·越城区', '绍兴市·柯桥区', '绍兴市·上虞区']
    },
    currentDistricts: [],
    hasUnreadMessages: false,
    searchKeyword: '',
    showImageModal: false,
    previewImages: []
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      city: app.globalData.city || '上海市',
      district: app.globalData.district || '浦东新区',
      currentDistricts: ['黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '虹口区', '杨浦区', '闵行区', '宝山区', '嘉定区', '浦东新区', '金山区', '松江区', '青浦区', '奉贤区', '崇明区']
    })
    if (app.globalData.userInfo) {
      this.loadHomeData()
    }
  },

  onShow() {
    // 双重身份共存 · 入口校正：接单模式下冷启动落在发单端首页时，自动回到接单端
    this.checkCurrentMode()
    if (app.globalData.userInfo) {
      this.loadHomeData()
      this.loadUnreadCount()
    }
  },

  /** 接单模式 + 拥有互助员身份 → 回接单端（发单模式 / 普通用户 / 管理角色不跳转） */
  checkCurrentMode() {
    const user = app.globalData.userInfo
    if (!user) return
    if (user.role === '管理员' || user.role === '民政管理员' || user.role === '超级管理员') return
    if (app.getCurrentMode() === 'helper' && (user.isHelper || user.role === '互助员')) {
      wx.reLaunch({ url: '/pages/helper/index/index' })
    }
  },

  async loadHomeData() {
    try {
      const homeData = await IndexAPI.getHomeData()
      const balanceData = await BankAPI.getBalance()

      this.setData({
        notices: homeData.notices || [],
        orders: this.processOrders(homeData.nearbyOrders || []),
        userTimeCoins: balanceData.balance || 0
      })
    } catch (error) {
      console.error('加载首页数据失败:', error ? (error.stack || error.message || JSON.stringify(error)) : 'unknown')
    }
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

  /** 未读消息数（消息铃铛红点）：游客不显示红点；登录后静默拉取 */
  async loadUnreadCount() {
    if (!app.globalData.userInfo) {
      this.setData({ hasUnreadMessages: false })
      return
    }
    try {
      const data = await get('/api/messages/unread', {}, { silent: true })
      this.setData({ hasUnreadMessages: (data && data.count) > 0 })
    } catch (error) {
      console.error('获取未读消息数失败:', error ? (error.message || JSON.stringify(error)) : 'unknown')
    }
  },

  goToMessage() {
    wx.showToast({
      title: '消息功能开发中',
      icon: 'none'
    })
  },

  scanCode() {
    wx.showToast({
      title: '扫码功能开发中',
      icon: 'none'
    })
  },

  goPeizhen() {
    wx.navigateTo({
      url: '/pages/peizhen/peizhen'
    })
  },

  goPeizhenBook() {
    // 与陪诊卡片一致：进入陪诊选择页（点击服务类型时才拦截登录）
    wx.navigateTo({
      url: '/pages/peizhen/peizhen'
    })
  },

  onLoginSuccess() {
    this.setData({ showLogin: false })
    this.loadHomeData()
    this.loadUnreadCount()
  },

  onLoginClose() {
    this.setData({ showLogin: false })
  },

  handleEntranceClick(e) {
    const type = e.currentTarget.dataset.type

    if (type === 'bank') {
      wx.switchTab({
        url: '/pages/bank/bank'
      })
    } else if (type === 'order') {
      // 游客点"自主下单" → 弹出登录提示
      if (!wx.getStorageSync('token')) {
        this.setData({ showLogin: true })
        return
      }
      wx.navigateTo({
        url: '/pages/publish/publish'
      })
    } else if (type === 'orderManage') {
      wx.switchTab({
        url: '/pages/order/order'
      })
    } else if (type === 'evaluate') {
      wx.navigateTo({
        url: '/pages/rating/rating'
      })
    } else if (type === 'health') {
      wx.navigateTo({
        url: '/pages/health/health'
      })
    } else {
      wx.showToast({
        title: '功能开发中',
        icon: 'none'
      })
    }
  },

  handleSOSClick() {
    wx.navigateTo({
      url: '/pages/sos/sos'
    })
  },

  goToNotice() {
    this.setData({
      hasUnreadMessages: false
    })
    if (app.globalData.userInfo) {
      app.saveUserInfo({
        ...app.globalData.userInfo,
        hasUnreadMessages: false
      })
    }
    wx.navigateTo({
      url: '/pages/notice/notice'
    })
  },



  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value
    })
  },

  onSearchConfirm() {
    const keyword = this.data.searchKeyword.trim()
    if (!keyword) {
      wx.showToast({
        title: '请输入搜索内容',
        icon: 'none'
      })
    } else {
      wx.showToast({
        title: `搜索"${keyword}"功能开发中`,
        icon: 'none'
      })
    }
  },

  goToNoticeDetail() {
    wx.showToast({
      title: '公告详情开发中',
      icon: 'none'
    })
  },

  showFilter() {
    wx.showToast({
      title: '筛选功能开发中，敬请期待',
      icon: 'none'
    })
  },

  grabOrder(e) {
    const orderId = e.currentTarget.dataset.orderId
    const order = this.data.orders.find(o => o.id === orderId)

    if (!order) {
      wx.showToast({
        title: '订单信息有误',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '确认接单',
      content: `服务类型：${order.type}\n地址：${order.address}\n奖励：${order.reward}时间币`,
      confirmText: '确认接单',
      confirmColor: '#2D7D46',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.handleAcceptOrder(order)
        }
      }
    })
  },

  handleAcceptOrder(order) {
    wx.showLoading({
      title: '接单中...',
      mask: true
    })

    OrderAPI.acceptOrder(order.id)
      .then(() => {
        wx.hideLoading()
        wx.showToast({
          title: '接单成功',
          icon: 'success'
        })
        this.loadHomeData()
      })
      .catch((error) => {
        wx.hideLoading()
        wx.showToast({
          title: (error && error.message) ? String(error.message) : '接单失败',
          icon: 'none'
        })
        console.error('接单失败:', error ? (error.stack || error.message || JSON.stringify(error)) : 'unknown')
      })
  },

  preventBubble() { },

  onViewImages(e) {
    const orderId = e.currentTarget.dataset.orderId
    const order = this.data.orders.find(o => o.id === orderId)
    if (!order || !order.images || order.images.length === 0) {
      wx.showToast({ title: '暂无图片', icon: 'none' })
      return
    }

    const images = order.images
    const baseUrl = getBaseUrl()
    const fixUrl = (url) => {
      if (!url) return url
      return url.replace(/https?:\/\/[^/]+/, baseUrl)
    }
    const fixedImages = images.map(fixUrl)

    this._remoteImages = fixedImages
    this.setData({
      showImageModal: true,
      previewImages: fixedImages
    })

    const sysInfo = wx.getSystemInfoSync()
    if (sysInfo.platform !== 'devtools') {
      this.downloadAndReplace(fixedImages)
    }
  },

  downloadAndReplace(remoteUrls) {
    wx.showLoading({ title: '加载图片中...', mask: true })
    const results = []
    let loaded = 0

    const tryDownload = (url, idx) => {
      wx.downloadFile({
        url: url,
        success: (res) => {
          if (res.statusCode === 200) {
            results[idx] = res.tempFilePath
          } else {
            results[idx] = url
          }
        },
        fail: () => {
          results[idx] = url
        },
        complete: () => {
          loaded++
          if (loaded === remoteUrls.length) {
            wx.hideLoading()
            const finalPaths = remoteUrls.map((_, i) => results[i] || remoteUrls[i])
            this.setData({ previewImages: finalPaths })
          }
        }
      })
    }

    remoteUrls.forEach((url, i) => tryDownload(url, i))
  },

  onCloseImageModal() {
    this.setData({
      showImageModal: false,
      previewImages: []
    })
    this._remoteImages = null
  },

  onPreviewImage(e) {
    const index = e.currentTarget.dataset.index
    const urls = this._remoteImages || this.data.previewImages
    wx.previewImage({
      current: urls[index],
      urls: urls
    })
  },

  preventClose() { },

  refreshOrders() {
    this.loadHomeData()
  },

  onLocationClick() {
    let cityIndex = 0
    let districtIndex = 0
    const currentCity = this.data.city.replace('市', '')
    const cityIndexFound = this.data.cityNames.indexOf(currentCity)
    if (cityIndexFound !== -1) {
      cityIndex = cityIndexFound
    }
    const districts = this.data.cityData[this.data.cityNames[cityIndex]] || []
    districtIndex = districts.indexOf(this.data.district)
    if (districtIndex === -1) {
      districtIndex = 0
    }
    this.setData({
      showCityPicker: true,
      pickerValue: [cityIndex, districtIndex],
      currentDistricts: districts
    })
  },

  onCloseCityPicker() {
    this.setData({
      showCityPicker: false
    })
  },

  preventClose() { },

  onPickerChange(e) {
    const value = e.detail.value
    const cityIndex = value[0]
    const districtIndex = value[1]
    const cityName = this.data.cityNames[cityIndex]
    const districts = this.data.cityData[cityName] || []
    let newDistrictIndex = districtIndex
    if (newDistrictIndex >= districts.length) {
      newDistrictIndex = 0
    }
    this.setData({
      pickerValue: [cityIndex, newDistrictIndex],
      currentDistricts: districts
    })
  },

  onConfirmCity() {
    const cityIndex = this.data.pickerValue[0]
    const districtIndex = this.data.pickerValue[1]
    const selectedCityName = this.data.cityNames[cityIndex]
    const districts = this.data.cityData[selectedCityName] || []
    const selectedDistrict = districts[districtIndex] || ''

    let cityText = selectedCityName + '市'
    let districtText = selectedDistrict

    if (selectedCityName === '江苏' || selectedCityName === '浙江') {
      const parts = selectedDistrict.split('·')
      if (parts.length === 2) {
        cityText = parts[0] + '市'
        districtText = parts[1]
      }
    }

    app.globalData.city = cityText
    app.globalData.district = districtText

    this.setData({
      city: cityText,
      district: districtText,
      showCityPicker: false
    })

    wx.showToast({
      title: '选择成功',
      icon: 'success'
    })
  }
})