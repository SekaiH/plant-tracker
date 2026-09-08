// 統一的 API 錯誤格式，方便前端（成員 A）依 status code 與 code 判斷錯誤類型
class ApiError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code; // 給前端判斷用的錯誤代碼，如 'PLANT_NOT_FOUND'
  }
}

module.exports = ApiError;
