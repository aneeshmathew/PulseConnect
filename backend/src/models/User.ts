import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  coverPhoto?: string;
  bio?: string;
  location?: string;
  website?: string;
  birthDate?: Date;
  friends: mongoose.Types.ObjectId[];
  friendRequests: { from: mongoose.Types.ObjectId; sentAt: Date }[];
  savedPosts: mongoose.Types.ObjectId[];
  following: mongoose.Types.ObjectId[];
  followers: mongoose.Types.ObjectId[];
  isOnline: boolean;
  lastSeen: Date;
  isVerified: boolean;
  role: 'user' | 'admin';
  privacySettings: {
    profileVisibility: 'public' | 'friends' | 'private';
    postsVisibility: 'public' | 'friends' | 'private';
  };
  notificationSettings: {
    emailNotifications: boolean;
    pushNotifications: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true, // ✅ always lowercase — prevents "Alice" / "alice" split
      minlength: 3,
      maxlength: 30,
      match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, underscores'],
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    // ✅ select: false means password never comes back in queries unless explicitly asked for
    password: { type: String, required: true, minlength: 8, select: false },
    firstName: { type: String, required: true, trim: true, maxlength: 50 },
    lastName: { type: String, required: true, trim: true, maxlength: 50 },
    avatar: { type: String, default: null },
    coverPhoto: { type: String, default: null },
    bio: { type: String, maxlength: 500, default: '' },
    location: { type: String, default: '', maxlength: 200 },
    website: { type: String, default: '', maxlength: 200 },
    birthDate: { type: Date },
    friends: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    friendRequests: [{
      from: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      sentAt: { type: Date, default: Date.now },
    }],
    // Backs the Saved page — bookmarked posts, not tied to friendship or
    // ownership. A plain array of ids (not full subdocuments) since there's
    // nothing else to store per save (no "saved at" timestamp needed for
    // the UI as designed — most-recently-saved-first isn't a requirement).
    savedPosts: [{ type: Schema.Types.ObjectId, ref: 'Post' }],
    following: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    followers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    isVerified: { type: Boolean, default: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    privacySettings: {
      profileVisibility: { type: String, enum: ['public', 'friends', 'private'], default: 'public' },
      postsVisibility: { type: String, enum: ['public', 'friends', 'private'], default: 'public' },
    },
    notificationSettings: {
      emailNotifications: { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
    // ✅ Don't leak __v in API responses
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  }
);

// ── Virtual ───────────────────────────────────────────────────────────────────
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// ── Password hashing ──────────────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  // ✅ Salt rounds 12 — good balance of security and speed
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── Indexes ───────────────────────────────────────────────────────────────────
// email and username are indexed via unique:true — no extra index needed
userSchema.index({ firstName: 'text', lastName: 'text' });
userSchema.index({ isOnline: 1 });
userSchema.index({ friends: 1 }); // for friend-of-friend queries

export const User = mongoose.model<IUser>('User', userSchema);
