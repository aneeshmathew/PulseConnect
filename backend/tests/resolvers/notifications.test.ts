import { describe, it, expect } from 'vitest';
import { graphql } from 'graphql';
import { schema, contextFor } from '../helpers/schema';
import { createUser, asContextUser } from '../helpers/factories';
import { Notification } from '../../src/models/Notification';

const NOTIFICATIONS = /* GraphQL */ `
  query Notifications {
    notifications {
      id
      type
      isRead
      sender {
        username
      }
    }
    unreadNotificationsCount
  }
`;

const MARK_READ = /* GraphQL */ `
  mutation MarkRead($id: ID!) {
    markNotificationRead(id: $id) {
      id
      isRead
    }
  }
`;

const DELETE_NOTIFICATION = /* GraphQL */ `
  mutation Delete($id: ID!) {
    deleteNotification(id: $id)
  }
`;

describe('notifications', () => {
  it('lists only the current user\'s notifications, newest first, with an accurate unread count', async () => {
    const recipient = await createUser({ username: 'notif_recipient' });
    const otherUser = await createUser({ username: 'notif_other' });
    const senderA = await createUser({ username: 'notif_sender_a' });
    const senderB = await createUser({ username: 'notif_sender_b' });

    await Notification.create({
      recipient: recipient._id,
      sender: senderA._id,
      type: 'FRIEND_REQUEST',
      message: 'sent you a friend request',
    });
    await Notification.create({
      recipient: recipient._id,
      sender: senderB._id,
      type: 'POST_LIKE',
      message: 'liked your post',
    });
    // Belongs to a different user — must never show up for `recipient`.
    await Notification.create({
      recipient: otherUser._id,
      sender: senderA._id,
      type: 'POST_LIKE',
      message: 'liked your post',
    });

    const viewer = await asContextUser(recipient);
    const result = await graphql({ schema, source: NOTIFICATIONS, contextValue: contextFor(viewer as any) });

    expect(result.errors).toBeUndefined();
    const notifs = result.data?.notifications as any[];
    expect(notifs).toHaveLength(2);
    expect(notifs[0].sender.username).toBe('notif_sender_b'); // newest first
    expect(result.data?.unreadNotificationsCount).toBe(2);
  });

  it('marking one notification read only affects that notification and its owner', async () => {
    const recipient = await createUser({ username: 'markread_recipient' });
    const sender = await createUser({ username: 'markread_sender' });
    const notif = await Notification.create({
      recipient: recipient._id,
      sender: sender._id,
      type: 'FRIEND_ACCEPT',
      message: 'accepted your request',
    });

    const viewer = await asContextUser(recipient);
    const result = await graphql({
      schema,
      source: MARK_READ,
      contextValue: contextFor(viewer as any),
      variableValues: { id: notif._id.toString() },
    });

    expect(result.errors).toBeUndefined();
    expect((result.data?.markNotificationRead as any).isRead).toBe(true);
  });

  it('rejects marking a notification read that belongs to a different user', async () => {
    const owner = await createUser({ username: 'notowner' });
    const attacker = await createUser({ username: 'attacker' });
    const sender = await createUser({ username: 'someone' });
    const notif = await Notification.create({
      recipient: owner._id,
      sender: sender._id,
      type: 'POST_LIKE',
      message: 'liked your post',
    });

    const viewer = await asContextUser(attacker);
    const result = await graphql({
      schema,
      source: MARK_READ,
      contextValue: contextFor(viewer as any),
      variableValues: { id: notif._id.toString() },
    });

    expect(result.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
    const stillUnread = await Notification.findById(notif._id);
    expect(stillUnread?.isRead).toBe(false);
  });

  it('deleting a notification actually removes it, scoped to the owner', async () => {
    const owner = await createUser({ username: 'delowner' });
    const attacker = await createUser({ username: 'delattacker' });
    const sender = await createUser({ username: 'delsender' });
    const notif = await Notification.create({
      recipient: owner._id,
      sender: sender._id,
      type: 'POST_LIKE',
      message: 'liked your post',
    });

    const viewerAttacker = await asContextUser(attacker);
    const attackerAttempt = await graphql({
      schema,
      source: DELETE_NOTIFICATION,
      contextValue: contextFor(viewerAttacker as any),
      variableValues: { id: notif._id.toString() },
    });
    expect(attackerAttempt.data?.deleteNotification).toBe(false);
    expect(await Notification.findById(notif._id)).not.toBeNull();

    const viewerOwner = await asContextUser(owner);
    const ownerAttempt = await graphql({
      schema,
      source: DELETE_NOTIFICATION,
      contextValue: contextFor(viewerOwner as any),
      variableValues: { id: notif._id.toString() },
    });
    expect(ownerAttempt.data?.deleteNotification).toBe(true);
    expect(await Notification.findById(notif._id)).toBeNull();
  });
});
