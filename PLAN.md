# 进销存管理系统（jin_xiao_cun）实现计划

## Context

从零构建一个进销存管理系统，支持多用户使用，包含进货管理、销货管理、存货管理三大核心模块。

**技术栈**: React + Vite + Ant Design (前端) | Node.js + Express + SQLite (后端)
**用户系统**: 多用户，JWT 认证，管理员/操作员角色

---

## 项目结构

```
jin_xiao_cun/
├── package.json                  # 根目录 monorepo 配置
├── client/                       # 前端 React 应用
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api/                  # API 请求封装
│       │   └── index.js
│       ├── components/           # 公共组件
│       │   └── PrivateRoute.jsx
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Dashboard.jsx
│       │   ├── purchase/         # 进货管理
│       │   │   ├── SupplierList.jsx
│       │   │   ├── PurchaseOrderList.jsx
│       │   │   └── PurchaseOrderForm.jsx
│       │   ├── sales/            # 销货管理
│       │   │   ├── CustomerList.jsx
│       │   │   ├── SalesOrderList.jsx
│       │   │   └── SalesOrderForm.jsx
│       │   ├── inventory/        # 存货管理
│       │   │   ├── ProductList.jsx
│       │   │   ├── StockOverview.jsx
│       │   │   └── StockAlert.jsx
│       │   └── settings/         # 系统设置
│       │       └── UserManagement.jsx
│       └── utils/
│           └── auth.js
├── server/                       # 后端 Express 应用
│   ├── package.json
│   ├── index.js                  # 入口文件
│   ├── db/
│   │   ├── init.js               # 数据库初始化 & 建表
│   │   └── database.js           # SQLite 连接
│   ├── middleware/
│   │   └── auth.js               # JWT 认证中间件
│   └── routes/
│       ├── auth.js               # 登录/用户路由
│       ├── products.js           # 商品路由
│       ├── suppliers.js          # 供应商路由
│       ├── customers.js          # 客户路由
│       ├── purchase.js           # 进货路由
│       ├── sales.js              # 销货路由
│       └── inventory.js          # 库存路由
```

---

## 数据库设计 (SQLite)

### users - 用户表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增ID |
| username | TEXT UNIQUE | 用户名 |
| password | TEXT | bcrypt 加密密码 |
| role | TEXT | admin / operator |
| created_at | TEXT | 创建时间 |

### products - 商品表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增ID |
| name | TEXT | 商品名称 |
| sku | TEXT UNIQUE | 编码 |
| category | TEXT | 分类 |
| unit | TEXT | 单位 |
| purchase_price | REAL | 进价 |
| sale_price | REAL | 售价 |
| stock_quantity | INTEGER | 当前库存 |
| min_stock | INTEGER | 最低库存预警 |
| created_at | TEXT | 创建时间 |

### suppliers - 供应商表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增ID |
| name | TEXT | 名称 |
| contact | TEXT | 联系人 |
| phone | TEXT | 电话 |
| address | TEXT | 地址 |
| created_at | TEXT | 创建时间 |

### customers - 客户表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增ID |
| name | TEXT | 名称 |
| contact | TEXT | 联系人 |
| phone | TEXT | 电话 |
| address | TEXT | 地址 |
| created_at | TEXT | 创建时间 |

### purchase_orders - 进货单
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增ID |
| order_no | TEXT UNIQUE | 单号 |
| supplier_id | INTEGER FK | 供应商 |
| total_amount | REAL | 总金额 |
| status | TEXT | 待入库/已入库/已退货 |
| operator_id | INTEGER FK | 操作员 |
| created_at | TEXT | 创建时间 |

### purchase_order_items - 进货单明细
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增ID |
| order_id | INTEGER FK | 进货单ID |
| product_id | INTEGER FK | 商品ID |
| quantity | INTEGER | 数量 |
| unit_price | REAL | 单价 |
| amount | REAL | 小计 |

### sales_orders - 销货单
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增ID |
| order_no | TEXT UNIQUE | 单号 |
| customer_id | INTEGER FK | 客户 |
| total_amount | REAL | 总金额 |
| status | TEXT | 待出库/已出库/已退货 |
| operator_id | INTEGER FK | 操作员 |
| created_at | TEXT | 创建时间 |

### sales_order_items - 销货单明细
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增ID |
| order_id | INTEGER FK | 销货单ID |
| product_id | INTEGER FK | 商品ID |
| quantity | INTEGER | 数量 |
| unit_price | REAL | 单价 |
| amount | REAL | 小计 |

