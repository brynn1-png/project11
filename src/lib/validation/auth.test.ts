import { describe, expect, it } from "vitest";
import { loginSchema } from "@/lib/validation/auth";

describe("login validation", () => {
  it("normalizes a valid email address", () => {
    const result = loginSchema.parse({ email: " Manager@Example.com ", password: "password" });
    expect(result.email).toBe("manager@example.com");
  });

  it("rejects an invalid email and empty password", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "" });
    expect(result.success).toBe(false);
  });

  it("rejects unexpectedly long passwords", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "x".repeat(129) });
    expect(result.success).toBe(false);
  });
});

