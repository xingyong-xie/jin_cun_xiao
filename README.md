# 商品进销存管理系统

轻量级商品进销存管理系统，支持多用户角色权限，覆盖采购、销售、库存三大业务场景。

## 功能介绍

### 用户与权限

- 多用户登录，JWT 令牌认证
- 两种角色：**管理员**（全部功能）和 **操作员**（业务操作，无用户管理权限）
- 默认管理员账户：`admin` / `admin123`

### 采购管理

- **供应商管理**：供应商信息的增删改查
- **采购订单**：创建采购单（选择供应商 + 添加商品明细），支持按状态、关键词、日期筛选
- **入库确认**：确认采购单后自动增加库存，记录库存变动
- **采购退货**：退货后自动扣减库存

### 销售管理

- **客户管理**：客户信息的增删改查
- **销售订单**：创建销售单（选择客户 + 添加商品明细），创建时检查库存是否充足
- **出库确认**：确认销售单后自动扣减库存，记录库存变动
- **销售退货**：退货后自动恢复库存

### 库存管理

- **商品管理**：商品信息增删改查，支持分类筛选，低库存高亮标记
- **库存概览**：库存统计卡片 + 变动记录查询（按商品、类型、日期筛选）
- **库存预警**：低于最低库存阈值的商品列表

### 仪表盘

- 今日/累计采购额与销售额
- 库存预警数量
- 近期采购单与销售单

## 项目架构

```
jin_cun_xiao/
├── client/                        # 前端 React 应用
│   ├── src/
│   │   ├── api/index.js           # Axios 封装，JWT 拦截器
│   │   ├── utils/auth.js          # Token 持久化
│   │   ├── components/
│   │   │   └── PrivateRoute.jsx   # 路由鉴权守卫
│   │   └── pages/
│   │       ├── Login.jsx
│   │       ├── Dashboard.jsx
│   │       ├── purchase/          # 采购模块页面
│   │       ├── sales/             # 销售模块页面
│   │       ├── inventory/         # 库存模块页面
│   │       └── settings/          # 用户管理页面
│   └── vite.config.js             # Vite 配置，开发代理
├── api/                           # Vercel Serverless Function 入口
│   └── index.js                   # Express app 导出
├── server/                        # 后端 Express 应用
│   ├── index.js                   # 入口，挂载路由，条件性启动/导出
│   ├── db/
│   │   ├── database.js            # 双模式适配器：sql.js(本地) / Turso(线上)
│   │   └── init.js                # 建表 & 种子数据
│   ├── middleware/auth.js         # JWT 验证 + 角色权限守卫
│   └── routes/                    # 按资源拆分的路由模块
│       ├── auth.js                # 登录 & 用户管理
│       ├── products.js            # 商品 CRUD
│       ├── suppliers.js           # 供应商 CRUD
│       ├── customers.js           # 客户 CRUD
│       ├── purchase.js            # 采购单（创建/确认/退货）
│       ├── sales.js               # 销售单（创建/确认/退货）
│       ├── inventory.js           # 库存概览/预警/变动
│       └── dashboard.js           # 仪表盘统计
├── vercel.json                    # Vercel 部署配置
└── deploy/                        # Windows 部署脚本
    ├── setup.bat                  # 一键安装
    ├── start.bat / stop.bat       # 启动/停止服务
    ├── install-service.bat        # 注册 Windows 服务（开机自启）
    ├── uninstall-service.bat      # 卸载服务
    ├── backup.bat                 # 数据库备份
    └── restore.bat                # 数据库恢复
```

### 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18 + Ant Design 5 + React Router 6 + Vite |
| 后端 | Express 4 + sql.js (SQLite) / Turso (libSQL) |
| 认证 | JWT (bcryptjs 加密密码，24h 过期) |
| 数据库 | 本地：SQLite（sql.js 驱动） / 线上：Turso（libSQL 云数据库） |

### 核心业务流程

采购单和销售单遵循统一的状态流转：

```
待处理 (pending) → 已确认 (confirmed) → 已退货 (returned)
```

- **采购确认**：库存增加 + 记录 `purchase_in` 变动
- **采购退货**：库存扣减 + 记录 `return_out` 变动
- **销售确认**：库存扣减 + 记录 `sales_out` 变动
- **销售退货**：库存恢复 + 记录 `return_in` 变动

