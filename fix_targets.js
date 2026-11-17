// 把旧数据的 target_big/target_small 设为跟 qty_big/qty_small 一样
const Database = require('better-sqlite3');
const db = new Database('shipments.db');

const rows = db.prepare('SELECT id, qty_big, qty_small, target_big, target_small FROM shipments').all();
const upd = db.prepare('UPDATE shipments SET target_big=?, target_small=? WHERE id=?');

for (const r of rows) {
  // 如果 target 为 0 或空，就用 qty 代替（旧数据里 qty 就是目标）
  if (!r.target_big && !r.target_small) {
    upd.run(r.qty_big, r.qty_small, r.id);
    console.log(`id=${r.id}: target 设为 大${r.qty_big} 小${r.qty_small}`);
  }
}

console.log('\n验证:');
db.prepare('SELECT seq, qty_big, qty_small, target_big, target_small FROM shipments ORDER BY seq').all()
  .forEach(r => console.log(`  seq=${r.seq} | 已发大${r.qty_big} 小${r.qty_small} | 目标大${r.target_big} 小${r.target_small}`));
