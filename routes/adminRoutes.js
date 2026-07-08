const express = require('express');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const adminController = require('../controllers/adminController');

const router = express.Router();

router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/users', adminController.users);
router.post('/users/:userId/grant', adminController.grant);
router.patch('/users/:userId/status', adminController.status);

module.exports = router;