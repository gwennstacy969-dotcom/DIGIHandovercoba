const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  const statusCode = err.statusCode || 500;
  
  // Custom response structure
  const response = {
    error: err.message || 'Internal Server Error'
  };

  // Stack trace hanya ditampilkan saat tidak di production
  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
