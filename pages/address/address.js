const app = getApp()

Page({
  data: {
    statusBarHeight: 0,
    addresses: [
      { id: 1, name: '家', detail: '浦东新区东方路1881号东方明珠小区3号楼101室', isDefault: true },
      { id: 2, name: '儿子家', detail: '浦东新区世纪大道100号环球金融中心公寓1205室', isDefault: false }
    ],
    showAddModal: false,
    editingId: null,
    formData: {
      name: '',
      detail: ''
    },
    canSubmit: false
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

  onAdd() {
    this.setData({
      showAddModal: true,
      editingId: null,
      formData: {
        name: '',
        detail: ''
      },
      canSubmit: false
    })
  },

  onNameInput(e) {
    this.updateFormData('name', e.detail.value)
  },

  onDetailInput(e) {
    this.updateFormData('detail', e.detail.value)
  },

  updateFormData(field, value) {
    const formData = { ...this.data.formData, [field]: value }
    const canSubmit = formData.name.trim() && formData.detail.trim()
    this.setData({ formData, canSubmit })
  },

  onCloseModal() {
    this.setData({
      showAddModal: false,
      editingId: null,
      formData: {
        name: '',
        detail: ''
      },
      canSubmit: false
    })
  },

  preventClose() {},

  onSubmit() {
    const { name, detail } = this.data.formData
    if (!name.trim() || !detail.trim()) {
      return
    }

    let newAddresses = [...this.data.addresses]

    if (this.data.editingId) {
      const index = newAddresses.findIndex(a => a.id === this.data.editingId)
      if (index > -1) {
        newAddresses[index] = {
          ...newAddresses[index],
          name: name.trim(),
          detail: detail.trim()
        }
      }
      wx.showToast({
        title: '修改成功',
        icon: 'success'
      })
    } else {
      const isFirst = newAddresses.length === 0
      const newAddress = {
        id: Date.now(),
        name: name.trim(),
        detail: detail.trim(),
        isDefault: isFirst
      }
      newAddresses.push(newAddress)
      wx.showToast({
        title: '添加成功',
        icon: 'success'
      })
    }

    this.setData({
      addresses: newAddresses,
      showAddModal: false,
      editingId: null,
      formData: {
        name: '',
        detail: ''
      },
      canSubmit: false
    })

    if (app.globalData.userInfo) {
      app.saveUserInfo({
        ...app.globalData.userInfo,
        addressCount: newAddresses.length
      })
    }
  },

  onSetDefault(e) {
    const id = e.currentTarget.dataset.id
    const newAddresses = this.data.addresses.map(a => ({
      ...a,
      isDefault: a.id === id
    }))
    this.setData({
      addresses: newAddresses
    })
    wx.showToast({
      title: '已设为默认地址',
      icon: 'success'
    })
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id
    const address = this.data.addresses.find(a => a.id === id)
    
    wx.showModal({
      title: '删除地址',
      content: '确定要删除该地址吗？',
      confirmColor: '#E53935',
      success: (res) => {
        if (res.confirm) {
          let newAddresses = this.data.addresses.filter(a => a.id !== id)
          
          if (address.isDefault && newAddresses.length > 0) {
            newAddresses[0].isDefault = true
          }

          this.setData({
            addresses: newAddresses
          })
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          })

          if (app.globalData.userInfo) {
            app.saveUserInfo({
              ...app.globalData.userInfo,
              addressCount: newAddresses.length
            })
          }
        }
      }
    })
  }
})