const mysql = require('mysql2/promise');

const dbUrl = new URL(process.env.DATABASE_URL);

const pool = mysql.createPool({
  host: dbUrl.hostname,
  port: Number(dbUrl.port || 3306),
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  database: decodeURIComponent(dbUrl.pathname.replace(/^\/+/, '')),

  // Enable SSL for Enzonic
  ssl: {},

  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
});

module.exports = pool;