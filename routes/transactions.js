const express = require('express');
const router = express.Router();
const {
  getTransactions,
  createTransaction,
  getTransaction,
  updateTransaction,
  deleteTransaction,
  getCategories,
} = require('../controllers/transactionController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', getTransactions);
router.post('/', createTransaction);
router.get('/categories', getCategories);
router.get('/:id', getTransaction);
router.put('/:id', updateTransaction);
router.delete('/:id', deleteTransaction);

module.exports = router;
