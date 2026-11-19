function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  next(error);
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const databaseUnavailable = [
    'ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT',
    'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR',
  ].includes(error.code);
  const conflict = ['ER_DUP_ENTRY', 'ER_ROW_IS_REFERENCED_2'].includes(error.code);
  const status = error.status || (databaseUnavailable ? 503 : conflict ? 409 : 500);
  const message = error.code === 'ER_DUP_ENTRY'
    ? 'A record with the same unique value already exists.'
    : databaseUnavailable
      ? 'Database connection failed. Check the database credentials and database name in server/.env.'
      : error.message;
  if (status === 500) console.error(error);
  else if (databaseUnavailable) console.error(`Database request failed: ${error.code}`);
  res.status(status).json({
    error: status === 500 ? 'An unexpected server error occurred.' : message,
  });
}

function validationError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

module.exports = { asyncRoute, notFound, errorHandler, validationError };
