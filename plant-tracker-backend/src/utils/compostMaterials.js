/**
 * 堆肥材料碳氮比(C:N)參照表與計算邏輯
 *
 * 【重要假設與限制】
 * 這裡的碳氮比數值取自堆肥教育資料常見的概略範圍(如美國 Cornell Waste
 * Management Institute 等推廣單位公開的參考表),用於居家堆肥的粗略估算,
 * 不是實驗室化驗等級的精確值。同一種材料因新鮮度、含水量、產地不同,
 * 實際比例可能有不小差異,僅供抓大方向使用。
 *
 * 【混合比例計算的簡化假設】
 * 要精確計算「混合多種材料後的整體碳氮比」,需要知道每種材料各自的碳含量
 * 與氮含量(而不是只有比例)。這裡採用堆肥計算機常見的簡化假設:
 * 假設所有有機材料的碳含量都約為乾重的 50%(這是堆肥教育資料裡常見的
 * 概略假設,不同材料實際碳含量會有落差,尤其木質類材料可能更高)。
 * 在這個假設下,氮含量 = 50 / 該材料碳氮比,加總後整體碳氮比可以簡化成:
 *
 *   整體碳氮比 = 總重量 / Σ(該材料重量 / 該材料碳氮比)
 *
 * 這是以重量加權的調和平均,不是直接平均每個比例數字。
 */

// 常見堆肥材料參照表(碳氮比為概略值,category 只是給前端 UI 分類用)
const MATERIAL_REFERENCE = [
  { name: '乾落葉', cnRatio: 50, category: '含碳(棕色)' },
  { name: '稻草/麥稈', cnRatio: 80, category: '含碳(棕色)' },
  { name: '木屑/鋸末', cnRatio: 400, category: '含碳(棕色)' },
  { name: '報紙(撕碎)', cnRatio: 175, category: '含碳(棕色)' },
  { name: '瓦楞紙板(撕碎)', cnRatio: 350, category: '含碳(棕色)' },
  { name: '稻殼', cnRatio: 90, category: '含碳(棕色)' },
  { name: '新鮮草屑/割草', cnRatio: 18, category: '含氮(綠色)' },
  { name: '廚餘(菜葉果皮)', cnRatio: 15, category: '含氮(綠色)' },
  { name: '咖啡渣', cnRatio: 20, category: '含氮(綠色)' },
  { name: '茶渣', cnRatio: 20, category: '含氮(綠色)' },
  { name: '雞糞', cnRatio: 10, category: '含氮(綠色)' },
  { name: '牛糞', cnRatio: 20, category: '含氮(綠色)' },
  { name: '豆科植物殘體(如豆莖)', cnRatio: 15, category: '含氮(綠色)' },
];

function findMaterial(name) {
  return MATERIAL_REFERENCE.find((m) => m.name === name);
}

/**
 * 計算一批加料紀錄的整體碳氮比。
 * entries: [{ amountKg, cnRatio }, ...]（只需要這兩個欄位）
 * 回傳 null 表示沒有足夠資料計算(例如總重量為 0)。
 */
function calculateMixRatio(entries) {
  const valid = entries.filter((e) => e.amountKg > 0 && e.cnRatio > 0);
  const totalWeight = valid.reduce((sum, e) => sum + e.amountKg, 0);
  if (totalWeight <= 0) return null;

  const weightedInverseSum = valid.reduce((sum, e) => sum + e.amountKg / e.cnRatio, 0);
  if (weightedInverseSum <= 0) return null;

  return totalWeight / weightedInverseSum;
}

/**
 * 依整體碳氮比給出調整建議。
 * 堆肥理想碳氮比一般建議落在 25:1 ~ 35:1 之間(過低易發臭、流失氮素；
 * 過高則分解速度過慢)。這個範圍同樣是堆肥教育資料常見的概略建議值。
 */
function getSuggestion(ratio) {
  if (ratio === null) {
    return { status: 'empty', message: '尚無加料紀錄,無法估算碳氮比。' };
  }
  if (ratio > 40) {
    return {
      status: 'too_high',
      message: `目前碳氮比約 ${ratio.toFixed(1)}:1,偏高(碳偏多)。建議增加含氮材料,如廚餘、新鮮草屑、咖啡渣,幫助加速分解。`,
    };
  }
  if (ratio < 20) {
    return {
      status: 'too_low',
      message: `目前碳氮比約 ${ratio.toFixed(1)}:1,偏低(氮偏多)。建議增加含碳材料,如乾落葉、稻草、木屑,避免發臭與氮素流失。`,
    };
  }
  return {
    status: 'good',
    message: `目前碳氮比約 ${ratio.toFixed(1)}:1,落在建議範圍(25~35:1)附近,適合持續發酵。`,
  };
}

module.exports = { MATERIAL_REFERENCE, findMaterial, calculateMixRatio, getSuggestion };
