import mongoose from 'mongoose';
import { STUDIO_CATEGORIES } from '../lib/constants.js';

const studioSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, required: true, enum: STUDIO_CATEGORIES },
    hourlyRate: { type: Number, required: true, min: 1, max: 100_000 },
    securityDeposit: { type: Number, default: 0, min: 0, max: 100_000 },
    capacity: { type: Number, required: true, min: 1, max: 1000 },
    location: { type: String, required: true, trim: true, maxlength: 200 },
    imageURL: { type: String, required: true, trim: true },
    images: { type: [String], default: [] },
    amenities: { type: [String], default: [] },
    overview: { type: String, required: true, trim: true, minlength: 40, maxlength: 5000 },
    ownerEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    ownerName: { type: String, required: true, trim: true },
    ownerPhoto: { type: String, default: '' },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        return ret;
      },
    },
  },
);

studioSchema.index({ category: 1, rating: -1 });
studioSchema.index({ title: 'text', location: 'text', overview: 'text' });

export const Studio = mongoose.model('Studio', studioSchema);
