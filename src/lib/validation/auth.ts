import { z } from "zod";
import { APP_ROLES } from "@/lib/auth/permissions";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  password: z.string().min(1, "Enter your password.").max(128, "Password is too long."),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const staffRoleSchema = z.enum(APP_ROLES);
export const staffStatusSchema = z.enum(["active", "inactive"]);

export const staffAccountSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the employee's full name.").max(120, "Name is too long."),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  password: z.string().min(8, "Use at least 8 characters.").max(128, "Password is too long."),
  role: staffRoleSchema,
});

export type StaffAccountInput = z.input<typeof staffAccountSchema>;

export const staffAccountUpdateSchema = z.object({
  profileId: z.uuid("Staff account identifier is invalid."),
  role: staffRoleSchema,
  status: staffStatusSchema,
});

export type StaffAccountUpdateInput = z.input<typeof staffAccountUpdateSchema>;
