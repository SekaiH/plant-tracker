/**
 * timeline.service.js 單元測試
 * 純 JS 陣列輸入輸出,不需要資料庫、不需要 npm install 任何套件。
 * 執行方式: node src/services/timeline.service.test.js
 */
const assert = require('node:assert');
const {
  aggregateTimeline,
  filterByType,
  filterByDateRange,
  groupByType,
  buildSummary,
} = require('./timeline.service');

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed += 1;
  } catch (err) {
    console.log(`❌ ${name}`);
    console.log(`   ${err.message}`);
    failed += 1;
  }
}

// 模擬鹿角蕨 A 的一段生命歷程(對應規格書 13.3 完整生命履歷測試)
const sampleEvents = [
  { id: '1', eventType: '買入', eventDate: '2026-08-01T00:00:00Z', content: '{"unitPrice":500}' },
  { id: '2', eventType: '拍照', eventDate: '2026-08-05T00:00:00Z', content: null },
  { id: '3', eventType: '移動', eventDate: '2026-08-10T00:00:00Z', content: null },
  { id: '4', eventType: '市價更新', eventDate: '2026-08-20T00:00:00Z', content: '{"from":500,"to":900}' },
  { id: '5', eventType: '繁殖', eventDate: '2026-09-02T00:00:00Z', content: null },
  { id: '6', eventType: '拍照', eventDate: '2026-09-03T00:00:00Z', content: null },
];

check('filterByType: 篩選出全部拍照事件', () => {
  const result = filterByType(sampleEvents, '拍照');
  assert.strictEqual(result.length, 2);
  assert.ok(result.every((e) => e.eventType === '拍照'));
});

check('filterByType: 未指定類型時回傳全部事件', () => {
  const result = filterByType(sampleEvents, null);
  assert.strictEqual(result.length, sampleEvents.length);
});

check('filterByType: 未知事件類型拋出例外', () => {
  assert.throws(() => filterByType(sampleEvents, '不存在的類型'), /未知事件類型/);
});

check('filterByDateRange: 篩選 8 月份事件', () => {
  const result = filterByDateRange(sampleEvents, '2026-08-01', '2026-08-31');
  assert.strictEqual(result.length, 4);
});

check('groupByType: 依類型分組且排除空分組', () => {
  const groups = groupByType(sampleEvents);
  assert.strictEqual(groups['拍照'].length, 2);
  assert.strictEqual(groups['買入'].length, 1);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(groups, '出售'), false);
});

check('buildSummary: 統計總數與起訖日期', () => {
  const summary = buildSummary(sampleEvents);
  assert.strictEqual(summary.totalEvents, 6);
  assert.strictEqual(summary.countByType['拍照'], 2);
  assert.strictEqual(summary.firstEventDate, new Date('2026-08-01T00:00:00Z').toISOString());
  assert.strictEqual(summary.lastEventDate, new Date('2026-09-03T00:00:00Z').toISOString());
});

check('aggregateTimeline: 預設回傳排序後的扁平陣列', () => {
  // 故意打亂順序輸入,驗證會依日期重新排序
  const shuffled = [sampleEvents[3], sampleEvents[0], sampleEvents[5], sampleEvents[1]];
  const result = aggregateTimeline(shuffled);
  assert.strictEqual(result.timeline[0].id, '1');
  assert.strictEqual(result.timeline[result.timeline.length - 1].id, '6');
});

check('aggregateTimeline: group=true 回傳分組結果', () => {
  const result = aggregateTimeline(sampleEvents, { group: true });
  assert.ok(Array.isArray(result.timeline['拍照']));
  assert.strictEqual(result.timeline['拍照'].length, 2);
});

check('aggregateTimeline: 可同時套用篩選與分組', () => {
  const result = aggregateTimeline(sampleEvents, { eventType: '拍照', group: true });
  assert.strictEqual(Object.keys(result.timeline).length, 1);
  assert.strictEqual(result.timeline['拍照'].length, 2);
  assert.strictEqual(result.summary.totalEvents, 2);
});

check('aggregateTimeline: 日期範圍篩選正確縮小總數', () => {
  const result = aggregateTimeline(sampleEvents, { from: '2026-09-01' });
  assert.strictEqual(result.summary.totalEvents, 2);
});

console.log('\n' + '='.repeat(50));
console.log(`測試結果: ${passed}/${passed + failed} 通過`);
if (failed > 0) process.exit(1);
