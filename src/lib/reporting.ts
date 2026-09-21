import type { SalesReportRow } from "@/app/reports/actions";

export type SalesReceiptSummary = {
  saleNumber: string;
  soldAt: string;
  cashierName: string;
  productCount: number;
  itemCount: number;
  returnedItemCount: number;
  products: string;
  total: number;
  cashReceived: number;
  changeDue: number;
  status: SalesReportRow["status"];
};

export function groupSalesByReceipt(rows: SalesReportRow[]): SalesReceiptSummary[] {
  const receipts = new Map<string, SalesReceiptSummary>();

  for (const row of rows) {
    const existing = receipts.get(row.saleNumber);
    if (existing) {
      existing.productCount += 1;
      existing.itemCount += row.quantity;
      existing.returnedItemCount += row.returnedQuantity;
      existing.products += `, ${row.productName}`;
      continue;
    }

    receipts.set(row.saleNumber, {
      saleNumber: row.saleNumber,
      soldAt: row.soldAt,
      cashierName: row.cashierName,
      productCount: 1,
      itemCount: row.quantity,
      returnedItemCount: row.returnedQuantity,
      products: row.productName,
      total: row.saleTotal,
      cashReceived: row.cashReceived,
      changeDue: row.changeDue,
      status: row.status,
    });
  }

  return [...receipts.values()];
}

export function escapeCsvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function createCsv(rows: unknown[][]) {
  return `\uFEFF${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")}`;
}
