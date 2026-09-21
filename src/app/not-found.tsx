import Link from "next/link";
import { APP_NAME } from "@/lib/ui-copy";

export default function NotFound() {
  return (
    <main className="grid min-h-[100dvh] place-items-center px-5 py-12">
      <section className="panel w-full max-w-lg p-6 text-center sm:p-8">
        <p className="text-sm font-bold text-[var(--accent)]">404</p>
        <h1 className="mt-2 text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">This page does not exist in {APP_NAME}.</p>
        <Link className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]" href="/">Return to the application</Link>
      </section>
    </main>
  );
}
