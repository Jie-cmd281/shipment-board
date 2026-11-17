// 发货统计实时看板 - 支持 SQLite（本地）+ Postgres（云部署）
const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// ============ 数据库适配层 ============
let db;  // 统一接口: async query(sql, params?) => { rows, rowCount, rows: [{...}] }
let DB_TYPE = 'sqlite';

async function initDB() {
  if (process.env.DATABASE_URL) {
    // ====== Postgres (云) ======
    DB_TYPE = 'postgres';
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { require: true, rejectUnauthorized: false } });
    // 测试连接
    await pool.query('SELECT 1');
    console.log('[DB] ✅ PostgreSQL connected');
    db = {
      query: async (sql, params) => {
        // 把 SQLite 的 ? 占位符转 Postgres 的 $1, $2...
        let pgSql = sql;
        let i = 0;
        pgSql = sql.replace(/\?/g, () => `$${++i}`);
        // 把 NOW() 换成 CURRENT_TIMESTAMP (pg 都支持, 保险起见)
        const res = await pool.query(pgSql, params || []);
        return res;
      }
    };
  } else {
    // ====== SQLite (本地) ======
    DB_TYPE = 'sqlite';
    const Database = require('better-sqlite3');
    const dbPath = path.join(__dirname, 'shipments.db');
    const sqlite = new Database(dbPath);
    console.log('[DB] ✅ SQLite opened at', dbPath);
    db = {
      query: async (sql, params) => {
        // 转换常见 PG 语法到 SQLite
        let s = sql;
        // CURRENT_TIMESTAMP 两者都支持, 不动
        try {
          if (s.trim().toUpperCase().startsWith('SELECT')) {
            return { rows: sqlite.prepare(s).all(...(params || [])), rowCount: 0 };
          } else if (s.trim().toUpperCase().startsWith('INSERT')) {
            const info = sqlite.prepare(s).run(...(params || []));
            return { rows: [], rowCount: info.changes, insertId: info.lastInsertRowid };
          } else if (s.trim().toUpperCase().startsWith('UPDATE')) {
            const info = sqlite.prepare(s).run(...(params || []));
            return { rows: [], rowCount: info.changes };
          } else if (s.trim().toUpperCase().startsWith('DELETE')) {
            const info = sqlite.prepare(s).run(...(params || []));
            return { rows: [], rowCount: info.changes };
          } else if (s.trim().toUpperCase().startsWith('CREATE') || s.trim().toUpperCase().startsWith('ALTER')) {
            sqlite.exec(s);
            return { rows: [], rowCount: 0 };
          } else if (s.trim().toUpperCase().startsWith('PRAGMA')) {
            return { rows: sqlite.prepare(s).all(), rowCount: 0 };
          }
        } catch(e) {
          console.error('[SQL Error]', sql, params, e.message);
          throw e;
        }
      }
    };
  }

  // ====== 建表 ======
  const createTableSQL = DB_TYPE === 'postgres'
    ? `CREATE TABLE IF NOT EXISTS shipments (
         id SERIAL PRIMARY KEY,
         date TEXT NOT NULL,
         seq INTEGER,
         sender TEXT,
         contact_name TEXT,
         contact_phone TEXT,
         address TEXT NOT NULL,
         qty_big INTEGER DEFAULT 0,
         qty_small INTEGER DEFAULT 0,
         tracking_no TEXT,
         stock TEXT,
         spec TEXT,
         note TEXT,
         target_big INTEGER DEFAULT 0,
         target_small INTEGER DEFAULT 0,
         order_total INTEGER,
         order_no TEXT,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       );`
    : `CREATE TABLE IF NOT EXISTS shipments (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         date TEXT NOT NULL,
         seq INTEGER,
         sender TEXT,
         contact_name TEXT,
         contact_phone TEXT,
         address TEXT NOT NULL,
         qty_big INTEGER DEFAULT 0,
         qty_small INTEGER DEFAULT 0,
         tracking_no TEXT,
         stock TEXT,
         spec TEXT,
         note TEXT,
         target_big INTEGER DEFAULT 0,
         target_small INTEGER DEFAULT 0,
         order_total INTEGER,
         order_no TEXT,
         created_at TEXT DEFAULT (datetime('now','localtime')),
         updated_at TEXT DEFAULT (datetime('now','localtime'))
       );`;
  await db.query(createTableSQL);
  console.log('[DB] ✅ table ready');
}

// ============ 中间件 ============
app.get('/', (req, res) => {
  const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  const injected = html.replace('</head>', `<script>window.__BUILD_TS = ${Date.now()};</script></head>`);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('ETag', '"never-cache-' + Date.now() + '"');
  res.send(injected);
});
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0 }));
app.use(express.json());

