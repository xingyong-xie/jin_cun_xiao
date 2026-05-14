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

function rowToObject(result) {
  if (result.length === 0 || result[0].values.length === 0) return null;
  const obj = {};
  result[0].columns.forEach((col, i) => { obj[col] = result[0].values[0][i]; });
  return obj;
}

function generateOrderNo() {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `PO${dateStr}${random}`;
}

// List purchase orders
router.get('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { status, keyword, start_date, end_date } = req.query;
    let sql = `SELECT po.*, s.name as supplier_name, u.username as operator_name
               FROM purchase_orders po
               LEFT JOIN suppliers s ON po.supplier_id = s.id
               LEFT JOIN users u ON po.operator_id = u.id WHERE 1=1`;
    const params = [];

    if (status) {
      sql += ' AND po.status = ?';
      params.push(status);
    }
    if (keyword) {
      sql += ' AND (po.order_no LIKE ? OR s.name LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (start_date) {
      sql += " AND po.created_at >= ?";
      params.push(start_date);
    }
    if (end_date) {
      sql += " AND po.created_at <= ?";
      params.push(end_date + ' 23:59:59');
    }
    sql += ' ORDER BY po.id DESC';

    const result = db.exec(sql, params);
    const orders = rowsToObjects(result);

    for (let order of orders) {
      const itemsResult = db.exec(
        `SELECT poi.*, p.name as product_name, p.sku as product_sku, p.unit as product_unit
         FROM purchase_order_items poi
         LEFT JOIN products p ON poi.product_id = p.id
         WHERE poi.order_id = ?`,
        [order.id]
      );
      order.items = rowsToObjects(itemsResult);
    }

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get purchase order detail
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const result = db.exec(
      `SELECT po.*, s.name as supplier_name, s.contact as supplier_contact, s.phone as supplier_phone,
              u.username as operator_name
       FROM purchase_orders po
       LEFT JOIN suppliers s ON po.supplier_id = s.id
       LEFT JOIN users u ON po.operator_id = u.id
       WHERE po.id = ?`,
      [req.params.id]
    );
    const order = rowToObject(result);
    if (!order) {
      return res.status(404).json({ error: '进货单不存在' });
    }

    const itemsResult = db.exec(
      `SELECT poi.*, p.name as product_name, p.sku as product_sku, p.unit as product_unit
       FROM purchase_order_items poi
       LEFT JOIN products p ON poi.product_id = p.id
       WHERE poi.order_id = ?`,
      [order.id]
    );
    order.items = rowsToObjects(itemsResult);

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create purchase order
router.post('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { supplier_id, items } = req.body;

    if (!supplier_id || !items || items.length === 0) {
      return res.status(400).json({ error: '请选择供应商并添加商品' });
    }

    const orderNo = generateOrderNo();
    const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

    db.run(
      'INSERT INTO purchase_orders (order_no, supplier_id, total_amount, status, operator_id) VALUES (?, ?, ?, ?, ?)',
      [orderNo, supplier_id, totalAmount, 'pending', req.user.id]
    );

    const orderResult = db.exec('SELECT last_insert_rowid() as id');
    const orderId = orderResult[0].values[0][0];

    for (const item of items) {
      db.run(
        'INSERT INTO purchase_order_items (order_id, product_id, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?)',
        [orderId, item.product_id, item.quantity, item.unit_price, item.quantity * item.unit_price]
      );
    }

    saveDb();
    res.json({ message: '进货单创建成功', id: orderId, order_no: orderNo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Confirm purchase order (stock in)
router.put('/:id/confirm', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const orderId = req.params.id;

    const result = db.exec('SELECT * FROM purchase_orders WHERE id = ?', [orderId]);
    const order = rowToObject(result);
    if (!order) {
      return res.status(404).json({ error: '进货单不存在' });
    }
    if (order.status !== 'pending') {
      return res.status(400).json({ error: '只有待入库的单据才能确认入库' });
    }

    const itemsResult = db.exec('SELECT * FROM purchase_order_items WHERE order_id = ?', [orderId]);
    const items = rowsToObjects(itemsResult);

    for (const item of items) {
      db.run('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
        [item.quantity, item.product_id]);

      db.run(
        'INSERT INTO stock_movements (product_id, type, quantity, order_id, operator_id) VALUES (?, ?, ?, ?, ?)',
        [item.product_id, 'purchase_in', item.quantity, orderId, req.user.id]
      );
    }

    db.run("UPDATE purchase_orders SET status = 'confirmed' WHERE id = ?", [orderId]);
    saveDb();

    res.json({ message: '入库确认成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Return purchase order
router.put('/:id/return', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const orderId = req.params.id;

    const result = db.exec('SELECT * FROM purchase_orders WHERE id = ?', [orderId]);
    const order = rowToObject(result);
    if (!order) {
      return res.status(404).json({ error: '进货单不存在' });
    }
    if (order.status !== 'confirmed') {
      return res.status(400).json({ error: '只有已入库的单据才能退货' });
    }

    const itemsResult = db.exec('SELECT * FROM purchase_order_items WHERE order_id = ?', [orderId]);
    const items = rowsToObjects(itemsResult);

    for (const item of items) {
      db.run('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
        [item.quantity, item.product_id]);

      db.run(
        'INSERT INTO stock_movements (product_id, type, quantity, order_id, operator_id) VALUES (?, ?, ?, ?, ?)',
        [item.product_id, 'return_out', item.quantity, orderId, req.user.id]
      );
    }

    db.run("UPDATE purchase_orders SET status = 'returned' WHERE id = ?", [orderId]);
    saveDb();

    res.json({ message: '退货成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
