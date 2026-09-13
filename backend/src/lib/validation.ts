import { z } from 'zod';
import { GraphQLError } from 'graphql';

export const RegisterSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  firstName: z.string().min(1).max(50).trim(),
  lastName: z.string().min(1).max(50).trim(),
  birthDate: z.string().optional(),
});

export const CreatePostSchema = z.object({
  content: z.string().max(63206).optional(),
  visibility: z.enum(['PUBLIC', 'FRIENDS', 'PRIVATE']).optional().default('PUBLIC'),
  location: z.string().max(200).optional(),
  feeling: z.string().max(100).optional(),
  media: z
    .array(
      z.object({
        url: z.string().url(),
        type: z.enum(['IMAGE', 'VIDEO', 'GIF']),
        thumbnail: z.string().url().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        duration: z.number().optional(),
      })
    )
    .max(10)
    .optional(),
  tags: z.array(z.string()).max(20).optional(),
});

export const CreateVideoSchema = z.object({
  url: z.string().url(),
  thumbnail: z.string().url().optional(),
  caption: z.string().max(2200).optional(),
  duration: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  visibility: z.enum(['PUBLIC', 'FRIENDS', 'PRIVATE']).optional().default('PUBLIC'),
});

export const VideoCommentSchema = z.object({
  videoId: z.string().min(1),
  content: z.string().min(1).max(2000),
});

export const CreateEventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(5000).optional(),
  coverImage: z.string().url().optional(),
  location: z.string().max(300).optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional(),
  visibility: z.enum(['PUBLIC', 'FRIENDS', 'PRIVATE']).optional().default('PUBLIC'),
}).refine((data) => !data.endAt || data.endAt >= data.startAt, {
  message: 'endAt must be on or after startAt',
  path: ['endAt'],
});

export const UpdateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  coverImage: z.string().url().optional(),
  location: z.string().max(300).optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional(),
  visibility: z.enum(['PUBLIC', 'FRIENDS', 'PRIVATE']).optional(),
}).refine((data) => !data.endAt || !data.startAt || data.endAt >= data.startAt, {
  message: 'endAt must be on or after startAt',
  path: ['endAt'],
});

export const CreateCommentSchema = z.object({
  postId: z.string().min(1),
  content: z.string().min(1).max(8000),
  parentCommentId: z.string().optional(),
});

export const SendMessageSchema = z.object({
  conversationId: z.string().optional(),
  recipientId: z.string().optional(),
  content: z.string().max(20000).optional(),
  replyToId: z.string().optional(),
}).refine((d) => d.conversationId || d.recipientId, {
  message: 'conversationId or recipientId is required',
});

export const UpdateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  bio: z.string().max(500).optional(),
  location: z.string().max(200).optional(),
  website: z.string().url().optional().or(z.literal('')),
  avatar: z.string().url().optional(),
  coverPhoto: z.string().url().optional(),
});

export const UpdatePrivacySettingsSchema = z.object({
  profileVisibility: z.enum(['public', 'friends', 'private']).optional(),
  postsVisibility: z.enum(['public', 'friends', 'private']).optional(),
});

export const UpdateNotificationSettingsSchema = z.object({
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

/** Validate and throw a proper GraphQL error on failure */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.errors.map((e) => e.message).join(', ');
    throw new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT', details: result.error.errors } });
  }
  return result.data;
}
