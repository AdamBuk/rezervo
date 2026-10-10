import { createHmac, timingSafeEqual } from "node:crypto";

// Signed "manage your booking" links for customers: /rezervace/<id>/<token>.
// The token is an HMAC of the booking id, so nothing is stored and the same
// link can be rebuilt for the reminder e-mail. The key is derived from the
// server secret with a fixed label, keeping it separate from API key encryption.

const LABEL = "booking-manage-link:v1";
const TOKEN_LENGTH = 32; // base64url chars = 192 bits
const MIN_SECRET_LENGTH = 32;

function deriveKey(secret: string | undefined): Buffer | null {
  if (!secret || secret.length < MIN_SECRET_LENGTH) return null;
  return createHmac("sha256", secret).update(LABEL).digest();
}

/** Token for a booking, or null when the server secret isn't configured. */
export function bookingManageToken(bookingId: string, secret: string | undefined): string | null {
  const key = deriveKey(secret);
  if (!key) return null;
  return createHmac("sha256", key).update(bookingId.toLowerCase()).digest("base64url").slice(0, TOKEN_LENGTH);
}

export function verifyBookingManageToken(bookingId: string, token: string, secret: string | undefined): boolean {
  if (typeof token !== "string" || token.length !== TOKEN_LENGTH) return false;
  const expected = bookingManageToken(bookingId, secret);
  if (!expected) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

/** Absolute manage link, or null when links can't be signed. */
export function bookingManageUrl(siteUrl: string, bookingId: string, secret: string | undefined): string | null {
  const token = bookingManageToken(bookingId, secret);
  return token ? `${siteUrl}/rezervace/${bookingId}/${token}` : null;
}
