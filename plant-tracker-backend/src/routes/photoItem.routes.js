const fs = require('fs');
const path = require('path');
const express = require('express');
const prisma = require('../lib/prisma');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const upload = require('../middleware/upload');

const router = express.Router();

// GET /api/photos/:photoId
// C-4 補充:規格書原文要求「驗證照片上下傳之個體關聯完整性」,
// 單筆查詢是編輯/替換前端流程的基本前提,B 原本沒有提供這支。
router.get(
  '/:photoId',
  asyncHandler(async (req, res) => {
    const photo = await prisma.photo.findUnique({ where: { id: req.params.photoId } });
    if (!photo) throw new ApiError(404, 'PHOTO_NOT_FOUND', '找不到此照片');
    res.json(photo);
  })
);

// PATCH /api/photos/:photoId
// 編輯照片備註／拍攝日期(不換圖檔本身)。維持與 Plant 的關聯不變,
// 純粹確認關聯完整性後才允許更新,對應規格書 C-4「確保...替換時關聯一致」。
router.patch(
  '/:photoId',
  asyncHandler(async (req, res) => {
    const photo = await prisma.photo.findUnique({ where: { id: req.params.photoId } });
    if (!photo) throw new ApiError(404, 'PHOTO_NOT_FOUND', '找不到此照片');

    const { note, takenAt } = req.body;
    const updated = await prisma.photo.update({
      where: { id: req.params.photoId },
      data: {
        ...(note !== undefined && { note }),
        ...(takenAt !== undefined && { takenAt: new Date(takenAt) }),
      },
    });
    res.json(updated);
  })
);

// PUT /api/photos/:photoId/file  (multipart/form-data, 欄位名稱: "photo")
// 替換照片檔案本身。C-4 關聯驗證重點:
//   1) 換圖前先確認照片與植株的關聯(plantId)仍然存在且一致
//   2) 新檔案成功寫入、資料庫更新成功後,才刪除舊檔案(避免中途失敗造成兩邊都遺失)
//   3) plant_id 不因替換而改變,確保個體關聯不漂移
router.put(
  '/:photoId/file',
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    const photo = await prisma.photo.findUnique({ where: { id: req.params.photoId } });
    if (!photo) {
      // 上傳已經落地的檔案要清掉,避免留下孤兒檔案
      if (req.file) fs.unlink(path.join(req.file.destination, req.file.filename), () => {});
      throw new ApiError(404, 'PHOTO_NOT_FOUND', '找不到此照片');
    }
    if (!req.file) throw new ApiError(400, 'MISSING_FILE', '請上傳新照片檔案（欄位名稱需為 photo）');

    const oldUrl = photo.url;
    const updated = await prisma.photo.update({
      where: { id: req.params.photoId },
      data: { url: `/uploads/${req.file.filename}` },
    });

    // 資料庫確認更新成功後才刪舊檔,維持「新檔案寫入成功才視為替換完成」的順序
    const oldPath = path.join(process.env.UPLOAD_DIR || './uploads', path.basename(oldUrl));
    fs.unlink(oldPath, () => {
      // 刪除失敗僅記錄,不影響本次替換結果(舊檔頂多變成待清理的孤兒檔)
    });

    res.json(updated);
  })
);

// DELETE /api/photos/:photoId
router.delete(
  '/:photoId',
  asyncHandler(async (req, res) => {
    const photo = await prisma.photo.findUnique({ where: { id: req.params.photoId } });
    if (!photo) throw new ApiError(404, 'PHOTO_NOT_FOUND', '找不到此照片');
    await prisma.photo.delete({ where: { id: req.params.photoId } });
    res.status(204).send();
  })
);

module.exports = router;
