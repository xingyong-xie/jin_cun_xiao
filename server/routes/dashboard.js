const express = require('express');
const { getDb, rowsToObjects, extractScalar, IS_POSTGRES } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Dashboard data
router.get('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();

    // 今日日期过滤：PostgreSQL 用 CURRENT_DATE，SQLite 用 date('now','localtime')
    const todayFilter = IS_POSTGRES
      ? "DATE(created_at) = CURRENT_DATE"
      : "date(created_at) = date('now', 'localtime')";

    // Today's purchase amount
    const todayPurchaseAmount = extractScalar(
      await db.execute(
        `SELECT COALESCE(SUM(total_amount), 0) as total FROM purchase_orders WHERE status != 'pending' AND ${todayFilter}`
      )
    );

    // Today's sales amount
    const todaySalesAmount = extractScalar(
      await db.execute(
        `SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE status != 'pending' AND ${todayFilter}`
      )
    );

    // Total purchase amount
    const totalPurchaseAmount = extractScalar(
      await db.execute(
        "SELECT COALESCE(SUM(total_amount), 0) as total FROM purchase_orders WHERE status != 'pending'"
      )
    );

    // Total sales amount
    const totalSalesAmount = extractScalar(
      await db.execute(
        "SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE status != 'pending'"
      )
    );

    // Low stock alert count
    const alertNum = extractScalar(
      await db.execute(
        'SELECT COUNT(*) as count FROM products WHERE stock_quantity <= min_stock AND min_stock > 0'
      )
    );

    // Recent purchase orders
    const recentPurchase = await db.execute(
      `SELECT po.*, s.name as supplier_name, u.username as operator_name
       FROM purchase_orders po
       LEFT JOIN suppliers s ON po.supplier_id = s.id
       LEFT JOIN users u ON po.operator_id = u.id
       ORDER BY po.id DESC LIMIT 5`
    );

    // Recent sales orders
    const recentSales = await db.execute(
      `SELECT so.*, c.name as customer_name, u.username as operator_name
       FROM sales_orders so
       LEFT JOIN customers c ON so.customer_id = c.id
       LEFT JOIN users u ON so.operator_id = u.id
       ORDER BY so.id DESC LIMIT 5`
    );

    res.json({
      todayPurchaseAmount,
      todaySalesAmount,
      totalPurchaseAmount,
      totalSalesAmount,
      alertCount: alertNum,
      recentPurchaseOrders: rowsToObjects(recentPurchase),
      recentSalesOrders: rowsToObjects(recentSales)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
