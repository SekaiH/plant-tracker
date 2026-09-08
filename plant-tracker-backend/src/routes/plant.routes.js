const express = require('express');
const prisma = require('../lib/prisma');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const generateCode = require('../utils/generateCode');
const { writeEvent } = require('../services/plantEvent.service');

const router = express.Router();

const VALID_STATUSES = ['幼苗', '成長中', '成株', '狀況不佳', '死亡', '出售', '送人', '已採收'];
const TERMINAL_STATUSES_REQUIRING_SALE = ['出售'];

// GET /api/plants?status=&location_id=&search=&page=&limit=
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, location_id: locationId, search, page = '1', limit = '20' } = req.query;

    const where = {};
    if (status) where.status = status;
    if (locationId) where.locationId = locationId;
    if (search) {
      // 搜尋涵蓋名稱、品種、編號、分類、備註——備註欄位常存放賣家、
      // 親本、規格等重要資訊(尤其批次匯入的資料),只搜前三個欄位常常搜不到。
      where.OR = [
        { name: { contains: search } },
        { variety: { contains: search } },
        { code: { contains: search } },
        { category: { contains: search } },
        { note: { contains: search } },
      ];
    }

    // 上限從 100 提高到 1000。原本三區分類(種植中/已採收/已離庫)是在前端
    // 對「單一頁」的結果做分類,資料量一大(超過一頁)就會出現死亡/出售的
    // 植株只出現在某幾頁、其他頁看不到的錯亂現象。改成一次把符合條件的
    // 全部植株抓回來,前端才能對「完整結果」正確分類,不會因為跨頁斷斷續續。
    const take = Math.min(parseInt(limit, 10) || 20, 1000);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

    const [items, total] = await Promise.all([
      prisma.plant.findMany({
        where,
        include: {
          location: true,
          // 只取最新一張照片當卡片封面用(C 補充:避免前端對每一株
          // 額外呼叫 GET /photos 造成 N+1 請求,列表這裡一次查詢就帶回)
          photos: { orderBy: { takenAt: 'desc' }, take: 1 },
          // 澆水計數與最近一次澆水時間,同理一次查詢帶回避免 N+1
          waterings: { orderBy: { wateredAt: 'desc' }, take: 1 },
          _count: { select: { waterings: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.plant.count({ where }),
    ]);

    res.json({
      items,
      pagination: { page: Number(page), limit: take, total, totalPages: Math.ceil(total / take) },
    });
  })
);

// GET /api/plants/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const plant = await prisma.plant.findUnique({
      where: { id: req.params.id },
      include: { location: true, parent: true, sale: true },
    });
    if (!plant) throw new ApiError(404, 'PLANT_NOT_FOUND', '找不到此植物');
    res.json(plant);
  })
);

// POST /api/plants
// 一般新增（無購買紀錄的情境，如朋友贈送）。若是購買情境，建議走 POST /api/purchases（會自動建立 Plant + Purchase）。
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, variety, category, speciesType, locationId, status, purchasePrice, currentPrice, note } = req.body;

    if (!name) throw new ApiError(400, 'MISSING_FIELDS', '植物名稱為必填');
    if (status && !VALID_STATUSES.includes(status)) {
      throw new ApiError(400, 'INVALID_STATUS', `狀態必須為: ${VALID_STATUSES.join('/')}`);
    }

    const code = await generateCode();

    const plant = await prisma.plant.create({
      data: {
        code,
        name,
        variety,
        category,
        speciesType,
        locationId: locationId || null,
        status: status || '幼苗',
        purchasePrice: purchasePrice ?? 0,
        currentPrice: currentPrice ?? purchasePrice ?? 0,
        note,
      },
    });

    res.status(201).json(plant);
  })
);

