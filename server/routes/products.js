const express = require('express');
const { getDb, saveDb, rowsToObjects, rowToObject } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// List products
router.get('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { keyword, category } = req.query;
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (keyword) {
      sql += ' AND (name LIKE ? OR sku LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    sql += ' ORDER BY id DESC';

    const result = await db.execute(sql, params);
    res.json(rowsToObjects(result));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create product
router.post('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { name, sku, category, unit, purchase_price, sale_price, min_stock } = req.body;

    if (!name || !sku) {
      return res.status(400).json({ error: '商品名称和编码为必填项' });
    }

    const existing = await db.execute('SELECT id FROM products WHERE sku = ?', [sku]);
    if (rowToObject(existing)) {
      return res.status(400).json({ error: '商品编码已存在' });
    }

    await db.run(
      'INSERT INTO products (name, sku, category, unit, purchase_price, sale_price, min_stock) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, sku, category || '', unit || '个', purchase_price || 0, sale_price || 0, min_stock || 0]
    );
    saveDb();

    res.json({ message: '商品创建成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update product
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { name, sku, category, unit, purchase_price, sale_price, min_stock } = req.body;

    await db.run(
      'UPDATE products SET name=?, sku=?, category=?, unit=?, purchase_price=?, sale_price=?, min_stock=? WHERE id=?',
      [name, sku, category || '', unit || '个', purchase_price || 0, sale_price || 0, min_stock || 0, req.params.id]
    );
    saveDb();

    res.json({ message: '商品更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete product
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();

    const items = await db.execute('SELECT id FROM purchase_order_items WHERE product_id = ? LIMIT 1', [req.params.id]);
    const salesItems = await db.execute('SELECT id FROM sales_order_items WHERE product_id = ? LIMIT 1', [req.params.id]);
    if (rowToObject(items) || rowToObject(salesItems)) {
      return res.status(400).json({ error: '该商品已有出入库记录，无法删除' });
    }

    await db.run('DELETE FROM products WHERE id = ?', [req.params.id]);
    saveDb();

    res.json({ message: '商品删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
