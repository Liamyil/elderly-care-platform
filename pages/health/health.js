Page({
  data: {
    statusBarHeight: 0,
    userInfo: {
      name: '张大爷',
      age: 72,
      gender: '男',
      riskLevel: 'low-risk',
      riskLevelText: '低风险'
    },
    healthMetrics: [
      { key: 'bloodPressure', icon: '🩸', value: '120/80', label: '血压(mmHg)' },
      { key: 'bloodGlucose', icon: '💉', value: '5.6', label: '血糖(mmol/L)' },
      { key: 'heartRate', icon: '❤️', value: '72', label: '心率(bpm)' },
      { key: 'bloodOxygen', icon: '💨', value: '98%', label: '血氧' }
    ],
    medicines: [
      { id: '1', name: '阿莫西林胶囊', dosage: '每日2次', takeTime: '早晚餐后服用', taken: true },
      { id: '2', name: '降压药', dosage: '每日1次', takeTime: '早晨服用', taken: false },
      { id: '3', name: '维生素D钙片', dosage: '每日1次', takeTime: '晚餐后服用', taken: false }
    ],
    healthRecords: [
      { id: '1', icon: '🩸', type: '血压测量', time: '2026-07-14', value: '120/80' },
      { id: '2', icon: '💉', type: '血糖测量', time: '2026-07-13', value: '5.6' },
      { id: '3', icon: '❤️', type: '心率测量', time: '2026-07-12', value: '72' }
    ]
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight
    })
  },

  goBack() {
    wx.navigateBack()
  },

  onMedicineClick(e) {
    const id = e.currentTarget.dataset.id
    const medicine = this.data.medicines.find(item => item.id === id)
    wx.showToast({
      title: `${medicine.name}详情开发中`,
      icon: 'none'
    })
  },

  onViewAllRecords() {
    wx.showToast({
      title: '跳转全部健康记录',
      icon: 'none'
    })
  },

  onRecordClick(e) {
    const id = e.currentTarget.dataset.id
    const record = this.data.healthRecords.find(item => item.id === id)
    wx.showToast({
      title: `${record.type}详情开发中`,
      icon: 'none'
    })
  }
})