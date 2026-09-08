const { PrismaClient } = require('@prisma/client');

// 全域單例，避免開發模式下（nodemon 熱重載）建立過多資料庫連線
const prisma = new PrismaClient();

module.exports = prisma;
