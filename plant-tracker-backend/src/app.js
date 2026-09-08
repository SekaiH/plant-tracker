const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 靜態提供已上傳的照片（本地開發用；正式環境建議改由 S3／R2 直接提供，見 README）
app.use('/uploads', express.static(path.join(process.cwd(), process.env.UPLOAD_DIR || './uploads')));

// 健康檢查端點，供成員 A／C 或部署平台確認服務是否存活
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'plant-tracker-backend' });
});

app.use('/api', routes);

// 靜態提供前端頁面（正式環境：前後端同一個服務、同一個網域）
app.use(express.static(path.join(__dirname, '../../frontend')));

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: '找不到此路徑' } });
});

// 統一錯誤處理（必須放在所有路由之後）
app.use(errorHandler);

module.exports = app;
