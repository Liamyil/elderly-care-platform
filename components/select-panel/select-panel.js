/**
 * 通用选择面板组件（大字号，替代系统原生 picker）
 * 用法：
 *   mode="list"：传入 options 数组，点选项触发 select 事件 {index, value}
 *   mode="date"：年月日三列滚动，点确定触发 confirm 事件 {date: 'YYYY-MM-DD'}
 *   点遮罩/取消触发 cancel 事件
 */
Component({
  properties: {
    show: { type: Boolean, value: false },
    title: { type: String, value: '请选择' },
    mode: { type: String, value: 'list' },
    options: { type: Array, value: [] },
    // 当前选中值（list 模式下高亮显示 ✓，可选属性，不影响原有用法）
    value: { type: String, value: '' }
  },

  data: {
    dateValue: [0, 0, 0],
    years: [],
    months: [],
    days: []
  },

  observers: {
    show: function (show) {
      if (show && this.properties.mode === 'date') {
        this.initDate()
      }
    }
  },

  lifetimes: {
    attached() {
      const now = new Date()
      const years = []
      for (let y = now.getFullYear(); y <= now.getFullYear() + 2; y++) {
        years.push(y + '年')
      }
      const months = []
      for (let m = 1; m <= 12; m++) {
        months.push(m + '月')
      }
      const days = []
      for (let d = 1; d <= 31; d++) {
        days.push(d + '日')
      }
      this.setData({ years: years, months: months, days: days })
    }
  },

  methods: {
    initDate() {
      const now = new Date()
      this.setData({
        dateValue: [0, now.getMonth(), now.getDate() - 1]
      })
    },

    onOptionTap(e) {
      const index = e.currentTarget.dataset.index
      this.triggerEvent('select', { index: index, value: this.properties.options[index] })
    },

    onDateChange(e) {
      this.setData({ dateValue: e.detail.value })
    },

    onConfirm() {
      const v = this.data.dateValue
      const year = parseInt(this.data.years[v[0]])
      const month = parseInt(this.data.months[v[1]])
      const day = parseInt(this.data.days[v[2]])
      const mm = month < 10 ? '0' + month : '' + month
      const dd = day < 10 ? '0' + day : '' + day
      this.triggerEvent('confirm', { date: year + '-' + mm + '-' + dd })
    },

    onCancel() {
      this.triggerEvent('cancel')
    },

    preventClose() { }
  }
})
