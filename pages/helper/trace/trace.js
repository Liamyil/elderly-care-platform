// 服务打卡留痕页（互助员端）：开工/完工打卡 = 定位 + 现场拍照 + 人工确认
// 对应《整体实现方案》"上门定位打卡 + 现场拍照留痕"；一期不做距离硬校验（订单地址为文字）
const { OrderAPI } = require('../../../utils/api')
const { getBaseUrl } = require('../../../utils/request')
const { requestSubscribe } = require('../../../utils/subscribe')

Page({
  data: {
    statusBarHeight: 0,
    orderId: '',
    kind: 'start',        // start=开工打卡 / end=完工打卡
    kindName: '开工打卡',
    order: null,
    longitude: '',
    latitude: '',
    locationText: '',
    locationTime: '',
    images: [],
    uploadedImages: [],
    submitting: false
  },

  onLoad(options) {
    const sysInfo = wx.getSystemInfoSync()
    const kind = options && options.kind === 'end' ? 'end' : 'start'
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight,
      orderId: (options && options.orderId) || '',
      kind: kind,
      kindName: kind === 'end' ? '完工打卡' : '开工打卡'
    })
    this.loadOrder()
  },

  async loadOrder() {
    if (!this.data.orderId) return
    try {
      const order = await OrderAPI.getOrderDetail(this.data.orderId)
      this.setData({ order: order })
    } catch (e) {
      console.error('加载订单失败:', e ? (e.stack || e.message || JSON.stringify(e)) : 'unknown')
    }
  },

  goBack() {
    wx.navigateBack()
  },

  // ===== 定位（地图选点：展示街道地址，经纬度仅入库备查不展示） =====
  onGetLocation() {
    wx.chooseLocation({
      success: (res) => {
        const locationText = res.name && res.address
          ? res.name + '（' + res.address + '）'
          : (res.name || res.address || '已选择位置')
        this.setData({
          longitude: (res.longitude || 0).toFixed(6),
          latitude: (res.latitude || 0).toFixed(6),
          locationText: locationText,
          locationTime: new Date().toLocaleTimeString('zh-CN', { hour12: false })
        })
        wx.showToast({ title: '定位成功', icon: 'success' })
      },
      fail: (err) => {
        const errMsg = (err && err.errMsg) || ''
        // 用户取消选择时静默处理
        if (errMsg.indexOf('cancel') > -1) return
        console.error('选择位置失败:', errMsg)
        wx.showModal({
          title: '定位失败',
          content: '请确认手机已开启定位权限（可在微信设置→位置信息中开启），然后重试',
          showCancel: false
        })
      }
    })
  },

  // ===== 现场拍照（与发布页一致，最多3张） =====
  onTakePhoto() {
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
      sourceType: ['camera', 'album'],
      success: (res) => {
        const tempImages = res.tempFilePaths
        if (!tempImages || tempImages.length === 0) return

        const newImages = this.data.images.concat(tempImages)
        this.setData({ images: newImages })

        this._uploading = true
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
                wx.showToast({ title: '照片上传成功', icon: 'success', duration: 2000 })
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

  // ===== 提交打卡（定位 + 照片 + 人工确认服务地点） =====
  onSubmit() {
    if (!this.data.orderId) {
      wx.showToast({ title: '订单信息缺失', icon: 'none' })
      return
    }
    if (!this.data.longitude || !this.data.latitude) {
      wx.showToast({ title: '请先获取定位', icon: 'none' })
      return
    }
    if (this.data.uploadedImages.length === 0) {
      wx.showToast({ title: '请拍摄现场照片', icon: 'none' })
      return
    }
    if (this.data.submitting) return

    const address = (this.data.order && this.data.order.address) || '服务地点'
    wx.showModal({
      title: this.data.kindName,
      content: '请确认您已到达服务地点：' + address + '\n\n打卡将记录当前定位与现场照片，作为服务留痕依据。',
      confirmText: '确认打卡',
      confirmColor: '#2D7D46',
      success: (res) => {
        if (res.confirm) {
          // 打卡后引导订阅服务提醒（结算到账等）
          requestSubscribe()
          this.doSubmit()
        }
      }
    })
  },

  async doSubmit() {
    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中...', mask: true })
    try {
      const result = await OrderAPI.addTrace(this.data.orderId, {
        kind: this.data.kind,
        photos: this.data.uploadedImages,
        longitude: Number(this.data.longitude),
        latitude: Number(this.data.latitude),
        locationText: this.data.locationText || (this.data.order && this.data.order.address) || ''
      })
      wx.hideLoading()
      this.setData({ submitting: false })
      if (result) {
        wx.showToast({ title: this.data.kindName + '成功', icon: 'success', duration: 1500 })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      }
    } catch (e) {
      wx.hideLoading()
      this.setData({ submitting: false })
      console.error('打卡失败:', e ? (e.stack || e.message || JSON.stringify(e)) : 'unknown')
      wx.showToast({
        title: (e && e.message) ? String(e.message) : '打卡失败，请重试',
        icon: 'none',
        duration: 2500
      })
    }
  }
})
