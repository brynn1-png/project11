# Cashier remittance design

Cashiers submit their own completed sales at shift end. They see only their own daily sales, counts, and totals. A submitted cashier cannot record another sale for that business day. Administrators and managers see all cashier submissions, while only they can submit and verify the store-wide business day. Store submission requires every cashier with completed sales that day to have remitted. An administrator may reopen one cashier's remittance while the store day remains open. Remittance records the system-calculated sales total; it does not collect a physical cash count.

The existing business day remains store-wide. A new per-cashier record is keyed by business day and cashier and created at that cashier's first sale. Database functions enforce ownership and role checks, and the sale insert path checks for a completed remittance. Unremitted open-day sales prevent that account's role or active status from changing. The Daily Verification view presents personal remittance to cashiers and all cashier records plus final controls to management. Current returns review stays management-only.

Approaches considered: per-cashier remittances inside the current store-wide day (chosen, minimal change to receipts and returns), or separate business days for each cashier (rejected because it would rewrite the sales and return model).

Constraints: preserve existing store-wide verification; never disclose another cashier's remittance or sale details to a cashier; validate direct RPC and Server Action calls; block duplicate submission and sales after remittance; permit administrator reopening only before store submission. A deployed database needs the new migration before the UI can use this feature.
