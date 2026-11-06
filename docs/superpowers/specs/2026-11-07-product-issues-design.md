# Product Issues design

Staff can report one damaged or questionable product and affected quantity per report. The report form supports preset flags Damaged and Other issue, plus Custom flag with a required label. Product, quantity, description, and optional known batch are recorded with reporter and time. If the batch is unknown, the database allocates the quantity from available batches in expiry/receipt order. All active staff can see the shared issue list; only managers and administrators resolve pending reports.

Submission atomically removes the affected units from batch quantity_remaining, so they cannot be sold. The report keeps per-batch allocations and stock adjustments. Management can confirm the loss or release the same units back to their batches. Release is prohibited for archived products or expired batches. Every resolution records its actor, time, note, and audit entry. Reports remain visible after resolution through a paginated list that prioritizes pending reports.

Alternatives considered: a report-only list until approval (rejected because known bad stock remains sellable) and an immediate permanent write-off (rejected because false reports cannot be corrected safely). The chosen flow isolates immediately, then lets management resolve.

No photos, supplier claims, batch transfers, or physical disposal workflow are included. The hosted database migration is required before deploying the page.
