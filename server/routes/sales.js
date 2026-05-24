const express = require('express');
const { getDb, saveDb, rowsToObjects, rowToObject } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function generateOrderNo() {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `SO${dateStr}${random}`;
}

// List sales orders
router.get('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { status, keyword, start_date, end_date } = req.query;
    let sql = `SELECT so.*, c.name as customer_name, u.username as operator_name
               FROM sales_orders so
               LEFT JOIN customers c ON so.customer_id = c.id
               LEFT JOIN users u ON so.operator_id = u.id WHERE 1=1`;
    const params = [];

    if (status) {
      sql += ' AND so.status = ?';
      params.push(status);
    }
    if (keyword) {
      sql += ' AND (so.order_no LIKE ? OR c.name LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (start_date) {
      sql += " AND so.created_at >= ?";
      params.push(start_date);
    }
    if (end_date) {
      sql += " AND so.created_at <= ?";
      params.push(end_date + ' 23:59:59');
    }
    sql += ' ORDER BY so.id DESC';

    const result = await db.execute(sql, params);
    const orders = rowsToObjects(result);

    for (let order of orders) {
      const itemsResult = await db.execute(
        `SELECT soi.*, p.name as product_name, p.sku as product_sku, p.unit as product_unit
         FROM sales_order_items soi
         LEFT JOIN products p ON soi.product_id = p.id
         WHERE soi.order_id = ?`,
        [order.id]
      );
      order.items = rowsToObjects(itemsResult);
    }

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get sales order detail
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.execute(
      `SELECT so.*, c.name as customer_name, c.contact as customer_contact, c.phone as customer_phone,
              u.username as operator_name
       FROM sales_orders so
       LEFT JOIN customers c ON so.customer_id = c.id
       LEFT JOIN users u ON so.operator_id = u.id
       WHERE so.id = ?`,
      [req.params.id]
    );
    const order = rowToObject(result);
    if (!order) {
      return res.status(404).json({ error: '销货单不存在' });
    }

    const itemsResult = await db.execute(
      `SELECT soi.*, p.name as product_name, p.sku as product_sku, p.unit as product_unit
       FROM sales_order_items soi
       LEFT JOIN products p ON soi.product_id = p.id
       WHERE soi.order_id = ?`,
      [order.id]
    );
    order.items = rowsToObjects(itemsResult);

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create sales order
router.post('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { customer_id, items } = req.body;

    if (!customer_id || !items || items.length === 0) {
      return res.status(400).json({ error: '请选择客户并添加商品' });
    }

    // Check stock availability
    for (const item of items) {
      const productResult = await db.execute('SELECT stock_quantity, name FROM products WHERE id = ?', [item.product_id]);
      const product = rowToObject(productResult);
      if (!product) {
        return res.status(400).json({ error: `商品ID ${item.product_id} 不存在` });
      }
      if (product.stock_quantity < item.quantity) {
        return res.status(400).json({ error: `商品「${product.name}」库存不足，当前库存: ${product.stock_quantity}` });
      }
    }

    const orderNo = generateOrderNo();
    const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

    const orderResult = await db.run(
      'INSERT INTO sales_orders (order_no, customer_id, total_amount, status, operator_id) VALUES (?, ?, ?, ?, ?)',
      [orderNo, customer_id, totalAmount, 'pending', req.user.id]
    );
    const orderId = Number(orderResult.lastInsertRowid);

    for (const item of items) {
      const deliveryType = item.delivery_type === 'pre_order' ? 'pre_order' : 'in_stock';
      await db.run(
        'INSERT INTO sales_order_items (order_id, product_id, quantity, unit_price, amount, delivery_type) VALUES (?, ?, ?, ?, ?, ?)',
        [orderId, item.product_id, item.quantity, item.unit_price, item.quantity * item.unit_price, deliveryType]
      );
    }

    saveDb();
    res.json({ message: '销货单创建成功', id: orderId, order_no: orderNo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Confirm sales order (stock out)
router.put('/:id/confirm', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const orderId = req.params.id;

    const result = await db.execute('SELECT * FROM sales_orders WHERE id = ?', [orderId]);
    const order = rowToObject(result);
    if (!order) {
      return res.status(404).json({ error: '销货单不存在' });
    }
    if (order.status !== 'pending') {
      return res.status(400).json({ error: '只有待出库的单据才能确认出库' });
    }

    const itemsResult = await db.execute('SELECT * FROM sales_order_items WHERE order_id = ?', [orderId]);
    const items = rowsToObjects(itemsResult);

    for (const item of items) {
      const productResult = await db.execute('SELECT stock_quantity, name FROM products WHERE id = ?', [item.product_id]);
      const product = rowToObject(productResult);
      if (product.stock_quantity < item.quantity) {
        return res.status(400).json({ error: `商品「${product.name}」库存不足，当前库存: ${product.stock_quantity}` });
      }

      await db.run('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
        [item.quantity, item.product_id]);

      await db.run(
        'INSERT INTO stock_movements (product_id, type, quantity, order_id, operator_id) VALUES (?, ?, ?, ?, ?)',
        [item.product_id, 'sales_out', item.quantity, orderId, req.user.id]
      );
    }

    await db.run("UPDATE sales_orders SET status = 'confirmed' WHERE id = ?", [orderId]);
    saveDb();

    res.json({ message: '出库确认成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Return sales order
router.put('/:id/return', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const orderId = req.params.id;

    const result = await db.execute('SELECT * FROM sales_orders WHERE id = ?', [orderId]);
    const order = rowToObject(result);
    if (!order) {
      return res.status(404).json({ error: '销货单不存在' });
    }
    if (order.status !== 'confirmed') {
      return res.status(400).json({ error: '只有已出库的单据才能退货' });
    }

    const itemsResult = await db.execute('SELECT * FROM sales_order_items WHERE order_id = ?', [orderId]);
    const items = rowsToObjects(itemsResult);

    for (const item of items) {
      await db.run('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
        [item.quantity, item.product_id]);

      await db.run(
        'INSERT INTO stock_movements (product_id, type, quantity, order_id, operator_id) VALUES (?, ?, ?, ?, ?)',
        [item.product_id, 'return_in', item.quantity, orderId, req.user.id]
      );
    }

    await db.run("UPDATE sales_orders SET status = 'returned' WHERE id = ?", [orderId]);
    saveDb();

    res.json({ message: '退货成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
