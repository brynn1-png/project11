import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canViewDiagnostics } from "@/lib/diagnostics-core";
import { loadFailures } from "./actions";
import { DiagnosticsView } from "@/components/diagnostics-view";
import { isSupabaseAdminConfigured } from "@/lib/env";

export default async function DiagnosticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canViewDiagnostics(user)) notFound();
  const initial = await loadFailures();
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-8">
      <Link href="/" className="text-sm font-semibold text-[var(--accent-strong)] hover:underline">← Back to inventory</Link>
      {!isSupabaseAdminConfigured() && <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Server failure storage is not configured. Set SUPABASE_SERVICE_ROLE_KEY on the server; failures currently go to server logs only.</p>}
      <div className="mt-6"><DiagnosticsView initial={initial} /></div>
    </main>
  );
}
