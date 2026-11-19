const pool = require('../config/db');
const { validationError } = require('../middleware/errors');

async function summary(req, res) {
  const [[{ fruitCount }]] = await pool.query("SELECT COUNT(*) AS fruitCount FROM fruits WHERE status='Available'");
  const [[{ vendorCount }]] = await pool.query("SELECT COUNT(*) AS vendorCount FROM vendors WHERE status='Available'");
  const [[{ supplierCount }]] = await pool.query('SELECT COUNT(*) AS supplierCount FROM suppliers');
  const [[{ boxesInStock }]] = await pool.query('SELECT COALESCE(SUM(available_quantity), 0) AS boxesInStock FROM stock');
  const [[{ revenue }]] = await pool.query(
    "SELECT COALESCE(SUM(total_amount), 0) AS revenue FROM sales WHERE payment_status='PAID'",
  );
  const [[{ outstanding }]] = await pool.query(
    'SELECT COALESCE(SUM(total_amount-amount_paid), 0) AS outstanding FROM sales',
  );
  const [recentSales] = await pool.query(
    `SELECT s.sale_id AS saleId, s.sale_date AS saleDate, v.vendor_name AS vendorName,
            s.total_amount AS totalAmount, s.payment_status AS paymentStatus
     FROM sales s JOIN vendors v ON v.vendor_id=s.vendor_id
     ORDER BY s.sale_id DESC LIMIT 5`,
  );
  res.json({ fruitCount, vendorCount, supplierCount, boxesInStock, revenue, outstanding, recentSales });
}

async function reports(req, res) {
  const { from, to } = req.query;
  if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to))) {
    throw validationError('Dates must use YYYY-MM-DD format.');
  }
  if (from && to && from > to) throw validationError('Start date cannot be after end date.');
  const dateRange = [from || null, to || null];
  const [topFruits] = await pool.query(
    `SELECT f.fruit_name AS fruitName, SUM(sd.quantity) AS boxesSold
     FROM sales_details sd JOIN sales s ON s.sale_id=sd.sale_id
     JOIN fruits f ON f.fruit_id=sd.fruit_id
     WHERE s.sale_date >= COALESCE(?, '1000-01-01')
       AND s.sale_date <= COALESCE(?, '9999-12-31')
     GROUP BY f.fruit_id, f.fruit_name ORDER BY boxesSold DESC LIMIT 5`,
    dateRange,
  );
  const [revenue] = await pool.query(
    `SELECT COALESCE(SUM(total_amount), 0) AS totalRevenue
     FROM sales WHERE sale_date >= COALESCE(?, '1000-01-01')
       AND sale_date <= COALESCE(?, '9999-12-31')`,
    dateRange,
  );
  const [topVendors] = await pool.query(
    `SELECT v.vendor_name AS vendorName, SUM(sd.quantity) AS boxesPurchased
     FROM sales_details sd JOIN sales s ON s.sale_id=sd.sale_id
     JOIN vendors v ON v.vendor_id=s.vendor_id
     WHERE s.sale_date >= COALESCE(?, '1000-01-01')
       AND s.sale_date <= COALESCE(?, '9999-12-31')
     GROUP BY v.vendor_id, v.vendor_name ORDER BY boxesPurchased DESC LIMIT 1`,
    dateRange,
  );
  res.json({ topFruits, totalRevenue: revenue[0].totalRevenue, topVendor: topVendors[0] || null });
}

module.exports = { summary, reports };
