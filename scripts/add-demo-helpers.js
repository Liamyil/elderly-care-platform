/**
 * 补充演示互助员账号（与 reset-demo-data.js 的密码哈希方式一致）
 * 用法：node scripts/add-demo-helpers.js
 */
/* eslint-disable */
const { execFileSync } = require('child_process');
const crypto = require('crypto');

const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe';

function scryptHash(password) {
  const saltHex = crypto.randomBytes(16).toString('hex');
  const dk = crypto.scryptSync(password, saltHex, 32, { N: 16384, r: 8, p: 1 }).toString('hex');
  return `s2$${saltHex}$${dk}`;
}

const HELPERS = [
  { phone: '13800138006', name: '王秀兰', coins: 260, serviceCount: 12 },
  { phone: '13800138007', name: '张建国', coins: 80, serviceCount: 2 }
];

function runSql(sql) {
  execFileSync(MYSQL, ['-uroot', '-p123456', '--default-character-set=utf8mb4', 'elderly_care'], {
    input: sql,
    stdio: ['pipe', 'ignore', 'pipe']
  });
}

const values = HELPERS.map((h) => {
  const pwd = scryptHash(h.phone + 'hhL.');
  return `('${h.phone}', '${pwd}', '${h.name}', '互助员', ${h.coins}, ${h.serviceCount})`;
}).join(',\n  ');

runSql(`INSERT INTO users (phone, password, name, role, time_coins, service_count) VALUES\n  ${values};`);
console.log('已添加 2 个演示互助员：王秀兰（完成12单）、张建国（完成2单）');
