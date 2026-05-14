const express = require('express');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function rowsToObjects(result) {
  if (result.length === 0) return [];
  return result[0].values.map(row => {
    const obj = {};
    result[0].columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

// Inventory overview
router.get('/overview', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();

    const totalProducts = db.exec('SELECT COUNT(*) as count FROM products');
    const totalStock = db.exec('SELECT SUM(stock_quantity) as total FROM products');
    const totalValue = db.exec('SELECT SUM(stock_quantity * purchase_price) as value FROM products');
    const alertCount = db.exec('SELECT COUNT(*) as count FROM products WHERE stock_quantity <= min_stock AND min_stock > 0');

    res.json({
      totalProducts: totalProducts.length > 0 ? totalProducts[0].values[0][0] : 0,
      totalStock: totalStock.length > 0 && totalStock[0].values[0][0] !== null ? totalStock[0].values[0][0] : 0,
      totalValue: totalValue.length > 0 && totalValue[0].values[0][0] !== null ? totalValue[0].values[0][0] : 0,
      alertCount: alertCount.length > 0 ? alertCount[0].values[0][0] : 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stock alerts (products below min_stock)
router.get('/alerts', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const result = db.exec(
      'SELECT * FROM products WHERE stock_quantity <= min_stock AND min_stock > 0 ORDER BY (min_stock - stock_quantity) DESC'
    );
    res.json(rowsToObjects(result));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stock movements
router.get('/movements', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { product_id, type, start_date, end_date } = req.query;
    let sql = `SELECT sm.*, p.name as product_name, p.sku as product_sku, u.username as operator_name
               FROM stock_movements sm
               LEFT JOIN products p ON sm.product_id = p.id
               LEFT JOIN users u ON sm.operator_id = u.id WHERE 1=1`;
    const params = [];

    if (product_id) {
      sql += ' AND sm.product_id = ?';
      params.push(product_id);
    }
    if (type) {
      sql += ' AND sm.type = ?';
      params.push(type);
    }
    if (start_date) {
      sql += " AND sm.created_at >= ?";
      params.push(start_date);
    }
    if (end_date) {
      sql += " AND sm.created_at <= ?";
      params.push(end_date + ' 23:59:59');
    }
    sql += ' ORDER BY sm.id DESC';

    const result = db.exec(sql, params);
    res.json(rowsToObjects(result));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
