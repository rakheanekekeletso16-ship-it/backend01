
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  ssl: {},
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
});

module.exports = pool;
