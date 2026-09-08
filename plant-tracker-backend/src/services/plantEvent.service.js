const prisma = require('../lib/prisma');

/**
 * 生命歷程事件寫入服務
 * 對應《植況簿_成員B_後端開發完整規格書》5.7 節：
 * B 僅負責「寫入」，時間軸的呈現分組／篩選／互動視覺化由成員 C 負責。
 *
 * eventType 可用值：買入 / 拍照 / 移動 / 繁殖 / 市價更新 / 出售 / 死亡 / 送人
 */
async function writeEvent({ plantId, eventType, refTable = null, refId = null, content = null, eventDate = null }) {
  return prisma.plantEvent.create({
    data: {
      plantId,
      eventType,
      refTable,
      refId,
      content: content ? JSON.stringify(content) : null,
      eventDate: eventDate ? new Date(eventDate) : new Date(),
    },
  });
}

module.exports = { writeEvent };
