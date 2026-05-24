const express = require('express');
const { getDb, saveDb, rowsToObjects, rowToObject } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function generateOrderNo(orderType) {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const prefix = orderType === 'pre_order' ? 'PO' : 'SO';
  return `${prefix}${dateStr}${random}`;
}

// List sales orders
router.get('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { status, keyword, start_date, end_date, order_type } = req.query;
    let sql = `SELECT so.*, c.name as customer_name, u.username as operator_name
               FROM sales_orders so
               LEFT JOIN customers c ON so.customer_id = c.id
               LEFT JOIN users u ON so.operator_id = u.id WHERE 1=1`;
    const params = [];

    if (order_type) {
      sql += ' AND so.order_type = ?';
      params.push(order_type);
    }
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

// Create sales order (auto-split by delivery_type)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const { customer_id, items, order_type } = req.body;
    const orderType = order_type === 'pre_order' ? 'pre_order' : 'in_stock';

    if (!customer_id || !items || items.length === 0) {
      return res.status(400).json({ error: '请选择客户并添加商品' });
    }

    // 校验商品存在
    for (const item of items) {
      const productResult = await db.execute('SELECT stock_quantity, name FROM products WHERE id = ?', [item.product_id]);
      const product = rowToObject(productResult);
      if (!product) {
        return res.status(400).json({ error: `商品ID ${item.product_id} 不存在` });
      }
    }

    const inStockItems = items.filter(it => (it.delivery_type || 'in_stock') === 'in_stock');
    const preOrderItems = items.filter(it => it.delivery_type === 'pre_order');

    // 仅现货明细校验库存（订货明细不校验）
    for (const item of inStockItems) {
      const productResult = await db.execute('SELECT stock_quantity, name FROM products WHERE id = ?', [item.product_id]);
      const product = rowToObject(productResult);
      if (product.stock_quantity < item.quantity) {
        return res.status(400).json({ error: `商品「${product.name}」库存不足，当前库存: ${product.stock_quantity}` });
      }
    }

    async function createOne(type, lst) {
      if (lst.length === 0) return null;
      const orderNo = generateOrderNo(type);
      const totalAmount = lst.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
      const orderResult = await db.run(
        'INSERT INTO sales_orders (order_no, customer_id, total_amount, status, order_type, operator_id) VALUES (?, ?, ?, ?, ?, ?)',
        [orderNo, customer_id, totalAmount, 'pending', type, req.user.id]
      );
      const orderId = Number(orderResult.lastInsertRowid);
      for (const item of lst) {
        const dt = item.delivery_type === 'pre_order' ? 'pre_order' : 'in_stock';
        await db.run(
          'INSERT INTO sales_order_items (order_id, product_id, quantity, unit_price, amount, delivery_type) VALUES (?, ?, ?, ?, ?, ?)',
          [orderId, item.product_id, item.quantity, item.unit_price, item.quantity * item.unit_price, dt]
        );
      }
      return { id: orderId, order_no: orderNo, type };
    }

    // 按用户当前页面（orderType）决定哪边是主单
    const primaryType = orderType;
    const secondaryType = orderType === 'in_stock' ? 'pre_order' : 'in_stock';
    const primaryList = orderType === 'in_stock' ? inStockItems : preOrderItems;
    const secondaryList = orderType === 'in_stock' ? preOrderItems : inStockItems;

    const primary = await createOne(primaryType, primaryList);
    const secondary = await createOne(secondaryType, secondaryList);

    saveDb();

    res.json({
      message: '创建成功',
      primary,
      secondary,
      // 兼容旧字段
      id: primary ? primary.id : secondary?.id,
      order_no: primary ? primary.order_no : secondary?.order_no
    });
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
