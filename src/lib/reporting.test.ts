import { describe, expect, it } from "vitest";
import { createCsv, groupSalesByReceipt } from "@/lib/reporting";
import type { SalesReportRow } from "@/app/reports/actions";

const base: SalesReportRow = {
  saleNumber: "1042",
  soldAt: "2026-09-21T02:00:00.000Z",
  cashierName: "Ana Cruz",
  productCode: "PRD-000001",
  productName: "Nivea Creme",
  barcode: "4005808166190",
  categoryName: "Consumable",
  quantity: 2,
  returnedQuantity: 0,
  unitPrice: 100,
  lineTotal: 200,
  saleTotal: 320,
  cashReceived: 500,
  changeDue: 180,
  status: "completed",
};

describe("groupSalesByReceipt", () => {
  it("creates one summary row for every receipt", () => {
    const summaries = groupSalesByReceipt([
      base,
      { ...base, productCode: "PRD-000002", productName: "Key Switch", quantity: 1, lineTotal: 120 },
      { ...base, saleNumber: "1043", productName: "Gluta", saleTotal: 40 },
    ]);

    expect(summaries).toHaveLength(2);
    expect(summaries[0]).toMatchObject({ productCount: 2, itemCount: 3, total: 320 });
    expect(summaries[0]!.products).toBe("Nivea Creme, Key Switch");
  });
});

describe("createCsv", () => {
  it("adds a BOM, quotes values, and neutralizes spreadsheet formulas", () => {
    expect(createCsv([["Name", "Value"], ["Widget", "=2+2"]])).toBe(
      '\uFEFF"Name","Value"\r\n"Widget","\'=2+2"',
    );
  });
});