// ============ 工具函数 ============
function rowToObj(r) {
  if (!r) return null;
  return { id: r.id, date: r.date, seq: r.seq ?? '',
    sender: r.sender || '', contact_name: r.contact_name || '',
    contact_phone: r.contact_phone || '',
    address: r.address || '',
    qty_big: r.qty_big || 0, qty_small: r.qty_small || 0,
    target_big: r.target_big || 0, target_small: r.target_small || 0,
    order_no: r.order_no || '',
    tracking_no: r.tracking_no || '', stock: r.stock || '',
    spec: r.spec || '', note: r.note || '',
    created_at: r.created_at };
}

// ============ API ============
app.get('/api/shipments', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM shipments ORDER BY date DESC, id DESC');
  res.json(rows.map(rowToObj));
});

app.post('/api/shipments', async (req, res) => {
  const b = req.body;
  let seq = b.seq ?? null;
  if (seq == null) {
    const { rows } = await db.query('SELECT MAX(seq) AS m FROM shipments WHERE date=?', [b.date]);
    seq = (rows[0].m || 0) + 1;
  }
  const params = [
    b.date, seq,
    b.sender || null, b.contact_name || null, b.contact_phone || null,
    b.address,
    b.qty_big || 0, b.qty_small || 0,
    b.target_big || 0, b.target_small || 0,
    b.order_no || null,
    b.tracking_no || null, b.stock || null, b.spec || null, b.note || null
  ];
  let newId;
  if (DB_TYPE === 'postgres') {
    const { rows } = await db.query(
      `INSERT INTO shipments (date,seq,sender,contact_name,contact_phone,address,
       qty_big,qty_small,target_big,target_small,order_no,tracking_no,stock,spec,note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`, params);
    newId = rows[0].id;
  } else {
    const res2 = await db.query(
      `INSERT INTO shipments (date,seq,sender,contact_name,contact_phone,address,
       qty_big,qty_small,target_big,target_small,order_no,tracking_no,stock,spec,note)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, params);
    newId = res2.insertId;
  }
  const { rows } = await db.query('SELECT * FROM shipments WHERE id=?', [newId]);
  const row = rowToObj(rows[0]);
  io.emit('shipment:create', row);
  res.json(row);
});

app.put('/api/shipments/:id', async (req, res) => {
  const b = req.body;
  await db.query(`UPDATE shipments SET
    date=?, seq=?, sender=?, contact_name=?, contact_phone=?, address=?,
    qty_big=?, qty_small=?, target_big=?, target_small=?, order_no=?,
    tracking_no=?, stock=?, spec=?, note=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?`, [
    b.date, b.seq || null, b.sender || null, b.contact_name || null,
    b.contact_phone || null, b.address,
    b.qty_big || 0, b.qty_small || 0,
    b.target_big || 0, b.target_small || 0,
    b.order_no || null,
    b.tracking_no || null, b.stock || null, b.spec || null, b.note || null,
    Number(req.params.id)
  ]);
  const { rows } = await db.query('SELECT * FROM shipments WHERE id=?', [Number(req.params.id)]);
  const row = rowToObj(rows[0]);
  io.emit('shipment:update', row);
  res.json(row);
});

app.delete('/api/shipments/:id', async (req, res) => {
  const id = Number(req.params.id);
  await db.query('DELETE FROM shipments WHERE id=?', [id]);
  io.emit('shipment:delete', id);
  res.json({ ok: true });
});

// ============ 导出 CSV ============
app.get('/api/export.csv', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM shipments ORDER BY date DESC, seq ASC');
  const headers = ['日期','序号','发货人','联系人','联系电话','收货地址','大件','小件','合计','物流单号','存货','规格','备注'];
  const escape = v => {
    if (v == null) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const lines = [headers.join(',')];
  for (const r of rows) {
    const big = r.qty_big || 0, small = r.qty_small || 0;
    lines.push([
      r.date, r.seq ?? '',
      r.sender || '', r.contact_name || '', r.contact_phone || '',
      r.address || '',
      big, small, big + small,
      r.tracking_no || '', r.stock || '', r.spec || '', r.note || ''
    ].map(escape).join(','));
  }
  const csv = '\uFEFF' + lines.join('\r\n');
  const fname = '发货统计_' + new Date().toISOString().slice(0,10) + '.csv';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="' + encodeURIComponent(fname) + '"');
  res.send(csv);
});

io.on('connection', (socket) => {
  console.log(`[socket] ${socket.id} connected, total=${io.engine.clientsCount}`);
});

// ============ 启动 ============
const PORT = process.env.PORT || 3000;
initDB().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log('====================================================');
    console.log(`  发货统计看板 → http://localhost:${PORT}`);
    console.log(`  数据库类型 → ${DB_TYPE.toUpperCase()}`);
    console.log('====================================================');
  });
}).catch(err => {
  console.error('[FATAL] DB init failed:', err.message);
  process.exit(1);
});
