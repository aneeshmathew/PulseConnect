import mongoose, { Document, Schema } from 'mongoose';

export interface IStory extends Document {
  _id: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  media?: {
    url: string;
    type: 'image' | 'video';
    duration?: number;
    thumbnail?: string;
  };
  text?: string;
  textStyle?: {
    color: string;
    fontSize: number;
    fontFamily: string;
    position: { x: number; y: number };
  };
  backgroundColor?: string;
  gradient?: string[];
  views: { user: mongoose.Types.ObjectId; viewedAt: Date }[];
  reactions: { user: mongoose.Types.ObjectId; emoji: string; createdAt: Date }[];
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
}

const storySchema = new Schema<IStory>(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Optional — a story can be photo/video (media set) OR text-only (just
    // `text` + `backgroundColor`, no media at all). Wrapped as an explicit
    // sub-schema with `default: undefined` rather than the old shorthand
    // `{ url: {...}, type: {...} }` object, which was `required: true` on
    // both sub-fields — that actually *prevented* text-only stories from
    // ever being saved, even though `text`/`backgroundColor`/`textStyle`/
    // `gradient` below clearly show text-only stories were intended.
    // Explicit sub-schema + `default: undefined` also avoids the Mongoose
    // "single nested subdocument defaults to {}" gotcha that caused the
    // Message.media bug earlier — same fix, applied here before it could
    // bite in the same way.
    media: {
      type: new Schema({
        url: { type: String, required: true },
        type: { type: String, enum: ['image', 'video'], required: true },
        duration: Number,
        thumbnail: String,
      }, { _id: false }),
      default: undefined,
    },
    text: String,
    textStyle: {
      color: String,
      fontSize: Number,
      fontFamily: String,
      position: { x: Number, y: Number },
    },
    backgroundColor: String,
    gradient: [String],
    views: [{
      user: { type: Schema.Types.ObjectId, ref: 'User' },
      viewedAt: { type: Date, default: Date.now },
    }],
    reactions: [{
      user: { type: Schema.Types.ObjectId, ref: 'User' },
      emoji: String,
      createdAt: { type: Date, default: Date.now },
    }],
    expiresAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

storySchema.index({ author: 1, isActive: 1 });
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Story = mongoose.model<IStory>('Story', storySchema);
