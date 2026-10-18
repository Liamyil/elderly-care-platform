const app = getApp()

Page({
  data: {
    statusBarHeight: 0,
    contacts: [
      { id: 1, name: '张伟', relation: '儿子', phone: '138****1234' },
      { id: 2, name: '李芳', relation: '女儿', phone: '139****5678' }
    ],
    showAddModal: false,
    editingId: null,
    formData: {
      name: '',
      relation: '',
      phone: ''
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
        relation: '',
        phone: ''
      },
      canSubmit: false
    })
  },

  onNameInput(e) {
    this.updateFormData('name', e.detail.value)
  },

  onRelationInput(e) {
    this.updateFormData('relation', e.detail.value)
  },

  onPhoneInput(e) {
    this.updateFormData('phone', e.detail.value)
  },

  updateFormData(field, value) {
    const formData = { ...this.data.formData, [field]: value }
    const canSubmit = formData.name.trim() && formData.relation.trim() && formData.phone.trim()
    this.setData({ formData, canSubmit })
  },

  onCloseModal() {
    this.setData({
      showAddModal: false,
      editingId: null,
      formData: {
        name: '',
        relation: '',
        phone: ''
      },
      canSubmit: false
    })
  },

  preventClose() {},

  onSubmit() {
    const { name, relation, phone } = this.data.formData
    if (!name.trim() || !relation.trim() || !phone.trim()) {
      return
    }

    let newContacts = [...this.data.contacts]

    if (this.data.editingId) {
      const index = newContacts.findIndex(c => c.id === this.data.editingId)
      if (index > -1) {
        newContacts[index] = {
          ...newContacts[index],
          name: name.trim(),
          relation: relation.trim(),
          phone: phone.trim()
        }
      }
      wx.showToast({
        title: '修改成功',
        icon: 'success'
      })
    } else {
      const newContact = {
        id: Date.now(),
        name: name.trim(),
        relation: relation.trim(),
        phone: phone.trim()
      }
      newContacts.push(newContact)
      wx.showToast({
        title: '添加成功',
        icon: 'success'
      })
    }

    this.setData({
      contacts: newContacts,
      showAddModal: false,
      editingId: null,
      formData: {
        name: '',
        relation: '',
        phone: ''
      },
      canSubmit: false
    })

    if (app.globalData.userInfo) {
      app.saveUserInfo({
        ...app.globalData.userInfo,
        emergencyCount: newContacts.length
      })
    }
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除联系人',
      content: '确定要删除该联系人吗？',
      confirmColor: '#E53935',
      success: (res) => {
        if (res.confirm) {
          const newContacts = this.data.contacts.filter(c => c.id !== id)
          this.setData({
            contacts: newContacts
          })
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          })

          if (app.globalData.userInfo) {
            app.saveUserInfo({
              ...app.globalData.userInfo,
              emergencyCount: newContacts.length
            })
          }
        }
      }
    })
  }
})