const { getBaseUrl } = require('../../utils/request')
const { generateTimeSlots, defaultTimeLabel, labelToTime } = require('../../utils/time-slots')

// 表单校验：字段 → wxml 锚点 id（按页面从上到下顺序定位第一个未填项）
const FIELD_ANCHORS = {
  selectedServiceType: 'field-type',
  serviceTime: 'field-time',
  address: 'field-address'
}

Page({
  data: {
    statusBarHeight: 0,
    serviceTypes: ['助餐服务', '助洁服务', '陪诊服务', '代买代办', '日常陪伴', '助浴服务', '理发服务', '维修服务', '法律咨询', '心理关怀'],
    selectedServiceType: '',
    typeIndex: 0,
    subType: '',
    typeLocked: false,
    // 服务时间：选项列表（尽快服务 + 今天 HH:mm）、展示值、写入订单的值
    timeOptions: [],
    selectedTimeLabel: '',
    selectedTime: '',
    panelType: '',
    address: '',
    description: '',
    images: [],
    uploadedImages: [],
    assessmentSummary: '',
    assessmentRisk: '',
    assessmentObj: null,
    showLogin: false,
    // 表单校验错误状态：空字符串=无错误，有值=红框+红字提示
    errors: {
      selectedServiceType: '',
      serviceTime: '',
      address: ''
    }
  },

  onLoad(options) {
    console.log('=== publish onLoad ===')
    const systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight
    })
    // 从陪诊入口进来时，服务类型预选（如 ?type=陪诊服务）
    if (options && options.type) {
      const idx = this.data.serviceTypes.indexOf(options.type)
      if (idx >= 0) {
        this.setData({
          selectedServiceType: options.type,
          typeIndex: idx
        })
      }
    }
    // 从陪诊类型详情页进来时，锁定类型并显示具体类型（如 ?sub=代办问诊）
    if (options && options.sub) {
      this.setData({
        subType: decodeURIComponent(options.sub),
        typeLocked: true
      })
    }
    // 生成服务时间选项并默认选中（当前时间 + 30 分钟向上取整到 5 分钟）
    this.refreshTimeSlots()
  },

  onShow() {
    // 陪诊订单：读取健康评估结果（问卷页保存，可反复填写）
    const saved = wx.getStorageSync('peizhenAssessment')
    if (saved && saved.risk) {
      this.setData({
        assessmentSummary: saved.summaryText || '',
        assessmentRisk: saved.risk,
        assessmentObj: saved
      })
    }
  },

  onHide() {
    console.log('=== publish onHide ===')
  },

  onUnload() {
    console.log('=== publish onUnload ===')
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

  // 地图定位选点：自动填入详情地址
  onChooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        if (!res.address) {
          wx.showToast({ title: '未获取到位置', icon: 'none' })
          return
        }
        this.setData({ address: res.address })
        this.clearError('address')
        wx.showToast({ title: '定位成功，已填入地址', icon: 'success' })
      },
      fail: (err) => {
        const msg = (err && err.errMsg) || ''
        if (msg.indexOf('cancel') > -1) return
        wx.showModal({ title: '定位失败', content: '请确认手机已开启定位权限后重试', showCancel: false })
      }
    })
  },

  onServiceTypeChange(e) {
    const index = e.detail.value
    this.setData({
      selectedServiceType: this.data.serviceTypes[index],
      typeIndex: index
    })
    this.clearError('selectedServiceType')
  },

  // ===== 大字号选择面板 =====
  openTypePanel() {
    if (this.data.typeLocked) return
    this.setData({ panelType: 'type' })
  },

  openTimePanel() {
    // 打开前重新生成选项：保证列表中不会出现已过去的时间
    this.refreshTimeSlots()
    this.setData({ panelType: 'time' })
  },

  onTypePanelSelect(e) {
    const idx = e.detail.index
    this.setData({
      selectedServiceType: this.data.serviceTypes[idx],
      typeIndex: idx,
      panelType: ''
    })
    this.clearError('selectedServiceType')
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

  onAddressInput(e) {
    this.setData({
      address: e.detail.value
    })
    this.clearError('address')
  },

  onDescriptionInput(e) {
    this.setData({
      description: e.detail.value
    })
  },

  onUploadImage() {
    if (this._uploading) {
      wx.showToast({ title: '图片上传中，请稍候', icon: 'none' })
      return
    }

    if (this.data.images.length >= 3) {
      wx.showToast({
        title: '最多上传3张图片',
        icon: 'none'
      })
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
        this._collectedUrls = []
        
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
                wx.showToast({
                  title: '图片上传成功',
                  icon: 'success',
                  duration: 2000
                })
              }, 100)
              this._uploading = false
            }
          } else {
            wx.showToast({
              title: data.message || '上传失败',
              icon: 'none'
            })
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

    this.setData({ images, uploadedImages })
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
      { key: 'selectedServiceType', fail: !this.data.selectedServiceType, msg: '请选择服务类型' },
      { key: 'serviceTime', fail: !this.data.selectedTime, msg: '请选择服务时间' },
      { key: 'address', fail: !this.data.address.trim(), msg: '请输入服务地址' }
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

  async onPublish() {
    // 提交前重新生成时间选项，保证所选时间不早于当前时间
    this.refreshTimeSlots()
    // 必填项校验：未通过时红框高亮 + 自动滚动定位到第一个未填字段
    if (!this.validateForm()) return

    const token = wx.getStorageSync('token')
    if (!token) {
      // 游客点发布 → 弹出登录提示（登录后表单数据仍在，再点一次即可发布）
      this.setData({ showLogin: true })
      return
    }

    const { post } = require('../../utils/request')

    wx.showModal({
      title: '确认发布',
      content: '确认发布该需求吗？',
      confirmColor: '#2D7D46',
      success: async (res) => {
        if (res.confirm) {
          try {
            // 陪诊订单：健康评估结果自动附在需求描述开头
            let remark = this.data.description
            if (this.data.selectedServiceType === '陪诊服务' && this.data.assessmentSummary) {
              const healthLine = '【健康评估】' + this.data.assessmentRisk + '：' + this.data.assessmentSummary
              remark = remark ? healthLine + '\n' + remark : healthLine
            }

            const result = await post('/api/orders', {
              type: this.data.selectedServiceType,
              address: this.data.address,
              time: this.data.selectedTime,
              reward: 5,
              remark: remark,
              images: this.data.uploadedImages,
              assessment: this.data.assessmentObj || null
            }, { loadingTitle: '发布中...' })

            if (result) {
              wx.setStorageSync('needRefreshOrders', true)

              wx.showToast({
                title: '发布成功！',
                icon: 'success',
                duration: 1500
              })

              setTimeout(() => {
                wx.switchTab({
                  url: '/pages/order/order',
                  fail: () => {
                    wx.showToast({
                      title: '跳转失败，请手动点击订单Tab',
                      icon: 'none',
                      duration: 2000
                    })
                  }
                })
              }, 1500)
            }
          } catch (error) {
            console.error('发布失败:', error ? (error.stack || error.message || JSON.stringify(error)) : 'unknown')
            const errMsg = (error && error.message) ? String(error.message) : '发布失败，请重试'
            if (errMsg.includes('登录已过期')) {
              wx.hideLoading()
            } else {
              wx.hideLoading()
              wx.showToast({
                title: errMsg,
                icon: 'none'
              })
            }
          }
        }
      }
    })
  }
})
