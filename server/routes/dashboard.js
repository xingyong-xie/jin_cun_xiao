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

// Dashboard data
router.get('/', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();

    // Today's purchase amount
    const todayPurchase = db.exec(
      "SELECT COALESCE(SUM(total_amount), 0) as total FROM purchase_orders WHERE status != 'pending' AND date(created_at) = date('now', 'localtime')"
    );
    const todayPurchaseAmount = todayPurchase.length > 0 ? todayPurchase[0].values[0][0] : 0;

    // Today's sales amount
    const todaySales = db.exec(
      "SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE status != 'pending' AND date(created_at) = date('now', 'localtime')"
    );
    const todaySalesAmount = todaySales.length > 0 ? todaySales[0].values[0][0] : 0;

    // Total purchase amount
    const totalPurchase = db.exec(
      "SELECT COALESCE(SUM(total_amount), 0) as total FROM purchase_orders WHERE status != 'pending'"
    );
    const totalPurchaseAmount = totalPurchase.length > 0 ? totalPurchase[0].values[0][0] : 0;

    // Total sales amount
    const totalSales = db.exec(
      "SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE status != 'pending'"
    );
    const totalSalesAmount = totalSales.length > 0 ? totalSales[0].values[0][0] : 0;

    // Low stock alert count
    const alertCount = db.exec(
      'SELECT COUNT(*) as count FROM products WHERE stock_quantity <= min_stock AND min_stock > 0'
    );
    const alertNum = alertCount.length > 0 ? alertCount[0].values[0][0] : 0;

    // Recent purchase orders
    const recentPurchase = db.exec(
      `SELECT po.*, s.name as supplier_name, u.username as operator_name
       FROM purchase_orders po
       LEFT JOIN suppliers s ON po.supplier_id = s.id
       LEFT JOIN users u ON po.operator_id = u.id
       ORDER BY po.id DESC LIMIT 5`
    );

    // Recent sales orders
    const recentSales = db.exec(
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
