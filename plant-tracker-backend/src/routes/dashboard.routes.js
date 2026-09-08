const express = require('express');
const prisma = require('../lib/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { getValuationSummary } = require('../services/valuation.service');

const router = express.Router();

// GET /api/dashboard/summary
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const [
      totalPlants, deadCount, soldCount, giftedCount, harvestedCount,
      valuation, salesAgg, spentAgg,
    ] = await Promise.all([
      prisma.plant.count(),
      prisma.plant.count({ where: { status: '死亡' } }),
      prisma.plant.count({ where: { status: '出售' } }),
      prisma.plant.count({ where: { status: '送人' } }),
      prisma.plant.count({ where: { status: '已採收' } }),
      getValuationSummary(),
      // 賣植物實際收到的總金額與已實現損益,以及賣出時的成本加總(明細用)
      prisma.sale.aggregate({ _sum: { realizedProfit: true, salePrice: true, costBasis: true } }),
      // 買植物總共花了多少錢:不分現在狀態,把「所有曾經存在過的植物」的購入
      // 成本全部加總(死亡/送人/已採收/出售/持有中一律計入,因為錢都已經花出去了)
      prisma.plant.aggregate({ _sum: { purchasePrice: true } }),
    ]);

    const totalSpentEver = spentAgg._sum.purchasePrice || 0;
    const totalSaleRevenue = salesAgg._sum.salePrice || 0;
    const totalRealizedProfit = salesAgg._sum.realizedProfit || 0;

    // 淨損益採「純現金流」角度:買植物的當下錢就已經花出去了,在真正賣掉、
    // 錢收回來之前,這筆花費就是負的,不能用「目前市價」去美化這個數字。
    // 只有實際賣出時,收到的錢才會真正抵銷掉花費。
    //
    // 範例:買一株 $500 的植物 → 淨損益 -$500(錢花了,還沒收回來)
    //       這株之後以 $700 賣出 → 淨損益變成 +$200($700 收入 - $500 花費)
    //
    // 公式:淨損益 = 賣出總收入 - 買入總花費
    // (現持有植株的市價、死亡/送人/已採收的植株,都不計入這個數字——
    //  它們的購入成本已經包含在「買入總花費」裡,在真正變現之前就是負的)
    const netProfitLoss = totalSaleRevenue - totalSpentEver;

    res.json({
      totalPlants,
      aliveCount: valuation.holdingCount,
      deadCount,
      soldCount,
      giftedCount,
      harvestedCount,
      totalMarketValue: valuation.totalMarketValue,
      holdingCost: valuation.holdingCost,
      unrealizedGain: valuation.unrealizedGain,
      totalRealizedProfit,
      // 淨損益總覽與可展開的明細四項
      netProfitLoss,
      financeBreakdown: {
        totalSpentEver,          // 買植物總共花了多少錢
        totalSaleRevenue,        // 賣植物總共收入多少錢(這個數字才是真正抵銷花費的錢)
        totalRealizedProfit,     // 賣植物已實現獲利(售價 - 成本,供參考對照)
        holdingCost: valuation.holdingCost,       // 現持有植物花了多少錢(尚未變現,計入花費但沒被抵銷)
        unrealizedGain: valuation.unrealizedGain, // 現持有植物若賣掉可以賺多少(紙上參考值,不計入淨損益)
      },
    });
  })
);

module.exports = router;
