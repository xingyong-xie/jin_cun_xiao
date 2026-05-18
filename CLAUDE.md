# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

商品进销存管理系统 (Purchase-Sales-Inventory Management System) — a full-stack web app with role-based access (admin/operator). All UI text and error messages are in Chinese. Three core business modules: purchase, sales, and inventory management.

## Development Commands

```bash
# Start both client and server concurrently
npm run dev

# Start server only (port 3001)
npm run dev:server

# Start client only (port 5173, proxies /api to localhost:3001)
npm run dev:client

# Build frontend for production
cd client && npm run build

# Production: server serves built frontend from client/dist/
cd server && node index.js
```

No test framework, linter, or TypeScript is configured.

## Architecture

**Monorepo** with two independent npm projects:

- **client/** — React 18 + Ant Design 5 + React Router 6, bundled with Vite. ESM (`"type": "module"`).
- **server/** — Express 4 + sql.js (SQLite, local) / PostgreSQL (cloud), CommonJS. No TypeScript.

### Client-Server Communication

- REST API over `/api` prefix
- JWT Bearer token auth (24h expiry, secret from `JWT_SECRET` env var or hardcoded fallback)
- Dev: Vite proxies `/api` → `http://localhost:3001`
- Prod: Express serves `client/dist/` as static + SPA fallback

### Client Structure

- `src/api/index.js` — Axios instance with JWT interceptor and 401 auto-logout
- `src/utils/auth.js` — Token/user persistence in localStorage (`jin_xiao_cun_token`, `jin_xiao_cun_user`)
- `src/components/PrivateRoute.jsx` — Auth guard redirecting to `/login`
- `src/pages/` — Feature-organized pages: `login/`, `purchase/`, `sales/`, `inventory/`, `settings/`, `Dashboard.jsx`

### Server Structure

- `index.js` — Express setup, mounts all route modules, production static serving
- `db/database.js` — Dual-mode database adapter: sql.js (local SQLite) or PostgreSQL (cloud). Detects `DATABASE_URL` env var for PostgreSQL mode. Auto-converts `?` → `$1,$2...` placeholders and `LIKE` → `ILIKE` for PG compatibility. **Important**: sql.js mode requires `saveDb()` after mutations to persist; PostgreSQL mode auto-commits.
- `db/init.js` — Creates tables if missing (separate SQL for SQLite/PostgreSQL), seeds default admin (`admin`/`admin123`)
- `middleware/auth.js` — JWT verification + admin-only guard
- `routes/` — One file per resource: `auth`, `products`, `suppliers`, `customers`, `purchase`, `sales`, `inventory`, `dashboard`

### Database (Dual-mode: SQLite / PostgreSQL)

8 tables: users, products, suppliers, customers, purchase_orders, purchase_order_items, sales_orders, sales_order_items, stock_movements.

Both database modes return results in `[{ columns, values }]` format. Shared utility functions `rowsToObjects()`, `rowToObject()`, and `extractScalar()` in `database.js` convert these to plain objects.

- **Local mode** (no `DATABASE_URL`): sql.js in-memory SQLite, persisted to `server/data/jin_xiao_cun.db`
- **Cloud mode** (`DATABASE_URL` set): PostgreSQL via `pg.Pool`, auto-converts SQL dialect differences

### Order Status Flow

Purchase and sales orders follow: `pending` → `confirmed` → `returned`. Each transition is validated server-side. Confirming/returning orders creates corresponding `stock_movements` records and updates product quantities.

### Deployment

`deploy/` contains Windows `.bat` scripts for setup, start/stop, Windows service registration, and database backup/restore. Cloud deployment via **Zeabur** with built-in PostgreSQL — see README for details.

## Git Workflow

- **提交粒度**: 按任务/功能提交，完成一个逻辑任务后统一 commit，不要逐文件提交
- **Commit message**: 根据修改内容自动生成中文 commit message，简洁描述做了什么（如"添加库存预警页面"、"修复采购订单确认逻辑"）
- **无需询问**: 完成任务后直接提交，不需要先问用户是否要 commit

## Key Implementation Details

- **sql.js persistence** (local mode only): Unlike better-sqlite3, sql.js requires explicit `saveDb()` calls after writes. Forgetting this means data is lost on server restart. PostgreSQL mode auto-commits.
- **No database transactions**: Multi-step mutations (order + items + stock updates) run as sequential `db.run()` calls without rollback capability.
- **No pagination**: All list endpoints return complete result sets.
- **Environment variables**: `DATABASE_URL` (PostgreSQL connection string), `JWT_SECRET` (JWT signing key), `PORT` (server port, default 3001).
