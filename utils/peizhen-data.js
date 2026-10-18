/**
 * 陪诊服务数据文件（手动维护）
 *
 * 使用方法：后续补充真实数据时，只改这个文件。
 * - image:     类型图片路径（如 '/images/peizhen/上门接送.png'），留空时页面显示图标占位
 * - baseInfo:  基础信息（一句话说明），留空时页面不显示该行
 * - sales:     销量（如 '已售 320'），留空时页面不显示该行
 * - price:     参考价格（如 '128起' 或 '128/次'），留空时页面不显示该行
 * - tags:      标签数组（如 ['陪诊师陪同', '含接送']），留空不显示
 * - badge:     图片左上角角标（如 '尊享服务'），留空不显示
 * - guarantees: 保障数组（如 ['保险承保', '省心', '安全']），留空不显示
 *
 * 注：baseInfo 与 sales 为试玩版演示数据（2026-09-30 补充），正式上线前需替换为真实运营数据
 */
const PEIZHEN_TYPES = [
  // ===== 全程陪诊 =====
  { category: '全程陪诊', name: '上门接送', icon: '🚗', image: '/images/陪诊/全程陪诊/上门接送，温暖相伴.jpg', baseInfo: '专车接送往返医院，全程陪同不落单', sales: '', price: '50元一次', tags: [], badge: '', guarantees: ['保险承保', '省心安全'] },
  { category: '全程陪诊', name: '2小时陪诊', icon: '⏱️', image: '/images/陪诊/全程陪诊/全程陪诊暖心服务.jpg', baseInfo: '两小时内全程陪同，适合简单复诊', sales: '', price: '198元一次', tags: [], badge: '', guarantees: ['白天陪诊', '平安承保'] },
  { category: '全程陪诊', name: '4小时陪诊', icon: '🕓', image: '/images/陪诊/全程陪诊/全程陪诊暖心服务.jpg', baseInfo: '半天陪同，适合多科室检查', sales: '', price: '339元一次', tags: [], badge: '', guarantees: ['白间陪诊', '家属看板', '平安承保'] },
  { category: '全程陪诊', name: '白天急诊4小时', icon: '🌤️', image: '/images/陪诊/全程陪诊/全程陪诊暖心服务.jpg', baseInfo: '白天急诊陪同，快速响应', sales: '', price: '398元一次', tags: [], badge: '', guarantees: ['凭证上岗', '保险承托', '家属看板'] },
  { category: '全程陪诊', name: '夜间急诊4小时', icon: '🌙', image: '/images/陪诊/全程陪诊/全程陪诊暖心服务.jpg', baseInfo: '夜间急诊陪同，凭证上岗', sales: '', price: '598元一次', tags: [], badge: '', guarantees: ['凭证上岗', '家属看板'] },
  { category: '全程陪诊', name: '8小时陪诊', icon: '🕗', image: '/images/陪诊/全程陪诊/全程陪诊暖心服务.jpg', baseInfo: '全天陪同，适合住院办理', sales: '', price: '599元一次', tags: [], badge: '', guarantees: ['白间陪诊', '家属看板', '平安承保'] },

  // ===== 专项陪诊 =====
  { category: '专项陪诊', name: '静脉输液', icon: '💉', image: '', baseInfo: '输液全程看护，持证上岗', sales: '', price: '198元', tags: [], badge: '', guarantees: ['持证上岗', '保险承托'] },
  { category: '专项陪诊', name: '穿刺活检', icon: '🧬', image: '', baseInfo: '穿刺陪同，全程心理安抚', sales: '', price: '258元', tags: [], badge: '', guarantees: ['持证上岗', '保险承托'] },
  { category: '专项陪诊', name: '近视手术', icon: '👁️', image: '', baseInfo: '术前术后陪同，家属看板同步', sales: '', price: '259元', tags: [], badge: '', guarantees: ['持证上岗', '保险承托', '家属看板'] },
  { category: '专项陪诊', name: '全周期孕产检查', icon: '🤰', image: '', baseInfo: '孕产全周期检查陪同', sales: '', price: '259元', tags: [], badge: '', guarantees: ['持证上岗', '保险承托'] },
  { category: '专项陪诊', name: '骨折复位固定', icon: '🦴', image: '', baseInfo: '骨科陪同，含康复指导', sales: '', price: '259元', tags: [], badge: '', guarantees: ['持证上岗', '保险承托'] },
  { category: '专项陪诊', name: '无痛肠胃镜检查', icon: '🔬', image: '', baseInfo: '胃肠镜全程陪同，注意事项提醒', sales: '', price: '259元', tags: [], badge: '', guarantees: ['专业', '可靠', '安全'] },
  { category: '专项陪诊', name: '复杂拔牙', icon: '🦷', image: '', baseInfo: '口腔陪同，术后护理提醒', sales: '', price: '259元', tags: [], badge: '', guarantees: ['持证上岗', '保险承托'] },
  { category: '专项陪诊', name: '结石', icon: '🪨', image: '', baseInfo: '泌尿结石检查陪同', sales: '', price: '259元', tags: [], badge: '', guarantees: ['持证上岗', '保险承托'] },
  { category: '专项陪诊', name: '增强扫描（CT/MRI）', icon: '📡', image: '', baseInfo: '增强扫描陪同，造影剂观察', sales: '', price: '259元', tags: [], badge: '', guarantees: ['专业', '可靠', '安全'] },
  { category: '专项陪诊', name: '透析', icon: '🩸', image: '', baseInfo: '透析全程看护', sales: '', price: '299元', tags: [], badge: '', guarantees: ['持证上岗', '保险承托'] },
  { category: '专项陪诊', name: '化疗', icon: '💊', image: '', baseInfo: '化疗陪同，用药提醒', sales: '', price: '299元', tags: [], badge: '', guarantees: ['持证上岗', '保险承托'] }
]

