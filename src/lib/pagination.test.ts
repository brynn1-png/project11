import { describe, expect, it } from "vitest";
import { compactPageNumbers, paginateItems } from "@/lib/pagination";

describe("table pagination", () => {
  const items = Array.from({ length: 63 }, (_, index) => index + 1);

  it("returns the requested page after filtering has already occurred", () => {
    const result = paginateItems(items, 2, 25);
    expect(result).toMatchObject({ page: 2, totalPages: 3, from: 26, to: 50, total: 63 });
    expect(result.items).toEqual(Array.from({ length: 25 }, (_, index) => index + 26));
  });

  it("clamps a page that no longer exists", () => {
    const result = paginateItems(items.slice(0, 7), 4, 25);
    expect(result).toMatchObject({ page: 1, totalPages: 1, from: 1, to: 7 });
  });

  it("uses zero-based result bounds for an empty collection", () => {
    expect(paginateItems([], 1, 25)).toMatchObject({ page: 1, totalPages: 1, from: 0, to: 0, total: 0, items: [] });
  });

  it("keeps page controls compact for long tables", () => {
    expect(compactPageNumbers(6, 12)).toEqual([1, "ellipsis", 5, 6, 7, "ellipsis", 12]);
  });
});
