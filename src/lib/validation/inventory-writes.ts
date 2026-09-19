import { z } from "zod";

export const expiryTrackingSchema = z.enum(["required", "not_applicable"]);

const optionalText = (maximum: number) => z.string().trim().max(maximum).optional();
const barcodeSchema = z.string()
  .trim()
  .min(4, "Barcode must contain at least 4 characters.")
  .max(64, "Barcode cannot exceed 64 characters.")
  .regex(/^[!-~]+$/, "Barcode can only contain printable characters without spaces.");

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2, "Category name must contain at least 2 characters.").max(80),
  description: optionalText(500),
  defaultExpiryTracking: expiryTrackingSchema,
});

export const productInputSchema = z.object({
  productId: z.uuid().optional(),
  name: z.string().trim().min(2, "Product name must contain at least 2 characters.").max(160),
  description: optionalText(1000),
  categoryId: z.uuid("Select a category."),
  packageSize: z.number().positive("Package size must be greater than zero.").max(1000000),
  packageUnit: z.string().trim().min(1, "Enter the package unit.").max(24),
  stockUnit: z.string().trim().min(1, "Enter the unit of measure.").max(24),
  sellingPrice: z.number().min(0, "Selling price cannot be negative.").max(100000000),
  minimumStock: z.number().int("Minimum stock must be a whole number.").min(0).max(1000000),
  expiryTracking: expiryTrackingSchema,
  barcodeMode: z.enum(["manufacturer", "generated"]),
  barcode: z.string().optional(),
}).superRefine((value, context) => {
  if (value.barcodeMode !== "manufacturer") return;
  const parsed = barcodeSchema.safeParse(value.barcode ?? "");
  if (!parsed.success) {
    context.addIssue({ code: "custom", path: ["barcode"], message: parsed.error.issues[0]?.message ?? "Enter a valid barcode." });
  }
});

const dateField = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.").optional();

export const receiveStockInputSchema = z.object({
  productId: z.uuid("Select a product."),
  quantity: z.number().int("Quantity must be a whole number.").min(1).max(1000000),
  unitCost: z.number().positive("Purchase price must be greater than zero.").max(100000000),
  batchNumber: optionalText(80),
  manufacturedAt: dateField,
  expiresAt: dateField,
  deliveryReference: optionalText(120),
  notes: optionalText(500),
  expiryTracking: expiryTrackingSchema,
}).superRefine((value, context) => {
  if (value.expiryTracking === "required" && !value.expiresAt) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "Expiry date is required for this product." });
  }
  if (value.expiryTracking === "not_applicable" && value.expiresAt) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "This product does not track expiry dates." });
  }
  if (value.manufacturedAt && value.expiresAt && value.manufacturedAt > value.expiresAt) {
    context.addIssue({ code: "custom", path: ["manufacturedAt"], message: "Manufactured date cannot be after the expiry date." });
  }
});

export const initialStockInputSchema = z.object({
  quantity: z.number().int("Initial quantity must be a whole number.").min(1, "Initial quantity must be at least one.").max(1000000),
  unitCost: z.number().positive("Purchase price must be greater than zero.").max(100000000),
  expiresAt: dateField,
  expiryTracking: expiryTrackingSchema,
}).superRefine((value, context) => {
  if (value.expiryTracking === "required" && !value.expiresAt) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "Expiry date is required for the initial stock." });
  }
  if (value.expiryTracking === "not_applicable" && value.expiresAt) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "This product does not track expiry dates." });
  }
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type ProductInput = z.infer<typeof productInputSchema>;
export type ReceiveStockInput = z.infer<typeof receiveStockInputSchema>;
export type InitialStockInput = z.infer<typeof initialStockInputSchema>;
