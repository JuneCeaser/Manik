// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const protectAdmin = require('../middleware/adminMiddleware');

const { 
  createFirstAdmin, 
  loginAdmin, 
  getAllUsers, 
  deleteUser 
} = require('../controllers/adminController');

// Public Admin Routes
//router.post('/setup', createFirstAdmin); // Remove this after you create your account
router.post('/login', loginAdmin);

// Protected Admin Routes (Requires Admin JWT)
router.get('/users', protectAdmin, getAllUsers);
router.delete('/users/:id', protectAdmin, deleteUser);

module.exports = router;