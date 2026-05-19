const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./db/init');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const supplierRoutes = require('./routes/suppliers');
const customerRoutes = require('./routes/customers');
const purchaseRoutes = require('./routes/purchase');
const salesRoutes = require('./routes/sales');
const inventoryRoutes = require('./routes/inventory');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

app.use(cors());
app.use(express.json());

// 数据库初始化中间件（冷启动时执行一次）
let dbInitialized = false;
app.use(async (req, res, next) => {
  if (!dbInitialized) {
    await initDatabase();
    dbInitialized = true;
  }
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/purchase-orders', purchaseRoutes);
app.use('/api/sales-orders', salesRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/dashboard', dashboardRoutes);

// 404 处理：未匹配的 /api 路由返回 JSON 错误
app.use('/api', (req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 服务前端静态文件 + SPA fallback（本地开发）
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// 启动 Express 服务器
const PORT = process.env.PORT || 3001;
async function start() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = app;
