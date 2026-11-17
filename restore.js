const Database = require('better-sqlite3');
const db = new Database('shipments.db');

const insert = db.prepare(`INSERT INTO shipments 
  (date, seq, sender, contact_name, contact_phone, destination, address, size, qty, qty_big, qty_small)
  VALUES (?,?,?,?,?,?,?,?,?,?,?)`);

// 先清空确保干净
db.prepare('DELETE FROM shipments').run();

// 从 hex dump 恢复的 7 条记录（2026-11-16 当天）
// 发货人: 靳侠 15978575665, 联系人: 汪熙皓/孙闯 17603712903
const records = [
  // 序号1
  { date:'2026-11-16', seq:1, sender:'靳侠15978575665', contact_name:'汪熙皓', contact_phone:'17603712903',
    address:'四川省甘孜州泸定县安乐坝瑞金路 叮咚闪购超市', qty_big:200, qty_small:0 },
  // 序号2 - 这条地址有 2 笔（先 big 150 后 small 50）
  { date:'2026-11-16', seq:2, sender:'靳侠15978575665', contact_name:'孙闯', contact_phone:'17603712903',
    address:'河南省许昌市建安区许繁路3935号', qty_big:150, qty_small:50 },
  // 序号3
  { date:'2026-11-16', seq:3, sender:'靳侠15978575665', contact_name:'汪熙皓', contact_phone:'17603712903',
    address:'浙江省台州市玉环市黄泥坎工业区亿工场电商园一楼宏诚酒业仓库', qty_big:200, qty_small:0 },
  // 序号4
  { date:'2026-11-16', seq:4, sender:'靳侠15978575665', contact_name:'汪熙皓', contact_phone:'17603712903',
    address:'山东省青岛市城阳区中城路562号对面', qty_big:200, qty_small:0 },
  // 序号5
  { date:'2026-11-16', seq:5, sender:'靳侠15978575665', contact_name:'汪熙皓', contact_phone:'17603712903',
    address:'浙江省浦江县金垒大道215号．浦江挚恋食品有限公司', qty_big:200, qty_small:0 },
  // 序号6
  { date:'2026-11-16', seq:6, sender:'靳侠15978575665', contact_name:'孙闯', contact_phone:'17603712903',
    address:'河南省信阳市商城县赤城街道金刚台大道三和阳光城附近三和阳光城西区', qty_big:200, qty_small:0 },
  // 序号7
  { date:'2026-11-16', seq:7, sender:'靳侠15978575665', contact_name:'李立锋', contact_phone:'17603712903',
    address:'河南省信阳市罗山县S219广东全馨家居', qty_big:50, qty_small:0 },
];

const tx = db.transaction(() => {
  for (const r of records) {
    const size = r.qty_big >= r.qty_small ? 'big' : 'small';
    const qty = r.qty_big + r.qty_small;
    insert.run(r.date, r.seq, r.sender, r.contact_name, r.contact_phone,
      r.address, r.address, size, qty, r.qty_big, r.qty_small);
  }
});
tx();

console.log('恢复完成！');
console.log('共恢复:', db.prepare('SELECT COUNT(*) as c FROM shipments').get().c, '条');
console.log('\n数据预览:');
const rows = db.prepare('SELECT seq, qty_big, qty_small, address FROM shipments ORDER BY seq').all();
rows.forEach(r => console.log(`  seq=${r.seq} | 大${r.qty_big} 小${r.qty_small} | ${r.address.slice(0, 35)}...`));
