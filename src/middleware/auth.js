import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { readAuthToken, verifyAuthToken } from '../utils/token.js';

const resolveUser = async (req) => {
  const token = readAuthToken(req);
  if (!token) return null;

  let payload;
  try {
    payload = verifyAuthToken(token);
  } catch {
    return null;
  }

  const user = await User.findById(payload.sub);
  if (!user) return null;
  return user;
};

const attachUser = async (req) => {
  const token = readAuthToken(req);
  if (!token) throw ApiError.unauthorized();

  let payload;
  try {
    payload = verifyAuthToken(token);
  } catch (error) {
    throw error;
  }

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('Your account could not be found. Please sign in again.');
  req.user = user;
};

/**
 * Rejects requests without a valid JWT in the HTTPOnly cookie (or a Bearer
 * token, useful for API clients). Used on every mutating endpoint.
 */
export const requireAuth = async (req, _res, next) => {
  try {
    await attachUser(req);
    next();
  } catch (error) {
    next(error);
  }
};

/** Attaches req.user when a valid cookie exists, but never rejects. */
export const optionalAuth = async (req, _res, next) => {
  try {
    req.user = await resolveUser(req);
  } catch {
    req.user = null;
  }
  next();
};