## 开发

```bash
# 安装依赖
cd client && npm install
cd ../server && npm install

# 启动开发环境（前后端同时运行，项目根目录执行）
npm run dev
# 开发模式访问地址：http://localhost:5173（Vite 自动代理 /api 到后端 3001）

# 单独启动后端（端口 3001，项目根目录执行）
npm run dev:server

# 单独启动前端（端口 5173，自动代理 /api 到后端，项目根目录执行）
npm run dev:client

# 构建前端
cd client && npm run build
```

## 部署

### 方式一：Vercel 云部署（推荐）

将项目部署到 Vercel，前端静态托管 + Serverless Function，数据库使用 Turso (libSQL) 云数据库。

#### 1. 创建 Turso 数据库

```bash
# 安装 Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# 注册/登录
turso auth signup

# 创建数据库
turso db create jin-xiao-cun

# 获取连接信息
turso db show jin-xiao-cun --url          # → TURSO_DATABASE_URL
turso db tokens create jin-xiao-cun       # → TURSO_AUTH_TOKEN
```

#### 2. 部署到 Vercel

```bash
# 安装 Vercel CLI（如果没有）
npm i -g vercel

# 在项目根目录执行部署
vercel
```

#### 3. 配置环境变量

在 Vercel Dashboard → Settings → Environment Variables 中添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `TURSO_DATABASE_URL` | `libsql://jin-xiao-cun-xxx.turso.co` | Turso 数据库连接地址 |
| `TURSO_AUTH_TOKEN` | `eyJhbGci...` | Turso 认证令牌 |
| `JWT_SECRET` | 自定义强密码（≥32位） | JWT 签名密钥 |

> `VERCEL` 环境变量由 Vercel 自动设置，无需手动配置。

#### 4. 验证

部署完成后访问 Vercel 分配的 URL，使用 `admin` / `admin123` 登录，数据库表会在首次访问时自动创建。

#### 架构说明

```
Vercel 云部署架构：
浏览器 → Vercel CDN (前端静态文件) + Serverless Function (/api) → Turso (云数据库)

本地开发架构（不变）：
浏览器 → Vite dev server (5173) → Express (3001) → sql.js (本地 SQLite 文件)
```

- 前端：Vercel 自动构建 `client/` 并托管静态文件，SPA 路由通过 `vercel.json` rewrite 处理
- API：所有 `/api/*` 请求路由到 `api/index.js`（Serverless Function），内部运行 Express 应用
- 数据库：Vercel 环境自动使用 Turso 云数据库，本地开发仍使用 sql.js 本地文件

### 方式二：Windows 脚本部署

1. **首次安装**：双击 `deploy/setup.bat`，自动安装依赖并构建前端
2. **启动服务**：双击 `deploy/start.bat`，访问 http://localhost:3001（生产模式）
3. **停止服务**：双击 `deploy/stop.bat`

### 方式三：注册为 Windows 服务（开机自启）

1. **右键** `deploy/install-service.bat` → **以管理员身份运行**
2. 服务名称 `JinXiaoCun`，自动启动并开机自启
3. 管理服务：`Win+R` → `services.msc` → 查找 `JinXiaoCun`
4. 卸载服务：以管理员身份运行 `deploy/uninstall-service.bat`

### 方式四：手动部署

```bash
# 构建前端
cd client && npm install && npm run build

# 启动服务（自动服务前端静态文件）
cd ../server && npm install --production && node index.js
# 生产模式访问地址：http://localhost:3001
# 注意：必须在 server/ 目录下执行 node index.js，不能在项目根目录执行
```

### 数据备份与恢复

- **Vercel + Turso**：数据由 Turso 云端托管，无需手动备份。可在 Turso Dashboard 管理数据
- **Windows 部署**：运行 `deploy/backup.bat` 备份，运行 `deploy/restore.bat` 恢复

### 端口配置

仅适用于 Windows / 手动部署方式，默认端口 `3001`：

```bash
# Linux/macOS（在项目根目录执行）
PORT=8080 node server/index.js

# Windows（在项目根目录执行）
set PORT=8080
node server/index.js
```

Vercel 部署无需配置端口。
