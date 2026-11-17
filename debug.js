const Database = require('better-sqlite3');
const db = new Database('shipments.db');

console.log('=== 所有数据 ===');
db.prepare('SELECT id, date, seq, address, qty_big, qty_small, target_big, target_small FROM shipments ORDER BY date DESC, seq').all()
  .forEach(r => console.log(`  id=${r.id} ${r.date} seq=${r.seq} | ${r.address?.slice(0,20)}... | 已发大${r.qty_big} 小${r.qty_small} | 目标大${r.target_big} 小${r.target_small}`));
