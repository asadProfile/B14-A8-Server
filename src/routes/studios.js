import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';

import { STUDIO_CATEGORIES } from '../lib/constants.js';
import { Studio } from '../models/Studio.js';
import { Booking } from '../models/Booking.js';
import { Review } from '../models/Review.js';
import { Wishlist } from '../models/Wishlist.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { escapeRegex, isHttpUrl } from '../utils/helpers.js';
import reviewsRouter from './reviews.js';

const router = Router();

const httpUrl = z
  .string()
  .trim()
  .refine(isHttpUrl, 'Enter a valid http(s) image URL.');

const studioSchema = z.object({
  title: z.string().trim().min(4, 'Give your space a descriptive title.').max(120),
  category: z.enum(STUDIO_CATEGORIES, {
    errorMap: () => ({ message: 'Choose a valid studio category.' }),
  }),
  hourlyRate: z.coerce.number().min(1, 'Hourly rate must be at least $1.').max(100_000),
  securityDeposit: z.coerce.number().min(0).max(100_000).optional().default(0),
  capacity: z.coerce.number().int().min(1, 'Capacity must be at least 1.').max(1000),
  location: z.string().trim().min(4, 'Add a neighbourhood or address.').max(200),
  imageURL: httpUrl,
  images: z.array(httpUrl).max(8, 'Add at most 8 gallery images.').optional().default([]),
  amenities: z.array(z.string().trim().min(1).max(40)).max(24).optional().default([]),
  overview: z
    .string()
    .trim()
    .min(40, 'Write at least 40 characters so creators know what to expect.')
    .max(5000),
});

const listQuerySchema = z.object({
  category: z.enum(STUDIO_CATEGORIES).optional(),
  q: z.string().trim().max(100).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sort: z.enum(['top-rated', 'newest', 'price-asc', 'price-desc']).optional().default('top-rated'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(48).optional().default(9),
});

const ensureObjectId = (id) => {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('That studio could not be found.');
};

const SORT_MAP = {
  'top-rated': { rating: -1, reviewCount: -1, createdAt: -1 },
  newest: { createdAt: -1 },
  'price-asc': { hourlyRate: 1, createdAt: -1 },
  'price-desc': { hourlyRate: -1, createdAt: -1 },
};

const buildFilters = (query) => {
  const filter = {};

  if (query.category) filter.category = query.category;

  if (query.q) {
    const term = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ title: term }, { location: term }, { overview: term }, { category: term }];
  }

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.hourlyRate = {};
    if (query.minPrice !== undefined) filter.hourlyRate.$gte = query.minPrice;
    if (query.maxPrice !== undefined) filter.hourlyRate.$lte = query.maxPrice;
  }

  return filter;
};

/* ------------------------------------------------------------------ */
/* Reviews are nested under a studio                                    */
/* ------------------------------------------------------------------ */

router.use('/:studioId/reviews', reviewsRouter);

/* ------------------------------------------------------------------ */
/* Read                                                                */
/* ------------------------------------------------------------------ */

// Featured studios for the home page: top-rated, hard-limited to six.
router.get(
  '/featured',
  asyncHandler(async (_req, res) => {
    const studios = await Studio.find().sort(SORT_MAP['top-rated']).limit(6);
    res.json({ success: true, studios });
  }),
);

// Listings owned by the signed-in user.
router.get(
  '/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const studios = await Studio.find({ ownerEmail: req.user.email }).sort({ createdAt: -1 });
    res.json({ success: true, studios });
  }),
);

router.get(
  '/',
  validate('query', listQuerySchema),
  asyncHandler(async (req, res) => {
    const { page, limit, sort } = req.query;
    const filter = buildFilters(req.query);

    const [total, studios] = await Promise.all([
      Studio.countDocuments(filter),
      Studio.find(filter)
        .sort(SORT_MAP[sort])
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.json({
      success: true,
      studios,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
        hasMore: page * limit < total,
      },
    });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    ensureObjectId(req.params.id);
    const studio = await Studio.findById(req.params.id);
    if (!studio) throw ApiError.notFound('That studio could not be found. It may have been removed.');

    const related = await Studio.find({
      _id: { $ne: studio._id },
      category: studio.category,
    })
      .sort({ rating: -1 })
      .limit(3);

    res.json({ success: true, studio, related });
  }),
);

/* ------------------------------------------------------------------ */
/* Write (all protected by the HTTPOnly JWT cookie)                    */
/* ------------------------------------------------------------------ */

router.post(
  '/',
  requireAuth,
  validate('body', studioSchema),
  asyncHandler(async (req, res) => {
    const studio = await Studio.create({
      ...req.body,
      ownerEmail: req.user.email,
      ownerName: req.user.name,
      ownerPhoto: req.user.photoURL || '',
    });

    res.status(201).json({
      success: true,
      message: 'Your studio is live. Creators can now discover it.',
      studio,
    });
  }),
);

router.patch(
  '/:id',
  requireAuth,
  validate('body', studioSchema.partial()),
  asyncHandler(async (req, res) => {
    ensureObjectId(req.params.id);
    const studio = await Studio.findById(req.params.id);
    if (!studio) throw ApiError.notFound('That studio could not be found.');
    if (studio.ownerEmail !== req.user.email) {
      throw ApiError.forbidden('Only the host who listed this studio can edit it.');
    }

    const allowed = [
      'title',
      'category',
      'hourlyRate',
      'securityDeposit',
      'capacity',
      'location',
      'imageURL',
      'images',
      'amenities',
      'overview',
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) studio[key] = req.body[key];
    }

    await studio.save();

    res.json({ success: true, message: 'Studio updated.', studio });
  }),
);

router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    ensureObjectId(req.params.id);
    const studio = await Studio.findById(req.params.id);
    if (!studio) throw ApiError.notFound('That studio could not be found.');
    if (studio.ownerEmail !== req.user.email) {
      throw ApiError.forbidden('Only the host who listed this studio can delete it.');
    }

    await Promise.all([
      Wishlist.deleteMany({ studioId: studio._id }),
      Review.deleteMany({ studioId: studio._id }),
      Booking.updateMany(
        { studioId: studio._id, status: 'Pending' },
        { status: 'Cancelled', cancelledAt: new Date() },
      ),
      Studio.deleteOne({ _id: studio._id }),
    ]);

    res.json({ success: true, message: 'Studio removed. Pending requests were cancelled.' });
  }),
);

export default router;
