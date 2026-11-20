require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const apiRoutes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('Database health check failed:', error.message);
    res.status(503).json({ status: 'degraded', database: 'unavailable' });
  }
});
app.use('/api', apiRoutes);
app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT || 5000);
app.listen(port, async () => {
  console.log(`Batloung Farm API listening on http://localhost:${port}`);
  try {
    await pool.query('SELECT 1');
    console.log('MySQL connection established.');
  } catch (error) {
    console.error('MySQL is unavailable:', error);
  }
});
