/** Escapes user input before it is used inside a MongoDB regex. */
export const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Restricts a string to absolute http(s) URLs (blocks javascript: etc.). */
export const isHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

/** Converts "HH:mm" into minutes since midnight. */
export const timeToMinutes = (value) => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

export const roundMoney = (value) => Math.round(value * 100) / 100;

/** Builds an absolute URL for a locally stored upload. */
export const absoluteUrl = (req, relativePath) => {
  const configured = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
  if (configured) return `${configured}${relativePath}`;
  return `${req.protocol}://${req.get('host')}${relativePath}`;
};
