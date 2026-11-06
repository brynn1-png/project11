import { z } from "zod";

export const productIssueInputSchema = z.object({
  productId: z.uuid(),
  batchId: z.uuid().optional(),
  quantity: z.number().int().min(1).max(1_000_000),
  flagKind: z.enum(["damage", "issue", "custom"]),
  customFlag: z.string().trim().max(80).default(""),
  description: z.string().trim().min(5, "Describe what is wrong with the product.").max(500),
}).superRefine((value, context) => {
  if (value.flagKind === "custom" && value.customFlag.length < 2) {
    context.addIssue({ code: "custom", path: ["customFlag"], message: "Name the custom issue flag." });
  }
});

export const issueResolutionSchema = z.object({
  issueId: z.uuid(),
  decision: z.enum(["confirm", "release"]),
  note: z.string().trim().min(2, "Explain the resolution.").max(500),
});

export type ProductIssueInput = z.input<typeof productIssueInputSchema>;
export type IssueResolutionInput = z.input<typeof issueResolutionSchema>;
