const ApiError = require('../utils/ApiError');

/**
 * 統一錯誤回應格式：
 * { "error": { "code": "PLANT_NOT_FOUND", "message": "..." } }
 *
 * 給前端（成員 A）的建議：優先判斷 error.code，訊息文字（message）僅供顯示用，
 * 未來若要做多語系，替換 message 不影響前端邏輯判斷。
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
  }

  // Multer 上傳錯誤（對應驗收 13.2：格式限制、檔案過大）
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: { code: 'FILE_TOO_LARGE', message: '檔案過大，請壓縮後再上傳（上限 15MB）' },
      });
    }
    return res.status(400).json({
      error: { code: 'UPLOAD_ERROR', message: `檔案上傳失敗：${err.message}` },
    });
  }
  if (err.message === 'UNSUPPORTED_FILE_TYPE') {
    return res.status(400).json({
      error: { code: 'UNSUPPORTED_FILE_TYPE', message: '不支援的檔案格式，僅接受 JPG／PNG／WEBP／GIF 圖片' },
    });
  }

  // Prisma 已知錯誤代碼（如唯一鍵衝突 P2002、找不到記錄 P2025）
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: { code: 'DUPLICATE_ENTRY', message: '資料重複，違反唯一性限制' },
    });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: '找不到對應的資料' },
    });
  }

  console.error('[Unhandled Error]', err); // eslint-disable-line no-console
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: '伺服器發生未預期的錯誤' },
  });
}

module.exports = errorHandler;
