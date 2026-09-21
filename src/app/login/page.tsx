import Image from "next/image";
import { CheckCircle, Database, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isSupabaseConfigured } from "@/lib/env";
import { APP_NAME, STORE_NAME } from "@/lib/ui-copy";

export default async function LoginPage() {
  const configured = isSupabaseConfigured();
  if (configured && (await getCurrentUser())) redirect("/");

  return (
    <main className="grid min-h-[100dvh] bg-[var(--background)] lg:grid-cols-[1.08fr_.92fr]">
      <section className="relative hidden overflow-hidden bg-[#16452e] p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -right-24 -top-24 size-80 rounded-full border-[56px] border-[#f4e90b]/[.055]" />
        <div className="relative my-auto max-w-xl">
          <h1 className="max-w-lg text-5xl font-semibold leading-[1.05] tracking-[-0.035em]">Know what is on every shelf.</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-white/70">Securely manage products, stock movement, purchases, and expiring inventory from one place.</p>
        </div>
        <div className="grid grid-cols-3 gap-8 border-t border-white/15 pt-6 text-sm text-white/60">
          <span>Role protected</span><span>Batch traceable</span><span>Responsive web</span>
        </div>
      </section>
      <section className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <Image
            src="/brand/south-emerald-logo.svg"
            alt={STORE_NAME}
            width={196}
            height={166}
            className="mx-auto mb-8 hidden h-auto w-[196px] lg:block"
            priority
          />
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <Image src="/brand/south-emerald-mark.svg" alt="" width={44} height={44} className="size-11 rounded-xl bg-white p-0.5" priority />
            <span className="text-lg font-bold">{APP_NAME}</span>
          </div>
          <h2 className="text-3xl font-bold tracking-[-0.03em]">Welcome back</h2>
          <p className="mt-2 text-[var(--muted-foreground)]">Sign in to manage inventory and sales with your assigned staff account.</p>
          {configured ? <LoginForm /> : <SetupRequired />}
        </div>
      </section>
    </main>
  );
}

function SetupRequired() {
  return (
    <section className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5" aria-labelledby="setup-title">
      <div className="flex items-start gap-3">
        <Database className="mt-0.5 shrink-0 text-[var(--accent)]" size={22} aria-hidden="true" />
        <div className="min-w-0">
          <h3 id="setup-title" className="font-bold">Connect Supabase to continue</h3>
          <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">Copy <code>.env.example</code> to <code>.env.local</code>, then add the project URL and publishable key from your Supabase project.</p>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-3 border-t border-[var(--border)] pt-5 text-sm text-[var(--muted-foreground)]">
        <p className="flex items-center gap-2"><CheckCircle className="text-[var(--accent)]" size={18} aria-hidden="true" />The production schema is ready to apply.</p>
        <p className="flex items-center gap-2"><ShieldCheck className="text-[var(--accent)]" size={18} aria-hidden="true" />Secrets remain outside source control.</p>
      </div>
    </section>
  );
}
