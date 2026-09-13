import { GraphQLError } from 'graphql';
import { MarketplaceListing } from '../../models/MarketplaceListing';
import { GraphQLContext, requireAuth } from '../context';
import { validate, CreateListingSchema, UpdateListingSchema } from '../../lib/validation';

// Same base64(ISO date) cursor convention as post/video/event resolvers —
// listings paginate by `createdAt` descending (newest first), same as
// Watch's default feed, since Marketplace is a discovery feed, not an
// "upcoming" schedule like Events.
function decodeCursor(cursor: string): Date {
  try {
    return new Date(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new GraphQLError('Invalid pagination cursor', { extensions: { code: 'BAD_USER_INPUT' } });
  }
}

function encodeCursor(date: Date): string {
  return Buffer.from(date.toISOString(), 'utf8').toString('base64url');
}

// Same deleted-author-safe widening-fetch loop as paginateVideos/paginateEvents
// — a listing whose seller has since been deleted is filtered out via
// populate's `match` + a null-check, and simply fetching `safeLimit + 1`
// and filtering afterward would let a deleted-seller listing silently
// shrink the valid count below what's actually available further out,
// making `hasMore` report `false` too early. Capped at 5 attempts.
async function paginateListings(query: any, cursor: string | undefined, safeLimit: number) {
  if (cursor) query.createdAt = { ...(query.createdAt ?? {}), $lt: decodeCursor(cursor) };

  const needed = safeLimit + 1;
  let fetchSize = needed;
  let valid: any[] = [];

  for (let attempt = 0; attempt < 5; attempt++) {
    const listings = await MarketplaceListing.find(query)
      .sort({ createdAt: -1 })
      .limit(fetchSize)
      .populate({ path: 'seller', select: '-password', match: { _id: { $exists: true } } })
      .lean();

    valid = (listings as any[]).filter((l: any) => l.seller != null);
    const exhausted = listings.length < fetchSize;
    if (valid.length >= needed || exhausted) break;
    fetchSize *= 2;
  }

  const hasMore = valid.length > safeLimit;
  const items = hasMore ? valid.slice(0, safeLimit) : valid;
  return {
    listings: items,
    hasMore,
    nextCursor: hasMore ? encodeCursor(items[items.length - 1].createdAt) : null,
  };
}

export const marketplaceResolvers = {
  Query: {
    // Public discovery feed — only ACTIVE listings, optionally scoped to a
    // category. No FRIENDS/PRIVATE visibility concept here (unlike
    // Post/Video/Event): a marketplace is inherently public to the whole
    // community, same as real-world classifieds.
    marketplaceListings: async (_: unknown, { category, cursor, limit = 12 }: any) => {
      const safeLimit = Math.min(Math.max(1, limit), 30);
      const query: any = { status: 'ACTIVE' };
      if (category) query.category = category;
      return paginateListings(query, cursor, safeLimit);
    },

    // Returns a listing regardless of status — someone who already has the
    // link (e.g. from a chat thread) should still be able to see it marked
    // SOLD, rather than hitting a 404-shaped null.
    marketplaceListing: async (_: unknown, { id }: { id: string }) => {
      const listing = await MarketplaceListing.findById(id)
        .populate({ path: 'seller', select: '-password', match: { _id: { $exists: true } } })
        .lean();
      if (!listing || !(listing as any).seller) return null;
      return listing;
    },

    // A seller's own listings page — both ACTIVE and SOLD, since that's
    // the natural "my marketplace history" view, viewable by anyone (no
    // visibility scoping needed, same reasoning as the public feed above).
    userListings: async (_: unknown, { userId, cursor, limit = 12 }: any) => {
      const safeLimit = Math.min(Math.max(1, limit), 30);
      return paginateListings({ seller: userId }, cursor, safeLimit);
    },
  },

  Mutation: {
    createListing: async (_: unknown, { input }: any, { user }: GraphQLContext) => {
      requireAuth(user);
      const data = validate(CreateListingSchema, input);
      const listing = new MarketplaceListing({ ...data, seller: user._id });
      await listing.save();
      await listing.populate('seller', '-password');
      return listing;
    },

    updateListing: async (_: unknown, { id, input }: any, { user }: GraphQLContext) => {
      requireAuth(user);
      const listing = await MarketplaceListing.findById(id);
      if (!listing) throw new GraphQLError('Listing not found', { extensions: { code: 'NOT_FOUND' } });
      if (listing.seller.toString() !== user._id.toString()) {
        throw new GraphQLError('Not authorized', { extensions: { code: 'FORBIDDEN' } });
      }
      const data = validate(UpdateListingSchema, input);
      Object.assign(listing, data);
      await listing.save();
      await listing.populate('seller', '-password');
      return listing;
    },

    deleteListing: async (_: unknown, { id }: { id: string }, { user }: GraphQLContext) => {
      requireAuth(user);
      const listing = await MarketplaceListing.findById(id);
      if (!listing) throw new GraphQLError('Listing not found', { extensions: { code: 'NOT_FOUND' } });
      if (listing.seller.toString() !== user._id.toString()) {
        throw new GraphQLError('Not authorized', { extensions: { code: 'FORBIDDEN' } });
      }
      await listing.deleteOne();
      return true;
    },

    markListingSold: async (_: unknown, { id }: { id: string }, { user }: GraphQLContext) => {
      requireAuth(user);
      const listing = await MarketplaceListing.findById(id);
      if (!listing) throw new GraphQLError('Listing not found', { extensions: { code: 'NOT_FOUND' } });
      if (listing.seller.toString() !== user._id.toString()) {
        throw new GraphQLError('Not authorized', { extensions: { code: 'FORBIDDEN' } });
      }
      listing.status = 'SOLD';
      await listing.save();
      await listing.populate('seller', '-password');
      return listing;
    },

    relistListing: async (_: unknown, { id }: { id: string }, { user }: GraphQLContext) => {
      requireAuth(user);
      const listing = await MarketplaceListing.findById(id);
      if (!listing) throw new GraphQLError('Listing not found', { extensions: { code: 'NOT_FOUND' } });
      if (listing.seller.toString() !== user._id.toString()) {
        throw new GraphQLError('Not authorized', { extensions: { code: 'FORBIDDEN' } });
      }
      listing.status = 'ACTIVE';
      await listing.save();
      await listing.populate('seller', '-password');
      return listing;
    },
  },

  MarketplaceListing: {
    id: (parent: any) => parent._id?.toString() ?? parent.id,
    category: (parent: any) => (parent.category ?? 'OTHER').toUpperCase(),
    condition: (parent: any) => (parent.condition ?? 'GOOD').toUpperCase(),
    status: (parent: any) => (parent.status ?? 'ACTIVE').toUpperCase(),
  },
};
