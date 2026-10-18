/**
 * 生成《智慧互助养老平台 · 小程序使用教程》Word 文档（.docx）
 * 用法：node scripts/generate-tutorial-docx.js
 * 输出：桌面 小程序使用教程.docx（若文件被 Word 占用则输出"小程序使用教程_新版.docx"）
 * 原理：docx 即 ZIP 包，本脚本直接生成最小合法 docx（无第三方依赖）
 */
/* eslint-disable */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const TMP = path.join(__dirname, '.docx_tmp')
const OUT_DIR = path.join(process.env.USERPROFILE || 'C:/Users/yi', 'Desktop')
const OUT_FILE = path.join(OUT_DIR, '小程序使用教程.docx')

// ---------- 内容定义：[类型, 文本] ----------
const CONTENT = [
  ['title', '智慧互助养老平台 · 小程序使用教程'],
  ['p', '适用版本：V1.0 试玩版（2026年9月）'],
  ['p', '本教程覆盖：登录与角色、居民端（下单/订单/评价/时间银行/个人中心）、互助员端（抢单/打卡留痕/完成服务）、陪诊服务全流程。'],

  ['h1', '第一章 使用前准备'],
  ['h2', '1.1 打开小程序（游客模式）'],
  ['p', '打开小程序默认以"游客"身份进入，无需登录即可浏览首页、陪诊服务等内容。'],
  ['p', '执行需要登录的操作时（如点击服务类型、立即预约、发布需求、查看"我的"等），会自动弹出登录窗引导登录。'],
  ['h2', '1.2 登录方式（二选一，均无需密码）'],
  ['p', '方式一：微信一键登录——点击绿色"微信快捷登录"按钮，自动识别当前微信；已绑定的微信直接登录，未绑定的微信自动创建账号并登录。'],
  ['p', '方式二：短信登录——输入手机号即可登录；未注册的手机号会自动创建账号。'],
  ['p', '登录前需勾选"我已阅读并同意《用户协议》与《隐私协议》"。'],
  ['img', '登录弹窗（微信快捷登录按钮、短信登录按钮、协议勾选框）'],
  ['h2', '1.3 首次登录选择角色'],
  ['p', '新账号首次登录时必须选择角色：'],
  ['p', '· 普通用户：老人或家属，用于发布需求、下单、享受服务；'],
  ['p', '· 互助员：提供互助服务的人，可接单服务、赚取时间币。'],
  ['p', '提示：若在选择角色时直接关闭弹窗，本次登录会取消，下次登录需重新选择。'],
  ['img', '角色二选一界面（普通用户/互助员两张卡片）'],
  ['note', '手机号是平台唯一主账号；一个手机号只绑定一个微信；微信仅作为登录凭证。'],

  ['h1', '第二章 居民端使用教程（老人/家属）'],
  ['h2', '2.1 首页浏览'],
  ['p', '首页包含：轮播图、陪诊服务入口、快捷入口（自主下单、时间银行等）、平台公告。游客可先浏览，执行需要登录的操作时会自动弹出登录窗。'],
  ['img', '首页完整画面'],
  ['h2', '2.2 陪诊服务下单全流程（重点）'],
  ['p', '第1步：进入陪诊。点击首页"陪诊服务"卡片或"立即预约"按钮，进入服务选择页（左侧分类：全程陪诊/专项陪诊；右侧服务列表，价格与保障一目了然，销量为真实订单累计）。'],
  ['img', '陪诊服务选择页（左分类右列表）'],
  ['p', '第2步：查看类型详情。点击任一服务类型，进入详情页：服务图片（全程陪诊 6 类已上线设计图，专项配图陆续补充中）、参考价格（人民币）、健康评估问卷入口、该服务项的真实用户评价、合作医院、服务人员。'],
  ['img', '陪诊类型详情页（含用户评价区）'],
  ['p', '第3步：填写健康评估问卷（建议）。6 道题（行动能力/自理能力/听力/视力/慢病/过敏）+ 特殊需求，提交后自动生成风险分级（低/中/高风险）；结果会随订单提交，帮助互助员提前了解照护需求。'],
  ['img', '健康评估问卷填写页 + 评估结果页（风险分级）'],
  ['p', '第4步：填写下单信息。点"立即下单"进入陪诊专属下单页：'],
  ['p', '· 定位：顶部地图选点（如接送地点），随订单附在需求描述中；'],
  ['p', '· 服务类型：从详情页进入时已锁定；'],
  ['p', '· 就诊医院：城市 + 医院两级选择；'],
  ['p', '· 帮办事项：挂号/取药/缴费/陪同就诊/取报告/其他，可多选；'],
  ['p', '· 谁就诊：本人或家人（家人需填姓名、年龄）；'],
  ['p', '· 就诊时间：日期 + 时段；'],
  ['p', '· 单据照片：最多 3 张；补充说明：选填。'],
  ['img', '陪诊下单页完整表单'],
  ['p', '第5步：提交订单。提交后订单直接进入"待接单"（审核环节目前已暂时跳过），互助员即可接单。'],
  ['h2', '2.3 订单管理'],
  ['p', '订单页共五个页签：待接单 / 服务中 / 待确认 / 已完成 / 已取消。每个订单卡片展示服务类型、时间币、地址、预约时间、需求描述、现场图片等。'],
  ['img', '订单页各页签'],
  ['h2', '2.4 确认完成与评价'],
  ['p', '互助员完成服务后，订单进入"待确认"：点击确认完成，服务正式结束。'],
  ['p', '评价：在"已完成"页签点击"去评价"，直接弹出该订单的评价框（星级 + 标签 + 文字），提交后评价会展示在对应服务类型的"用户评价"区。'],
  ['img', '定向评价弹窗（星级+标签+文字）'],
  ['h2', '2.5 时间银行'],
  ['p', '查看时间币余额、收支流水，使用时间币兑换服务或实物。'],
  ['img', '时间银行页面（余额+流水）'],
  ['h2', '2.6 个人信息与账号安全'],
  ['p', '· 点击"我的"页顶部头像进入个人信息页：更换头像（微信头像）、修改姓名；'],
  ['p', '· 菜单"账号与安全"：查看/修改昵称头像、绑定微信、未绑定手机号时可补绑。'],
  ['img', '个人信息页 + 账号与安全页'],

  ['h1', '第三章 互助员端使用教程'],
  ['h2', '3.1 登录进入互助员端'],
  ['p', '角色为"互助员"的账号登录后，会自动进入互助员端（首页为订单大厅）。'],
  ['img', '互助员端首页（订单大厅）'],
  ['h2', '3.2 订单大厅抢单'],
  ['p', '订单大厅展示所有待接单订单，5 秒自动刷新。点击"立即接单"，确认后订单进入"服务中"。'],
  ['h2', '3.3 服务留痕打卡（重要）'],
  ['p', '服务中的订单必须打卡留痕：'],
  ['p', '· 开工打卡：到达服务地点后，地图选点 + 现场拍照 + 确认到达；'],
  ['p', '· 完工打卡：服务结束时，地图选点 + 现场拍照。'],
  ['p', '注意：完工打卡是"服务完成"的前置条件，未完工打卡无法点服务完成。'],
  ['img', '打卡页（定位+现场照片）'],
  ['h2', '3.4 完成服务与结算'],
  ['p', '完工打卡后点击"服务完成"→ 订单进入"待确认"→ 下单方确认后订单完成，时间币自动结算。'],
  ['img', '互助员订单页（打卡状态+服务完成按钮）'],
  ['h2', '3.5 互助员台账与个人中心'],
  ['p', '时间银行台账查看收益；"我的"页可进入个人信息、账号与安全。'],

  ['p', ''],
  ['p', '—— 教程完 ——'],
]

