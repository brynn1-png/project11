"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { TABLE_PAGE_SIZES, compactPageNumbers } from "@/lib/pagination";

export function TablePagination({ page, pageSize, totalPages, from, to, total, itemLabel, onPageChange, onPageSizeChange }: {
  page: number;
  pageSize: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  if (total === 0) return null;
  const pages = compactPageNumbers(page, totalPages);

  return <div className="flex flex-col gap-3 border-t border-[var(--border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-sm text-[var(--muted-foreground)]" aria-live="polite">Showing {from}–{to} of {total} {itemLabel}</p>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {total > TABLE_PAGE_SIZES[0] && <label className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
        Rows
        <select className="select-field h-9 min-h-9 w-20 py-1" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} aria-label={`Rows per page for ${itemLabel}`}>
          {TABLE_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>}
      {totalPages > 1 && <nav className="flex items-center gap-1" aria-label={`${itemLabel} pagination`}>
        <Button type="button" variant="secondary" size="sm" className="px-2" disabled={page === 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page"><CaretLeft /></Button>
        <div className="hidden items-center gap-1 sm:flex">
          {pages.map((item, index) => item === "ellipsis"
            ? <span key={`ellipsis-${index}`} className="grid min-w-8 place-items-center text-sm text-[var(--muted-foreground)]" aria-hidden="true">…</span>
            : <Button key={item} type="button" variant={item === page ? "default" : "ghost"} size="sm" className="min-w-9 px-2" aria-current={item === page ? "page" : undefined} onClick={() => onPageChange(item)}>{item}</Button>)}
        </div>
        <span className="min-w-20 text-center text-sm font-medium sm:hidden">Page {page} of {totalPages}</span>
        <Button type="button" variant="secondary" size="sm" className="px-2" disabled={page === totalPages} onClick={() => onPageChange(page + 1)} aria-label="Next page"><CaretRight /></Button>
      </nav>}
    </div>
  </div>;
}
