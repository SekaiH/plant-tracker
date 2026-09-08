const assert = require('node:assert');
const { calculateMixRatio, getSuggestion, findMaterial } = require('./compostMaterials');

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed += 1;
  } catch (err) {
    console.log(`❌ ${name}\n   ${err.message}`);
    failed += 1;
  }
}

check('單一材料時,整體碳氮比就等於該材料本身的比例', () => {
  const ratio = calculateMixRatio([{ amountKg: 5, cnRatio: 50 }]);
  assert.strictEqual(ratio, 50);
});

check('等重量混合兩種材料時,結果是調和平均而非算術平均', () => {
  // 1kg 落葉(50:1) + 1kg 廚餘(15:1)
  // 調和平均 = 2 / (1/50 + 1/15) = 2 / (0.02 + 0.0667) = 2 / 0.08667 ≈ 23.08
  const ratio = calculateMixRatio([
    { amountKg: 1, cnRatio: 50 },
    { amountKg: 1, cnRatio: 15 },
  ]);
  assert.ok(Math.abs(ratio - 23.08) < 0.1, `預期約 23.08,實際 ${ratio}`);
  // 確認不是算術平均(會是 32.5,跟調和平均差很多)
  assert.ok(Math.abs(ratio - 32.5) > 5);
});

check('重量佔比高的材料影響力更大(加重落葉份量,整體比例應更接近落葉)', () => {
  const ratio = calculateMixRatio([
    { amountKg: 10, cnRatio: 50 }, // 大量落葉
    { amountKg: 1, cnRatio: 15 }, // 少量廚餘
  ]);
  assert.ok(ratio > 40, `預期接近 50(落葉為主),實際 ${ratio}`);
});

check('沒有任何加料紀錄時回傳 null', () => {
  const ratio = calculateMixRatio([]);
  assert.strictEqual(ratio, null);
});

check('總重量為 0 時回傳 null(避免除以 0)', () => {
  const ratio = calculateMixRatio([{ amountKg: 0, cnRatio: 50 }]);
  assert.strictEqual(ratio, null);
});

check('比例過高(>40)時建議增加含氮材料', () => {
  const s = getSuggestion(45);
  assert.strictEqual(s.status, 'too_high');
  assert.ok(s.message.includes('含氮'));
});

check('比例過低(<20)時建議增加含碳材料', () => {
  const s = getSuggestion(12);
  assert.strictEqual(s.status, 'too_low');
  assert.ok(s.message.includes('含碳'));
});

check('比例落在 20~40 之間時視為良好', () => {
  const s = getSuggestion(28);
  assert.strictEqual(s.status, 'good');
});

check('null 比例(尚無紀錄)有專屬提示', () => {
  const s = getSuggestion(null);
  assert.strictEqual(s.status, 'empty');
});

check('findMaterial 能正確找到已知材料', () => {
  const m = findMaterial('乾落葉');
  assert.strictEqual(m.cnRatio, 50);
});

check('findMaterial 對未知材料回傳 undefined', () => {
  const m = findMaterial('不存在的材料');
  assert.strictEqual(m, undefined);
});

console.log('\n' + '='.repeat(50));
console.log(`測試結果: ${passed}/${passed + failed} 通過`);
if (failed > 0) process.exit(1);