// ---------- docx XML 生成 ----------
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function para(inner, opts) {
  const { jc, before, after } = opts || {}
  const pPr = []
  if (jc) pPr.push(`<w:jc w:val="${jc}"/>`)
  if (before != null) pPr.push(`<w:spacing w:before="${before}" w:after="${after != null ? after : 0}"/>`)
  else if (after != null) pPr.push(`<w:spacing w:after="${after}"/>`)
  return `<w:p>${pPr.length ? `<w:pPr>${pPr.join('')}</w:pPr>` : ''}${inner}</w:p>`
}

function run(text, opts) {
  const { b, color, sz, italic } = opts || {}
  const rPr = []
  if (b) rPr.push('<w:b/>')
  if (color) rPr.push(`<w:color w:val="${color}"/>`)
  if (sz) rPr.push(`<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`)
  if (italic) rPr.push('<w:i/>')
  return `<w:r>${rPr.length ? `<w:rPr>${rPr.join('')}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`
}

function blockParagraph(type, text) {
  switch (type) {
    case 'title':
      return para(run(text, { b: true, sz: 52 }), { jc: 'center', after: 240 })
    case 'h1':
      return para(run(text, { b: true, sz: 36, color: '2D7D46' }), { before: 360, after: 160 })
    case 'h2':
      return para(run(text, { b: true, sz: 30 }), { before: 240, after: 120 })
    case 'p':
      return para(run(text, { sz: 24 }), { after: 80 })
    case 'note':
      return para(run('【规则说明】' + text, { color: 'B26A00', sz: 24 }), { before: 120, after: 120 })
    case 'img': {
      const inner = run('📷 图片占位｜截图：' + text + '（请在此处粘贴截图，粘贴后删除本行提示文字）', { color: '888888', sz: 22, italic: true })
      const pPr = '<w:pPr><w:pBdr><w:top w:val="dashed" w:sz="6" w:color="AAAAAA"/><w:left w:val="dashed" w:sz="6" w:color="AAAAAA"/><w:bottom w:val="dashed" w:sz="6" w:color="AAAAAA"/><w:right w:val="dashed" w:sz="6" w:color="AAAAAA"/></w:pBdr><w:shd w:val="clear" w:fill="F2F2F2"/><w:spacing w:before="120" w:after="160"/></w:pPr>'
      return `<w:p>${pPr}${inner}</w:p>`
    }
    default:
      return para(run(text, { sz: 24 }), { after: 80 })
  }
}

const bodyXml = CONTENT.map(function (c) { return blockParagraph(c[0], c[1]) }).join('')

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${bodyXml}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
</w:body>
</w:document>`

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`

const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`

// ---------- 打包 ----------
fs.rmSync(TMP, { recursive: true, force: true })
fs.mkdirSync(path.join(TMP, '_rels'), { recursive: true })
fs.mkdirSync(path.join(TMP, 'word', '_rels'), { recursive: true })
fs.writeFileSync(path.join(TMP, '[Content_Types].xml'), contentTypes)
fs.writeFileSync(path.join(TMP, '_rels', '.rels'), rels)
fs.writeFileSync(path.join(TMP, 'word', 'document.xml'), documentXml)
fs.writeFileSync(path.join(TMP, 'word', '_rels', 'document.xml.rels'), docRels)

const zipTmp = path.join(TMP, '..', '.tutorial_tmp.zip')
const zipPath = path.resolve(zipTmp)
execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${path.join(TMP, '*').replace(/\\/g, '/')}' -DestinationPath '${zipPath.replace(/\\/g, '/')}' -Force`])
fs.rmSync(TMP, { recursive: true, force: true })

let finalFile = OUT_FILE
try {
  fs.unlinkSync(OUT_FILE)
} catch (e) { /* 文件被占用或不存在 */ }
try {
  execFileSync('powershell', ['-NoProfile', '-Command', `Move-Item -Path '${zipPath.replace(/\\/g, '/')}' -Destination '${OUT_FILE.replace(/\\/g, '/')}' -Force`])
} catch (e) {
  finalFile = path.join(OUT_DIR, '小程序使用教程_新版.docx')
  execFileSync('powershell', ['-NoProfile', '-Command', `Move-Item -Path '${zipPath.replace(/\\/g, '/')}' -Destination '${finalFile.replace(/\\/g, '/')}' -Force`])
}

console.log('已生成：' + finalFile)
console.log('图片占位段落共 ' + CONTENT.filter(function (c) { return c[0] === 'img' }).length + ' 处，截图后粘贴替换即可。')
