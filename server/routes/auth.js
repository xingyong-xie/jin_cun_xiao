const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb, saveDb } = require('../db/database');
const { authMiddleware, adminOnly, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const db = await getDb();
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '请输入用户名和密码' });
    }

    const result = db.exec('SELECT * FROM users WHERE username = ?', [username]);
    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const columns = result[0].columns;
    const row = result[0].values[0];
    const user = {};
    columns.forEach((col, i) => { user[col] = row[i]; });

    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user info
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const result = db.exec('SELECT id, username, role, created_at FROM users WHERE id = ?', [req.user.id]);
    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    const columns = result[0].columns;
    const row = result[0].values[0];
    const user = {};
    columns.forEach((col, i) => { user[col] = row[i]; });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List users (admin only)
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const result = db.exec('SELECT id, username, role, created_at FROM users ORDER BY id');
    const rows = result.length > 0 ? result[0].values.map(row => {
      const obj = {};
      result[0].columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    }) : [];
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create user (admin only)
router.post('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '请输入用户名和密码' });
    }

    const existing = db.exec('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hashedPassword, role || 'operator']);
    saveDb();

    res.json({ message: '用户创建成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user (admin only)
router.put('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const { username, password, role } = req.body;
    const userId = req.params.id;

    if (password) {
      const hashedPassword = bcrypt.hashSync(password, 10);
      db.run('UPDATE users SET username = ?, password = ?, role = ? WHERE id = ?',
        [username, hashedPassword, role, userId]);
    } else {
      db.run('UPDATE users SET username = ?, role = ? WHERE id = ?',
        [username, role, userId]);
    }
    saveDb();

    res.json({ message: '用户更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user (admin only)
router.delete('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const db = await getDb();

    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: '不能删除当前登录的用户' });
    }

    db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
    saveDb();

    res.json({ message: '用户删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
