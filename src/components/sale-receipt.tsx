import Image from "next/image";

export type SaleReceiptData = {
  saleNumber: string;
  soldAt: string;
  cashierName: string;
  totalAmount: number;
  paymentMethod?: "cash";
  cashReceived?: number;
  changeDue?: number;
  notes?: string;
  returnedQuantity?: number;
  items: Array<{ productName: string; barcode: string; quantity: number; unitPrice: number; lineTotal: number }>;
};

function peso(value: number) { return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value); }
function date(value: string) { return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

export function SaleReceiptDetails({ receipt }: { receipt: SaleReceiptData }) {
  return <div className="grid gap-5">
    <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
      <div className="flex min-w-0 items-center gap-3"><Image src="/brand/south-emerald-mark.svg" width={44} height={44} alt="" className="size-11 rounded-xl bg-white p-0.5" /><div><h2 className="font-bold">South Emerald Supermarket</h2><p className="text-sm text-[var(--muted-foreground)]">Sale #{receipt.saleNumber}</p></div></div>
      <p className="shrink-0 text-right text-xs leading-5 text-[var(--muted-foreground)]">{date(receipt.soldAt)}<br />Cashier: {receipt.cashierName}</p>
    </div>
    <div className="grid gap-3">{receipt.items.map((item) => <div key={`${receipt.saleNumber}-${item.barcode}`} className="grid grid-cols-[1fr_auto] gap-x-4 text-sm"><div className="min-w-0"><p className="font-semibold">{item.productName}</p><p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{item.quantity} × {peso(item.unitPrice)}</p></div><strong>{peso(item.lineTotal)}</strong></div>)}</div>
    <div className="grid gap-2 border-t border-[var(--border)] pt-4 text-sm"><div className="flex justify-between"><span className="text-[var(--muted-foreground)]">Total</span><strong className="text-lg">{peso(receipt.totalAmount)}</strong></div>{receipt.cashReceived !== undefined && <><div className="flex justify-between"><span className="text-[var(--muted-foreground)]">Cash received</span><span>{peso(receipt.cashReceived)}</span></div><div className="flex justify-between text-base"><span className="font-semibold">Change</span><strong>{peso(receipt.changeDue ?? 0)}</strong></div></>}{receipt.cashReceived === undefined && <p className="text-xs text-[var(--muted-foreground)]">Payment details were not recorded for this earlier receipt.</p>}{receipt.returnedQuantity ? <p className="text-xs font-semibold text-amber-800">{receipt.returnedQuantity} item{receipt.returnedQuantity === 1 ? "" : "s"} returned</p> : null}{receipt.notes && <p className="text-xs text-[var(--muted-foreground)]">Note: {receipt.notes}</p>}</div>
  </div>;
}

export function SaleReceiptPrintSheet({ receipt }: { receipt: SaleReceiptData }) {
  return <section className="receipt-print-sheet" aria-label={`Sale ${receipt.saleNumber} receipt`}><div className="text-center"><h1>South Emerald Supermarket</h1><p>Sale #{receipt.saleNumber}</p><p>{date(receipt.soldAt)} · {receipt.cashierName}</p></div><div className="receipt-print-lines">{receipt.items.map((item) => <div key={`${receipt.saleNumber}-${item.barcode}`}><span>{item.quantity} × {item.productName}</span><strong>{peso(item.lineTotal)}</strong><small>{peso(item.unitPrice)} each</small></div>)}</div><div className="receipt-print-total"><span>Total</span><strong>{peso(receipt.totalAmount)}</strong></div>{receipt.cashReceived !== undefined && <><div className="receipt-print-payment"><span>Cash received</span><span>{peso(receipt.cashReceived)}</span></div><div className="receipt-print-payment"><strong>Change</strong><strong>{peso(receipt.changeDue ?? 0)}</strong></div></>}{receipt.cashReceived === undefined && <p>Payment details unavailable for this earlier receipt.</p>}{receipt.returnedQuantity ? <p>{receipt.returnedQuantity} item{receipt.returnedQuantity === 1 ? "" : "s"} returned</p> : null}{receipt.notes && <p>Note: {receipt.notes}</p>}<p className="receipt-print-thanks">Thank you for shopping with us.</p></section>;
}
