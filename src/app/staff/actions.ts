"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission, type AppRole } from "@/lib/auth/permissions";
import { isSupabaseAdminConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit, databaseRateLimitMessage, rateLimitMessage } from "@/lib/security/rate-limit";
import {
  staffAccountSchema,
  staffAccountUpdateSchema,
  type StaffAccountInput,
  type StaffAccountUpdateInput,
} from "@/lib/validation/auth";

const ACCESS_DENIED = "Your account is not allowed to manage staff accounts.";

const GUARD_MESSAGES = [
  "You cannot change your own role or status.",
  "The last active administrator cannot be demoted or deactivated.",
  "That staff account was not found.",
  "That account is no longer new.",
];

function errorMessage(error: { message: string }, fallback: string) {
  const limited = databaseRateLimitMessage(error);
  if (limited) return limited;
  if (error.message.includes("update_staff_account") || error.message.includes("schema cache")) {
    return "Apply the latest database migration, then try again.";
  }
  if (GUARD_MESSAGES.some((message) => error.message.includes(message))) return error.message;
  if (error.message.includes("Administrator access") || error.message.includes("not allowed")) return error.message;
  return fallback;
}

export type CreatedStaffAccount = {
  profileId: string;
  fullName: string;
  email: string;
  role: AppRole;
};

export async function createStaffAccount(
  input: StaffAccountInput,
): Promise<{ ok: true; account: CreatedStaffAccount } | { ok: false; message: string }> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "users:manage")) return { ok: false, message: ACCESS_DENIED };

  const parsed = staffAccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Review the account details." };

  if (!isSupabaseAdminConfigured()) {
    return {
      ok: false,
      message: "Adding accounts is not configured yet. Add SUPABASE_SERVICE_ROLE_KEY to the server environment, then try again.",
    };
  }

  const limit = await consumeRateLimit("staff_write");
  if (!limit.allowed) return { ok: false, message: rateLimitMessage(limit) };

  const supabase = await createClient();
  const { data: existing } = await supabase.from("profiles").select("id").eq("email", parsed.data.email).maybeSingle();
  if (existing) return { ok: false, message: "An account already uses that email address." };

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });

  if (createError || !created?.user) {
    if (createError?.message.includes("already") || createError?.message.includes("registered")) {
      return { ok: false, message: "An account already uses that email address." };
    }
    if (createError?.message.includes("rate") || createError?.status === 429) {
      return { ok: false, message: "Too many accounts were requested. Wait a moment and try again." };
    }
    if (createError?.message.includes("password")) {
      return { ok: false, message: "That password was rejected. Use at least 8 characters." };
    }
    return { ok: false, message: "The account could not be created. Try again." };
  }

  const profileId = created.user.id;
  const { error: roleError } = await supabase.rpc("update_staff_account", {
    p_profile_id: profileId,
    p_role: parsed.data.role,
    p_status: "active",
    p_created: true,
  });

  if (roleError) {
    await admin.auth.admin.deleteUser(profileId);
    return { ok: false, message: errorMessage(roleError, "The account was created but its role could not be applied, so it was removed. Try again.") };
  }

  revalidatePath("/");

  return {
    ok: true,
    account: { profileId, fullName: parsed.data.fullName, email: parsed.data.email, role: parsed.data.role },
  };
}

export async function updateStaffAccount(
  input: StaffAccountUpdateInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "users:manage")) return { ok: false, message: ACCESS_DENIED };

  const parsed = staffAccountUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Review the account changes and try again." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_staff_account", {
    p_profile_id: parsed.data.profileId,
    p_role: parsed.data.role,
    p_status: parsed.data.status,
  });

  if (error) return { ok: false, message: errorMessage(error, "The staff account could not be updated. Try again.") };

  revalidatePath("/");
  return { ok: true };
}
