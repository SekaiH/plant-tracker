require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`🌿 植況簿後端 API 已啟動：http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`   健康檢查：http://localhost:${PORT}/health`);
});
