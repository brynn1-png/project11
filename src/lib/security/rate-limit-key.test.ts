import { describe, expect, it } from "vitest";
import { buildLoginRateLimitIdentifier, readClientAddress } from "@/lib/security/rate-limit-key";

describe("rate-limit identifiers", () => {
  it("uses the first forwarded address", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.4, 10.0.0.2" });
    expect(readClientAddress(headers)).toBe("203.0.113.4");
  });

  it("normalizes login email and address", () => {
    expect(buildLoginRateLimitIdentifier(" Admin@Example.COM ", " 203.0.113.4 ")).toBe("admin@example.com|203.0.113.4");
  });

  it("does not allow an unbounded identifier", () => {
    expect(buildLoginRateLimitIdentifier(`${"a".repeat(400)}@example.com`, "unknown")).toHaveLength(320);
  });
});
