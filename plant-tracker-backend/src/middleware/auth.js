const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');

/**
 * 單一使用者情境的簡易 JWT 驗證。
 * 前端（成員 A）需於登入後將 token 帶在 Authorization: Bearer <token> header。
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next(new ApiError(401, 'UNAUTHORIZED', '缺少登入憑證，請先登入'));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    next(new ApiError(401, 'INVALID_TOKEN', '登入憑證無效或已過期，請重新登入'));
  }
}

module.exports = requireAuth;
