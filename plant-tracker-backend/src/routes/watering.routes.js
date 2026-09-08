const express = require('express');
const prisma = require('../lib/prisma');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { writeEvent } = require('../services/plantEvent.service');

const router = express.Router({ mergeParams: true });

// GET /api/plants/:id/waterings
// 回傳澆水歷史（依時間新到舊排序）與總次數，供卡片顯示「已澆水 N 次」使用
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const plantId = req.params.id;

    const plant = await prisma.plant.findUnique({ where: { id: plantId } });
    if (!plant) throw new ApiError(404, 'PLANT_NOT_FOUND', '找不到此植物');

    const [waterings, count] = await Promise.all([
      prisma.watering.findMany({
        where: { plantId },
        orderBy: { wateredAt: 'desc' },
      }),
      prisma.watering.count({ where: { plantId } }),
    ]);

    res.json({
      items: waterings,
      count,
      lastWateredAt: waterings.length > 0 ? waterings[0].wateredAt : null,
    });
  })
);

// POST /api/plants/:id/waterings
// 記錄一次澆水，並寫入生命歷程事件
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const plantId = req.params.id;
    const { wateredAt, note } = req.body;

    const plant = await prisma.plant.findUnique({ where: { id: plantId } });
    if (!plant) throw new ApiError(404, 'PLANT_NOT_FOUND', '找不到此植物');

    const wateredAtValue = wateredAt ? new Date(wateredAt) : new Date();

    const watering = await prisma.watering.create({
      data: { plantId, wateredAt: wateredAtValue, note },
    });

    await writeEvent({
      plantId,
      eventType: '澆水',
      refTable: 'Watering',
      refId: watering.id,
      content: { note: note || null },
      eventDate: wateredAtValue,
    });

    res.status(201).json(watering);
  })
);

// DELETE /api/waterings/:wateringId — 由 index.js 掛載於 /waterings 頂層路徑
// 提供刪除誤按的澆水紀錄用
const topRouter = express.Router();
topRouter.delete(
  '/:wateringId',
  asyncHandler(async (req, res) => {
    const watering = await prisma.watering.findUnique({ where: { id: req.params.wateringId } });
    if (!watering) throw new ApiError(404, 'WATERING_NOT_FOUND', '找不到此澆水紀錄');
    await prisma.watering.delete({ where: { id: req.params.wateringId } });
    res.status(204).send();
  })
);

module.exports = { nestedRouter: router, topRouter };
