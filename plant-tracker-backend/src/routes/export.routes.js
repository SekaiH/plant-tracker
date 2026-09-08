const express = require('express');
const prisma = require('../lib/prisma');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const router = express.Router();

function toCsv(rows) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [headers.join(',')];
  rows.forEach((row) => {
    lines.push(headers.map((h) => escape(row[h])).join(','));
  });
  return lines.join('\n');
}

// POST /api/export  body: { format: 'csv' | 'json' }
// 對應甲方文件 9.5 資料安全與備份：甲方對自己資料擁有完整所有權，可隨時匯出。
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { format = 'json' } = req.body;
    if (!['csv', 'json'].includes(format)) {
      throw new ApiError(400, 'INVALID_FORMAT', 'format 必須為 csv 或 json');
    }

    const plants = await prisma.plant.findMany({
      include: {
        location: { select: { name: true } },
        sale: true,
      },
      orderBy: { code: 'asc' },
    });

    const flatRows = plants.map((p) => ({
      code: p.code,
      name: p.name,
      variety: p.variety || '',
      status: p.status,
      location: p.location ? p.location.name : '',
      purchasePrice: p.purchasePrice,
      currentPrice: p.currentPrice,
      salePrice: p.sale ? p.sale.salePrice : '',
      realizedProfit: p.sale ? p.sale.realizedProfit : '',
      createdAt: p.createdAt.toISOString(),
    }));

    await prisma.exportLog.create({
      data: {
        format: format.toUpperCase(),
        recordCount: flatRows.length,
        operator: (req.user && req.user.username) || 'owner',
      },
    });

    if (format === 'json') {
      res.setHeader('Content-Disposition', 'attachment; filename="plants-export.json"');
      return res.json(flatRows);
    }

    const csv = toCsv(flatRows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="plants-export.csv"');
    return res.send(csv);
  })
);

module.exports = router;
