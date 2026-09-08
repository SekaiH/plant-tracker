const express = require('express');
const prisma = require('../lib/prisma');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { writeEvent } = require('../services/plantEvent.service');

// 這個路由檔同時提供：
//   POST /api/plants/:id/sale （掛載於 plant 巢狀路徑，mergeParams）
//   GET  /api/sales           （掛載於頂層路徑，見 routes/index.js 的第二次掛載）
const nestedRouter = express.Router({ mergeParams: true });
const topRouter = express.Router();

// POST /api/plants/:id/sale
// 對應規格書 5.4：cost_basis 快照 purchasePrice，realized_profit 自動計算，並同步 Plant.status = 出售
nestedRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const plantId = req.params.id;
    const { salePrice, saleDate, buyer, note } = req.body;

    if (salePrice === undefined || salePrice === null) {
      throw new ApiError(400, 'MISSING_FIELDS', '售價（salePrice）為必填');
    }

    const plant = await prisma.plant.findUnique({ where: { id: plantId } });
    if (!plant) throw new ApiError(404, 'PLANT_NOT_FOUND', '找不到此植物');

    const existingSale = await prisma.sale.findUnique({ where: { plantId } });
    if (existingSale) {
      throw new ApiError(409, 'ALREADY_SOLD', '此植物已有出售紀錄，一株植物僅能出售一次');
    }

    const costBasis = plant.purchasePrice || 0;
    const realizedProfit = Number(salePrice) - costBasis;
    const saleDateValue = saleDate ? new Date(saleDate) : new Date();

    const [sale] = await prisma.$transaction([
      prisma.sale.create({
        data: {
          plantId,
          salePrice: Number(salePrice),
          costBasis,
          realizedProfit,
          saleDate: saleDateValue,
          buyer,
          note,
        },
      }),
      prisma.plant.update({ where: { id: plantId }, data: { status: '出售' } }),
    ]);

    await writeEvent({
      plantId,
      eventType: '出售',
      refTable: 'Sale',
      refId: sale.id,
      content: { salePrice: Number(salePrice), costBasis, realizedProfit },
      eventDate: saleDateValue,
    });

    res.status(201).json(sale);
  })
);

// GET /api/sales?from=&to=
topRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { from, to } = req.query;
    const where = {};
    if (from || to) {
      where.saleDate = {};
      if (from) where.saleDate.gte = new Date(from);
      if (to) where.saleDate.lte = new Date(to);
    }

    const sales = await prisma.sale.findMany({
      where,
      include: { plant: { select: { name: true, code: true } } },
      orderBy: { saleDate: 'desc' },
    });

    const totalRealizedProfit = sales.reduce((sum, s) => sum + s.realizedProfit, 0);

    res.json({ items: sales, totalRealizedProfit });
  })
);

module.exports = { nestedRouter, topRouter };
