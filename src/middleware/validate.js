import { ApiError } from '../utils/ApiError.js';

/**
 * Validates a request against a zod schema. Parsed output replaces the raw
 * input so downstream handlers only ever see trusted, typed data.
 *
 * @param {'body'|'query'|'params'} part
 * @param {import('zod').ZodSchema} schema
 */
export const validate = (part, schema) => (req, _res, next) => {
  const result = schema.safeParse(req[part]);

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || part,
      message: issue.message,
    }));
    return next(ApiError.unprocessable('Some fields need your attention.', details));
  }

  // req.query is a getter-only property on some Express setups; assign safely.
  try {
    req[part] = result.data;
  } catch {
    Object.defineProperty(req, part, { value: result.data, configurable: true });
  }
  next();
};
