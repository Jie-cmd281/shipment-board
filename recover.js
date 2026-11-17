const Database = require('better-sqlite3');
const db = new Database('shipments.db');

console.log('=== 当前数据 ===');
console.log(db.prepare('SELECT COUNT(*) as c FROM shipments').get());

console.log('\n=== Schema ===');
console.log(db.prepare("SELECT sql FROM sqlite_master WHERE name='shipments'").get());

console.log('\n=== 尝试 sqlite_dbpage 恢复 ===');
// SQLite 3.32+ 支持 sqlite_dbpage 虚拟表直接读磁盘页
try {
  const hasModule = db.prepare("SELECT name FROM sqlite_master WHERE name='sqlite_dbpage'").get();
  console.log('sqlite_dbpage module:', hasModule);
} catch(e) { console.log('no dbpage:', e.message); }

// 直接尝试用十六进制 dump 找残留字符串
const fs = require('fs');
const buf = fs.readFileSync('shipments.db');
const text = buf.toString('utf8');

// 找日期模式
const dateRe = /\d{4}-\d{2}-\d{2}/g;
const dates = [...new Set(text.match(dateRe) || [])];
console.log('\n文件中残留的日期:', dates);

// 找中文地址片段
const zhRe = /[\u4e00-\u9fa5]{2,20}/g;
const zhChunks = [...new Set((text.match(zhRe) || []).filter(s => s.length >= 4))];
console.log('\n残留中文片段:', zhChunks.slice(0, 30));
