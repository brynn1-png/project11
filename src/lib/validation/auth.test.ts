import { describe, expect, it } from "vitest";
import { loginSchema, staffAccountSchema, staffAccountUpdateSchema } from "@/lib/validation/auth";

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

const validAccount = {
  fullName: "Rosa Delgado",
  email: "rosa@example.com",
  password: "correct-horse-1",
  role: "inventory_staff" as const,
};

describe("staff account input", () => {
  it("accepts a complete new account", () => {
    expect(staffAccountSchema.safeParse(validAccount).success).toBe(true);
  });

  it("normalizes the email to lowercase", () => {
    const parsed = staffAccountSchema.safeParse({ ...validAccount, email: "  Rosa@Example.COM " });
    expect(parsed.success && parsed.data.email).toBe("rosa@example.com");
  });

  it("rejects a starting password shorter than eight characters", () => {
    expect(staffAccountSchema.safeParse({ ...validAccount, password: "short12" }).success).toBe(false);
  });

  it("rejects a blank starting password", () => {
    expect(staffAccountSchema.safeParse({ ...validAccount, password: "" }).success).toBe(false);
  });

  it("rejects a malformed email address", () => {
    expect(staffAccountSchema.safeParse({ ...validAccount, email: "not-an-email" }).success).toBe(false);
  });

  it("rejects a name that is too short to identify the employee", () => {
    expect(staffAccountSchema.safeParse({ ...validAccount, fullName: "R" }).success).toBe(false);
  });

  it("rejects a role outside the application role list", () => {
    expect(staffAccountSchema.safeParse({ ...validAccount, role: "owner" }).success).toBe(false);
  });

  it("accepts a role change for an existing account", () => {
    const parsed = staffAccountUpdateSchema.safeParse({
      profileId: "1f0d5b2c-6f1a-4a3f-9a0e-2b7c8d9e0f11",
      role: "manager",
      status: "active",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a profile identifier that is not a uuid", () => {
    expect(staffAccountUpdateSchema.safeParse({ profileId: "42", role: "manager", status: "active" }).success).toBe(false);
  });

  it("rejects an unknown account status", () => {
    expect(staffAccountUpdateSchema.safeParse({
      profileId: "1f0d5b2c-6f1a-4a3f-9a0e-2b7c8d9e0f11",
      role: "manager",
      status: "suspended",
    }).success).toBe(false);
  });
});
