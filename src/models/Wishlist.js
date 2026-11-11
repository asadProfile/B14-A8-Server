import mongoose from 'mongoose';

const wishlistSchema = new mongoose.Schema(
  {
    userEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    studioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Studio', required: true },
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

wishlistSchema.index({ userEmail: 1, studioId: 1 }, { unique: true });

export const Wishlist = mongoose.model('Wishlist', wishlistSchema);
