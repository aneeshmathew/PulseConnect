import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Date formatting ───────────────────────────────────────────────────────────

export function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return '';
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return '';
  }
}

export function formatMessageTime(date: string | Date | null | undefined): string {
  if (!date) return '';
  try {
    const d = new Date(date);
    if (isToday(d)) return format(d, 'h:mm a');
    if (isYesterday(d)) return `Yesterday ${format(d, 'h:mm a')}`;
    return format(d, 'MMM d, h:mm a');
  } catch {
    return '';
  }
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '';
  try {
    return format(new Date(date), 'MMMM d, yyyy');
  } catch {
    return '';
  }
}

// ── Media upload ──────────────────────────────────────────────────────────
// Files never touch our own backend. Flow:
//   1. Ask our backend for a signature (POST /api/upload/signature) — this
//      proves the request came from a logged-in user without exposing our
//      Cloudinary API secret to the browser.
//   2. POST the actual file straight to Cloudinary's API using that
//      signature. Our server's compute is never in the request path for
//      the file bytes, which is why this works identically on the
//      standalone dev server and on Vercel serverless — there's no local
//      disk involved anywhere.
//   3. Cloudinary returns a permanent, CDN-backed URL we hand to the
//      createPost/createStory GraphQL mutations.
export interface UploadedMedia {
  url: string;
  type: 'IMAGE' | 'VIDEO' | 'GIF';
  filename: string;
  size: number;
}

function apiBaseUrl(): string {
  // Mirror the derivation in lib/apollo.ts so uploads always hit the same
  // backend the GraphQL client is configured for.
  const isDevServer = import.meta.env.DEV;
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const graphqlUrl = isDevServer
    ? 'http://localhost:4000/graphql'
    : (import.meta.env.VITE_GRAPHQL_URL ?? (isLocalhost ? 'http://localhost:4000/graphql' : '/api/graphql'));
  return graphqlUrl.replace(/\/graphql$/, '');
}

interface UploadSignature {
  signature: string;
  timestamp: number;
  folder: string;
  allowedFormats: string;
  apiKey: string;
  cloudName: string;
}

async function getUploadSignature(): Promise<UploadSignature> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${apiBaseUrl()}/api/upload/signature`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Could not start upload (${res.status})`);
  }
  return res.json();
}

export async function uploadMedia(file: File): Promise<UploadedMedia> {
  const { signature, timestamp, folder, allowedFormats, apiKey, cloudName } = await getUploadSignature();

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', apiKey);
  formData.append('timestamp', String(timestamp));
  formData.append('signature', signature);
  formData.append('folder', folder);
  // Must exactly match what the backend signed, or Cloudinary rejects the
  // upload as tampered. NOTE: max_file_size is deliberately NOT sent here
  // — Cloudinary's raw signed /upload endpoint doesn't support it at all
  // (it's an Upload Preset-only option), and including it used to break
  // every upload with "Invalid Signature". Size is enforced after the
  // fact instead — see the /api/upload/verify call below.
  formData.append('allowed_formats', allowedFormats);

  // 'auto' lets Cloudinary accept either images or videos on the same
  // endpoint and pick the right resource_type itself.
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: 'POST',
    body: formData,
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error?.message ?? `Upload failed (${res.status})`);
  }

  // Real server-side size enforcement: our backend checks the actual
  // uploaded size and deletes it via the Admin API (using a secret key
  // never exposed to the browser) if it's over the limit — this can't be
  // bypassed by skipping the frontend's own pre-upload size check.
  const token = localStorage.getItem('token');
  const verifyRes = await fetch(`${apiBaseUrl()}/api/upload/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      publicId: body.public_id,
      bytes: body.bytes,
      resourceType: body.resource_type,
    }),
  });
  if (!verifyRes.ok) {
    const verifyBody = await verifyRes.json().catch(() => null);
    throw new Error(verifyBody?.error ?? 'Upload was rejected');
  }

  const type: UploadedMedia['type'] =
    body.resource_type === 'video' ? 'VIDEO' : body.format === 'gif' ? 'GIF' : 'IMAGE';

  return {
    url: body.secure_url,
    type,
    filename: body.public_id,
    size: body.bytes,
  };
}

// ── Reactions ─────────────────────────────────────────────────────────────────

export const REACTION_EMOJIS: Record<string, string> = {
  LIKE: '👍',
  LOVE: '❤️',
  HAHA: '😂',
  WOW: '😮',
  SAD: '😢',
  ANGRY: '😡',
};

export const REACTION_COLORS: Record<string, string> = {
  LIKE: '#1877F2',
  LOVE: '#F33E58',
  HAHA: '#F7B125',
  WOW: '#F7B125',
  SAD: '#F7B125',
  ANGRY: '#E9710F',
};

// ── Avatar utilities ──────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#1877F2', '#E4405F', '#00B27A', '#F7B125', '#A855F7',
  '#EF4444', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899',
];

export function getInitials(name: string): string {
  if (!name?.trim()) return '?';
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function generateAvatarColor(name: string): string {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0; // convert to 32-bit int
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── String helpers ────────────────────────────────────────────────────────────

export function truncate(str: string, length: number): string {
  if (!str || str.length <= length) return str ?? '';
  return `${str.slice(0, length)}…`;
}

/** Escape user input before using in RegExp to prevent ReDoS */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Format a number with locale-aware comma separators */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
