const express = require('express');
const prisma = require('../lib/prisma');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { aggregateTimeline } = require('../services/timeline.service');

const router = express.Router({ mergeParams: true });

// GET /api/plants/:id/timeline?type=&from=&to=&group=&raw=
//
// 對應規格書 5.7 / B README 第 4 節分工:
// B 負責寫入原始事件、依日期排序回傳；
// 分組、篩選、統計摘要由成員 C 的 timeline.service.js 負責(本次由 C 接上)。
//
// 【給前端 A 的相容性說明】
// - 不帶任何 query 參數:回傳 { summary, timeline: [...排序後的事件] }
// - ?group=true:timeline 改為 { 事件類型: [事件陣列] } 的分組物件
// - ?type=拍照:只回傳指定事件類型
// - ?from=2026-08-01&to=2026-08-31:日期範圍篩選(含頭尾)
// - ?raw=true:回到 B 原本的純陣列格式(過渡期相容,若 A 已對接舊格式可先用這個)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const plantId = req.params.id;
    const { type, from, to, group, raw } = req.query;

    const plant = await prisma.plant.findUnique({ where: { id: plantId } });
    if (!plant) throw new ApiError(404, 'PLANT_NOT_FOUND', '找不到此植物');

    const events = await prisma.plantEvent.findMany({
      where: { plantId },
      orderBy: { eventDate: 'asc' },
    });

    const parsed = events.map((e) => ({
      ...e,
      content: e.content ? JSON.parse(e.content) : null,
    }));

    if (raw === 'true') {
      return res.json(parsed);
    }

    let result;
    try {
      result = aggregateTimeline(parsed, {
        eventType: type || null,
        from: from || null,
        to: to || null,
        group: group === 'true',
      });
    } catch (err) {
      if (err.code === 'INVALID_EVENT_TYPE') {
        throw new ApiError(400, 'INVALID_EVENT_TYPE', err.message);
      }
      throw err;
    }

    res.json(result);
  })
);

module.exports = router;
