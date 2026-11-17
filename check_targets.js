const Database = require('better-sqlite3');
const db = new Database('shipments.db');
console.log('=== 全部数据字段详情 ===');
db.prepare('SELECT seq, qty_big, qty_small, target_big, target_small, order_no FROM shipments ORDER BY seq').all()
  .forEach(r => {
    const hasTarget = r.target_big > 0 || r.target_small > 0;
    console.log(`  seq=${r.seq} | qty大${r.qty_big} 小${r.qty_small} | target大${r.target_big} 小${r.target_small} | order_no=[${r.order_no || ''}] | ${hasTarget ? '✅有目标' : '❌没目标'}`);
  });
