import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';

import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { absoluteUrl } from '../utils/helpers.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

const ALLOWED_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      return callback(new ApiError(415, 'Please upload a JPG, PNG, WebP or GIF image.'));
    }
    callback(null, true);
  },
});

const uploadToImgBB = async (buffer) => {
  const body = new URLSearchParams({ image: buffer.toString('base64') });
  const response = await fetch(
    `https://api.imgbb.com/1/upload?key=${encodeURIComponent(config.imgbbKey)}`,
    { method: 'POST', body, signal: AbortSignal.timeout(20_000) },
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.data?.url) {
    throw new ApiError(502, 'The image service could not accept that file. Please try again.');
  }
  return payload.data.url;
};

/*
 * Vercel functions have a read-only filesystem, so hosted uploads go to
 * Vercel Blob (the store is connected to the project and injects
 * BLOB_READ_WRITE_TOKEN). Local disks and ImgBB still work everywhere else.
 */
const uploadToBlob = async (file) => {
  const extension = ALLOWED_TYPES.get(file.mimetype);
  const pathname = `studios/${Date.now()}-${randomUUID().slice(0, 8)}.${extension}`;

  const response = await fetch(`https://blob.vercel-storage.com/${pathname}`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${config.blobToken}`,
      'x-api-version': '7',
      'x-content-type': file.mimetype,
      'x-add-random-suffix': '0',
    },
    body: file.buffer,
    signal: AbortSignal.timeout(20_000),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.url) {
    throw new ApiError(502, 'The image service could not accept that file. Please try again.');
  }
  return payload.url;
};

const uploadLocally = async (file) => {
  await fs.mkdir(uploadsDir, { recursive: true });
  const extension = ALLOWED_TYPES.get(file.mimetype);
  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}.${extension}`;
  await fs.writeFile(path.join(uploadsDir, filename), file.buffer);
  return { filename, relativePath: `/uploads/${filename}` };
};

router.post(
  '/',
  requireAuth,
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('Choose an image to upload.');

    if (config.imgbbKey) {
      const url = await uploadToImgBB(req.file.buffer);
      return res.status(201).json({
        success: true,
        url,
        provider: 'imgbb',
        message: 'Image uploaded.',
      });
    }

    if (config.blobToken) {
      const url = await uploadToBlob(req.file);
      return res.status(201).json({
        success: true,
        url,
        provider: 'vercel-blob',
        message: 'Image uploaded.',
      });
    }

    const { filename, relativePath } = await uploadLocally(req.file);
    res.status(201).json({
      success: true,
      url: absoluteUrl(req, relativePath),
      filename,
      provider: 'local',
      message: 'Image uploaded.',
    });
  }),
);

export default router;