// PUT /api/plants/:id
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const existing = await prisma.plant.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'PLANT_NOT_FOUND', '找不到此植物');

    const { name, variety, category, speciesType, locationId, note } = req.body;

    const updated = await prisma.plant.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(variety !== undefined && { variety }),
        ...(category !== undefined && { category }),
        ...(speciesType !== undefined && { speciesType }),
        ...(locationId !== undefined && { locationId }),
        ...(note !== undefined && { note }),
      },
    });

    res.json(updated);
  })
);

// PATCH /api/plants/:id/status
// 狀態切換，對應規格書 5.1 狀態機。死亡／出售／送人為特殊分支，出售會被導向專用邏輯。
// 「已採收」需要填寫採收日期（harvestDate），比照死亡日期（deathDate）的處理方式。
router.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, deathDate, harvestDate } = req.body;

    if (!status || !VALID_STATUSES.includes(status)) {
      throw new ApiError(400, 'INVALID_STATUS', `狀態必須為: ${VALID_STATUSES.join('/')}`);
    }
    if (TERMINAL_STATUSES_REQUIRING_SALE.includes(status)) {
      throw new ApiError(
        400,
        'USE_SALE_ENDPOINT',
        '設定為「出售」狀態請改用 POST /api/plants/:id/sale，系統會自動計算損益並同步狀態'
      );
    }
    if (status === '已採收' && !harvestDate) {
      throw new ApiError(400, 'MISSING_FIELDS', '設定為「已採收」時，採收日期（harvestDate）為必填');
    }

    const existing = await prisma.plant.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'PLANT_NOT_FOUND', '找不到此植物');

    const updated = await prisma.plant.update({
      where: { id },
      data: {
        status,
        deathDate: status === '死亡' ? new Date(deathDate || Date.now()) : existing.deathDate,
        harvestDate: status === '已採收' ? new Date(harvestDate) : existing.harvestDate,
      },
    });

    if (status === '死亡' || status === '送人' || status === '已採收') {
      await writeEvent({
        plantId: id,
        eventType: status === '已採收' ? '採收' : status,
        refTable: 'Plant',
        refId: id,
        content: { from: existing.status, to: status },
        eventDate: status === '已採收' ? new Date(harvestDate) : undefined,
      });
    }

    res.json(updated);
  })
);

// DELETE /api/plants/:id
// 【本次需求變更】不再做刪除防呆檢查。刪除一律直接執行，交由資料庫層級的
// onDelete 規則（見 schema.prisma）自動處理關聯：
//   - 子代（parentId 指向此植株的其他 Plant）：不會被刪除，而是 parentId
//     自動清空（onDelete: SetNull）。子代個體本身完整保留，只是親緣關係消失。
//   - 該植株「自己的」附屬記錄：照片、購買、市價歷史、移動、出售、
//     繁殖事件（as 母株）、生命歷程事件、澆水紀錄 —— 這些屬於被刪除植株
//     本身的資料，會一併刪除（onDelete: Cascade）。
// 這是刻意的設計選擇：使用者可能大量整理資料，不希望每次刪除都被攔下來
// 要求二次確認或處理關聯；但子代是獨立的植物個體，刪除母株不應該波及子代
// 存在與否。舊版本的關聯完整性檢查（HAS_CHILDREN 等）已移除。
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const existing = await prisma.plant.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'PLANT_NOT_FOUND', '找不到此植物');

    await prisma.plant.delete({ where: { id } });

    res.status(204).send();
  })
);

// GET /api/plants/:id/offspring
router.get(
  '/:id/offspring',
  asyncHandler(async (req, res) => {
    const offspring = await prisma.plant.findMany({ where: { parentId: req.params.id } });
    res.json(offspring);
  })
);

// GET /api/plants/:id/parent
router.get(
  '/:id/parent',
  asyncHandler(async (req, res) => {
    const plant = await prisma.plant.findUnique({
      where: { id: req.params.id },
      include: { parent: true },
    });
    if (!plant) throw new ApiError(404, 'PLANT_NOT_FOUND', '找不到此植物');
    res.json(plant.parent || null);
  })
);

module.exports = router;
