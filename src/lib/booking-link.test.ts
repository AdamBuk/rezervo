import { describe, expect, it } from "vitest";
import { bookingManageToken, bookingManageUrl, verifyBookingManageToken } from "./booking-link";

const SECRET = "test-secret-that-is-at-least-32-characters-long";
const ID = "9d4f1c2e-3b4a-4c5d-8e6f-7a8b9c0d1e2f";

describe("booking manage links", () => {
  it("creates a stable, verifiable token", () => {
    const token = bookingManageToken(ID, SECRET)!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(bookingManageToken(ID, SECRET)).toBe(token);
    expect(bookingManageToken(ID.toUpperCase(), SECRET)).toBe(token);
    expect(verifyBookingManageToken(ID, token, SECRET)).toBe(true);
  });

  it("rejects tokens for other bookings, other secrets and tampering", () => {
    const token = bookingManageToken(ID, SECRET)!;
    const otherId = "1d4f1c2e-3b4a-4c5d-8e6f-7a8b9c0d1e2f";
    expect(verifyBookingManageToken(otherId, token, SECRET)).toBe(false);
    expect(verifyBookingManageToken(ID, token, `${SECRET}-rotated`)).toBe(false);
    expect(verifyBookingManageToken(ID, (token[0] === "A" ? "B" : "A") + token.slice(1), SECRET)).toBe(false);
    expect(verifyBookingManageToken(ID, token.slice(0, 31), SECRET)).toBe(false);
    expect(verifyBookingManageToken(ID, "", SECRET)).toBe(false);
  });

  it("is disabled without a proper secret", () => {
    expect(bookingManageToken(ID, undefined)).toBeNull();
    expect(bookingManageToken(ID, "short")).toBeNull();
    expect(verifyBookingManageToken(ID, "x".repeat(32), undefined)).toBe(false);
    expect(bookingManageUrl("https://rezervo.example", ID, undefined)).toBeNull();
  });

  it("builds the absolute URL", () => {
    expect(bookingManageUrl("https://rezervo.example", ID, SECRET)).toBe(
      `https://rezervo.example/rezervace/${ID}/${bookingManageToken(ID, SECRET)}`,
    );
  });
});
