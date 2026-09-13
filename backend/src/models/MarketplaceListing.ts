import mongoose, { Document, Schema } from 'mongoose';

export interface IMarketplaceListing extends Document {
  _id: mongoose.Types.ObjectId;
  seller: mongoose.Types.ObjectId;
  title: string;
  description: string;
  price: number;
  category: 'ELECTRONICS' | 'VEHICLES' | 'HOME_GARDEN' | 'CLOTHING' | 'FURNITURE' | 'TOYS_GAMES' | 'OTHER';
  condition: 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR';
  images: string[];
  location?: string;
  status: 'ACTIVE' | 'SOLD';
  createdAt: Date;
  updatedAt: Date;
}

const toUpper = (v: any) => (typeof v === 'string' ? v.toUpperCase() : v);

const listingSchema = new Schema<IMarketplaceListing>(
  {
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 5000 },
    price: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      enum: ['ELECTRONICS', 'VEHICLES', 'HOME_GARDEN', 'CLOTHING', 'FURNITURE', 'TOYS_GAMES', 'OTHER'],
      required: true,
      set: toUpper,
    },
    condition: {
      type: String,
      enum: ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR'],
      required: true,
      set: toUpper,
    },
    // At least one photo is required at the resolver/validation layer (see
    // CreateListingSchema) — a marketplace listing with no photo at all is
    // the one thing this feature can't meaningfully ship without, unlike
    // Event's coverImage or Video's thumbnail, both of which are optional
    // extras on top of a primary url/date that already carries the post.
    images: { type: [String], default: [] },
    location: { type: String, maxlength: 300 },
    status: { type: String, enum: ['ACTIVE', 'SOLD'], default: 'ACTIVE', set: toUpper },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  }
);

listingSchema.index({ seller: 1, createdAt: -1 });
listingSchema.index({ status: 1, category: 1, createdAt: -1 });

export const MarketplaceListing = mongoose.model<IMarketplaceListing>('MarketplaceListing', listingSchema);
