const express = require('express');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../lib/prisma');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const generateCode = require('../utils/generateCode');
const { writeEvent } = require('../services/plantEvent.service');

const router = express.Router();

// POST /api/purchases
// 對應規格書 5.2：批次購買建立多株植物。
// body: { name, variety, category, locationId, quantity, unitPrice, seller, purchaseLocation, purchaseDate, quality, note }
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const {
      name,
      variety,
      category,
      speciesType,
      locationId,
      quantity = 1,
      unitPrice,
      seller,
      purchaseLocation,
      purchaseDate,
      quality,
      photoUrl,
      note,
    } = req.body;

    if (!name) throw new ApiError(400, 'MISSING_FIELDS', '植物名稱為必填');
    if (unitPrice === undefined || unitPrice === null) {
      throw new ApiError(400, 'MISSING_FIELDS', '單價（unitPrice）為必填');
    }
    if (Number(unitPrice) < 0) {
      throw new ApiError(400, 'INVALID_AMOUNT', '單價不可為負數');
    }
    const qty = parseInt(quantity, 10);
    if (!Number.isInteger(qty) || qty < 1) {
      throw new ApiError(400, 'INVALID_QUANTITY', '購買數量必須為正整數');
    }

    const batchId = uuidv4();
    const purchaseDateValue = purchaseDate ? new Date(purchaseDate) : new Date();

    const results = [];
    // 依規格書 5.2：每株各自建立 Plant + Purchase 記錄，逐一寫入（非一次性 createMany），
    // 確保每株各自取得唯一的 code 且事件寫入邏輯正確對應到各自的 plantId。
    for (let i = 0; i < qty; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const code = await generateCode();
      // eslint-disable-next-line no-await-in-loop
      const plant = await prisma.plant.create({
        data: {
          code,
          name,
          variety,
          category,
          speciesType,
          locationId: locationId || null,
          status: '幼苗',
          purchasePrice: Number(unitPrice),
          currentPrice: Number(unitPrice),
        },
      });

      // eslint-disable-next-line no-await-in-loop
      const purchase = await prisma.purchase.create({
        data: {
          plantId: plant.id,
          batchId,
          unitPrice: Number(unitPrice),
          quantity: 1, // 每株各自的購買記錄視為 1 株，整批總價僅用於畫面彙總顯示
          totalPrice: Number(unitPrice),
          seller,
          purchaseLocation,
          purchaseDate: purchaseDateValue,
          quality,
          photoUrl,
          note,
        },
      });

      // eslint-disable-next-line no-await-in-loop
      await writeEvent({
        plantId: plant.id,
        eventType: '買入',
        refTable: 'Purchase',
        refId: purchase.id,
        content: { unitPrice: Number(unitPrice), seller },
        eventDate: purchaseDateValue,
      });

      results.push({ plant, purchase });
    }

    res.status(201).json({
      batchId,
      quantity: qty,
      totalBatchPrice: Number(unitPrice) * qty,
      items: results,
    });
  })
);

// GET /api/purchases?group_by=name
// 對應規格書 5.3：跨賣家比價，標註最低價來源
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { plant_id: plantId, group_by: groupBy } = req.query;

    if (plantId) {
      const purchases = await prisma.purchase.findMany({
        where: { plantId },
        orderBy: { purchaseDate: 'desc' },
      });
      return res.json(purchases);
    }

    if (groupBy === 'name') {
      const purchases = await prisma.purchase.findMany({
        include: { plant: { select: { name: true } } },
      });

      const groups = {};
      purchases.forEach((p) => {
        const key = p.plant.name;
        if (!groups[key]) groups[key] = [];
        groups[key].push({
          purchaseId: p.id,
          seller: p.seller,
          unitPrice: p.unitPrice,
          quality: p.quality,
          purchaseDate: p.purchaseDate,
        });
      });

      const result = Object.entries(groups).map(([name, records]) => {
        const minRecord = records.reduce((min, r) => (r.unitPrice < min.unitPrice ? r : min), records[0]);
        return { name, records, minPriceSeller: minRecord.seller, minPrice: minRecord.unitPrice };
      });

      return res.json(result);
    }

    const purchases = await prisma.purchase.findMany({ orderBy: { purchaseDate: 'desc' } });
    res.json(purchases);
  })
);

module.exports = router;
