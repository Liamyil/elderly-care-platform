// 陪诊专属下单页：医院选择 / 帮办事项 / 患者信息 / 就诊时间 / 健康评估 / 单据上传
// 设计参照根目录 陪诊下单页效果图.html v2；服务类型与医院数据来自 utils/peizhen-data.js
const { PEIZHEN_TYPES, HOSPITALS, HOSPITAL_CITIES } = require('../../utils/peizhen-data')
const { getBaseUrl } = require('../../utils/request')
const { generateTimeSlots, defaultTimeLabel, labelToTime } = require('../../utils/time-slots')

const TASKS = ['挂号', '取药', '缴费', '陪同就诊', '取报告', '其他']

// 表单校验：字段 → wxml 锚点 id（按页面从上到下顺序定位第一个未填项）
const FIELD_ANCHORS = {
  locationText: 'field-location',
  selectedType: 'field-type',
  rmbAmount: 'field-type',
  selectedHospital: 'field-hospital',
  familyName: 'field-family',
  familyAge: 'field-family',
  serviceTime: 'field-time'
}

// 从价格文案解析人民币金额（'339元一次' → 339；'128起' → 128；解析失败返回 0）
function parsePriceAmount(price) {
  const m = String(price || '').match(/(\d+(?:\.\d+)?)/)
  return m ? Number(m[1]) : 0
}

