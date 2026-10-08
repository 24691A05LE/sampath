const express = require('express');
const router = express.Router();
const {
  getGoals,
  createGoal,
  updateGoal,
  addContribution,
  deleteGoal,
} = require('../controllers/savingController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', getGoals);
router.post('/', createGoal);
router.put('/:id', updateGoal);
router.post('/:id/contribute', addContribution);
router.delete('/:id', deleteGoal);

module.exports = router;
