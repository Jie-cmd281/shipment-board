const DB = require('better-sqlite3');
const db = new DB('shipments.db');
const t = db.prepare("SELECT sql FROM sqlite_master WHERE type='table'").get();
console.log('=== CREATE TABLE ===');
console.log(t.sql);
console.log('\n=== COLUMNS ===');
db.prepare('PRAGMA table_info(shipments)').all().forEach(c => {
  console.log(`${c.name} ${c.type} notnull=${c.notnull} dflt=${c.dflt_value}`);
});
console.log('\n=== SAMPLE ROWS ===');
db.prepare('SELECT * FROM shipments LIMIT 3').all().forEach(r => console.log(r));
