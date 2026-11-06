import { describe, expect, it } from "vitest";
import { canViewDiagnostics, safeFailureText } from "./diagnostics-core";

describe("diagnostics security", () => {
  it("allows only the exact active administrator email", () => {
    expect(canViewDiagnostics({ email: "ADMIN@gmail.com", role: "administrator" })).toBe(true);
    expect(canViewDiagnostics({ email: "other@gmail.com", role: "administrator" })).toBe(false);
    expect(canViewDiagnostics({ email: "admin@gmail.com", role: "manager" })).toBe(false);
    expect(canViewDiagnostics(null)).toBe(false);
  });

  it("redacts credentials and bounds output", () => {
    const value = safeFailureText('Authorization: Bearer secret123 Authorization: Basic basicsecret password=hidden api_key=abc123 token=xyz access_token=accessvalue refresh_token=refreshvalue client_secret=clientvalue {"password":"jsonsecret"} https://person:dbpass@example.com sb_secret_1234567890abcdef', 2000);
    expect(value).not.toContain("secret123");
    expect(value).not.toContain("hidden");
    expect(value).not.toContain("abc123");
    expect(value).not.toContain("xyz");
    expect(value).not.toContain("jsonsecret");
    expect(value).not.toContain("dbpass");
    expect(value).not.toContain("sb_secret_1234567890abcdef");
    expect(value).not.toContain("basicsecret");
    expect(value).not.toContain("accessvalue");
    expect(value).not.toContain("refreshvalue");
    expect(value).not.toContain("clientvalue");
    expect(safeFailureText("a".repeat(3000), 2000)).toHaveLength(2000);
  });
});
