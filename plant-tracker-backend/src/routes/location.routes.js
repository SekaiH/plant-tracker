const express = require('express');
const prisma = require('../lib/prisma');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const router = express.Router();

// GET /api/locations — 含各區域植物數量統計（對應規格書 4.3）
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const locations = await prisma.location.findMany({
      include: { _count: { select: { plants: true } } },
      orderBy: { name: 'asc' },
    });

    res.json(
      locations.map((loc) => ({
        id: loc.id,
        name: loc.name,
        createdAt: loc.createdAt,
        plantCount: loc._count.plants,
      }))
    );
  })
);

// POST /api/locations
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!name) throw new ApiError(400, 'MISSING_FIELDS', '區域名稱為必填');

    const location = await prisma.location.create({ data: { name } });
    res.status(201).json(location);
  })
);

module.exports = router;
