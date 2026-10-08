const express = require('express');
const router = express.Router();
const {
  getStats,
  getUsers,
  getUserDetail,
  updateUser,
  deleteUser,
  deleteUserTransaction,
} = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect, adminOnly);

router.get('/stats', getStats);
router.get('/users', getUsers);
router.get('/users/:id', getUserDetail);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.delete('/transactions/:id', deleteUserTransaction);

module.exports = router;
