const pool = require('../config/db');
const { findById, getStock } = require('../models/queries');
const { validationError } = require('../middleware/errors');

const provinces = [
  'Gauteng', 'Free State', 'KwaZulu-Natal', 'Western Cape',
  'Eastern Cape', 'Limpopo', 'Mpumalanga', 'North West',
];

function required(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw validationError(`${label} is required.`);
  return value.trim();
}

function id(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw validationError(`${label} must be a positive integer.`);
  return parsed;
}

function positivePrice(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || Math.round(parsed * 100) / 100 !== parsed) {
    throw validationError(`${label} must be a positive amount with no more than two decimal places.`);
  }
  return parsed;
}

async function listSuppliers(req, res) {
  const [rows] = await pool.query('SELECT * FROM suppliers ORDER BY business_name');
  res.json(rows);
}

async function createSupplier(req, res) {
  const { businessName, contactPerson, phone, province, address } = req.body;
  const values = [
    required(businessName, 'Business name'),
    required(contactPerson, 'Contact person'),
    required(phone, 'Phone'),
    required(province, 'Province'),
    required(address, 'Address'),
  ];
  if (!provinces.includes(values[3])) throw validationError('Select a valid South African province.');
  const [result] = await pool.query(
    `INSERT INTO suppliers (business_name, contact_person, phone, province, address)
     VALUES (?, ?, ?, ?, ?)`, values,
  );
  res.status(201).json(await findById('suppliers', 'supplier_id', result.insertId));
}

async function getSupplier(req, res) {
  const supplier = await findById('suppliers', 'supplier_id', id(req.params.id, 'Supplier ID'));
  if (!supplier) return res.status(404).json({ error: 'Supplier not found.' });
  res.json(supplier);
}

async function updateSupplier(req, res) {
  const supplierId = id(req.params.id, 'Supplier ID');
  if (!await findById('suppliers', 'supplier_id', supplierId)) {
    return res.status(404).json({ error: 'Supplier not found.' });
  }
  const { businessName, contactPerson, phone, province, address } = req.body;
  const values = [
    required(businessName, 'Business name'),
    required(contactPerson, 'Contact person'),
    required(phone, 'Phone'),
    required(province, 'Province'),
    required(address, 'Address'),
  ];
  if (!provinces.includes(values[3])) throw validationError('Select a valid South African province.');
  await pool.query(
    `UPDATE suppliers SET business_name=?, contact_person=?, phone=?, province=?, address=?
     WHERE supplier_id=?`, [...values, supplierId],
  );
  res.json(await findById('suppliers', 'supplier_id', supplierId));
}

async function deleteSupplier(req, res) {
  const supplierId = id(req.params.id, 'Supplier ID');
  try {
    const [result] = await pool.query('DELETE FROM suppliers WHERE supplier_id=?', [supplierId]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Supplier not found.' });
    res.status(204).end();
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      error.status = 409;
      error.message = 'This supplier has purchase records and cannot be deleted.';
    }
    throw error;
  }
}

async function listFruits(req, res) {
  const [rows] = await pool.query(
    `SELECT f.fruit_id AS fruitId, f.fruit_name AS fruitName, f.description, f.status,
            COALESCE(SUM(s.available_quantity), 0) AS totalStock,
            JSON_OBJECTAGG(fp.packaging_size, fp.unit_price) AS prices,
            JSON_OBJECTAGG(fp.packaging_size, fp.status) AS packageStatuses
     FROM fruits f
     LEFT JOIN stock s ON s.fruit_id=f.fruit_id
     LEFT JOIN fruit_prices fp ON fp.fruit_id=f.fruit_id
     GROUP BY f.fruit_id ORDER BY f.fruit_name`,
  );
  res.json(rows.map((fruit) => ({
    ...fruit,
    prices: typeof fruit.prices === 'string' ? JSON.parse(fruit.prices) : fruit.prices,
    packageStatuses: typeof fruit.packageStatuses === 'string'
      ? JSON.parse(fruit.packageStatuses)
      : fruit.packageStatuses,
  })));
}

