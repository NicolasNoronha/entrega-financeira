const express = require('express');
const vehicleController = require('../controllers/vehicleController');
const authMiddleware = require('../middleware/auth');
const subscriptionAccess = require('../middleware/subscriptionAccess');

const router = express.Router();

router.use(authMiddleware);
router.use(subscriptionAccess);

router.get('/', vehicleController.index);
router.post('/', vehicleController.create);
router.delete('/:id', vehicleController.remove);

module.exports = router;
