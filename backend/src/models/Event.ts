import mongoose, { Document, Schema } from 'mongoose';

// RSVP status is embedded directly on the Event document rather than a
// top-level collection — same reasoning as Video.comments (see Video.ts):
// an event's attendee list is short-lived and always displayed in full
// alongside the event itself, with no independent pagination or threading
// requirement, so embedding keeps this additive with zero changes to any
// existing model.
export interface IEventAttendee {
  user: mongoose.Types.ObjectId;
  status: 'GOING' | 'INTERESTED' | 'DECLINED';
  respondedAt: Date;
}

export interface IEvent extends Document {
  _id: mongoose.Types.ObjectId;
  host: mongoose.Types.ObjectId;
  title: string;
  description: string;
  coverImage?: string;
  location: string;
  startAt: Date;
  endAt?: Date;
  visibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE';
  attendees: IEventAttendee[];
  createdAt: Date;
  updatedAt: Date;
}

const toUpper = (v: any) => (typeof v === 'string' ? v.toUpperCase() : v);

const eventAttendeeSchema = new Schema<IEventAttendee>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['GOING', 'INTERESTED', 'DECLINED'], required: true, set: toUpper },
    respondedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const eventSchema = new Schema<IEvent>(
  {
    host: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, maxlength: 5000, default: '' },
    coverImage: String,
    location: { type: String, maxlength: 300, default: '' },
    startAt: { type: Date, required: true, index: true },
    endAt: Date,
    visibility: {
      type: String,
      enum: ['PUBLIC', 'FRIENDS', 'PRIVATE'],
      default: 'PUBLIC',
      set: toUpper,
    },
    attendees: { type: [eventAttendeeSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  }
);

eventSchema.index({ host: 1, startAt: -1 });
eventSchema.index({ visibility: 1, startAt: 1 });

export const Event = mongoose.model<IEvent>('Event', eventSchema);
