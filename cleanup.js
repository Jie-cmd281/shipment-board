const Database = require('better-sqlite3');
const db = new Database('shipments.db');

// 删掉测试数据（seq > 7 的）
db.prepare('DELETE FROM shipments WHERE seq > 7').run();
console.log('清理后:', db.prepare('SELECT COUNT(*) FROM shipments').get());
db.prepare('SELECT seq, qty_big, qty_small, target_big, target_small FROM shipments ORDER BY seq').all()
  .forEach(r => console.log(`  seq=${r.seq} | 大${r.qty_big} 小${r.qty_small} | 目标大${r.target_big} 小${r.target_small}`));
