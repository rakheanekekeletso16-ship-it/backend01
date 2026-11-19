const pool = require('../config/db');
const { validationError } = require('../middleware/errors');

const sizes = ['SMALL', 'MEDIUM', 'LARGE'];
const paymentMethods = ['CASH', 'MOBILE_MONEY', 'CREDIT'];

function positiveId(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw validationError(`${label} must be a positive integer.`);
  return parsed;
}

function positiveMoney(value, label) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) / 100 !== amount) {
    throw validationError(`${label} must be a positive amount with no more than two decimal places.`);
  }
  return amount;
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw validationError('Add at least one fruit item.');
  return items.map((item, index) => {
    const fruitId = positiveId(item.fruitId, `Item ${index + 1} fruit ID`);
    const quantity = Number(item.quantity);
    const packagingSize = String(item.packagingSize || '').toUpperCase();
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw validationError(`Item ${index + 1} quantity must be a positive whole number.`);
    }
    if (!sizes.includes(packagingSize)) throw validationError(`Item ${index + 1} has an invalid packaging size.`);
    return { fruitId, quantity, packagingSize, rawUnitCost: item.unitCost };
  });
}

async function createPurchase(req, res) {
  const supplierId = positiveId(req.body.supplierId, 'Supplier ID');
  const items = normalizeItems(req.body.items);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [suppliers] = await connection.query('SELECT supplier_id FROM suppliers WHERE supplier_id=? FOR UPDATE', [supplierId]);
    if (!suppliers.length) throw Object.assign(new Error('Supplier not found.'), { status: 404 });

    const fruitIds = [...new Set(items.map((item) => item.fruitId))];
    const [existingFruits] = await connection.query(
      `SELECT fruit_id FROM fruits WHERE status='Available' AND fruit_id IN (${fruitIds.map(() => '?').join(',')})`,
      fruitIds,
    );
    if (existingFruits.length !== fruitIds.length) {
      throw Object.assign(new Error('One or more selected fruits do not exist or are inactive.'), { status: 404 });
    }

    let totalCents = 0;
    const prepared = items.map((item, index) => {
      const unitCost = positiveMoney(item.rawUnitCost, `Item ${index + 1} unit cost`);
      totalCents += Math.round(unitCost * 100) * item.quantity;
      return { ...item, unitCost };
    });
    const totalAmount = totalCents / 100;

    const [purchase] = await connection.query(
      'INSERT INTO purchases (supplier_id, purchase_date, total_amount) VALUES (?, CURRENT_DATE(), ?)',
      [supplierId, totalAmount],
    );
    for (const item of prepared) {
      await connection.query(
        `INSERT INTO purchase_details (purchase_id, fruit_id, quantity, unit_cost, packaging_size)
         VALUES (?, ?, ?, ?, ?)`,
        [purchase.insertId, item.fruitId, item.quantity, item.unitCost, item.packagingSize],
      );
      await connection.query(
        `INSERT INTO stock (fruit_id, packaging_size, available_quantity) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE available_quantity = available_quantity + VALUES(available_quantity)`,
        [item.fruitId, item.packagingSize, item.quantity],
      );
    }
    await connection.commit();
    res.status(201).json({ purchaseId: purchase.insertId, totalAmount });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function createSale(req, res) {
  const vendorId = positiveId(req.body.vendorId, 'Vendor ID');
  const items = normalizeItems(req.body.items);
  const paymentMethod = String(req.body.paymentMethod || '').toUpperCase();
  if (!paymentMethods.includes(paymentMethod)) {
    throw validationError('Payment method must be CASH, MOBILE_MONEY, or CREDIT.');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [vendors] = await connection.query(
      "SELECT vendor_id FROM vendors WHERE vendor_id=? AND status='Available' FOR UPDATE",
      [vendorId],
    );
    if (!vendors.length) throw Object.assign(new Error('Vendor not found or inactive.'), { status: 404 });

    const stockKeys = [...new Set(items.map((item) => `${item.fruitId}:${item.packagingSize}`))].sort();
    const stock = new Map();
    for (const key of stockKeys) {
      const [fruitId, packagingSize] = key.split(':');
      const [rows] = await connection.query(
        `SELECT s.available_quantity, fp.unit_price, f.fruit_name
         FROM stock s
         JOIN fruit_prices fp ON fp.fruit_id=s.fruit_id AND fp.packaging_size=s.packaging_size
         JOIN fruits f ON f.fruit_id=s.fruit_id
         WHERE s.fruit_id=? AND s.packaging_size=? AND f.status='Available'
           AND fp.status='Available' FOR UPDATE`,
        [fruitId, packagingSize],
      );
      if (!rows.length) throw validationError(`No active stock or selling price for ${packagingSize.toLowerCase()} ${fruitId}.`);
      stock.set(key, rows[0]);
    }

    const requested = new Map();
    for (const item of items) {
      const key = `${item.fruitId}:${item.packagingSize}`;
      requested.set(key, (requested.get(key) || 0) + item.quantity);
    }
    for (const [key, quantity] of requested) {
      const row = stock.get(key);
      if (row.available_quantity < quantity) {
        throw validationError(`Insufficient stock for ${row.fruit_name} (${key.split(':')[1].toLowerCase()}): ${row.available_quantity} available, ${quantity} requested.`);
      }
    }

    const totalCents = items.reduce((total, item) => {
      const { unit_price: unitPrice } = stock.get(`${item.fruitId}:${item.packagingSize}`);
      return total + Math.round(unitPrice * 100) * item.quantity;
    }, 0);
    const totalAmount = totalCents / 100;
    const requestedPaid = req.body.amountPaid === undefined
      ? (paymentMethod === 'CREDIT' ? 0 : totalAmount)
      : Number(req.body.amountPaid);
    if (!Number.isFinite(requestedPaid) || requestedPaid < 0
      || Math.round(requestedPaid * 100) / 100 !== requestedPaid || requestedPaid > totalAmount) {
      throw validationError('Amount paid must be between zero and the sale total.');
    }
    const paymentStatus = requestedPaid === 0 ? 'UNPAID'
      : requestedPaid >= totalAmount ? 'PAID' : 'PARTIALLY_PAID';

    const [sale] = await connection.query(
      `INSERT INTO sales (vendor_id, sale_date, payment_status, payment_method, total_amount, amount_paid)
       VALUES (?, CURRENT_DATE(), ?, ?, ?, ?)`,
      [vendorId, paymentStatus, paymentMethod, totalAmount, requestedPaid],
    );
    for (const item of items) {
      const unitPrice = stock.get(`${item.fruitId}:${item.packagingSize}`).unit_price;
      await connection.query(
        `INSERT INTO sales_details (sale_id, fruit_id, packaging_size, quantity, unit_price)
         VALUES (?, ?, ?, ?, ?)`,
        [sale.insertId, item.fruitId, item.packagingSize, item.quantity, unitPrice],
      );
    }
    for (const [key, quantity] of requested) {
      const [fruitId, packagingSize] = key.split(':');
      await connection.query(
        `UPDATE stock SET available_quantity=available_quantity-?
         WHERE fruit_id=? AND packaging_size=? AND available_quantity>=?`,
        [quantity, fruitId, packagingSize, quantity],
      );
    }
    await connection.commit();
    res.status(201).json({
      saleId: sale.insertId,
      totalAmount,
      amountPaid: requestedPaid,
      outstandingBalance: totalAmount - requestedPaid,
      paymentStatus,
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listPurchases(req, res) {
  const [rows] = await pool.query(
    `SELECT p.purchase_id AS purchaseId, p.purchase_date AS purchaseDate, p.total_amount AS totalAmount,
            s.business_name AS supplierName,
            (SELECT JSON_ARRAYAGG(JSON_OBJECT(
              'fruitName', f.fruit_name,
              'quantity', pd.quantity,
              'packagingSize', pd.packaging_size,
              'unitCost', pd.unit_cost
            ))
             FROM purchase_details pd JOIN fruits f ON f.fruit_id=pd.fruit_id
             WHERE pd.purchase_id=p.purchase_id) AS items
     FROM purchases p JOIN suppliers s ON s.supplier_id=p.supplier_id
     ORDER BY p.purchase_date DESC, p.purchase_id DESC`,
  );
  res.json(rows.map((purchase) => ({
    ...purchase,
    items: typeof purchase.items === 'string' ? JSON.parse(purchase.items) : purchase.items || [],
  })));
}

async function listSales(req, res) {
  const [rows] = await pool.query(
    `SELECT s.sale_id AS saleId, s.sale_date AS saleDate, s.payment_status AS paymentStatus,
            s.payment_method AS paymentMethod, s.total_amount AS totalAmount, s.amount_paid AS amountPaid,
            v.vendor_name AS vendorName,
            (SELECT JSON_ARRAYAGG(JSON_OBJECT(
              'fruitName', f.fruit_name,
              'quantity', sd.quantity,
              'packagingSize', sd.packaging_size,
              'unitPrice', sd.unit_price
            ))
             FROM sales_details sd JOIN fruits f ON f.fruit_id=sd.fruit_id
             WHERE sd.sale_id=s.sale_id) AS items
     FROM sales s JOIN vendors v ON v.vendor_id=s.vendor_id
     ORDER BY s.sale_date DESC, s.sale_id DESC`,
  );
  res.json(rows.map((sale) => ({
    ...sale,
    items: typeof sale.items === 'string' ? JSON.parse(sale.items) : sale.items || [],
  })));
}

async function paySale(req, res) {
  const saleId = positiveId(req.params.id, 'Sale ID');
  const amount = positiveMoney(req.body.amount, 'Payment amount');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [sales] = await connection.query('SELECT * FROM sales WHERE sale_id=? FOR UPDATE', [saleId]);
    if (!sales.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Sale not found.' });
    }
    const sale = sales[0];
    if (sale.amount_paid + amount > sale.total_amount) throw validationError('Payment exceeds the outstanding balance.');
    const paid = sale.amount_paid + amount;
    const status = paid >= sale.total_amount ? 'PAID' : 'PARTIALLY_PAID';
    await connection.query('UPDATE sales SET amount_paid=?, payment_status=? WHERE sale_id=?', [paid, status, saleId]);
    await connection.commit();
    res.json({ saleId, amountPaid: paid, outstandingBalance: sale.total_amount - paid, paymentStatus: status });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { createPurchase, createSale, listPurchases, listSales, paySale };
