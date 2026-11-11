import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';

import { Booking } from '../models/Booking.js';
import { Studio } from '../models/Studio.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { roundMoney, timeToMinutes } from '../utils/helpers.js';

const router = Router();

const SERVICE_FEE_RATE = 0.05;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const todayInUtc = () => new Date().toISOString().slice(0, 10);

const createBookingSchema = z
  .object({
    studioId: z.string().refine((id) => mongoose.isValidObjectId(id), 'Choose a valid studio.'),
    date: z
      .string()
      .regex(DATE_PATTERN, 'Choose a valid date.')
      .refine((value) => value >= todayInUtc(), 'Choose today or a future date.'),
    startTime: z.string().regex(TIME_PATTERN, 'Choose a valid start time.'),
    endTime: z.string().regex(TIME_PATTERN, 'Choose a valid end time.'),
    note: z.string().trim().max(500).optional().default(''),
  })
  .superRefine((value, ctx) => {
    const start = timeToMinutes(value.startTime);
    const end = timeToMinutes(value.endTime);

    if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endTime'],
        message: 'End time must be after the start time.',
      });
      return;
    }

    if (end - start < 60) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endTime'],
        message: 'The minimum booking is one hour.',
      });
    }

    if (end - start > 12 * 60) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endTime'],
        message: 'Bookings are capped at 12 hours. Split longer shoots into two requests.',
      });
    }
  });

const ensureObjectId = (id) => {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('That booking could not be found.');
};

const findConfirmedOverlap = (studioId, date, startTime, endTime, excludeId = null) =>
  Booking.findOne({
    studioId,
    date,
    status: 'Confirmed',
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

router.post(
  '/',
  requireAuth,
  validate('body', createBookingSchema),
  asyncHandler(async (req, res) => {
    const { studioId, date, startTime, endTime, note } = req.body;

    const studio = await Studio.findById(studioId);
    if (!studio) throw ApiError.notFound('That studio could not be found.');

    if (studio.ownerEmail === req.user.email) {
      throw ApiError.forbidden('This is your own listing — you cannot book your own space.');
    }

    // Challenge 2: reject any collision with an existing confirmed booking.
    const confirmedConflict = await findConfirmedOverlap(studioId, date, startTime, endTime);
    if (confirmedConflict) {
      throw ApiError.conflict(
        `That slot overlaps a confirmed booking (${confirmedConflict.startTime}–${confirmedConflict.endTime}). Pick a different time.`,
        {
          date,
          startTime: confirmedConflict.startTime,
          endTime: confirmedConflict.endTime,
        },
      );
    }

    // Friendly guard against accidental duplicate pending requests.
    const duplicatePending = await Booking.findOne({
      studioId,
      date,
      status: 'Pending',
      userEmail: req.user.email,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    });
    if (duplicatePending) {
      throw ApiError.conflict('You already have a pending request for this slot.');
    }

    const hours = (timeToMinutes(endTime) - timeToMinutes(startTime)) / 60;
    const subtotal = roundMoney(studio.hourlyRate * hours);
    const serviceFee = roundMoney(subtotal * SERVICE_FEE_RATE);
    const total = roundMoney(subtotal + serviceFee);

    const booking = await Booking.create({
      studioId: studio._id,
      studioSnapshot: {
        title: studio.title,
        imageURL: studio.imageURL,
        category: studio.category,
        location: studio.location,
      },
      userEmail: req.user.email,
      userName: req.user.name,
      ownerEmail: studio.ownerEmail,
      date,
      startTime,
      endTime,
      hours,
      hourlyRate: studio.hourlyRate,
      subtotal,
      serviceFee,
      securityDeposit: studio.securityDeposit || 0,
      total,
      note,
      status: 'Pending',
    });

    res.status(201).json({
      success: true,
      message: 'Request sent. The host will confirm your slot shortly.',
      booking,
    });
  }),
);

/* ------------------------------------------------------------------ */
/* Read                                                                */
/* ------------------------------------------------------------------ */

router.get(
  '/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const bookings = await Booking.find({ userEmail: req.user.email }).sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  }),
);

// Incoming requests for spaces the signed-in user hosts.
router.get(
  '/host',
  requireAuth,
  asyncHandler(async (req, res) => {
    const bookings = await Booking.find({ ownerEmail: req.user.email }).sort({
      date: 1,
      startTime: 1,
    });
    res.json({ success: true, bookings });
  }),
);

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    ensureObjectId(req.params.id);
    const booking = await Booking.findById(req.params.id);
    if (!booking) throw ApiError.notFound('That booking could not be found.');
    if (booking.userEmail !== req.user.email && booking.ownerEmail !== req.user.email) {
      throw ApiError.forbidden('You do not have access to this booking.');
    }
    res.json({ success: true, booking });
  }),
);

/* ------------------------------------------------------------------ */
/* Status transitions                                                  */
/* ------------------------------------------------------------------ */

router.patch(
  '/:id/cancel',
  requireAuth,
  asyncHandler(async (req, res) => {
    ensureObjectId(req.params.id);
    const booking = await Booking.findById(req.params.id);
    if (!booking) throw ApiError.notFound('That booking could not be found.');
    if (booking.userEmail !== req.user.email) {
      throw ApiError.forbidden('Only the guest who made this request can cancel it.');
    }
    if (booking.status !== 'Pending') {
      throw ApiError.conflict(`Only pending requests can be cancelled. This one is ${booking.status.toLowerCase()}.`);
    }

    booking.status = 'Cancelled';
    booking.cancelledAt = new Date();
    await booking.save();

    res.json({ success: true, message: 'Booking cancelled.', booking });
  }),
);

router.patch(
  '/:id/confirm',
  requireAuth,
  asyncHandler(async (req, res) => {
    ensureObjectId(req.params.id);
    const booking = await Booking.findById(req.params.id);
    if (!booking) throw ApiError.notFound('That booking could not be found.');
    if (booking.ownerEmail !== req.user.email) {
      throw ApiError.forbidden('Only the host can confirm this request.');
    }
    if (booking.status !== 'Pending') {
      throw ApiError.conflict(`Only pending requests can be confirmed. This one is ${booking.status.toLowerCase()}.`);
    }

    const conflict = await findConfirmedOverlap(
      booking.studioId,
      booking.date,
      booking.startTime,
      booking.endTime,
      booking._id,
    );
    if (conflict) {
      throw ApiError.conflict(
        `Cannot confirm — these hours overlap another confirmed booking (${conflict.startTime}–${conflict.endTime}).`,
      );
    }

    booking.status = 'Confirmed';
    await booking.save();

    res.json({ success: true, message: 'Booking confirmed.', booking });
  }),
);

router.patch(
  '/:id/complete',
  requireAuth,
  asyncHandler(async (req, res) => {
    ensureObjectId(req.params.id);
    const booking = await Booking.findById(req.params.id);
    if (!booking) throw ApiError.notFound('That booking could not be found.');
    if (booking.ownerEmail !== req.user.email) {
      throw ApiError.forbidden('Only the host can complete this booking.');
    }
    if (booking.status !== 'Confirmed') {
      throw ApiError.conflict('Only confirmed bookings can be marked complete.');
    }

    booking.status = 'Completed';
    await booking.save();

    res.json({ success: true, message: 'Booking marked as completed.', booking });
  }),
);

export default router;
