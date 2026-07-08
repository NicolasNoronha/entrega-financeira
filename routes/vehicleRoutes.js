const express = require('express');
const vehicleController = require('../controllers/vehicleController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/', vehicleController.index);
router.post('/', vehicleController.create);
router.delete('/:id', vehicleController.remove);

module.exports = router;
