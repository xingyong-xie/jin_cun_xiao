const bcrypt = require('bcryptjs');
const { getDb, saveDb, rowToObject, IS_POSTGRES } = require('./database');

// SQLite 建表语句
const SQLITE_TABLES = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator',
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  )`,
  `CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    category TEXT DEFAULT '',
    unit TEXT DEFAULT '个',
    purchase_price REAL DEFAULT 0,
    sale_price REAL DEFAULT 0,
    stock_quantity INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  )`,
  `CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  )`,
  `CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  )`,
  `CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT UNIQUE NOT NULL,
    supplier_id INTEGER NOT NULL,
    total_amount REAL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    operator_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (operator_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    amount REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES purchase_orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  )`,
  `CREATE TABLE IF NOT EXISTS sales_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL,
    total_amount REAL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    order_type TEXT DEFAULT 'in_stock',
    operator_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (operator_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS sales_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    amount REAL NOT NULL,
    delivery_type TEXT DEFAULT 'in_stock',
    FOREIGN KEY (order_id) REFERENCES sales_orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  )`,
  `CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    order_id INTEGER,
    operator_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (operator_id) REFERENCES users(id)
  )`
];

// PostgreSQL 建表语句
const PG_TABLES = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    category TEXT DEFAULT '',
    unit TEXT DEFAULT '个',
    purchase_price DOUBLE PRECISION DEFAULT 0,
    sale_price DOUBLE PRECISION DEFAULT 0,
    stock_quantity INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    contact TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    contact TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS purchase_orders (
    id SERIAL PRIMARY KEY,
    order_no TEXT UNIQUE NOT NULL,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
    total_amount DOUBLE PRECISION DEFAULT 0,
    status TEXT DEFAULT 'pending',
    operator_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS purchase_order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES purchase_orders(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DOUBLE PRECISION NOT NULL,
    amount DOUBLE PRECISION NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sales_orders (
    id SERIAL PRIMARY KEY,
    order_no TEXT UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    total_amount DOUBLE PRECISION DEFAULT 0,
    status TEXT DEFAULT 'pending',
    order_type TEXT DEFAULT 'in_stock',
    operator_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS sales_order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES sales_orders(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DOUBLE PRECISION NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    delivery_type TEXT DEFAULT 'in_stock'
  )`,
  `CREATE TABLE IF NOT EXISTS stock_movements (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    order_id INTEGER,
    operator_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`
];

async function migrateSalesOrderItemsDeliveryType(db) {
  if (IS_POSTGRES) {
    const result = await db.execute(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'sales_order_items' AND column_name = 'delivery_type'`
    );
    const exists = result && result[0] && result[0].values && result[0].values.length > 0;
    if (!exists) {
      await db.run(`ALTER TABLE sales_order_items ADD COLUMN delivery_type TEXT DEFAULT 'in_stock'`);
    }
  } else {
    const result = await db.execute(`PRAGMA table_info(sales_order_items)`);
    const cols = (result && result[0] && result[0].values) ? result[0].values.map(r => r[1]) : [];
    if (!cols.includes('delivery_type')) {
      await db.run(`ALTER TABLE sales_order_items ADD COLUMN delivery_type TEXT DEFAULT 'in_stock'`);
    }
  }
}

async function migrateSalesOrdersOrderType(db) {
  let needBackfill = false;
  if (IS_POSTGRES) {
    const result = await db.execute(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'sales_orders' AND column_name = 'order_type'`
    );
    const exists = result && result[0] && result[0].values && result[0].values.length > 0;
    if (!exists) {
      await db.run(`ALTER TABLE sales_orders ADD COLUMN order_type TEXT DEFAULT 'in_stock'`);
      needBackfill = true;
    }
  } else {
    const result = await db.execute(`PRAGMA table_info(sales_orders)`);
    const cols = (result && result[0] && result[0].values) ? result[0].values.map(r => r[1]) : [];
    if (!cols.includes('order_type')) {
      await db.run(`ALTER TABLE sales_orders ADD COLUMN order_type TEXT DEFAULT 'in_stock'`);
      needBackfill = true;
    }
  }

  if (needBackfill) {
    // 全部明细都是 pre_order 的订单 → 标记为订货单；其余保持 in_stock
    await db.run(`
      UPDATE sales_orders SET order_type = 'pre_order'
      WHERE id IN (
        SELECT order_id FROM sales_order_items
        GROUP BY order_id
        HAVING MIN(delivery_type) = 'pre_order' AND MAX(delivery_type) = 'pre_order'
      )
    `);
  }
}

async function initDatabase() {
  const db = await getDb();
  const tables = IS_POSTGRES ? PG_TABLES : SQLITE_TABLES;

  for (const sql of tables) {
    await db.run(sql);
  }

  await migrateSalesOrderItemsDeliveryType(db);
  await migrateSalesOrdersOrderType(db);

  // Create default admin user
  const result = await db.execute("SELECT id FROM users WHERE username = 'admin'");
  const user = rowToObject(result);
  if (!user) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    await db.run(
      "INSERT INTO users (username, password, role) VALUES ('admin', ?, 'admin')",
      [hashedPassword]
    );
  }

  saveDb();
  console.log('Database initialized successfully');
}

module.exports = { initDatabase };
