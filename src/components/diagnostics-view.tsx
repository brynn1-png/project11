"use client";

import { useState, useTransition } from "react";
import { loadFailures, type FailureRecord } from "@/app/diagnostics/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Result = Awaited<ReturnType<typeof loadFailures>>;

export function DiagnosticsView({ initial }: { initial: Result }) {
  const [records, setRecords] = useState<FailureRecord[]>(initial.ok ? initial.records : []);
  const [hasMore, setHasMore] = useState(initial.ok ? initial.hasMore : false);
  const [message, setMessage] = useState(initial.ok ? "" : initial.message);
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [pending, startTransition] = useTransition();

  function refresh(term: string, offset: number) {
    startTransition(async () => {
      const result = await loadFailures(offset, term);
      if (!result.ok) { setMessage(result.message); return; }
      setRecords((current) => offset ? [...current, ...result.records] : result.records);
      setHasMore(result.hasMore);
      setMessage("");
      setActiveSearch(term);
    });
  }

  return (
    <>
      <header>
        <h1 className="text-3xl font-bold">Diagnostics</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">Recorded server failures, newest first. Times are shown in Manila time. Browser-only and past failures may not appear here.</p>
      </header>
      <form className="mt-6 flex max-w-lg gap-2" onSubmit={(event) => { event.preventDefault(); refresh(search.trim(), 0); }}>
        <Input aria-label="Search operation" placeholder="Search function or operation" value={search} maxLength={80} onChange={(event) => setSearch(event.target.value)} />
        <Button type="submit" disabled={pending}>Search</Button>
      </form>
      {message && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{message}</p>}
      <div className="mt-6 space-y-3">
        {records.map((record) => (
          <details key={record.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <summary className="cursor-pointer list-none">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="font-semibold">{record.operation}</span>
                <time className="text-xs text-[var(--muted-foreground)]" dateTime={record.occurredAt}>{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(record.occurredAt))}</time>
              </div>
              <p className="mt-2 line-clamp-2 text-sm">{record.reason}</p>
            </summary>
            <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-4 text-sm">
              <p><strong>Source:</strong> {record.source === "server_action" ? "Server action" : "Next.js server"}</p>
              {record.errorCode && <p><strong>Code:</strong> {record.errorCode}</p>}
              <p><strong>Reference:</strong> <code>{record.referenceId}</code></p>
              {record.stack && <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-[var(--muted)] p-3 text-xs">{record.stack}</pre>}
            </div>
          </details>
        ))}
        {!records.length && !message && <p className="rounded-2xl border border-[var(--border)] p-6 text-sm text-[var(--muted-foreground)]">No recorded failures{activeSearch ? " match this operation" : " yet"}.</p>}
      </div>
      {hasMore && <Button variant="secondary" className="mt-5" disabled={pending} onClick={() => refresh(activeSearch, records.length)}>Load more</Button>}
    </>
  );
}
