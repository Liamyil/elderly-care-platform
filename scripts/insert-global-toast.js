// 一次性工具：把 <global-toast id="globalToast" /> 批量挂到 app.json 注册的所有页面 WXML 末尾。
// 安全设计：只读 app.json 的 pages 列表 → 逐文件处理（幂等，可重复运行）→
//  1. 已含 global-toast 但缺 id → 标准化补 id（供 app.js selectComponent('#globalToast') 选择）；
//  2. 未含 → 文件末尾追加一个顶层节点（WXML 支持多根节点，组件为 position:fixed 不受位置影响）；
//  3. 处理后回读校验，任何一步失败即抛错，不改坏其他代码。
// 用法：node scripts/insert-global-toast.js
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const TAG = '<global-toast id="globalToast" />'

const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'))
const pages = appJson.pages || []

const inserted = []
const normalized = []
const skipped = []
const missing = []

for (const page of pages) {
  const wxmlPath = path.join(ROOT, page + '.wxml')
  if (!fs.existsSync(wxmlPath)) {
    missing.push(page)
    continue
  }
  const content = fs.readFileSync(wxmlPath, 'utf8')

  if (!content.includes('<global-toast')) {
    // 末尾追加（原内容一个字节不动）
    fs.writeFileSync(wxmlPath, content.replace(/\s*$/, '\n\n' + TAG + '\n'), 'utf8')
    inserted.push(page)
  } else if (!content.includes('id="globalToast"')) {
    // 已插入但缺 id：把裸标签标准化为带 id 标签
    const next = content.replace(/<global-toast\s*\/>/g, TAG)
    fs.writeFileSync(wxmlPath, next, 'utf8')
    normalized.push(page)
  } else {
    skipped.push(page)
  }

  // 回读校验
  const verify = fs.readFileSync(wxmlPath, 'utf8')
  if (!verify.includes(TAG)) {
    throw new Error('回读校验失败：' + page)
  }
}

console.log('=== global-toast 批量挂载结果 ===')
console.log('本次插入 (' + inserted.length + '):\n  ' + (inserted.join('\n  ') || '（无）'))
console.log('\n补 id 标准化 (' + normalized.length + '):\n  ' + (normalized.join('\n  ') || '（无）'))
console.log('\n已就绪跳过 (' + skipped.length + '):\n  ' + (skipped.join('\n  ') || '（无）'))
console.log('\n缺少 wxml 文件 (' + missing.length + '):\n  ' + (missing.join('\n  ') || '（无）'))
if (missing.length > 0) process.exitCode = 2
