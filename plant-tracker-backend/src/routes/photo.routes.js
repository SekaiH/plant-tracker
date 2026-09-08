const express = require('express');
const prisma = require('../lib/prisma');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const upload = require('../middleware/upload');
const { writeEvent } = require('../services/plantEvent.service');

const router = express.Router({ mergeParams: true });

// GET /api/plants/:id/photos
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const photos = await prisma.photo.findMany({
      where: { plantId: req.params.id },
      orderBy: { takenAt: 'asc' },
    });
    res.json(photos);
  })
);

// POST /api/plants/:id/photos  (multipart/form-data, field name: "photo")
router.post(
  '/',
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    const plantId = req.params.id;
    const plant = await prisma.plant.findUnique({ where: { id: plantId } });
    if (!plant) throw new ApiError(404, 'PLANT_NOT_FOUND', '找不到此植物');
    if (!req.file) throw new ApiError(400, 'MISSING_FILE', '請上傳照片檔案（欄位名稱需為 photo）');

    const { takenAt, note } = req.body;

    const photo = await prisma.photo.create({
      data: {
        plantId,
        url: `/uploads/${req.file.filename}`,
        takenAt: takenAt ? new Date(takenAt) : new Date(),
        statusSnapshot: plant.status,
        locationSnapshot: plant.locationId,
        note,
      },
    });

    await writeEvent({
      plantId,
      eventType: '拍照',
      refTable: 'Photo',
      refId: photo.id,
      content: { url: photo.url },
      eventDate: photo.takenAt,
    });

    res.status(201).json(photo);
  })
);

module.exports = router;
