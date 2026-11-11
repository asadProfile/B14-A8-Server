import { config } from '../config.js';
import { ApiError } from '../utils/ApiError.js';

export const notFound = (req, _res, next) => {
  next(ApiError.notFound(`No route matches ${req.method} ${req.originalUrl}`));
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (error, req, res, _next) => {
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Something went wrong.';
  let details = error.details;

  // Common MongoDB / Mongoose errors mapped to friendly responses.
  if (error.name === 'CastError') {
    statusCode = 400;
    message = 'That identifier is not valid.';
  } else if (error.code === 11000) {
    statusCode = 409;
    message = 'That record already exists.';
    details = error.keyValue;
  } else if (error.name === 'ValidationError') {
    statusCode = 422;
    message = 'Some fields need your attention.';
    details = Object.values(error.errors).map((item) => ({
      field: item.path,
      message: item.message,
    }));
  } else if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Your session has expired. Please sign in again.';
  } else if (error.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'The request body is not valid JSON.';
  } else if (error.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    message = 'That image is too large. Maximum size is 5 MB.';
  }

  if (statusCode >= 500) {
    // Keep server logs useful without leaking internals to clients.
    console.error('[studiosspace:error]', error);
    if (config.isProd) message = 'Something went wrong on our side. Please try again.';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { details } : {}),
  });
};
