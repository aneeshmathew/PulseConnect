import { describe, it, expect } from 'vitest';
import { graphql } from 'graphql';
import { schema, contextFor } from '../helpers/schema';
import { createUser, asContextUser } from '../helpers/factories';
import { Message, Conversation } from '../../src/models/Message';

// Regression coverage for changelog entry 2026-08-22 (10): Mongoose
// defaults a single-nested subdocument (Message.media) to `{}` on every
// document, even when it's never set — so a plain text message ended up
// stored as `media: { url: undefined, ... }` instead of leaving `media`
// genuinely absent. GraphQL then saw a non-null `media` object and threw
// resolving `MessageMedia.url: String!` against `undefined`, which
// surfaced to users as "Internal server error" on every text-only chat
// message. The real fix is `default: undefined` on the media sub-schema
// (models/Message.ts); Message.media's field resolver
// (message.resolvers.ts) is a second, defensive layer specifically for
// documents written before that fix. These tests cover both layers.

const SEND_MESSAGE = /* GraphQL */ `
  mutation Send($input: SendMessageInput!) {
    sendMessage(input: $input) {
      id
      content
      media {
        url
      }
    }
  }
`;

describe('Message.media — text-only messages', () => {
  it('stores media as genuinely absent at the DB level, not {}', async () => {
    const sender = await createUser({ username: 'sender1' });
    const recipient = await createUser({ username: 'recipient1' });

    const viewer = await asContextUser(sender);
    const result = await graphql({
      schema,
      source: SEND_MESSAGE,
      contextValue: contextFor(viewer as any),
      variableValues: { input: { recipientId: recipient._id.toString(), content: 'hey there' } },
    });

    expect(result.errors).toBeUndefined();
    expect((result.data?.sendMessage as any).media).toBeNull();

    // The actual regression check: read the raw document back and confirm
    // `media` is `undefined`, not an empty object with undefined fields —
    // this is the part a resolver-level workaround alone can't guarantee.
    const raw = await Message.findOne({ content: 'hey there' }).lean();
    expect(raw?.media).toBeUndefined();
  });

  it('does not throw when a pre-existing document has a malformed empty media object', async () => {
    // Simulates data written before the `default: undefined` model fix —
    // bypass the schema default via a raw collection update so the
    // malformed shape actually lands in the DB for this one document,
    // the same way old production documents are expected to look.
    const sender = await createUser({ username: 'sender2' });
    const recipient = await createUser({ username: 'recipient2' });
    const conversation = await Conversation.create({
      participants: [sender._id, recipient._id],
      isGroup: false,
    });
    const message = await Message.create({
      conversation: conversation._id,
      sender: sender._id,
      content: 'legacy message',
    });
    await Message.collection.updateOne(
      { _id: message._id },
      { $set: { media: { url: undefined, type: undefined } } }
    );

    const viewer = await asContextUser(sender);
    const result = await graphql({
      schema,
      source: /* GraphQL */ `
        query Msgs($conversationId: ID!) {
          messages(conversationId: $conversationId) {
            id
            media {
              url
            }
          }
        }
      `,
      contextValue: contextFor(viewer as any),
      variableValues: { conversationId: conversation._id.toString() },
    });

    expect(result.errors).toBeUndefined();
    const msgs = result.data?.messages as any[];
    expect(msgs).toHaveLength(1);
    expect(msgs[0].media).toBeNull();
  });
});
