const express = require('express');
const prisma = require('../lib/prisma');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { MATERIAL_REFERENCE, findMaterial, calculateMixRatio, getSuggestion } = require('../utils/compostMaterials');

const router = express.Router();

const VALID_BIN_CATEGORIES = ['高溫箱', '低溫箱'];

async function assertValidBin(binType) {
  const bin = await prisma.compostBin.findUnique({ where: { name: binType } });
  if (!bin) {
    throw new ApiError(400, 'INVALID_BIN_TYPE', `找不到名為「${binType}」的箱子,請先在箱子清單中新增`);
  }
}

// GET /api/compost/bins — 箱子清單。
// 【設計說明】預設的高溫箱／低溫箱只在 `npm run seed` 時建立一次,這裡不會
// 自動補齊。如果使用者把箱子全部刪光,清單就會是空的,畫面上會顯示空狀態,
// 不會又跳出兩個預設箱子——這是刻意的行為,尊重使用者「就是要清空」的操作。
router.get(
  '/bins',
  asyncHandler(async (req, res) => {
    const bins = await prisma.compostBin.findMany({ orderBy: { createdAt: 'asc' } });
    res.json(bins);
  })
);

// POST /api/compost/bins — 新增一個箱子。name 是使用者自訂的箱子名稱(如「三號箱」),
// type 是分類,必須是「高溫箱」或「低溫箱」其中一種,兩者是分開的欄位。
router.post(
  '/bins',
  asyncHandler(async (req, res) => {
    const { name, type } = req.body;
    if (!name || !name.trim()) throw new ApiError(400, 'MISSING_FIELDS', '箱子名稱為必填');
    if (!VALID_BIN_CATEGORIES.includes(type)) {
      throw new ApiError(400, 'INVALID_BIN_CATEGORY', `箱子類型必須為: ${VALID_BIN_CATEGORIES.join('/')}`);
    }

    const existing = await prisma.compostBin.findUnique({ where: { name: name.trim() } });
    if (existing) throw new ApiError(409, 'BIN_ALREADY_EXISTS', `已經有名為「${name.trim()}」的箱子`);

    const bin = await prisma.compostBin.create({ data: { name: name.trim(), type } });
    res.status(201).json(bin);
  })
);

// DELETE /api/compost/bins/:binId — 刪除一個箱子,連同該箱子名下所有加料紀錄一併刪除
// (對應本系統一貫「刪除不做限制」的設計原則,不特別攔阻)
router.delete(
  '/bins/:binId',
  asyncHandler(async (req, res) => {
    const bin = await prisma.compostBin.findUnique({ where: { id: req.params.binId } });
    if (!bin) throw new ApiError(404, 'BIN_NOT_FOUND', '找不到此箱子');

    await prisma.$transaction([
      prisma.compostEntry.deleteMany({ where: { binType: bin.name } }),
      prisma.compostBin.delete({ where: { id: req.params.binId } }),
    ]);
    res.status(204).send();
  })
);

// GET /api/compost/materials — 材料參照表,供前端下拉選單使用
router.get(
  '/materials',
  asyncHandler(async (req, res) => {
    res.json(MATERIAL_REFERENCE);
  })
);

