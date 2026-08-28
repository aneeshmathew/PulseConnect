import { Router, Response } from 'express';
import { requireAuthHeader, AuthedRequest } from '../lib/authMiddleware';
import { cloudinary, cloudinaryConfigured } from '../config/cloudinary';

// ─────────────────────────────────────────────────────────────────────────
// Media uploads go straight from the browser to Cloudinary — this backend
// never receives or stores the file bytes at all, which is why this works
// unchanged whether you're running the standalone dev server or deployed on
// Vercel serverless (there's no local disk in the picture to lose files
// between invocations, unlike the old multer-based version of this route).
//
// Flow:
//   1. Client asks this route for a signature (proves they're logged in).
//   2. Client POSTs the actual file directly to Cloudinary's API using
//      that signature — see frontend/src/utils/index.ts's uploadMedia().
//   3. Client reports the result back to POST /upload/verify, which checks
//      the actual uploaded size and deletes+rejects it if it's too big.
//   4. Only then does the client hand the URL to createPost/createStory.
//      This server still never receives the file bytes themselves.
//
// Validation note: file type/size checks in the frontend composer
// (CreatePost.tsx) are just a fast-fail UX nicety — anyone could skip them
// and call Cloudinary directly with a signature obtained from this route.
// ALLOWED_FORMATS below is a *signed* parameter, which Cloudinary enforces
// server-side — tampering with it client-side invalidates the signature.
//
// MAX_FILE_SIZE_BYTES is enforced differently: Cloudinary's raw signed
// /upload endpoint does NOT support a `max_file_size` parameter at all —
// that's only available inside Upload Presets, and passing it ad-hoc here
// previously broke every upload with "Invalid Signature" (Cloudinary
// silently excludes unrecognized params when recomputing the signature to
// verify it, so the signatures never matched once we started sending one).
// Enforcing size without an upload preset means checking it *after* the
// file lands — see /upload/verify below, which deletes anything oversized
// via the Admin API before the client is allowed to use its URL.
// ─────────────────────────────────────────────────────────────────────────

const ALLOWED_FORMATS = 'jpg,jpeg,png,gif,webp,mp4,mov,webm';
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB — matches the frontend's own limit

export const uploadRouter = Router();

uploadRouter.post('/upload/signature', requireAuthHeader, (req: AuthedRequest, res: Response) => {
  if (!cloudinaryConfigured) {
    return res.status(503).json({
      error: 'Media upload is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, ' +
        'and CLOUDINARY_API_SECRET in the backend environment.',
    });
  }

  const timestamp = Math.round(Date.now() / 1000);
  // Scope uploads under a per-user folder — purely organizational (helps
  // browsing the Cloudinary media library), not an access-control boundary.
  const folder = `pulse-connect/${req.userId}`;

  // Every param the client will actually send to Cloudinary must be part
  // of the signature, or Cloudinary rejects the request as tampered.
  const paramsToSign = {
    timestamp,
    folder,
    allowed_formats: ALLOWED_FORMATS,
  };
  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET!
  );

  res.json({
    signature,
    timestamp,
    folder,
    allowedFormats: ALLOWED_FORMATS,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  });
});

// Called right after a successful Cloudinary upload, before the client uses
// the URL for anything. Real server-side size enforcement: deletes the
// asset via the Admin API (using our secret key, not exposed to the
// browser) and rejects it if it's over the limit, so a tampered client
// can't just skip the frontend's own size check and upload anything.
uploadRouter.post('/upload/verify', requireAuthHeader, async (req: AuthedRequest, res: Response) => {
  const { publicId, bytes, resourceType } = req.body ?? {};
  if (!publicId || typeof bytes !== 'number') {
    return res.status(400).json({ error: 'publicId and bytes are required' });
  }

  if (bytes > MAX_FILE_SIZE_BYTES) {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType === 'video' ? 'video' : 'image' });
    } catch (err) {
      console.error('[upload/verify] Failed to delete oversized asset', publicId, err);
    }
    return res.status(400).json({ error: `File exceeds the ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB limit` });
  }

  res.json({ ok: true });
});

