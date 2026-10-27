const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack, path: req.originalUrl, method: req.method });

  const statusCode = err.statusCode || 500;
  
  // Custom response structure: sanitize 500 message in production
  let clientMessage = err.message || 'Internal Server Error';
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    clientMessage = 'Terjadi kesalahan pada sistem backend (Internal Server Error)';
  }

  const response = {
    error: clientMessage
  };

  // Stack trace hanya ditampilkan saat tidak di production
  if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
