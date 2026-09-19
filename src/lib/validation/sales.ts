import { z } from "zod";

export const saleItemSchema = z.object({
  productId: z.uuid("Product identifier is invalid."),
  quantity: z.number().int("Quantity must be a whole number.").min(1, "Quantity must be at least one.").max(10000, "Quantity is too large."),
});

export const recordSaleSchema = z.object({
  idempotencyKey: z.uuid("Sale identifier is invalid."),
  items: z.array(saleItemSchema).min(1, "Add at least one product.").max(250, "A sale cannot contain more than 250 products."),
  notes: z.string().trim().max(500, "Notes cannot exceed 500 characters.").optional(),
  cashReceived: z.number().positive("Cash received must be greater than zero.").max(100000000, "Cash received is too large.").refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, "Cash received cannot have more than two decimal places."),
});

export type RecordSaleInput = z.infer<typeof recordSaleSchema>;
