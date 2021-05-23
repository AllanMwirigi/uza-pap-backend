const express = require('express');
const controller = require('./controllers');
const router = express.Router();

router.post('/users/register', controller.registerUser);
router.post('/users/check', controller.checkUser);

router.get('/assets', controller.getAllAssets);
router.get('/assets/:userId', controller.getUserCatalogue);
router.post('/assets', controller.saveAsset);
router.post('/assets/purchase', controller.purchaseAsset);
router.post('/assets/payment/notification', controller.onReceivePaymentNotification);
router.get('/purchases/:userId', controller.getUserPurchases);

module.exports = router;