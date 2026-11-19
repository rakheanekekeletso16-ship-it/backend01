const express = require('express');
const master = require('../controllers/masterController');
const transactions = require('../controllers/transactionController');
const reports = require('../controllers/reportController');
const { asyncRoute } = require('../middleware/errors');

const router = express.Router();

router.get('/suppliers', asyncRoute(master.listSuppliers));
router.post('/suppliers', asyncRoute(master.createSupplier));
router.get('/suppliers/:id', asyncRoute(master.getSupplier));
router.put('/suppliers/:id', asyncRoute(master.updateSupplier));
router.delete('/suppliers/:id', asyncRoute(master.deleteSupplier));

router.get('/fruits', asyncRoute(master.listFruits));
router.post('/fruits', asyncRoute(master.createFruit));
router.put('/fruits/:id', asyncRoute(master.updateFruit));
router.delete('/fruits/:id', asyncRoute(master.deleteFruit));
router.get('/stock', asyncRoute(master.getStockList));
router.get('/stock/low', asyncRoute(master.lowStock));

router.get('/vendors', asyncRoute(master.listVendors));
router.post('/vendors', asyncRoute(master.createVendor));
router.put('/vendors/:id', asyncRoute(master.updateVendor));
router.delete('/vendors/:id', asyncRoute(master.deleteVendor));

router.get('/purchases', asyncRoute(transactions.listPurchases));
router.post('/purchases', asyncRoute(transactions.createPurchase));
router.get('/sales', asyncRoute(transactions.listSales));
router.post('/sales', asyncRoute(transactions.createSale));
router.post('/sales/:id/payments', asyncRoute(transactions.paySale));

router.get('/reports/summary', asyncRoute(reports.summary));
router.get('/reports', asyncRoute(reports.reports));

module.exports = router;
