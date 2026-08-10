// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const protectAdmin = require('../middleware/adminMiddleware');

const { 
  createFirstAdmin, 
  loginAdmin, 
  getAllUsers, 
  deleteUser,
  getPendingPayments,
  approvePayment
} = require('../controllers/adminController');

// Public Admin Routes
router.post('/setup', createFirstAdmin);
router.post('/login', loginAdmin);

// Protected Admin Routes (Requires Admin JWT)
router.get('/users', protectAdmin, getAllUsers);
router.delete('/users/:id', protectAdmin, deleteUser);
router.get('/payments/pending', protectAdmin, getPendingPayments);
router.put('/payments/:id/approve', protectAdmin, approvePayment);

module.exports = router;