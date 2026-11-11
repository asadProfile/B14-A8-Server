import { Router } from 'express';
import mongoose from 'mongoose';

import { Wishlist } from '../models/Wishlist.js';
import { Studio } from '../models/Studio.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);

const ensureStudioId = (id) => {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('That studio could not be found.');
};

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const entries = await Wishlist.find({ userEmail: req.user.email })
      .sort({ createdAt: -1 })
      .populate('studioId');

    const studios = entries
      .map((entry) => entry.studioId)
      .filter(Boolean)
      .map((studio) => studio.toJSON());

    res.json({
      success: true,
      studios,
      studioIds: studios.map((studio) => studio.id),
    });
  }),
);

// Idempotent toggle used by the heart button on cards.
router.post(
  '/:studioId',
  asyncHandler(async (req, res) => {
    const { studioId } = req.params;
    ensureStudioId(studioId);

    const studio = await Studio.findById(studioId);
    if (!studio) throw ApiError.notFound('That studio could not be found.');

    const existing = await Wishlist.findOne({ userEmail: req.user.email, studioId });

    if (existing) {
      await Wishlist.deleteOne({ _id: existing._id });
      return res.json({ success: true, saved: false, message: 'Removed from your saved studios.' });
    }

    try {
      await Wishlist.create({ userEmail: req.user.email, studioId });
    } catch (error) {
      if (error.code !== 11000) throw error; // Already saved — safe to treat as success.
    }

    res.json({ success: true, saved: true, message: 'Saved to your studio collection.' });
  }),
);

router.delete(
  '/:studioId',
  asyncHandler(async (req, res) => {
    const { studioId } = req.params;
    ensureStudioId(studioId);
    await Wishlist.deleteOne({ userEmail: req.user.email, studioId });
    res.json({ success: true, saved: false, message: 'Removed from your saved studios.' });
  }),
);

export default router;
