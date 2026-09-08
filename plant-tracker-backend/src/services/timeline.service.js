/**
 * ==============================================================
 *   C-3 生命歷程事件聚合 — 時間軸分組／篩選／統計服務
 * ==============================================================
 * 對應 B 的 README 第 4 節明文分工：
 *   「PlantEvent 已由 B 在對應動作發生時自動寫入……
 *    時間軸的分組、篩選、互動視覺化邏輯不在 B 的程式碼範圍內」
 *
 * 這個檔案只做純資料轉換（輸入事件陣列，輸出聚合結果），
 * 不直接碰 Prisma，方便單元測試，也方便未來換資料庫實作不受影響。
 * 實際從資料庫撈資料、接 HTTP 的部分在 routes/timeline.routes.js。
 */

// 對應 B schema 的 eventType 中文值（plant.routes.js / propagation.routes.js / ...）
const EVENT_TYPES = ['買入', '拍照', '移動', '繁殖', '市價更新', '出售', '死亡', '送人', '澆水', '採收'];

/**
 * 依 eventType 篩選事件。傳入 null/undefined 則不篩選。
 */
function filterByType(events, eventType) {
  if (!eventType) return events;
  if (!EVENT_TYPES.includes(eventType)) {
    const err = new Error(`未知事件類型: ${eventType}`);
    err.code = 'INVALID_EVENT_TYPE';
    throw err;
  }
  return events.filter((e) => e.eventType === eventType);
}

/**
 * 依日期範圍篩選事件(含頭尾)。from/to 為 Date 物件或 ISO 字串,可省略其一。
 */
function filterByDateRange(events, from, to) {
  const fromTime = from ? new Date(from).getTime() : null;
  const toTime = to ? new Date(to).getTime() : null;
  return events.filter((e) => {
    const t = new Date(e.eventDate).getTime();
    if (fromTime !== null && t < fromTime) return false;
    if (toTime !== null && t > toTime) return false;
    return true;
  });
}

/**
 * 依 eventType 分組,回傳 { eventType: [events...] } 且各組內部維持日期升冪排序。
 */
function groupByType(events) {
  const groups = {};
  for (const type of EVENT_TYPES) groups[type] = [];
  for (const e of events) {
    if (!groups[e.eventType]) groups[e.eventType] = [];
    groups[e.eventType].push(e);
  }
  // 移除完全沒有事件的分組,回傳精簡結果
  return Object.fromEntries(Object.entries(groups).filter(([, list]) => list.length > 0));
}

/**
 * 統計摘要:各事件類型次數、事件總數、起訖日期。
 * 用於前端(成員 A - A-10 互動時間軸)頂部概覽卡片。
 */
function buildSummary(events) {
  const countByType = {};
  for (const e of events) {
    countByType[e.eventType] = (countByType[e.eventType] || 0) + 1;
  }
  const dates = events.map((e) => new Date(e.eventDate).getTime());
  return {
    totalEvents: events.length,
    countByType,
    firstEventDate: dates.length ? new Date(Math.min(...dates)).toISOString() : null,
    lastEventDate: dates.length ? new Date(Math.max(...dates)).toISOString() : null,
  };
}

/**
 * 主要聚合入口。
 * options:
 *   - eventType: 篩選單一事件類型
 *   - from, to: 日期範圍篩選
 *   - group: true 時回傳依類型分組的結果,否則回傳排序後的扁平陣列
 */
function aggregateTimeline(rawEvents, options = {}) {
  const { eventType, from, to, group = false } = options;

  let events = [...rawEvents].sort(
    (a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
  );

  events = filterByType(events, eventType);
  events = filterByDateRange(events, from, to);

  const summary = buildSummary(events);

  return {
    summary,
    timeline: group ? groupByType(events) : events,
  };
}

module.exports = {
  EVENT_TYPES,
  filterByType,
  filterByDateRange,
  groupByType,
  buildSummary,
  aggregateTimeline,
};
