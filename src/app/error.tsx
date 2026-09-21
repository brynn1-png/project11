"use client";

import { useEffect } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("Application route failed", error);
  }, [error]);

  return (
    <main className="grid min-h-[70dvh] place-items-center px-5 py-12">
      <section className="panel w-full max-w-lg p-6 text-center sm:p-8" role="alert">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-red-50 text-red-700">
          <WarningCircle size={24} weight="fill" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-bold">This page could not be loaded</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">Your data was not changed. Try loading the page again.</p>
        {error.digest && <p className="mt-2 font-mono text-xs text-[var(--muted-foreground)]">Reference: {error.digest}</p>}
        <Button className="mt-6" onClick={retry}>Try again</Button>
      </section>
    </main>
  );
}
