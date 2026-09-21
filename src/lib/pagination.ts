export const TABLE_PAGE_SIZES = [10, 25, 50, 100] as const;

export function paginateItems<T>(items: T[], requestedPage: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(Math.trunc(requestedPage) || 1, 1), totalPages);
  const startIndex = (page - 1) * pageSize;
  return {
    items: items.slice(startIndex, startIndex + pageSize),
    page,
    totalPages,
    from: items.length === 0 ? 0 : startIndex + 1,
    to: Math.min(startIndex + pageSize, items.length),
    total: items.length,
  };
}

export function compactPageNumbers(page: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (page <= 3) return [1, 2, 3, 4, "ellipsis", totalPages];
  if (page >= totalPages - 2) return [1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, "ellipsis", page - 1, page, page + 1, "ellipsis", totalPages];
}
