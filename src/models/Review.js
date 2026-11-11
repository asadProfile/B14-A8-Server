import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    studioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Studio', required: true, index: true },
    userEmail: { type: String, required: true, lowercase: true, trim: true },
    userName: { type: String, required: true, trim: true },
    userPhoto: { type: String, default: '' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true, minlength: 3, maxlength: 1000 },
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

reviewSchema.index({ studioId: 1, userEmail: 1 }, { unique: true });

export const Review = mongoose.model('Review', reviewSchema);
