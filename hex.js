const fs = require('fs');
const buf = fs.readFileSync('shipments.db');
const text = buf.toString('utf8');

// SQLite 把整数存成 varint，但文本字段还是完整 UTF-8
// 让我找所有可能的行结构：日期 + 地址 + 数字字段

// 方法：找所有 "日期" 出现的位置，然后向前后扫描
const dateRe = /2026-11-16/g;
let m;
const positions = [];
while ((m = dateRe.exec(text)) !== null) {
  positions.push(m.index);
}
console.log('找到日期位置:', positions.length);

// SQLite 每行一个 record：header + body
// 直接打印每个日期附近 300 字节的 hex 看看
for (const pos of positions.slice(0, 5)) {
  const chunk = buf.slice(Math.max(0, pos - 50), Math.min(buf.length, pos + 400));
  console.log(`\n=== 偏移 ${pos} (前后50到+400字节) ===`);
  // 打印 hex + ASCII
  for (let i = 0; i < chunk.length; i += 16) {
    const hex = chunk.slice(i, i + 16).toString('hex').match(/.{1,2}/g).join(' ');
    const ascii = chunk.slice(i, i + 16).toString('utf8').replace(/[\x00-\x1f]/g, '.');
    console.log(`  ${(pos - 50 + i).toString().padStart(6)}  ${hex.padEnd(48)}  ${ascii}`);
  }
}
