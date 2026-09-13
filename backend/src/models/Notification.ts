import mongoose, { Document, Schema } from 'mongoose';

export type NotificationType =
  | 'FRIEND_REQUEST' | 'FRIEND_ACCEPT' | 'POST_LIKE' | 'POST_COMMENT'
  | 'COMMENT_REPLY' | 'POST_SHARE' | 'POST_TAG' | 'MENTION' | 'STORY_VIEW' | 'MESSAGE' | 'EVENT_RSVP';

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  recipient: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  type: NotificationType;
  entityId?: mongoose.Types.ObjectId;
  entityType?: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

const toUpper = (v: any) => (typeof v === 'string' ? v.toUpperCase() : v);

const notificationSchema = new Schema<INotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['FRIEND_REQUEST', 'FRIEND_ACCEPT', 'POST_LIKE', 'POST_COMMENT',
             'COMMENT_REPLY', 'POST_SHARE', 'POST_TAG', 'MENTION', 'STORY_VIEW', 'MESSAGE', 'EVENT_RSVP'],
      required: true,
      set: toUpper,
    },
    entityId: { type: Schema.Types.ObjectId },
    entityType: { type: String, enum: ['post', 'comment', 'message', 'story', 'event'] },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
