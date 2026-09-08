// 包裝 async route handler，將 Promise reject 自動導向 Express 的 error middleware
// 用法：router.get('/', asyncHandler(async (req, res) => { ... }))
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
