const express = require('express');

const authRoutes = require('./auth.routes');
const plantRoutes = require('./plant.routes');
const photoRoutes = require('./photo.routes');
const photoItemRoutes = require('./photoItem.routes');
const locationRoutes = require('./location.routes');
const movementRoutes = require('./movement.routes');
const purchaseRoutes = require('./purchase.routes');
const priceHistoryRoutes = require('./priceHistory.routes');
const { nestedRouter: saleNestedRoutes, topRouter: saleTopRoutes } = require('./sale.routes');
const { nestedRouter: wateringNestedRoutes, topRouter: wateringTopRoutes } = require('./watering.routes');
const propagationRoutes = require('./propagation.routes');
const timelineRoutes = require('./timeline.routes');
const exportRoutes = require('./export.routes');
const dashboardRoutes = require('./dashboard.routes');
const valuationRoutes = require('./valuation.routes');
const compostRoutes = require('./compost.routes');
const equipmentRoutes = require('./equipment.routes');
const requireAuth = require('../middleware/auth');

const router = express.Router();

// ── 認證（不需 requireAuth） ──────────────────────────
router.use('/auth', authRoutes);

// ── 以下端點皆需登入（單一使用者情境） ──────────────────
router.use('/plants', requireAuth, plantRoutes);

// 巢狀路由：掛載在 /plants/:id/xxx 之下，mergeParams 讓子路由拿得到 :id
router.use('/plants/:id/photos', requireAuth, photoRoutes);
router.use('/plants/:id/movements', requireAuth, movementRoutes);
router.use('/plants/:id/price-history', requireAuth, priceHistoryRoutes);
router.use('/plants/:id/sale', requireAuth, saleNestedRoutes);
router.use('/plants/:id/timeline', requireAuth, timelineRoutes);
router.use('/plants/:id/waterings', requireAuth, wateringNestedRoutes);

router.use('/photos', requireAuth, photoItemRoutes);
router.use('/locations', requireAuth, locationRoutes);
router.use('/purchases', requireAuth, purchaseRoutes);
router.use('/sales', requireAuth, saleTopRoutes);
router.use('/waterings', requireAuth, wateringTopRoutes);
router.use('/propagations', requireAuth, propagationRoutes);
router.use('/export', requireAuth, exportRoutes);
router.use('/dashboard', requireAuth, dashboardRoutes);
router.use('/valuation', requireAuth, valuationRoutes);
router.use('/compost', requireAuth, compostRoutes);
router.use('/equipment', requireAuth, equipmentRoutes);

module.exports = router;
