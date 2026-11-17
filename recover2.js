// 从 SQLite 空闲页里扫回被 DELETE 的数据
const fs = require('fs');
const buf = fs.readFileSync('shipments.db');
const text = buf.toString('utf8');

// 扫出所有有意义的中文数据块
// 先找所有 "big" 和 "small" 出现的位置（这是 size 字段）
const results = [];
let idx = 0;

// 方法：按日期 + 发货人 + 电话号码 + 地址块来切分
const senderRe = /[\u4e00-\u9fa5]{2,4}1[3-9]\d{9}/g;  // 名字+手机号
let m;
while ((m = senderRe.exec(text)) !== null) {
  const senderChunk = m.index;
  // 向前找最近的日期
  const before = text.slice(Math.max(0, senderChunk - 500), senderChunk);
  const dateMatch = before.match(/\d{4}-\d{2}-\d{2}/g);
  const date = dateMatch ? dateMatch[dateMatch.length - 1] : null;

  // 向后找电话号码（联系人电话）
  const after = text.slice(senderChunk, senderChunk + 500);
  const phones = [...after.matchAll(/1[3-9]\d{9}/g)].map(x => x[0]);
  const senderPhone = m[0].slice(-11);
  const contactPhone = phones.find(p => p !== senderPhone) || '';
  const senderName = m[0].slice(0, -11);

  // 找地址：从电话之后的中文块，遇到 big/small 之前
  const contactIdx = after.indexOf(contactPhone);
  let addrPart = contactIdx >= 0 ? after.slice(contactIdx + contactPhone.length) : after.slice(after.indexOf(senderPhone) + 11);
  // 找到 big 或 small
  const sizeMatch = addrPart.match(/(big|small)/);
  const size = sizeMatch ? sizeMatch[1] : null;
  if (sizeMatch) addrPart = addrPart.slice(0, sizeMatch.index);
  // 提取连续中文地址
  const addrMatch = addrPart.match(/[\u4e00-\u9fa5][\u4e00-\u9fa50-9a-zA-Z\-·\s]{10,50}/);
  const address = addrMatch ? addrMatch[0].trim() : '';

  // 数量：从 size 之前找整数
  // 在 hex dump 里看到 `c8` = 200, `96` = 150, `32` = 50
  // 实际上 qty 是 INTEGER，跟在 text 字段之后
  // 我们用另一个方法：找 "创建时间" 字段的时间戳之前

  results.push({
    date, senderName, senderPhone, contactPhone, address, size,
    pos: m.index
  });
}

// 去重（同位置的只留一个）
const seen = new Set();
const unique = results.filter(r => {
  const key = r.senderPhone + r.contactPhone + r.address.slice(0, 10);
  if (seen.has(key) || !r.address) return false;
  seen.add(key);
  return true;
});

console.log('=== 从文件恢复的记录 ===');
unique.forEach((r, i) => {
  console.log(`${i+1}. ${r.date} | ${r.senderName} ${r.senderPhone} | 电话:${r.contactPhone} | ${r.address.slice(0, 40)}... | ${r.size}`);
});

// 现在尝试用另一种方法找数量
// 在 "big" 或 "small" 之前通常有一个整数 qty
console.log('\n=== 尝试恢复数量 ===');
for (const r of unique) {
  // 从 r.pos 向回找，看 hex 里的整数
  const chunk = buf.slice(Math.max(0, r.pos - 100), Math.min(buf.length, r.pos + 50));
  // 打印附近的小整数
  console.log(`\n${r.address.slice(0,20)}... 附近的整数:`);
  for (let i = 0; i < chunk.length - 4; i++) {
    // SQLite varint 编码：如果 0x81 后跟一个字节，那是 1-127
    if (chunk[i] === 0x81) {
      const val = chunk[i+1];
      if (val >= 1 && val <= 500) console.log(`  @${i}: varint=${val}`);
    }
    // 如果是直接的小整数（< 0x80 就是直接值）
    if (chunk[i] >= 0x01 && chunk[i] <= 0x7f) {
      const val = chunk[i];
      if ([50, 100, 150, 200].includes(val)) console.log(`  @${i}: direct=${val}`);
    }
  }
}