Page({
  data: {
    statusBarHeight: 0,
    types: PEIZHEN_TYPES,
    selectedType: '',      // 从类型详情页带 type 参数则锁定
    typeLocked: false,
    cities: HOSPITAL_CITIES,
    currentCity: '沈阳',
    hospitalOptions: [],
    selectedHospital: '',
    taskOptions: TASKS.map(function (t) { return { label: t, on: false } }),
    selectedTasks: [],
    who: '本人',           // 本人 / 家人
    familyName: '',
    familyAge: '',
    // 服务时间：选项列表（尽快服务 + 今天 HH:mm）、展示值、写入订单的值
    timeOptions: [],
    selectedTimeLabel: '',
    selectedTime: '',
    panelType: '',         // city / hospital / time
    assessmentSummary: '',
    assessmentRisk: '',
    priceText: '',
    images: [],
    uploadedImages: [],
    note: '',
    submitting: false,
    showLogin: false,
    locationText: '',
    assessmentObj: null,
    // 表单校验错误状态：空字符串=无错误，有值=红框+红字提示
    errors: {
      locationText: '',
      selectedType: '',
      rmbAmount: '',
      selectedHospital: '',
      serviceTime: '',
      familyName: '',
      familyAge: ''
    }
  },

  onLoad(options) {
    const systemInfo = wx.getSystemInfoSync()
    const app = getApp()
    const savedCity = (app && app.globalData && app.globalData.peizhenCity) || '沈阳'

    let selectedType = ''
    let typeLocked = false
    let priceText = ''
    let rmbAmount = 0
    if (options && options.type) {
      const name = decodeURIComponent(options.type)
      const found = PEIZHEN_TYPES.find(function (t) { return t.name === name })
      if (found) {
        selectedType = name
        typeLocked = true
        priceText = found.price || ''
        rmbAmount = parsePriceAmount(found.price)
      }
    }

    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      selectedType: selectedType,
      typeLocked: typeLocked,
      priceText: priceText,
      rmbAmount: rmbAmount,
      currentCity: savedCity,
      hospitalOptions: (HOSPITALS[savedCity] || []).map(function (h) { return h.name })
    })
    this.refreshAssessment()
    // 生成服务时间选项并默认选中（当前时间 + 30 分钟向上取整到 5 分钟）
    this.refreshTimeSlots()
  },

  onShow() {
    // 从健康评估问卷返回后刷新
    this.refreshAssessment()
  },

  refreshAssessment() {
    const saved = wx.getStorageSync('peizhenAssessment')
    if (saved && saved.risk) {
      this.setData({
        assessmentSummary: saved.summaryText || '',
        assessmentRisk: saved.risk,
        assessmentObj: saved
      })
    }
  },

  goBack() {
    wx.navigateBack()
  },

  goAssessment() {
    wx.navigateTo({
      url: '/pages/health-assessment/health-assessment'
    })
  },

  onLoginSuccess() {
    this.setData({ showLogin: false })
  },

  onLoginClose() {
    this.setData({ showLogin: false })
  },

  // 地图定位选点（顶部）：如接送地点等，随订单附在需求描述里
  onChooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        const text = res.name && res.address ? res.name + '（' + res.address + '）' : (res.name || res.address || '')
        if (!text) {
          wx.showToast({ title: '未获取到位置', icon: 'none' })
          return
        }
        this.setData({ locationText: text })
        this.clearError('locationText')
        wx.showToast({ title: '定位成功', icon: 'success' })
      },
      fail: (err) => {
        const msg = (err && err.errMsg) || ''
        if (msg.indexOf('cancel') > -1) return
        wx.showModal({ title: '定位失败', content: '请确认手机已开启定位权限后重试', showCancel: false })
      }
    })
  },

  // ===== 服务类型（未锁定时横向滚动选择） =====
  onTypeTap(e) {
    if (this.data.typeLocked) return
    const name = e.currentTarget.dataset.name
    const found = PEIZHEN_TYPES.find(function (t) { return t.name === name })
    // 选择服务类型即联动带出对应金额（消灭假数据）
    this.setData({
      selectedType: name,
      priceText: found ? (found.price || '') : '',
      rmbAmount: found ? parsePriceAmount(found.price) : 0
    })
    this.clearError('selectedType')
    this.clearError('rmbAmount')
  },

  // ===== 选择面板 =====
  openCityPanel() {
    this.setData({ panelType: 'city' })
  },

  openHospitalPanel() {
    if (!this.data.currentCity) {
      wx.showToast({ title: '请先选择城市', icon: 'none' })
      return
    }
    this.setData({ panelType: 'hospital' })
  },

  openTimePanel() {
    // 打开前重新生成选项：保证列表中不会出现已过去的时间
    this.refreshTimeSlots()
    this.setData({ panelType: 'time' })
  },

  onCitySelect(e) {
    const city = e.detail.value
    this.setData({
      currentCity: city,
      selectedHospital: '',
      hospitalOptions: (HOSPITALS[city] || []).map(function (h) { return h.name }),
      panelType: ''
    })
    const app = getApp()
    if (app && app.globalData) {
      app.globalData.peizhenCity = city
    }
  },

  onHospitalSelect(e) {
    this.setData({
      selectedHospital: e.detail.value,
      panelType: ''
    })
    this.clearError('selectedHospital')
  },

  onTimePanelSelect(e) {
    const label = this.data.timeOptions[e.detail.index]
    this.setData({
      selectedTimeLabel: label,
      selectedTime: labelToTime(label),
      panelType: ''
    })
    this.clearError('serviceTime')
  },

  onPanelCancel() {
    this.setData({ panelType: '' })
  },

  // 生成服务时间选项（尽快服务 + 今天具体时间）并保持默认选中
  refreshTimeSlots() {
    const options = generateTimeSlots()
    const defaultLabel = defaultTimeLabel()
    // 已选值仍有效则保留（如已选「今天 10:35」且尚未过期），否则回退到默认项
    let label = this.data.selectedTimeLabel
    if (!label || options.indexOf(label) < 0) {
      label = defaultLabel
    }
    this.setData({
      timeOptions: options,
      selectedTimeLabel: label,
      selectedTime: labelToTime(label)
    })
  },

  // ===== 帮办事项（多选，on 标记在 JS 里算好） =====
  onTaskTap(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    const selectedTasks = this.data.selectedTasks.slice()
    const label = this.data.taskOptions[idx].label
    const pos = selectedTasks.indexOf(label)
    if (pos > -1) {
      selectedTasks.splice(pos, 1)
    } else {
      selectedTasks.push(label)
    }
    const taskOptions = this.data.taskOptions.map(function (t) {
      return { label: t.label, on: selectedTasks.indexOf(t.label) > -1 }
    })
    this.setData({ selectedTasks: selectedTasks, taskOptions: taskOptions })
  },

  // ===== 谁就诊 =====
  onWhoTap(e) {
    const who = e.currentTarget.dataset.who
    this.setData({ who: who })
    // 切回「本人」时清掉家人信息的错误高亮
    if (who === '本人') {
      this.clearError('familyName')
      this.clearError('familyAge')
    }
  },

  onFamilyNameInput(e) {
    this.setData({ familyName: e.detail.value })
    this.clearError('familyName')
  },

  onFamilyAgeInput(e) {
    this.setData({ familyAge: e.detail.value })
    this.clearError('familyAge')
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value })
  },

  // ===== 单据照片上传（与发布页一致，最多3张） =====
  onUploadImage() {
    if (this._uploading) {
      wx.showToast({ title: '图片上传中，请稍候', icon: 'none' })
      return
    }
    if (this.data.images.length >= 3) {
      wx.showToast({ title: '最多上传3张图片', icon: 'none' })
      return
    }

    const remainCount = 3 - this.data.images.length
    wx.chooseImage({
      count: remainCount,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempImages = res.tempFilePaths
        if (!tempImages || tempImages.length === 0) return

        const newImages = this.data.images.concat(tempImages)
        this.setData({ images: newImages })

        this._uploading = true
        this._pendingUploads = tempImages.length
        this.doUpload(tempImages[0], 0, tempImages, [])
      },
      fail: (err) => {
        console.log('chooseImage fail:', err)
      }
    })
  },

  doUpload(currentPath, index, allPaths, collectedUrls) {
    const baseUrl = getBaseUrl()
    const uploadUrl = `${baseUrl}/api/upload`

    wx.uploadFile({
      url: uploadUrl,
      filePath: currentPath,
      name: 'images',
      success: (res) => {
        try {
          const data = JSON.parse(res.data)
          if (data.code === 0 && data.data && data.data.length > 0) {
            collectedUrls.push(data.data[0])

            const nextIndex = index + 1
            if (nextIndex < allPaths.length) {
              setTimeout(() => {
                this.doUpload(allPaths[nextIndex], nextIndex, allPaths, collectedUrls)
              }, 200)
            } else {
              const newUploadedImages = this.data.uploadedImages.concat(collectedUrls)
              this.setData({ uploadedImages: newUploadedImages })

              setTimeout(() => {
                wx.showToast({ title: '图片上传成功', icon: 'success', duration: 2000 })
              }, 100)
              this._uploading = false
            }
          } else {
            wx.showToast({ title: data.message || '上传失败', icon: 'none' })
            this._uploading = false
          }
        } catch (e) {
          console.error('JSON parse error:', e ? (e.stack || e.message || JSON.stringify(e)) : 'unknown')
          wx.showToast({ title: '解析响应失败', icon: 'none' })
          this._uploading = false
        }
      },
      fail: (err) => {
        console.error('uploadFile fail:', err ? (err.errMsg || JSON.stringify(err)) : 'unknown')
        wx.showToast({ title: '网络错误', icon: 'none' })
        this._uploading = false
      }
    })
  },

  onRemoveImage(e) {
    const index = e.currentTarget.dataset.index
    const images = this.data.images
    const uploadedImages = this.data.uploadedImages

    images.splice(index, 1)
    uploadedImages.splice(index, 1)

    this.setData({ images: images, uploadedImages: uploadedImages })
  },

  onPreviewImage(e) {
    const index = e.currentTarget.dataset.index
    wx.previewImage({
      current: this.data.images[index],
      urls: this.data.images
    })
  },

  // ===== 表单校验（必填项红框高亮 + 自动滚动定位） =====
  validateForm() {
    // 按页面从上到下的顺序排列，找到第一个未填项
    const checks = [
      { key: 'locationText', fail: !this.data.locationText, msg: '请选择定位地址' },
      { key: 'selectedType', fail: !this.data.selectedType, msg: '请选择服务类型' },
      { key: 'rmbAmount', fail: !this.data.rmbAmount, msg: '请重新选择陪诊服务' },
      { key: 'selectedHospital', fail: !this.data.selectedHospital, msg: '请选择就诊医院' },
      { key: 'familyName', fail: this.data.who === '家人' && !this.data.familyName.trim(), msg: '请填写家人姓名' },
      { key: 'familyAge', fail: this.data.who === '家人' && !this.data.familyAge.trim(), msg: '请填写家人年龄' },
      { key: 'serviceTime', fail: !this.data.selectedTime, msg: '请选择服务时间' }
    ]
    const errors = {}
    let firstKey = ''
    checks.forEach(function (c) {
      errors[c.key] = c.fail ? c.msg : ''
      if (c.fail && !firstKey) firstKey = c.key
    })
    this.setData({ errors: errors })
    if (firstKey) {
      this.scrollToError(FIELD_ANCHORS[firstKey])
      return false
    }
    return true
  },

  // 平滑滚动到报错字段，滚动位置避开顶部固定导航栏
  scrollToError(id) {
    const systemInfo = wx.getSystemInfoSync()
    const navHeight = systemInfo.statusBarHeight + Math.round(systemInfo.windowWidth * 160 / 750)
    setTimeout(function () {
      wx.createSelectorQuery().select('#' + id).boundingClientRect(function (rect) {
        if (!rect) return
        wx.createSelectorQuery().selectViewport().scrollOffset(function (offset) {
          wx.pageScrollTo({
            scrollTop: Math.max(offset.scrollTop + rect.top - navHeight - 20, 0),
            duration: 300
          })
        }).exec()
      }).exec()
    }, 150)
  },

  // 字段输入/选择后自动消除该字段的错误高亮
  clearError(key) {
    if (!this.data.errors[key]) return
    const update = {}
    update['errors.' + key] = ''
    this.setData(update)
  },

  // ===== 提交 =====
  async onPublish() {
    if (this.data.submitting) return

    // 提交前重新生成时间选项，保证所选时间不早于当前时间
    this.refreshTimeSlots()
    // 必填项校验：未通过时红框高亮 + 自动滚动定位到第一个未填字段
    if (!this.validateForm()) return

    const token = wx.getStorageSync('token')
    if (!token) {
      // 游客点提交 → 弹出登录提示（登录后表单数据仍在，再点一次即可提交）
      this.setData({ showLogin: true })
      return
    }

    // 组装需求描述：健康评估 + 服务信息（管理员审核与互助员接单时可见）
    const lines = []
    if (this.data.assessmentSummary) {
      lines.push('【健康评估】' + this.data.assessmentRisk + '：' + this.data.assessmentSummary)
    }
    let typeLine = '服务类型：' + this.data.selectedType
    if (this.data.selectedTasks.length > 0) {
      typeLine += '；帮办事项：' + this.data.selectedTasks.join('、')
    }
    lines.push(typeLine)
    lines.push(this.data.who === '家人'
      ? '患者：家人（' + this.data.familyName + '，' + this.data.familyAge + '岁）'
      : '患者：本人')
    lines.push('就诊医院：' + this.data.currentCity + '·' + this.data.selectedHospital)
    if (this.data.locationText) {
      lines.push('定位地点：' + this.data.locationText)
    }
    if (this.data.note.trim()) {
      lines.push(this.data.note.trim())
    }
    const remark = lines.join('\n')

    const { post } = require('../../utils/request')
    try {
      this.setData({ submitting: true })
      // 创建订单：陪诊类带人民币金额，后端落「待支付」，支付成功后转「待接单」
      const result = await post('/api/orders', {
        type: '陪诊服务',
        subType: this.data.selectedType,
        priceText: this.data.priceText,
        rmbAmount: this.data.rmbAmount,
        address: this.data.currentCity + '·' + this.data.selectedHospital,
        // 结构化字段：就诊人 / 帮办事项 / 健康评估
        patientRelation: this.data.who,
        patientName: this.data.who === '家人' ? this.data.familyName : '',
        patientAge: this.data.who === '家人' ? this.data.familyAge : '',
        tasks: this.data.selectedTasks,
        assessment: this.data.assessmentObj || null,
        time: this.data.selectedTime,
        reward: 5,
        remark: remark,
        images: this.data.uploadedImages
      }, { loadingTitle: '提交中...' })

      const orderId = result && result.id
      if (!orderId) {
        wx.showToast({ title: '订单创建失败，请重试', icon: 'none' })
        return
      }
      // 订单创建成功（状态：待支付）→ 拉起支付
      this.requestPayment(orderId, this.data.rmbAmount)
    } catch (error) {
      console.error('提交失败:', error ? (error.stack || error.message || JSON.stringify(error)) : 'unknown')
      wx.hideLoading()
      wx.showToast({
        title: (error && error.message) ? String(error.message) : '提交失败，请重试',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  },

  // ===== 拉起支付（未来接入真实微信支付的唯一替换点） =====
  // 一期模拟支付：弹窗确认后调后端 Mock 支付接口 POST /api/orders/{id}/pay（pay_mock=1 支付即成功，订单转待接单）。
  // 上线时仅需把本方法内 wx.showModal 的确认回调替换为 wx.requestPayment({...}) 即可，其余业务代码不用动。
  requestPayment(orderId, amount) {
    wx.showModal({
      title: '模拟支付',
      content: '是否立即支付 ¥' + amount + '？',
      confirmText: '确认支付',
      cancelText: '稍后支付',
      confirmColor: '#2D7D46',
      success: (res) => {
        if (res.confirm) {
          this.confirmPay(orderId)
        } else {
          this.abandonPay(orderId)
        }
      }
    })
  },

  // 确认支付：调后端 Mock 支付，成功后订单由「待支付」转「待接单」
  async confirmPay(orderId) {
    try {
      const { post } = require('../../utils/request')
      await post('/api/orders/' + orderId + '/pay', {}, { loadingTitle: '支付中...' })
      wx.setStorageSync('needRefreshOrders', true)
      wx.showToast({ title: '支付成功！', icon: 'success', duration: 1500 })
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/order/order',
          fail: () => {
            wx.showToast({ title: '跳转失败，请手动点击订单Tab', icon: 'none', duration: 2000 })
          }
        })
      }, 1500)
    } catch (error) {
      console.error('支付失败:', error ? (error.stack || error.message || JSON.stringify(error)) : 'unknown')
      wx.hideLoading()
      wx.showToast({
        title: (error && error.message) ? String(error.message) : '支付失败，请重试',
        icon: 'none'
      })
    }
  },

  // 放弃支付：订单页暂无「待支付」页签，未支付订单自动作废，避免产生不可见订单
  async abandonPay(orderId) {
    try {
      const { post } = require('../../utils/request')
      await post('/api/orders/' + orderId + '/cancel', { cancelReason: '我不需要服务了' }, { silent: true })
      wx.showToast({ title: '已放弃支付，订单已作废', icon: 'none' })
    } catch (e) {
      console.error('作废待支付订单失败:', e ? (e.message || JSON.stringify(e)) : 'unknown')
      wx.showToast({ title: '已放弃支付', icon: 'none' })
    }
  }
})
