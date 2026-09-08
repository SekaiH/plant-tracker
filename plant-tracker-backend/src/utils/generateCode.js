const prisma = require('../lib/prisma');

/**
 * 產生新植物的個體編號。
 * - 一般新增（無母株）：依名稱字首＋流水號產生，如 A-001、A-002。
 * - 繁殖建立子代：以母株編號為前綴，如 A-001-01、A-001-02。
 *
 * 對應規格書 3.2 Plant.code 欄位：UNIQUE、系統自動產生。
 */
async function generateCode({ parentCode = null } = {}) {
  if (parentCode) {
    // 子代編號：母株編號-流水號（兩碼，超過99再往上長也沒關係）
    const siblingCount = await prisma.plant.count({
      where: { parent: { code: parentCode } },
    });
    const seq = String(siblingCount + 1).padStart(2, '0');
    return `${parentCode}-${seq}`;
  }

  // 一般新增：用固定前綴 P 加上全域流水號，確保不重複、不依賴植物名稱（名稱可能重複或含特殊字元）
  const total = await prisma.plant.count({ where: { parentId: null } });
  const seq = String(total + 1).padStart(3, '0');
  return `P-${seq}`;
}

module.exports = generateCode;
