const prisma = require('../lib/prisma');

// 「存活」狀態集合：死亡／出售／送人／已採收排除在總市值計算之外，但資料仍保留於資料庫
const NON_HOLDING_STATUSES = ['死亡', '出售', '送人', '已採收'];

/**
 * 整批總市值統計
 * 對應規格書 5.5：
 *   holding_count      = 目前持有株數
 *   holding_cost       = 持有成本加總
 *   total_market_value = 目前市值加總
 *   unrealized_gain    = total_market_value - holding_cost
 */
async function getValuationSummary() {
  const holdingPlants = await prisma.plant.findMany({
    where: { status: { notIn: NON_HOLDING_STATUSES } },
    select: { purchasePrice: true, currentPrice: true },
  });

  const holdingCount = holdingPlants.length;
  const holdingCost = holdingPlants.reduce((sum, p) => sum + (p.purchasePrice || 0), 0);
  const totalMarketValue = holdingPlants.reduce((sum, p) => sum + (p.currentPrice || 0), 0);
  const unrealizedGain = totalMarketValue - holdingCost;

  return {
    holdingCount,
    holdingCost,
    totalMarketValue,
    unrealizedGain,
  };
}

module.exports = { getValuationSummary, NON_HOLDING_STATUSES };
