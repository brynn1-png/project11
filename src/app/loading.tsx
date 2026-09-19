import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-h-[100dvh] bg-[var(--background)] lg:pl-[264px]" aria-label="Loading inventory">
      <div className="hidden border-r border-[#27603f] bg-[#16452e] lg:fixed lg:inset-y-0 lg:left-0 lg:block lg:w-[264px]" />
      <header className="h-16 border-b border-[var(--border)] bg-[var(--surface)]" />
      <main className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-3 h-5 w-full max-w-lg" />
        <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-2xl" />)}
        </div>
        <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </main>
    </div>
  );
}
