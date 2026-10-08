const express = require('express');
const router = express.Router();
const {
  getSummary,
  getCategoryBreakdown,
  getDailyTrend,
  getMonthlyComparison,
  getBudgetStatus,
  getExportData,
} = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/summary', getSummary);
router.get('/categories', getCategoryBreakdown);
router.get('/trend', getDailyTrend);
router.get('/comparison', getMonthlyComparison);
router.get('/budget-status', getBudgetStatus);
router.get('/export', getExportData);

module.exports = router;
