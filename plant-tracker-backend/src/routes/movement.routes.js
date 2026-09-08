const express = require('express');
const prisma = require('../lib/prisma');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { writeEvent } = require('../services/plantEvent.service');

const router = express.Router({ mergeParams: true });

// GET /api/plants/:id/movements
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const movements = await prisma.movement.findMany({
      where: { plantId: req.params.id },
      include: { fromLocation: true, toLocation: true },
      orderBy: { movedAt: 'asc' },
    });
    res.json(movements);
  })
);

// POST /api/plants/:id/movements
// 建立移動紀錄，並自動更新 Plant.locationId（對應規格書 4.3）
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const plantId = req.params.id;
    const { toLocationId, movedAt, note } = req.body;

    if (!toLocationId) throw new ApiError(400, 'MISSING_FIELDS', '新位置（toLocationId）為必填');

    const plant = await prisma.plant.findUnique({ where: { id: plantId } });
    if (!plant) throw new ApiError(404, 'PLANT_NOT_FOUND', '找不到此植物');

    const toLocation = await prisma.location.findUnique({ where: { id: toLocationId } });
    if (!toLocation) throw new ApiError(404, 'LOCATION_NOT_FOUND', '找不到目標區域');

    const movement = await prisma.$transaction(async (tx) => {
      const created = await tx.movement.create({
        data: {
          plantId,
          fromLocationId: plant.locationId || null, // 首次建立時為 null，對應驗收 13.3
          toLocationId,
          movedAt: movedAt ? new Date(movedAt) : new Date(),
          note,
        },
      });

      await tx.plant.update({
        where: { id: plantId },
        data: { locationId: toLocationId },
      });

      return created;
    });

    await writeEvent({
      plantId,
      eventType: '移動',
      refTable: 'Movement',
      refId: movement.id,
      content: { fromLocationId: plant.locationId, toLocationId },
      eventDate: movement.movedAt,
    });

    res.status(201).json(movement);
  })
);

module.exports = router;