/**
 * 医院数据（与医院信息页、下单页共用）
 * 后续补充真实医院信息时改这里
 */
const HOSPITALS = {
  '沈阳': [
    { name: '中国医科大学附属盛京医院', level: '三甲综合', addr: '沈阳市和平区三好街36号' },
    { name: '辽宁省人民医院', level: '三甲综合', addr: '沈阳市沈河区文艺路33号' },
    { name: '辽宁中医药大学附属医院', level: '三甲中医', addr: '沈阳市皇姑区北陵大街33号' },
    { name: '沈阳市第四人民医院', level: '三乙综合', addr: '沈阳市皇姑区黄河南大街20号' }
  ],
  '上海': [
    { name: '上海交通大学医学院附属瑞金医院', level: '三甲综合', addr: '上海市黄浦区瑞金二路197号' },
    { name: '复旦大学附属华山医院', level: '三甲综合', addr: '上海市静安区乌鲁木齐中路12号' },
    { name: '复旦大学附属中山医院', level: '三甲综合', addr: '上海市徐汇区枫林路180号' },
    { name: '上海市第一人民医院', level: '三甲综合', addr: '上海市虹口区武进路85号' }
  ],
  '杭州': [
    { name: '浙江大学医学院附属第一医院', level: '三甲综合', addr: '杭州市上城区庆春路79号' },
    { name: '浙江大学医学院附属第二医院', level: '三甲综合', addr: '杭州市上城区解放路88号' },
    { name: '浙江省人民医院', level: '三甲综合', addr: '杭州市拱墅区上塘路158号' },
    { name: '杭州市中医院', level: '三乙中医', addr: '杭州市西湖区体育场路453号' }
  ],
  '宁波': [
    { name: '宁波大学附属第一医院（月湖院区）', level: '三甲综合', addr: '宁波市海曙区柳汀街59号' },
    { name: '镇海区中医医院', level: '三乙中医', addr: '宁波市镇海区环城西路51号' },
    { name: '宁波市第九医院', level: '二甲综合', addr: '宁波市江北区祥北路68号' }
  ]
}

const HOSPITAL_CITIES = ['沈阳', '上海', '杭州', '宁波']

module.exports = {
  PEIZHEN_TYPES: PEIZHEN_TYPES,
  HOSPITALS: HOSPITALS,
  HOSPITAL_CITIES: HOSPITAL_CITIES
}
