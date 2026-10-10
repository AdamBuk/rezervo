import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("keeps local paths with query and hash", () => {
    expect(safeRedirectPath("/dashboard/services")).toBe("/dashboard/services");
    expect(safeRedirectPath("/dashboard?view=day&date=2026-10-14#x")).toBe("/dashboard?view=day&date=2026-10-14#x");
  });

  it("rejects external and ambiguous targets", () => {
    for (const value of [
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "/\\/evil.com",
      "/\t/evil.com",
      "/\n/evil.com",
      "javascript:alert(1)",
      "dashboard",
      "",
      null,
      undefined,
      42,
    ]) {
      expect(safeRedirectPath(value), String(value)).toBe("/dashboard");
    }
  });

  it("uses the given fallback", () => {
    expect(safeRedirectPath("//evil.com", "/dashboard/setup")).toBe("/dashboard/setup");
  });
});