### stock_movements - 库存变动记录
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增ID |
| product_id | INTEGER FK | 商品ID |
| type | TEXT | purchase_in/sales_out/return_in/return_out |
| quantity | INTEGER | 数量(正数) |
| order_id | INTEGER | 关联单据ID |
| operator_id | INTEGER FK | 操作员 |
| created_at | TEXT | 创建时间 |

---

## 实现步骤

### Step 1: 项目初始化
- 创建根目录 package.json（workspace 配置）
- 初始化 server/ 和 client/ 子项目
- 安装依赖

**server 依赖**: express, better-sqlite3, bcryptjs, jsonwebtoken, cors
**client 依赖**: react, react-dom, react-router-dom, antd, @ant-design/icons, axios, dayjs

### Step 2: 后端 - 数据库 & 认证
- 创建 SQLite 数据库连接 (better-sqlite3)
- 建表脚本（含默认管理员账户 admin/admin123）
- JWT 认证中间件
- 登录/用户管理 API

### Step 3: 后端 - 业务 API
- 商品 CRUD API
- 供应商 CRUD API
- 客户 CRUD API
- 进货单 API（创建、列表、详情、入库确认、退货）
- 销货单 API（创建、列表、详情、出库确认、退货）
- 库存 API（查询、变动记录、预警）
- 入库/出库时自动更新库存和记录变动

### Step 4: 前端 - 基础框架
- Vite + React 项目搭建
- Ant Design 布局（侧边栏导航 + 内容区）
- 路由配置（含登录守卫）
- Axios 请求封装（自动携带 JWT token）

### Step 5: 前端 - 进货管理页面
- 供应商列表（增删改查）
- 进货单列表（筛选、搜索）
- 进货单创建/编辑表单（选择供应商、添加商品明细）
- 入库确认 & 退货操作

### Step 6: 前端 - 销货管理页面
- 客户列表（增删改查）
- 销货单列表（筛选、搜索）
- 销货单创建/编辑表单（选择客户、添加商品明细、实时检查库存）
- 出库确认 & 退货操作

### Step 7: 前端 - 存货管理页面
- 商品列表（增删改查、按分类筛选）
- 库存概览（库存统计、低库存预警列表）
- 库存变动记录查看

### Step 8: 前端 - Dashboard & 设置
- 仪表盘（今日采购额/销售额、库存预警数、近期单据）
- 用户管理页面（仅管理员可访问）

### Step 9: 联调 & 验证
- 前后端联调
- 完整流程测试：创建进货单 → 入库 → 创建销货单 → 出库 → 查看库存变动

---

## API 设计

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/login | 登录 |
| GET | /api/users | 用户列表 |
| POST | /api/users | 创建用户 |
| PUT | /api/users/:id | 编辑用户 |
| DELETE | /api/users/:id | 删除用户 |
| GET | /api/products | 商品列表 |
| POST | /api/products | 创建商品 |
| PUT | /api/products/:id | 编辑商品 |
| DELETE | /api/products/:id | 删除商品 |
| GET | /api/suppliers | 供应商列表 |
| POST | /api/suppliers | 创建供应商 |
| PUT | /api/suppliers/:id | 编辑供应商 |
| DELETE | /api/suppliers/:id | 删除供应商 |
| GET | /api/customers | 客户列表 |
| POST | /api/customers | 创建客户 |
| PUT | /api/customers/:id | 编辑客户 |
| DELETE | /api/customers/:id | 删除客户 |
| GET | /api/purchase-orders | 进货单列表 |
| POST | /api/purchase-orders | 创建进货单 |
| GET | /api/purchase-orders/:id | 进货单详情 |
| PUT | /api/purchase-orders/:id/confirm | 确认入库 |
| PUT | /api/purchase-orders/:id/return | 进货退货 |
| GET | /api/sales-orders | 销货单列表 |
| POST | /api/sales-orders | 创建销货单 |
| GET | /api/sales-orders/:id | 销货单详情 |
| PUT | /api/sales-orders/:id/confirm | 确认出库 |
| PUT | /api/sales-orders/:id/return | 销货退货 |
| GET | /api/inventory/overview | 库存概览 |
| GET | /api/inventory/alerts | 库存预警 |
| GET | /api/inventory/movements | 变动记录 |
| GET | /api/dashboard | 仪表盘数据 |

---

## 验证方式

1. 启动后端: `cd server && node index.js` (端口 3001)
2. 启动前端: `cd client && npm run dev` (端口 5173)
3. 登录默认管理员账户 (admin / admin123)
4. 测试完整流程：
   - 创建商品 → 创建供应商 → 创建进货单 → 确认入库 → 检查库存增加
   - 创建客户 → 创建销货单 → 确认出库 → 检查库存减少
   - 查看库存预警 & 变动记录
