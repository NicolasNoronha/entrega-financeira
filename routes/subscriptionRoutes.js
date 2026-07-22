const express = require('express');
const authMiddleware = require('../middleware/auth');
const subscriptionController = require('../controllers/subscriptionController');

const router = express.Router();

router.post('/webhook/mercado-pago', subscriptionController.mercadoPagoWebhook);
router.get('/webhook/mercado-pago', subscriptionController.mercadoPagoWebhook);
router.get('/status', authMiddleware, subscriptionController.status);
router.post('/renew', authMiddleware, subscriptionController.renew);
router.post('/sync-payment', authMiddleware, subscriptionController.syncPayment);

module.exports = router;
