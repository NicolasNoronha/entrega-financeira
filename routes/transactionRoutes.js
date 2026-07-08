const express = require('express');
const transactionController = require('../controllers/transactionController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/', transactionController.index);
router.post('/', transactionController.create);
router.get('/dashboard', transactionController.dashboard);
router.get('/reports', transactionController.report);
router.delete('/:id', transactionController.remove);

module.exports = router;
