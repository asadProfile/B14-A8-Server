import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';

import { Review } from '../models/Review.js';
import { Studio } from '../models/Studio.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Mounted at /api/studios/:studioId/reviews
const router = Router({ mergeParams: true });

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, 'Choose a rating from 1 to 5.').max(5),
  comment: z
    .string()
    .trim()
    .min(3, 'Write a short note about your experience.')
    .max(1000, 'Keep reviews under 1000 characters.'),
});

const resolveStudio = async (studioId) => {
  if (!mongoose.isValidObjectId(studioId)) {
    throw ApiError.notFound('That studio could not be found.');
  }
  const studio = await Studio.findById(studioId);
  if (!studio) throw ApiError.notFound('That studio could not be found.');
  return studio;
};

/**
 * Recomputes the denormalised rating on the studio document after any review
 * change, so cards and sorting stay in sync without extra lookups.
 */
const syncStudioRating = async (studioId) => {
  const stats = await Review.aggregate([
    { $match: { studioId: new mongoose.Types.ObjectId(studioId) } },
    { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  const average = stats[0]?.average ?? 0;
  const count = stats[0]?.count ?? 0;
  const rating = Math.round(average * 10) / 10;

  await Studio.updateOne({ _id: studioId }, { rating, reviewCount: count });
  return { rating, reviewCount: count };
};

router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const studio = await resolveStudio(req.params.studioId);

    const [reviews, distribution] = await Promise.all([
      Review.find({ studioId: studio._id }).sort({ createdAt: -1 }).limit(50),
      Review.aggregate([
        { $match: { studioId: new mongoose.Types.ObjectId(studio._id) } },
        { $group: { _id: '$rating', count: { $sum: 1 } } },
      ]),
    ]);

    const buckets = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of distribution) buckets[row._id] = row.count;

    const myReview = req.user
      ? reviews.find((review) => review.userEmail === req.user.email) ?? null
      : null;

    res.json({
      success: true,
      reviews,
      myReview,
      summary: {
        rating: studio.rating,
        reviewCount: studio.reviewCount,
        distribution: buckets,
      },
    });
  }),
);

router.post(
  '/',
  requireAuth,
  validate('body', reviewSchema),
  asyncHandler(async (req, res) => {
    const studio = await resolveStudio(req.params.studioId);

    if (studio.ownerEmail === req.user.email) {
      throw ApiError.forbidden('Hosts cannot review their own space.');
    }

    const review = await Review.findOneAndUpdate(
      { studioId: studio._id, userEmail: req.user.email },
      {
        $set: {
          userName: req.user.name,
          userPhoto: req.user.photoURL || '',
          rating: req.body.rating,
          comment: req.body.comment,
        },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );

    const summary = await syncStudioRating(studio._id);

    res.status(201).json({
      success: true,
      message: 'Thanks for sharing your experience.',
      review,
      summary,
    });
  }),
);

router.delete(
  '/:reviewId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const studio = await resolveStudio(req.params.studioId);
    if (!mongoose.isValidObjectId(req.params.reviewId)) {
      throw ApiError.notFound('That review could not be found.');
    }

    const review = await Review.findOne({ _id: req.params.reviewId, studioId: studio._id });
    if (!review) throw ApiError.notFound('That review could not be found.');
    if (review.userEmail !== req.user.email) {
      throw ApiError.forbidden('You can only remove your own review.');
    }

    await Review.deleteOne({ _id: review._id });
    const summary = await syncStudioRating(studio._id);

    res.json({ success: true, message: 'Review removed.', summary });
  }),
);

export default router;
