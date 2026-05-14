const express = require('express');
const { getDb, saveDb, rowsToObjects, rowToObject } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// List suppliers
router.get('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { keyword } = req.query;
    let sql = 'SELECT * FROM suppliers WHERE 1=1';
    const params = [];

    if (keyword) {
      sql += ' AND (name LIKE ? OR contact LIKE ? OR phone LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    sql += ' ORDER BY id DESC';

    const result = await db.execute(sql, params);
    res.json(rowsToObjects(result));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create supplier
router.post('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { name, contact, phone, address } = req.body;

    if (!name) {
      return res.status(400).json({ error: '供应商名称为必填项' });
    }

    await db.run('INSERT INTO suppliers (name, contact, phone, address) VALUES (?, ?, ?, ?)',
      [name, contact || '', phone || '', address || '']);
    saveDb();

    res.json({ message: '供应商创建成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update supplier
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { name, contact, phone, address } = req.body;

    await db.run('UPDATE suppliers SET name=?, contact=?, phone=?, address=? WHERE id=?',
      [name, contact || '', phone || '', address || '', req.params.id]);
    saveDb();

    res.json({ message: '供应商更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete supplier
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();

    const orders = await db.execute('SELECT id FROM purchase_orders WHERE supplier_id = ? LIMIT 1', [req.params.id]);
    if (rowToObject(orders)) {
      return res.status(400).json({ error: '该供应商已有采购记录，无法删除' });
    }

    await db.run('DELETE FROM suppliers WHERE id = ?', [req.params.id]);
    saveDb();

    res.json({ message: '供应商删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
