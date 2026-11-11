import mongoose from 'mongoose';
import { BOOKING_STATUSES } from '../lib/constants.js';

const snapshotSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    imageURL: { type: String, required: true },
    category: { type: String, required: true },
    location: { type: String, required: true },
  },
  { _id: false },
);

const bookingSchema = new mongoose.Schema(
  {
    studioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Studio', required: true, index: true },
    studioSnapshot: { type: snapshotSchema, required: true },
    userEmail: { type: String, required: true, lowercase: true, index: true },
    userName: { type: String, required: true },
    ownerEmail: { type: String, required: true, lowercase: true, index: true },
    date: { type: String, required: true }, // YYYY-MM-DD — timezone-safe for slot matching
    startTime: { type: String, required: true }, // HH:mm (24h)
    endTime: { type: String, required: true },
    hours: { type: Number, required: true, min: 0.5 },
    hourlyRate: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    serviceFee: { type: Number, required: true, min: 0 },
    securityDeposit: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    note: { type: String, default: '', maxlength: 500 },
    status: { type: String, enum: BOOKING_STATUSES, default: 'Pending', index: true },
    cancelledAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        ret.studioId = ret.studioId?.toString?.() ?? ret.studioId;
        delete ret._id;
        return ret;
      },
    },
  },
);

// Supports the confirmed-overlap query used to prevent double bookings.
bookingSchema.index({ studioId: 1, date: 1, status: 1 });

export const Booking = mongoose.model('Booking', bookingSchema);
