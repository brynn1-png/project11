import { describe, expect, it } from "vitest";
import { productIssueInputSchema, issueResolutionSchema } from "@/lib/validation/product-issues";

const report = {
  productId: "11111111-1111-4111-8111-111111111111",
  quantity: 2,
  flagKind: "damage" as const,
  customFlag: "",
  description: "Package is torn",
};

describe("product issue input", () => {
  it("accepts a preset flag without a batch", () => {
    expect(productIssueInputSchema.safeParse(report).success).toBe(true);
  });

  it("requires a named custom flag and a positive whole quantity", () => {
    expect(productIssueInputSchema.safeParse({ ...report, flagKind: "custom" }).success).toBe(false);
    expect(productIssueInputSchema.safeParse({ ...report, flagKind: "custom", customFlag: "Leaking" }).success).toBe(true);
    expect(productIssueInputSchema.safeParse({ ...report, quantity: 0 }).success).toBe(false);
    expect(productIssueInputSchema.safeParse({ ...report, quantity: 1.5 }).success).toBe(false);
  });

  it("rejects an unrelated batch identifier format and empty description", () => {
    expect(productIssueInputSchema.safeParse({ ...report, batchId: "wrong" }).success).toBe(false);
    expect(productIssueInputSchema.safeParse({ ...report, description: " " }).success).toBe(false);
  });
});

describe("issue resolution input", () => {
  it("requires a valid report, supported decision, and explanation", () => {
    expect(issueResolutionSchema.safeParse({ issueId: report.productId, decision: "confirm", note: "Disposed in store" }).success).toBe(true);
    expect(issueResolutionSchema.safeParse({ issueId: report.productId, decision: "release", note: "" }).success).toBe(false);
    expect(issueResolutionSchema.safeParse({ issueId: report.productId, decision: "delete", note: "No" }).success).toBe(false);
  });
});
