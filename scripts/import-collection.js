#!/usr/bin/env node
/**
 * 植況簿 — 收藏清單批次匯入腳本
 *
 * 使用方式:
 *   node import-collection.js
 *
 * 需要後端已經用 npm run dev 啟動。預設連 http://localhost:4000,
 * 帳密預設 owner / changeme123,如果你改過可以用環境變數覆寫:
 *
 *   PT_API_BASE=http://localhost:4000 PT_USERNAME=owner PT_PASSWORD=你的密碼 node import-collection.js
 *
 * 這支腳本不會動到資料庫結構,純粹是逐筆呼叫既有的 POST /api/plants
 * 跟 POST /api/equipment,跟你在畫面上手動一筆一筆新增效果完全一樣,
 * 只是自動化跑過一輪,不用真的點兩百多次按鈕。
 */

const API_BASE = process.env.PT_API_BASE || 'http://localhost:4000';
const USERNAME = process.env.PT_USERNAME || 'owner';
const PASSWORD = process.env.PT_PASSWORD || 'changeme123';

const { plants, equipment } = require('./collection-data');

async function apiFetch(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(API_BASE + path, { method, headers, body });

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // 204 No Content 或非 JSON 回應,忽略
  }

  if (!res.ok) {
    const message = data && data.error ? data.error.message : `HTTP ${res.status}`;
    throw new Error(message);
  }
  return data;
}

async function importList(label, list, path, token) {
  console.log(`\n開始匯入${label}(共 ${list.length} 筆)...`);
  let success = 0;
  const failed = [];

  for (const item of list) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await apiFetch(path, { method: 'POST', token, body: JSON.stringify(item) });
      success += 1;
      process.stdout.write(`\r已完成 ${success}/${list.length}`);
    } catch (err) {
      failed.push({ name: item.name, error: err.message });
    }
  }

  console.log(`\n${label}匯入結果:成功 ${success} / ${list.length}`);
  if (failed.length > 0) {
    console.log(`❌ 失敗 ${failed.length} 筆:`);
    failed.forEach((f) => console.log(`   - ${f.name}:${f.error}`));
  }
  return { success, failed };
}

async function main() {
  console.log(`連接後端:${API_BASE}`);
  console.log('登入中...');

  let token;
  try {
    const loginResult = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
    });
    token = loginResult.token;
    console.log('✅ 登入成功');
  } catch (err) {
    console.error(`❌ 登入失敗:${err.message}`);
    console.error('請確認後端已經用 npm run dev 啟動,且帳密正確。');
    process.exit(1);
  }

  const plantResult = await importList('植物', plants, '/api/plants', token);
  const equipResult = await importList('工具/資源', equipment, '/api/equipment', token);

  console.log('\n========================================');
  console.log('匯入全部完成');
  console.log(`植物: ${plantResult.success}/${plants.length} 成功`);
  console.log(`工具/資源: ${equipResult.success}/${equipment.length} 成功`);
  console.log('========================================');

  if (plantResult.failed.length > 0 || equipResult.failed.length > 0) {
    console.log('\n有失敗項目,請檢查上方錯誤訊息。常見原因:名稱重複、價格格式錯誤。');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n匯入過程發生未預期錯誤:', err.message);
  process.exit(1);
});
