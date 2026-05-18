const path = require('path');
const fs = require('fs');

const IS_POSTGRES = !!process.env.DATABASE_URL;

let db = null;
let pgPool = null;

// 共享工具函数：将查询结果转换为对象数组
function rowsToObjects(result) {
  if (!result || result.length === 0) return [];
  if (!result[0].values || result[0].values.length === 0) return [];
  return result[0].values.map(row => {
    const obj = {};
    result[0].columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

// 共享工具函数：将查询结果转换为单个对象
function rowToObject(result) {
  if (!result || result.length === 0 || !result[0].values || result[0].values.length === 0) return null;
  const obj = {};
  result[0].columns.forEach((col, i) => { obj[col] = result[0].values[0][i]; });
  return obj;
}

// 提取单个标量值（如 COUNT/SUM 结果）
function extractScalar(result, defaultValue = 0) {
  if (!result || result.length === 0 || !result[0].values || result[0].values.length === 0) {
    return defaultValue;
  }
  const val = result[0].values[0][0];
  return val !== null && val !== undefined ? val : defaultValue;
}

// PostgreSQL: 将 ? 占位符转换为 $1, $2, $3...
function convertPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

// PostgreSQL: 将 LIKE 转换为 ILIKE（大小写不敏感，匹配 SQLite 行为）
function convertLike(sql) {
  return sql.replace(/\bLIKE\b/g, 'ILIKE');
}

// PostgreSQL: 转换 SQL 语句
function convertSql(sql) {
  let converted = convertPlaceholders(sql);
  converted = convertLike(converted);
  return converted;
}

async function getDb() {
  // 云环境：PostgreSQL
  if (IS_POSTGRES) {
    if (!pgPool) {
      const { Pool } = require('pg');
      pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
      });
    }

    // 返回与 sql.js 兼容的接口
    return {
      async execute(sql, params = []) {
        const converted = convertSql(sql);
        const result = await pgPool.query(converted, params);
        // 转换为 sql.js 格式：[{ columns, values }]
        const columns = result.fields ? result.fields.map(f => f.name) : [];
        if (!result.rows || result.rows.length === 0) {
          return [{ columns, values: [] }];
        }
        const values = result.rows.map(row =>
          columns.map(col => row[col])
        );
        return [{ columns, values }];
      },

      async run(sql, params = []) {
        let converted = convertSql(sql);
        // INSERT 语句自动追加 RETURNING id
        if (/^\s*INSERT\s/i.test(converted)) {
          converted += ' RETURNING id';
        }
        const result = await pgPool.query(converted, params);
        const lastInsertRowid = result.rows && result.rows.length > 0 ? result.rows[0].id : null;
        return { lastInsertRowid };
      }
    };
  }

  // 本地开发：sql.js
  if (db) return db;

  const initSqlJs = require('sql.js');
  const DB_PATH = path.join(__dirname, '..', 'data', 'jin_xiao_cun.db');

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // 为 sql.js 添加异步包装方法，兼容 await 调用
  db.execute = async function(sql, params = []) {
    return this.exec(sql, params);
  };

  // 覆盖 db.run 为异步版本，返回含 lastInsertRowid 的结果
  const originalRun = db.run.bind(db);
  db.run = async function(sql, params = []) {
    originalRun(sql, params);
    const idResult = this.exec('SELECT last_insert_rowid() as id');
    const lastInsertRowid = idResult.length > 0 && idResult[0].values.length > 0
      ? idResult[0].values[0][0]
      : null;
    return { lastInsertRowid };
  };

  return db;
}

function saveDb() {
  if (IS_POSTGRES) return; // PostgreSQL 自动提交
  if (!db) return;
  const DB_PATH = path.join(__dirname, '..', 'data', 'jin_xiao_cun.db');
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

module.exports = { getDb, saveDb, rowsToObjects, rowToObject, extractScalar, IS_POSTGRES };
