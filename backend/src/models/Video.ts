import mongoose, { Document, Schema } from 'mongoose';

// Same reaction shape/enum as Post (backend/src/models/Post.ts) — kept
// deliberately identical so the frontend can reuse REACTION_EMOJIS /
// REACTION_COLORS and the ReactionType GraphQL enum without a special case
// for videos.
export interface IVideoReaction {
  user: mongoose.Types.ObjectId;
  type: 'LIKE' | 'LOVE' | 'HAHA' | 'WOW' | 'SAD' | 'ANGRY';
  createdAt: Date;
}

// Watch comments are intentionally flat (no threaded replies) and embedded
// directly on the video document rather than in the shared `Comment`
// collection. Post's comments need threading + independent pagination at
// scale, which is why they're a top-level collection; a reel's comment
// list is short-lived and displayed in full below the video, so embedding
// keeps this additive — zero changes to the existing Comment model/schema
// that Post/Comment resolvers already depend on. Can be split out into its
// own collection later if Watch comments grow real threading requirements.
export interface IVideoComment {
  _id: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  content: string;
  createdAt: Date;
}

export interface IVideo extends Document {
  _id: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  url: string;
  thumbnail?: string;
  caption: string;
  duration?: number;
  width?: number;
  height?: number;
  visibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE';
  reactions: IVideoReaction[];
  comments: IVideoComment[];
  shares: mongoose.Types.ObjectId[];
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const toUpper = (v: any) => (typeof v === 'string' ? v.toUpperCase() : v);

const videoReactionSchema = new Schema<IVideoReaction>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['LIKE', 'LOVE', 'HAHA', 'WOW', 'SAD', 'ANGRY'], required: true, set: toUpper },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const videoCommentSchema = new Schema<IVideoComment>({
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, maxlength: 2000 },
  createdAt: { type: Date, default: Date.now },
});

const videoSchema = new Schema<IVideo>(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    url: { type: String, required: true },
    thumbnail: String,
    caption: { type: String, maxlength: 2200, default: '' },
    duration: Number,
    width: Number,
    height: Number,
    visibility: {
      type: String,
      enum: ['PUBLIC', 'FRIENDS', 'PRIVATE'],
      default: 'PUBLIC',
      set: toUpper,
    },
    reactions: { type: [videoReactionSchema], default: [] },
    comments: { type: [videoCommentSchema], default: [] },
    shares: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    viewCount: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  }
);

videoSchema.index({ author: 1, createdAt: -1 });
videoSchema.index({ visibility: 1, createdAt: -1 });

export const Video = mongoose.model<IVideo>('Video', videoSchema);
