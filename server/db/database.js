const path = require('path');
const fs = require('fs');

const IS_VERCEL = !!process.env.VERCEL;

let db = null;
let tursoClient = null;

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

async function getDb() {
  // 生产环境：Turso
  if (IS_VERCEL) {
    if (tursoClient) return tursoClient;

    const { createClient } = require('@libsql/client');
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    // 包装 Turso 客户端，兼容 sql.js 的调用方式
    tursoClient = {
      async execute(sql, params = []) {
        const result = await client.execute({ sql, args: params });
        // 转换为 sql.js 格式：[{ columns, values }]
        const columns = result.columns || [];
        if (!result.rows || result.rows.length === 0) {
          return [{ columns, values: [] }];
        }
        const values = result.rows.map(row =>
          columns.map(col => row[col])
        );
        return [{ columns, values }];
      },

      async run(sql, params = []) {
        const result = await client.execute({ sql, args: params });
        return result;
      }
    };

    return tursoClient;
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
  if (IS_VERCEL) return; // Vercel 环境下 Turso 自动提交，无需手动保存
  if (!db) return;
  const DB_PATH = path.join(__dirname, '..', 'data', 'jin_xiao_cun.db');
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

module.exports = { getDb, saveDb, rowsToObjects, rowToObject, extractScalar };
