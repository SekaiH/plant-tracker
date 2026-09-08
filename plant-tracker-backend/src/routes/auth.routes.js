const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const router = express.Router();

// POST /api/auth/login
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      throw new ApiError(400, 'MISSING_FIELDS', '請輸入帳號與密碼');
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', '帳號或密碼錯誤');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', '帳號或密碼錯誤');
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({ token, user: { id: user.id, username: user.username } });
  })
);

// POST /api/auth/logout
// 單一使用者、JWT 為無狀態設計，此端點僅供前端呼叫作語意上的「登出」，
// 實際登出行為（清除 token）由前端自行從儲存中移除即可。
router.post('/logout', (req, res) => {
  res.json({ message: '已登出' });
});

module.exports = router;
