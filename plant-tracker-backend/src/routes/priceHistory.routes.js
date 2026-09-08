const express = require('express');
const prisma = require('../lib/prisma');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { writeEvent } = require('../services/plantEvent.service');

const router = express.Router({ mergeParams: true });

// GET /api/plants/:id/price-history
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const history = await prisma.priceHistory.findMany({
      where: { plantId: req.params.id },
      orderBy: { recordedAt: 'asc' },
    });
    res.json(history);
  })
);

// POST /api/plants/:id/price-history
// 新增市價紀錄（只新增不覆蓋），並同步更新 Plant.currentPrice（對應規格書「PriceHistory」表註解）
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const plantId = req.params.id;
    const { price, recordedAt, note } = req.body;

    if (price === undefined || price === null) {
      throw new ApiError(400, 'MISSING_FIELDS', '市價（price）為必填');
    }
    if (Number(price) < 0) {
      throw new ApiError(400, 'INVALID_AMOUNT', '市價不可為負數');
    }

    const plant = await prisma.plant.findUnique({ where: { id: plantId } });
    if (!plant) throw new ApiError(404, 'PLANT_NOT_FOUND', '找不到此植物');

    const recordedAtValue = recordedAt ? new Date(recordedAt) : new Date();
    const previousPrice = plant.currentPrice;

    const [record] = await prisma.$transaction([
      prisma.priceHistory.create({
        data: { plantId, price: Number(price), recordedAt: recordedAtValue, note },
      }),
      prisma.plant.update({
        where: { id: plantId },
        data: { currentPrice: Number(price) },
      }),
    ]);

    await writeEvent({
      plantId,
      eventType: '市價更新',
      refTable: 'PriceHistory',
      refId: record.id,
      content: { from: previousPrice, to: Number(price) },
      eventDate: recordedAtValue,
    });

    res.status(201).json(record);
  })
);

module.exports = router;
