import type { StockTransaction } from "@/lib/types";

export type ReceiptActivity = {
  id: string;
  reference: string;
  type: StockTransaction["type"];
  transactions: StockTransaction[];
  productCount: number;
  totalQuantity: number;
  user: string;
  createdAt: string;
};

function fallbackGroupId(transaction: StockTransaction) {
  if (transaction.type === "Stock In") return transaction.id;
  return [transaction.type, transaction.createdAt, transaction.user, transaction.notes ?? ""].join("|");
}

export function groupActivityByReceipt(transactions: StockTransaction[]): ReceiptActivity[] {
  const grouped = new Map<string, ReceiptActivity>();

  for (const transaction of transactions) {
    const id = transaction.groupId ?? fallbackGroupId(transaction);
    const existing = grouped.get(id);

    if (existing) {
      existing.transactions.push(transaction);
      existing.totalQuantity += transaction.quantity;
      existing.productCount = new Set(existing.transactions.map((item) => item.productId)).size;
      continue;
    }

    grouped.set(id, {
      id,
      reference: transaction.reference ?? (transaction.type === "Stock In" ? "Stock receipt" : "Sale receipt"),
      type: transaction.type,
      transactions: [transaction],
      productCount: 1,
      totalQuantity: transaction.quantity,
      user: transaction.user,
      createdAt: transaction.createdAt,
    });
  }

  return Array.from(grouped.values());
}
