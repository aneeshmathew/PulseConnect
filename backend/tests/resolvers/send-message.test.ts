import { describe, it, expect } from 'vitest';
import { graphql } from 'graphql';
import { schema, contextFor } from '../helpers/schema';
import { createUser, asContextUser } from '../helpers/factories';
import { Conversation } from '../../src/models/Message';

// Integration coverage requested in DEVELOPMENT.md §3: sendMessage with a
// recipientId and no prior conversation must find-or-create the DM
// conversation exactly once, not error and not create duplicates on
// repeated messages between the same two users.

const SEND_MESSAGE = /* GraphQL */ `
  mutation Send($input: SendMessageInput!) {
    sendMessage(input: $input) {
      id
      content
      conversation {
        id
        participants {
          id
        }
      }
    }
  }
`;

describe('sendMessage — no prior conversation', () => {
  it('creates a new DM conversation on the first message between two users', async () => {
    const sender = await createUser({ username: 'newdm_sender' });
    const recipient = await createUser({ username: 'newdm_recipient' });

    expect(await Conversation.countDocuments()).toBe(0);

    const viewer = await asContextUser(sender);
    const result = await graphql({
      schema,
      source: SEND_MESSAGE,
      contextValue: contextFor(viewer as any),
      variableValues: { input: { recipientId: recipient._id.toString(), content: 'first message' } },
    });

    expect(result.errors).toBeUndefined();
    const sent = result.data?.sendMessage as any;
    expect(sent.content).toBe('first message');
    expect(sent.conversation).toBeTruthy();

    const participantIds = sent.conversation.participants.map((p: any) => p.id).sort();
    expect(participantIds).toEqual([recipient._id.toString(), sender._id.toString()].sort());
    expect(await Conversation.countDocuments()).toBe(1);
  });

  it('reuses the existing DM conversation on a second message instead of creating a duplicate', async () => {
    const sender = await createUser({ username: 'reuse_sender' });
    const recipient = await createUser({ username: 'reuse_recipient' });
    const viewer = await asContextUser(sender);

    const first = await graphql({
      schema,
      source: SEND_MESSAGE,
      contextValue: contextFor(viewer as any),
      variableValues: { input: { recipientId: recipient._id.toString(), content: 'msg 1' } },
    });
    expect(first.errors).toBeUndefined();

    const second = await graphql({
      schema,
      source: SEND_MESSAGE,
      contextValue: contextFor(viewer as any),
      variableValues: { input: { recipientId: recipient._id.toString(), content: 'msg 2' } },
    });
    expect(second.errors).toBeUndefined();

    const firstConvId = (first.data?.sendMessage as any).conversation.id;
    const secondConvId = (second.data?.sendMessage as any).conversation.id;
    expect(secondConvId).toBe(firstConvId);
    expect(await Conversation.countDocuments()).toBe(1);
  });

  it('works identically regardless of which of the two users sends first', async () => {
    const userA = await createUser({ username: 'either_a' });
    const userB = await createUser({ username: 'either_b' });

    const viewerA = await asContextUser(userA);
    await graphql({
      schema,
      source: SEND_MESSAGE,
      contextValue: contextFor(viewerA as any),
      variableValues: { input: { recipientId: userB._id.toString(), content: 'from A' } },
    });

    const viewerB = await asContextUser(userB);
    const reply = await graphql({
      schema,
      source: SEND_MESSAGE,
      contextValue: contextFor(viewerB as any),
      variableValues: { input: { recipientId: userA._id.toString(), content: 'from B' } },
    });

    expect(reply.errors).toBeUndefined();
    expect(await Conversation.countDocuments()).toBe(1);
  });

  // Found while writing this test file, not from the changelog: sendMessage's
  // Message.conversation fallback fetch (`Conversation.findById(...).lean()`,
  // no `.populate('participants')`) left `participants` as raw ObjectIds
  // with no field resolver to lazy-load them — the same bug class as
  // User.friends/Post.tags, just not yet caught here. Fixed alongside this
  // test by adding a Conversation.participants field resolver.
  it('resolves each participant to a full User, not a bare id, on a brand-new conversation', async () => {
    const sender = await createUser({ username: 'fullpart_sender' });
    const recipient = await createUser({ username: 'fullpart_recipient' });
    const viewer = await asContextUser(sender);

    const result = await graphql({
      schema,
      source: /* GraphQL */ `
        mutation Send($input: SendMessageInput!) {
          sendMessage(input: $input) {
            conversation {
              participants {
                id
                username
                fullName
              }
            }
          }
        }
      `,
      contextValue: contextFor(viewer as any),
      variableValues: { input: { recipientId: recipient._id.toString(), content: 'hi' } },
    });

    expect(result.errors).toBeUndefined();
    const participants = (result.data?.sendMessage as any).conversation.participants;
    expect(participants).toHaveLength(2);
    const usernames = participants.map((p: any) => p.username).sort();
    expect(usernames).toEqual(['fullpart_recipient', 'fullpart_sender']);
    participants.forEach((p: any) => {
      expect(p.id).toBeTruthy();
      expect(typeof p.fullName).toBe('string');
    });
  });
});
