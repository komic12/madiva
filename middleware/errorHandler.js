// middleware/errorHandler.js

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message    = err.message    || 'Internal Server Error';

  // Firebase / Firestore errors
  if (err.code === 'auth/email-already-exists')   { statusCode = 409; message = 'Email already registered.'; }
  if (err.code === 'auth/user-not-found')         { statusCode = 404; message = 'User not found.'; }
  if (err.code === 'auth/invalid-email')          { statusCode = 400; message = 'Invalid email address.'; }
  if (err.code === 'auth/wrong-password')         { statusCode = 401; message = 'Invalid credentials.'; }

  // JWT errors
  if (err.name === 'JsonWebTokenError')  { statusCode = 401; message = 'Invalid token.'; }
  if (err.name === 'TokenExpiredError')  { statusCode = 401; message = 'Token expired. Please log in again.'; }

  // Validation errors
  if (err.name === 'ValidationError') { statusCode = 400; }

  if (process.env.NODE_ENV === 'development') {
    console.error('❌ Error:', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

// Async handler wrapper — eliminates try/catch in every controller
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { errorHandler, asyncHandler };
