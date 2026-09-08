# 🌿 植況簿 — 啟動說明

## 事前準備

- 電腦要先裝好 **Node.js**(建議 18 版以上)。到 [nodejs.org](https://nodejs.org) 下載安裝即可,安裝完打開終端機輸入 `node --version` 確認有版本號跑出來。
- 需要網路連線(安裝套件那一步要用)。

---

## 第一部分:啟動後端

打開終端機(Windows 用「命令提示字元」或 PowerShell,Mac/Linux 用「終端機」)。

### 1. 解壓縮並進入後端資料夾

解壓縮拿到的 zip 檔案,會看到 `plant-tracker-backend` 和 `frontend` 兩個資料夾。

```
cd plant-tracker-backend
```

### 2. 安裝後端套件

```
npm install
```

這步需要網路連線,會抓取專案需要的套件。第一次執行可能要等一兩分鐘。

### 3. 建立環境變數檔案

**Windows(命令提示字元 / PowerShell 都適用):**
```
copy .env.example .env
```

**Mac / Linux:**
```
cp .env.example .env
```

> ⚠️ 這兩個指令不能混用——`cp` 是 Mac/Linux 的指令,`copy` 是 Windows 的指令,用錯會看到「不是內部或外部命令」之類的錯誤訊息。

不用修改 `.env` 裡的內容,預設值就能直接使用。

### 4. 建立資料庫

```
npx prisma migrate dev --name init
```

第一次執行會順便下載 Prisma 相關工具,耐心等待。過程中如果跳出問題,直接按 Enter 或輸入 `y` 即可。

成功的話會看到類似「Your database is now in sync with your schema」的訊息。

### 5. 建立測試帳號與範例資料

```
npm run seed
```

會自動建立一組登入帳號,以及一株「鹿角蕨」的完整範例資料,方便直接測試功能。

### 6. 啟動後端伺服器

```
npm run dev
```

看到終端機顯示伺服器跑在 `http://localhost:4000`,就代表後端成功啟動。

可以打開瀏覽器輸入 `http://localhost:4000/health` 確認,應該會看到:
```json
{"status":"ok","service":"plant-tracker-backend"}
```

**這個終端機視窗要保持開著,不要關閉、不要按 Ctrl+C。**

---

## 第二部分:啟動前端

**另外開一個新的終端機視窗**(不要用剛剛那個,那個要繼續跑後端)。

### 7. 進入前端資料夾並啟動

```
cd frontend
npx serve .
```

執行後終端機會顯示一個網址,通常是:
```
http://localhost:3000
```

(如果你用別的工具,例如 `python3 -m http.server 5173`,網址會是 `http://localhost:5173`,看終端機實際顯示的網址為準即可。)

> ⚠️ **不能直接雙擊 `index.html` 打開**。瀏覽器會擋跨源請求導致畫面連不上後端,一定要透過上面這種本機伺服器的方式開啟。

---

## 第三部分:打開瀏覽器使用

瀏覽器輸入終端機顯示的網址(例如 `http://localhost:3000`)。

**不需要手動登入。** 系統會自動用內建的測試帳號登入,幾秒內就會看到 Dashboard 統計卡片跟範例植株的卡片畫面。

---

## 常見問題排除

| 狀況 | 可能原因 | 怎麼處理 |
| --- | --- | --- |
| `'cp' 不是內部或外部命令` | 在 Windows 用了 Mac/Linux 的指令 | 改用 `copy .env.example .env` |
| 畫面一直卡在「連接後端中...」轉圈圈 | 後端沒有啟動,或後端視窗被關掉了 | 檢查跑後端的那個終端機視窗還在不在、有沒有顯示錯誤訊息 |
| 顯示「自動登入失敗」 | 後端網址不對,或帳密被改過但沒同步 | 確認後端真的跑在 `http://localhost:4000`;如果改過 `.env` 裡的帳密,要同步修改 `frontend/index.html` 最上面 script 區塊裡的 `DEFAULT_CREDENTIALS` |
| 畫面空白、Console 出現 CORS 錯誤 | 用 `file://` 直接開啟 `index.html`,而不是透過本機伺服器 | 改用 `npx serve .` 或 `python3 -m http.server` 開啟 |
| `npx prisma migrate dev` 報錯 | 資料庫 schema 本身有問題,或資料夾權限問題 | 把完整錯誤訊息複製起來回報 |
| 上傳照片後畫面沒有更新封面 | 網路較慢,或該功能版本較舊 | 重新整理頁面看看;確認前端 `index.html` 是最新版本 |

---

## 兩個終端機視窗的關係(容易搞混的地方)

```
終端機視窗 A                          終端機視窗 B
────────────────                     ────────────────
cd plant-tracker-backend             cd frontend
npm run dev                          npx serve .
→ http://localhost:4000              → http://localhost:3000
   (資料庫 + API,後台運作)              (瀏覽器實際打開這個網址)
   ⚠️ 要保持開著                        ⚠️ 也要保持開著
```

瀏覽器打開的是 B 視窗的網址,但畫面上的資料實際上是透過 A 視窗的 API 拿到的——**兩個視窗缺一不可**,只要關掉任何一個,畫面就會連不上。

---

## 之後要換帳密怎麼辦

1. 打開 `plant-tracker-backend/.env`,修改 `ADMIN_USERNAME` / `ADMIN_PASSWORD`
2. 重新執行一次 `npm run seed`(會依新的 `.env` 內容建立帳號;如果帳號已存在需要的處理方式視 seed 腳本邏輯而定)
3. 打開 `frontend/index.html`,找到最上面 `<script>` 區塊裡的 `DEFAULT_CREDENTIALS`,改成一樣的帳密
4. 重新整理瀏覽器頁面
