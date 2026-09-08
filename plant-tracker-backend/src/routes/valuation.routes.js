const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { getValuationSummary } = require('../services/valuation.service');

const router = express.Router();

// GET /api/valuation/summary
// 對應規格書 4.4 與 5.5：整批市值統計
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const summary = await getValuationSummary();
    res.json(summary);
  })
);

module.exports = router;