// GET /api/compost/:binType/summary
// 回傳:目前這批(最後一次 reset 之後)的加料時間軸、目前整體碳氮比、調整建議
router.get(
  '/:binType/summary',
  asyncHandler(async (req, res) => {
    const { binType } = req.params;
    await assertValidBin(binType);

    // 找出最後一次 reset 的時間點(若有),只計算這之後的加料紀錄
    const lastReset = await prisma.compostEntry.findFirst({
      where: { binType, entryType: 'reset' },
      orderBy: { createdAt: 'desc' },
    });

    const currentBatchEntries = await prisma.compostEntry.findMany({
      where: {
        binType,
        entryType: 'material',
        ...(lastReset ? { createdAt: { gt: lastReset.createdAt } } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    // 計算每筆加料紀錄之後「累積至當下」的比例,讓時間軸可以顯示比例的變化過程
    const timeline = [];
    const accumulated = [];
    for (const entry of currentBatchEntries) {
      accumulated.push({ amountKg: entry.amountKg, cnRatio: entry.cnRatio });
      timeline.push({
        ...entry,
        ratioAfterThisEntry: calculateMixRatio(accumulated),
      });
    }

    const currentRatio = calculateMixRatio(currentBatchEntries.map((e) => ({ amountKg: e.amountKg, cnRatio: e.cnRatio })));
    const totalWeightKg = currentBatchEntries.reduce((sum, e) => sum + (e.amountKg || 0), 0);

    res.json({
      binType,
      batchStartedAt: lastReset ? lastReset.createdAt : (currentBatchEntries[0] ? currentBatchEntries[0].createdAt : null),
      totalWeightKg,
      currentRatio,
      suggestion: getSuggestion(currentRatio),
      timeline,
    });
  })
);

// POST /api/compost/:binType/entries
// body: { materialName, amountKg, cnRatio?(僅自訂材料需要), note? }
router.post(
  '/:binType/entries',
  asyncHandler(async (req, res) => {
    const { binType } = req.params;
    await assertValidBin(binType);

    const { materialName, amountKg, cnRatio, note } = req.body;

    if (!materialName) throw new ApiError(400, 'MISSING_FIELDS', '材料名稱為必填');
    const amount = Number(amountKg);
    if (!amount || amount <= 0) throw new ApiError(400, 'INVALID_AMOUNT', '份量(公斤)須為正數');

    // 已知材料:一律採用參照表的碳氮比,即使前端傳了 cnRatio 也不採用,
    // 確保同一種材料的比例來源一致,不會因為前端沒更新而跟後端參照表兜不起來。
    const known = findMaterial(materialName);
    let resolvedRatio;
    if (known) {
      resolvedRatio = known.cnRatio;
    } else {
      resolvedRatio = Number(cnRatio);
      if (!resolvedRatio || resolvedRatio <= 0) {
        throw new ApiError(
          400,
          'MISSING_CN_RATIO',
          `「${materialName}」不在常見材料參照表中,請提供估計的碳氮比(cnRatio)`
        );
      }
    }

    const entry = await prisma.compostEntry.create({
      data: {
        binType,
        entryType: 'material',
        materialName,
        amountKg: amount,
        cnRatio: resolvedRatio,
        note,
      },
    });

    res.status(201).json(entry);
  })
);

// POST /api/compost/:binType/reset
// 開始新一批:插入一筆 reset 標記,之前的紀錄仍保留(可回頭查閱),
// 但目前比例計算只會採計這個時間點之後的加料紀錄。
router.post(
  '/:binType/reset',
  asyncHandler(async (req, res) => {
    const { binType } = req.params;
    await assertValidBin(binType);
    const { note } = req.body;

    const entry = await prisma.compostEntry.create({
      data: { binType, entryType: 'reset', note },
    });

    res.status(201).json(entry);
  })
);

// GET /api/compost/:binType/history
// 完整歷史紀錄(不受目前批次限制),供想回顧所有紀錄時使用
router.get(
  '/:binType/history',
  asyncHandler(async (req, res) => {
    const { binType } = req.params;
    await assertValidBin(binType);

    const entries = await prisma.compostEntry.findMany({
      where: { binType },
      orderBy: { createdAt: 'desc' },
    });
    res.json(entries);
  })
);

// DELETE /api/compost/entries/:entryId — 刪除誤按的單筆紀錄
router.delete(
  '/entries/:entryId',
  asyncHandler(async (req, res) => {
    const entry = await prisma.compostEntry.findUnique({ where: { id: req.params.entryId } });
    if (!entry) throw new ApiError(404, 'ENTRY_NOT_FOUND', '找不到此紀錄');
    await prisma.compostEntry.delete({ where: { id: req.params.entryId } });
    res.status(204).send();
  })
);

module.exports = router;