async function createFruit(req, res) {
  const { fruitName, description = '', prices = {} } = req.body;
  const name = required(fruitName, 'Fruit name');
  const allowed = ['SMALL', 'MEDIUM', 'LARGE'];
  if (!prices || typeof prices !== 'object' || Array.isArray(prices)) {
    throw validationError('Prices must be provided for each packaging size.');
  }
  const validatedPrices = {};
  for (const size of allowed) {
    validatedPrices[size] = positivePrice(prices[size], `The ${size.toLowerCase()} price`);
  }
  const connection = await pool.getConnection();
  let fruitId;
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      'INSERT INTO fruits (fruit_name, description) VALUES (?, ?)', [name, description],
    );
    fruitId = result.insertId;
    for (const size of allowed) {
      await connection.query(
        'INSERT INTO fruit_prices (fruit_id, packaging_size, unit_price, status) VALUES (?, ?, ?, ?)',
        [fruitId, size, validatedPrices[size], 'Available'],
      );
      await connection.query(
        'INSERT INTO stock (fruit_id, packaging_size, available_quantity) VALUES (?, ?, 0)',
        [fruitId, size],
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  res.status(201).json(await findById('fruits', 'fruit_id', fruitId));
}

async function updateFruit(req, res) {
  const fruitId = id(req.params.id, 'Fruit ID');
  const fruit = await findById('fruits', 'fruit_id', fruitId);
  if (!fruit) return res.status(404).json({ error: 'Fruit not found.' });
  const { fruitName, description = '', status = fruit.status, prices = {} } = req.body;
  const { packageStatuses = {} } = req.body;
  const name = required(fruitName, 'Fruit name');
  if (!['Available', 'Unavailable'].includes(status)) throw validationError('Status must be Available or Unavailable.');
  if (!prices || typeof prices !== 'object' || Array.isArray(prices)) {
    throw validationError('Prices must be an object keyed by packaging size.');
  }
  const validatedPrices = {};
  for (const [size, rawPrice] of Object.entries(prices)) {
    if (!['SMALL', 'MEDIUM', 'LARGE'].includes(size)) throw validationError('Invalid packaging size.');
    validatedPrices[size] = positivePrice(rawPrice, 'Prices');
  }
  await pool.query('UPDATE fruits SET fruit_name=?, description=?, status=? WHERE fruit_id=?', [name, description, status, fruitId]);
  for (const [size, price] of Object.entries(validatedPrices)) {
    await pool.query(
      'UPDATE fruit_prices SET unit_price=? WHERE fruit_id=? AND packaging_size=?',
      [price, fruitId, size],
    );
  }
  for (const size of ['SMALL', 'MEDIUM', 'LARGE']) {
    const packageStatus = packageStatuses[size] || 'Available';
    if (!['Available', 'Unavailable'].includes(packageStatus)) {
      throw validationError(`Invalid status for ${size.toLowerCase()} packaging.`);
    }
    await pool.query(
      'UPDATE fruit_prices SET status=? WHERE fruit_id=? AND packaging_size=?',
      [packageStatus, fruitId, size],
    );
  }
  res.json(await findById('fruits', 'fruit_id', fruitId));
}

async function deleteFruit(req, res) {
  const fruitId = id(req.params.id, 'Fruit ID');
  try {
    const [result] = await pool.query('DELETE FROM fruits WHERE fruit_id=?', [fruitId]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Fruit not found.' });
    res.status(204).end();
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      const [result] = await pool.query(
        "UPDATE fruits SET status='Unavailable' WHERE fruit_id=?",
        [fruitId],
      );
      if (!result.affectedRows) return res.status(404).json({ error: 'Fruit not found.' });
      return res.json({ unavailable: true });
    }
    throw error;
  }
}

async function getStockList(req, res) {
  res.json(await getStock());
}

async function lowStock(req, res) {
  const threshold = Number(req.query.threshold || 10);
  if (!Number.isInteger(threshold) || threshold < 0) throw validationError('Threshold must be a non-negative integer.');
  const rows = await getStock();
  res.json(rows.filter((item) => item.quantity <= threshold));
}

async function listVendors(req, res) {
  const search = String(req.query.search || '').trim();
  const [rows] = await pool.query(
    `SELECT v.vendor_id AS vendorId, v.vendor_name AS vendorName, v.phone_number AS phoneNumber,
            v.location, v.status, v.registration_date AS registrationDate,
            COALESCE(SUM(s.total_amount-s.amount_paid), 0) AS outstandingBalance
     FROM vendors v LEFT JOIN sales s ON s.vendor_id=v.vendor_id
     WHERE (?='' OR v.vendor_name LIKE ? OR v.phone_number LIKE ?)
     GROUP BY v.vendor_id ORDER BY v.vendor_name`,
    [search, `%${search}%`, `%${search}%`],
  );
  res.json(rows);
}

async function createVendor(req, res) {
  const { vendorName, phoneNumber, location } = req.body;
  const values = [required(vendorName, 'Vendor name'), required(phoneNumber, 'Phone number'), required(location, 'Location')];
  const [result] = await pool.query(
    `INSERT INTO vendors (vendor_name, phone_number, location, registration_date)
     VALUES (?, ?, ?, CURRENT_DATE)`, values,
  );
  res.status(201).json(await findById('vendors', 'vendor_id', result.insertId));
}

async function updateVendor(req, res) {
  const vendorId = id(req.params.id, 'Vendor ID');
  const vendor = await findById('vendors', 'vendor_id', vendorId);
  if (!vendor) return res.status(404).json({ error: 'Vendor not found.' });
  const { vendorName, phoneNumber, location, status = vendor.status } = req.body;
  if (!['Available', 'Unavailable'].includes(status)) throw validationError('Status must be Available or Unavailable.');
  await pool.query(
    'UPDATE vendors SET vendor_name=?, phone_number=?, location=?, status=? WHERE vendor_id=?',
    [required(vendorName, 'Vendor name'), required(phoneNumber, 'Phone number'), required(location, 'Location'), status, vendorId],
  );
  res.json(await findById('vendors', 'vendor_id', vendorId));
}

async function deleteVendor(req, res) {
  const vendorId = id(req.params.id, 'Vendor ID');
  try {
    const [result] = await pool.query('DELETE FROM vendors WHERE vendor_id=?', [vendorId]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Vendor not found.' });
    res.status(204).end();
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      const [result] = await pool.query(
        "UPDATE vendors SET status='Unavailable' WHERE vendor_id=?",
        [vendorId],
      );
      if (!result.affectedRows) return res.status(404).json({ error: 'Vendor not found.' });
      return res.json({ unavailable: true });
    }
    throw error;
  }
}

module.exports = {
  listSuppliers, createSupplier, getSupplier, updateSupplier, deleteSupplier,
  listFruits, createFruit, updateFruit, deleteFruit, getStockList, lowStock,
  listVendors, createVendor, updateVendor, deleteVendor,
};
