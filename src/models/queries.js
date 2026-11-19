const pool = require('../config/db');

async function findById(table, idColumn, id) {
  const [rows] = await pool.query(`SELECT * FROM ${table} WHERE ${idColumn} = ?`, [id]);
  return rows[0] || null;
}

async function getStock() {
  const [rows] = await pool.query(
    `SELECT s.stock_id AS stockId, s.fruit_id AS fruitId, f.fruit_name AS fruitName,
            s.packaging_size AS packagingSize, s.available_quantity AS quantity,
            COALESCE(fp.unit_price, 0) AS unitPrice,
            COALESCE(fp.status, 'Unavailable') AS status
     FROM stock s
     JOIN fruits f ON f.fruit_id = s.fruit_id
     LEFT JOIN fruit_prices fp ON fp.fruit_id = s.fruit_id AND fp.packaging_size = s.packaging_size
     WHERE f.status = 'Available'
     ORDER BY f.fruit_name, FIELD(s.packaging_size, 'SMALL', 'MEDIUM', 'LARGE')`,
  );
  return rows;
}

module.exports = { findById, getStock };
