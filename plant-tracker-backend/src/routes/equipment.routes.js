const express = require('express');
const prisma = require('../lib/prisma');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const router = express.Router();

// GET /api/equipment — 完整清單(依建立時間排序)+ 總花費
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await prisma.equipment.findMany({ orderBy: { createdAt: 'asc' } });
    const totalCost = items.reduce((sum, item) => sum + (item.price || 0), 0);
    res.json({ items, totalCost });
  })
);

// POST /api/equipment — 新增一筆工具設備
// body: { name, spec?, price, source?, note? }
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, spec, price, source, note } = req.body;

    if (!name || !name.trim()) throw new ApiError(400, 'MISSING_FIELDS', '項目名稱為必填');
    const priceValue = Number(price);
    if (Number.isNaN(priceValue) || priceValue < 0) throw new ApiError(400, 'INVALID_PRICE', '價格須為不小於 0 的數字');

    const item = await prisma.equipment.create({
      data: { name: name.trim(), spec: spec || null, price: priceValue, source: source || null, note: note || null },
    });
    res.status(201).json(item);
  })
);

// PUT /api/equipment/:id — 編輯一筆
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.equipment.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'EQUIPMENT_NOT_FOUND', '找不到此項目');

    const { name, spec, price, source, note } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (spec !== undefined) data.spec = spec;
    if (price !== undefined) {
      const priceValue = Number(price);
      if (Number.isNaN(priceValue) || priceValue < 0) throw new ApiError(400, 'INVALID_PRICE', '價格須為不小於 0 的數字');
      data.price = priceValue;
    }
    if (source !== undefined) data.source = source;
    if (note !== undefined) data.note = note;

    const updated = await prisma.equipment.update({ where: { id: req.params.id }, data });
    res.json(updated);
  })
);

// DELETE /api/equipment/:id — 刪除一筆(不做關聯限制,符合本系統一貫設計)
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.equipment.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'EQUIPMENT_NOT_FOUND', '找不到此項目');
    await prisma.equipment.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

module.exports = router;
