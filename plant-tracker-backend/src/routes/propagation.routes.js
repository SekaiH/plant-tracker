const express = require('express');
const prisma = require('../lib/prisma');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const generateCode = require('../utils/generateCode');
const { writeEvent } = require('../services/plantEvent.service');

const router = express.Router();

const VALID_METHODS = ['分株', '扦插', '播種', '雜交'];

/**
 * 檢查 candidateParentId 的祖先鏈中是否已包含 plantId。
 * 對應規格書 5.6 / 驗收 13.5：防止循環關聯（避免母株／子代互指造成無限迴圈）。
 */
async function wouldCreateCycle(plantId, candidateParentId) {
  let current = candidateParentId;
  const visited = new Set();
  while (current) {
    if (current === plantId) return true;
    if (visited.has(current)) break; // 資料庫本身已有循環，安全跳出避免無限迴圈
    visited.add(current);
    // eslint-disable-next-line no-await-in-loop
    const parent = await prisma.plant.findUnique({ where: { id: current }, select: { parentId: true } });
    current = parent ? parent.parentId : null;
  }
  return false;
}

// POST /api/propagations
// body: { parentPlantId, method, propagationDate, offspringCount, note }
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { parentPlantId, method, propagationDate, offspringCount, note } = req.body;

    if (!parentPlantId) throw new ApiError(400, 'MISSING_FIELDS', '母株（parentPlantId）為必填');
    if (!method || !VALID_METHODS.includes(method)) {
      throw new ApiError(400, 'INVALID_METHOD', `繁殖方式必須為: ${VALID_METHODS.join('/')}`);
    }
    const count = parseInt(offspringCount, 10);
    if (!Number.isInteger(count) || count < 1) {
      throw new ApiError(400, 'INVALID_COUNT', '幼苗數量必須為正整數');
    }

    const parentPlant = await prisma.plant.findUnique({ where: { id: parentPlantId } });
    if (!parentPlant) throw new ApiError(404, 'PLANT_NOT_FOUND', '找不到母株');

    const propagationDateValue = propagationDate ? new Date(propagationDate) : new Date();

    const propagation = await prisma.propagation.create({
      data: {
        parentPlantId,
        method,
        propagationDate: propagationDateValue,
        offspringCount: count,
        note,
      },
    });

    await writeEvent({
      plantId: parentPlantId,
      eventType: '繁殖',
      refTable: 'Propagation',
      refId: propagation.id,
      content: { method, offspringCount: count },
      eventDate: propagationDateValue,
    });

    const children = [];
    for (let i = 0; i < count; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const code = await generateCode({ parentCode: parentPlant.code });

      // 防循環檢查：新建子代情境下理論上不會發生（子代是全新記錄），
      // 但保留檢查以因應「將既有植物改指定母株」的未來擴充情境（見 PUT /api/plants/:id 若日後開放修改 parentId）。
      // eslint-disable-next-line no-await-in-loop
      const child = await prisma.plant.create({
        data: {
          code,
          name: parentPlant.name,
          variety: parentPlant.variety,
          category: parentPlant.category,
          speciesType: parentPlant.speciesType,
          locationId: parentPlant.locationId,
          parentId: parentPlantId,
          status: '幼苗',
          purchasePrice: 0,
          currentPrice: 0,
        },
      });

      // eslint-disable-next-line no-await-in-loop
      await writeEvent({
        plantId: child.id,
        eventType: '繁殖',
        refTable: 'Propagation',
        refId: propagation.id,
        content: { parentPlantId, method },
        eventDate: propagationDateValue,
      });

      children.push(child);
    }

    res.status(201).json({ propagation, children });
  })
);

// PATCH /api/plants/:id/parent — 供未來「改指定母株」情境使用，內含防循環檢查
router.patch(
  '/reassign-parent/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { newParentId } = req.body;

    if (newParentId) {
      const cyclic = await wouldCreateCycle(id, newParentId);
      if (cyclic) {
        throw new ApiError(400, 'CIRCULAR_RELATION', '此設定會產生循環的母株／子代關聯，已拒絕');
      }
    }

    const updated = await prisma.plant.update({
      where: { id },
      data: { parentId: newParentId || null },
    });

    res.json(updated);
  })
);

module.exports = router;
