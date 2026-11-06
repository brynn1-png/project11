import type { AppRole } from "@/lib/auth/permissions";

export const DIAGNOSTICS_OWNER_EMAIL = "admin@gmail.com";

export function canViewDiagnostics(user: { email: string; role: AppRole } | null): boolean {
  return user?.role === "administrator" && user.email.trim().toLowerCase() === DIAGNOSTICS_OWNER_EMAIL;
}

export function safeFailureText(value: string, limit: number): string {
  return value
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, "$1[REDACTED]@")
    .replace(/\bsb_secret_[A-Za-z0-9_-]+\b/g, "[REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED]")
    .replace(/(["'](?:password|passwd|token|access_token|refresh_token|api[_-]?key|client_secret|secret|private_key|service[_-]?role[_-]?key)["']\s*:\s*["'])[^"']+/gi, "$1[REDACTED]")
    .replace(/(authorization\s*:\s*(?:bearer|basic)\s+)\S+/gi, "$1[REDACTED]")
    .replace(/((?:password|passwd|token|access_token|refresh_token|api[_-]?key|client_secret|secret|private_key|service[_-]?role[_-]?key)\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .slice(0, limit);
}
