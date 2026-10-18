/**
 * 替换订单演示图片脚本
 * 用法：后端启动后执行  node scripts/replace-order-images.js
 *
 * 功能：把数据库中所有带图片信息的订单（is_deleted=0 且 images 非空），
 * 图片随机替换为 imagescs 提供的测试图片（compressed_cs_1..8.jpg，位于 uploads 目录）。
 * 可重复执行；图片文件名以相对形式存储，后端输出时自动补全完整访问地址。
 */
/* eslint-disable */
const { execFileSync } = require('child_process');

const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe';
const POOL = [
  'compressed_cs_1.jpg',
  'compressed_cs_2.jpg',
  'compressed_cs_3.jpg',
  'compressed_cs_4.jpg',
  'compressed_cs_5.jpg',
  'compressed_cs_6.jpg',
  'compressed_cs_7.jpg',
  'compressed_cs_8.jpg'
];

function runSql(sql) {
  execFileSync(
    MYSQL,
    ['-uroot', '-p123456', '--default-character-set=utf8mb4', 'elderly_care'],
    { input: sql, stdio: ['pipe', 'ignore', 'pipe'] }
  );
}

function query(sql) {
  const out = execFileSync(
    MYSQL,
    ['-uroot', '-p123456', '--default-character-set=utf8mb4', '-N', '-B', 'elderly_care'],
    { input: sql, stdio: ['pipe', 'pipe', 'pipe'] }
  ).toString();
  return out.trim().split('\n').filter(Boolean).map(function (line) { return line.split('\t'); });
}

// 随机取 1-3 张不重复图片
function pickImages() {
  const shuffled = POOL.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = t;
  }
  return shuffled.slice(0, 1 + Math.floor(Math.random() * 3));
}

function main() {
  const rows = query("SELECT id, images FROM orders WHERE is_deleted = 0 AND images IS NOT NULL AND images != '' AND images != '[]'");
  console.log('带图片信息的订单数：' + rows.length);

  let replaced = 0;
  for (const row of rows) {
    const id = row[0];
    const picks = pickImages();
    const json = JSON.stringify(picks).replace(/'/g, "''");
    runSql(`UPDATE orders SET images = '${json}' WHERE id = '${id}';`);
    replaced++;
    console.log(`  ${id} → ${picks.join('、')}`);
  }
  console.log('\n========== 替换完成 ==========');
  console.log('共替换 ' + replaced + ' 笔订单的图片（随机 1-3 张/单）');
}

main();
