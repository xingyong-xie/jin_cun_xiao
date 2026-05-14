const express = require('express');
const { getDb, saveDb } = require('../db/database');
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

// List customers
router.get('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { keyword } = req.query;
    let sql = 'SELECT * FROM customers WHERE 1=1';
    const params = [];

    if (keyword) {
      sql += ' AND (name LIKE ? OR contact LIKE ? OR phone LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    sql += ' ORDER BY id DESC';

    const result = db.exec(sql, params);
    res.json(rowsToObjects(result));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create customer
router.post('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { name, contact, phone, address } = req.body;

    if (!name) {
      return res.status(400).json({ error: '客户名称为必填项' });
    }

    db.run('INSERT INTO customers (name, contact, phone, address) VALUES (?, ?, ?, ?)',
      [name, contact || '', phone || '', address || '']);
    saveDb();

    res.json({ message: '客户创建成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update customer
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { name, contact, phone, address } = req.body;

    db.run('UPDATE customers SET name=?, contact=?, phone=?, address=? WHERE id=?',
      [name, contact || '', phone || '', address || '', req.params.id]);
    saveDb();

    res.json({ message: '客户更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete customer
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();

    const orders = db.exec('SELECT id FROM sales_orders WHERE customer_id = ? LIMIT 1', [req.params.id]);
    if (orders.length > 0 && orders[0].values.length > 0) {
      return res.status(400).json({ error: '该客户已有销售记录，无法删除' });
    }

    db.run('DELETE FROM customers WHERE id = ?', [req.params.id]);
    saveDb();

    res.json({ message: '客户删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
