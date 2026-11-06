# Pending Work

## Current State Summary (Updated: 2026-11-07)
- **Open items:** 10
- **Highest priority:** Apply and accept the Product Issues and Diagnostics migrations, finish remaining cashier-remittance checks, then complete production deployment and visual acceptance
- **Purpose:** Track work that cannot be completed until required hardware, credentials, assets, decisions, or external access become available

---

## PND-001 — Physical USB Barcode Scanner Testing
**Status:** Partially complete — Sales workflow confirmed
**Added:** 2026-09-15
**Reason:** The keyboard-emulating scanner and Task #009 Sales flow are working; Task #010 Stock In selection plus broader barcode-format and rapid-scan coverage remain to be checked.
**Prerequisites:** Configure the YHD-8200L to send `F9` as its prefix and `Enter` as its suffix, then run the Sales workflow with representative grocery-product barcodes.
**Acceptance criteria:**
- The scanner enters EAN-13, EAN-8, UPC-A, UPC-E, Code 128, and Code 39 values correctly when supported by the device.
- A scan can identify a product without requiring mouse interaction.
- Rapid consecutive scans do not merge, duplicate, or drop values.
- Focus loss and scanner suffix keys such as Enter are handled safely.
- The workflow is verified in the supported Windows browser environment.
**Result:** The user confirmed the YHD-8200L scan-anywhere Sales workflow is working. Stock In acceptance plus the remaining format and stress checks are non-blocking follow-up coverage.

---

## PND-002 — Physical Camera Scanning Tests
**Status:** Pending devices
**Added:** 2026-09-15
**Reason:** Camera scanning has not been verified on representative physical devices.
**Prerequisites:** At least one mobile phone, one built-in webcam, and one external webcam where available.
**Acceptance criteria:**
- Camera permission, selection, scanning, cancellation, and retry flows work.
- Scanning is checked under typical store lighting and with representative barcode formats.
- Manual barcode entry remains usable when camera access fails or is denied.

---

## PND-003 — Desktop and Mobile Visual Acceptance Review
**Status:** Pending review environment
**Added:** 2026-09-15
**Reason:** The interface has not received final visual acceptance testing on target desktop and mobile viewports.
**Prerequisites:** A browser review surface and agreed target device sizes.
**Acceptance criteria:**
- Core workflows are visually reviewed on desktop and mobile.
- Overflow, focus, keyboard navigation, reduced motion, and touch targets are checked.
- Any accepted visual defects are recorded as implementation tasks.

---

## PND-004 — Production Database and Authentication Credentials
**Status:** Partially complete — development MVP active; production deployment pending
**Added:** 2026-09-15
**Reason:** The hosted development project is running the MVP product-code workflow and the user accepted Task #008. This checkout is not linked to Supabase and Docker remains unavailable, so local database reset testing and future production deployment remain external work.
**Prerequisites:** For production, create a separate Supabase project and apply all reviewed migrations without the development seed.
**Acceptance criteria:**
- Development and production environments are separate.
- Credentials are stored outside source control.
- Task #006 migration and development seed apply successfully. (Completed 2026-09-16)
- Task #007 sales migrations apply successfully to development. (Completed 2026-09-16)
- Task #007 corrective and recent-sales migrations apply successfully to development. (Completed 2026-09-16)
- Task #008 product-registration and stock-receiving migration applies successfully to development. (Accepted 2026-09-19)
- Database connectivity and authentication are verified in each deployed environment.

---

## PND-005 — Hosting and Deployment Configuration
**Status:** Pending hosting decision and access
**Added:** 2026-09-15
**Reason:** The production hosting provider and deployment account are not yet finalized.
**Prerequisites:** Approve the hosting provider and provide deployment access.
**Acceptance criteria:**
- Preview and production deployments succeed.
- HTTPS, environment variables, migrations, health checks, and rollback steps are verified.
- Camera access is tested through the deployed HTTPS application.

---

## PND-006 — Final Branding Assets
**Status:** Completed 2026-09-19
**Added:** 2026-09-15
**Reason:** A raster South Emerald Supermarket logo was supplied, reconstructed as full and compact SVG assets, approved by the user, and applied to the system.
**Prerequisites:** Completed.
**Acceptance criteria:**
- Placeholder branding is replaced without changing application behavior.
- Assets are optimized and verified at desktop and mobile sizes.
**Result:** South Emerald naming, logo marks, metadata icon, and restrained palette are implemented and visually verified on desktop and mobile sign-in layouts.

---

## PND-007 — Latest Receipt Detail Migration
**Status:** Pending hosted database application and acceptance tests
**Added:** 2026-09-19
**Reason:** Task #019 adds business-day submission and verification details to permanent receipt history.
**Prerequisites:** The earlier product, archive/history, and cash-payment migrations are already active. Apply `supabase/migrations/20260919000400_receipt_modal_details.sql` through the Supabase SQL editor or migration workflow.
**Acceptance criteria:**
- View receipt opens a modal without moving or expanding the receipt table.
- The modal closes by Close, Escape, and outside click and restores keyboard focus.
- Receipt shows every purchased line plus total, cash received, and change.
- Receipt Activity shows its business-day submission and verification details.
- The receipt modal shows only returns linked to the selected sale.
- Print and browser Save as PDF output include all purchased product lines and payment details.

---

## PND-008 — September 21 Archive and Activity Migrations
**Status:** Pending hosted database confirmation
**Added:** 2026-09-21
**Reason:** Archive write-off, administrator product purge, and exact receipt-level activity references depend on the latest protected database functions.
**Prerequisites:** Apply the migrations in filename order after all earlier migrations:
- `20260921000100_admin_delete_archived_products.sql`
- `20260921000200_archive_stock_writeoff.sql`
- `20260921000300_allow_archived_inventory_purge.sql`
- `20260921000400_admin_product_history_purge.sql`
- `20260921000500_group_inventory_activity_by_receipt.sql`
**Acceptance criteria:**
- Archiving stock requires acknowledgement, writes remaining batches to zero, and records adjustments.
- Administrators can permanently delete an eligible archived test product after typed-code confirmation.
- Managers and lower roles cannot permanently purge products.
- Related receipt totals remain valid after a permitted purge.
- Dashboard Recent activity shows one row per sale or receiving receipt with the exact receipt reference.
- Full Inventory activity remains item-level.

---

## PND-009 — Hosted Cashier Remittance Migration and Acceptance
**Status:** Partially complete — cashier submission flow confirmed working by user; remaining scenarios pending
**Added:** 2026-11-07
**Reason:** Task #037 adds per-cashier remittance and a database sale guard; no local PostgreSQL service is available in this checkout.
**Prerequisites:** Apply all earlier migrations, then `20261107000100_cashier_remittance.sql` to the hosted development project before deploying the updated app.
**Acceptance criteria:**
- User confirmed on 2026-11-07 that the cashier submission flow passed and is working in the interface; the exact environment and remaining scenarios were not specified.
- Two cashiers with sales on the same day each see only their own sale details and totals in My Daily Sales.
- One cashier remits; that cashier cannot confirm another sale, while the second cashier can continue selling.
- Managers see both cashiers' statuses and cannot submit the store day until both have remitted.
- Only an administrator can reopen a remittance while the store day is open; the cashier can then record a missed sale and remit again.
- A duplicate remittance and an attempt to reopen after store submission are rejected.
- Changing the role or deactivating a cashier with open, unremitted sales is rejected with an actionable message; a remitted cashier remains visible in management history after a later role change.
- Managers and administrators can submit and verify the store day and review returns as before.

---

## PND-010 — Product Issues Hosted Migration and Acceptance
**Status:** Pending hosted database migration and acceptance
**Added:** 2026-11-07
**Reason:** Product Issues requires the new protected database tables and stock-changing functions; no local PostgreSQL service is available in this checkout.
**Prerequisites:** Apply `20261107000200_product_issues.sql` after `20261107000100_cashier_remittance.sql` to the hosted development database before deploying the matching app build.
**Acceptance criteria:**
- A cashier or inventory staff member reports one product with Damaged, Other issue, or a named Custom flag; only managers and administrators see resolution actions.
- A report immediately removes exactly the affected quantity from the selected batch, or oldest available batches when none is selected; a concurrent sale cannot make stock negative.
- Reports above available batch quantity and forged product/batch combinations are rejected without partial stock changes.
- Management can confirm a loss without another stock deduction, or release the original units back to their source batches with a resolution note.
- Duplicate resolution and release of archived or expired stock fail without partial restoration.
- Report records, batch allocations, and stock adjustment history remain visible after resolution.

---

## PND-011 — Diagnostics Hosted Migration and Acceptance
**Status:** Pending hosted database migration and acceptance
**Added:** 2026-11-07
**Reason:** Diagnostics storage and its email-specific database policy require the new migration and a server-side service-role key; no local PostgreSQL service is available in this checkout.
**Prerequisites:** Apply `20261107000300_failure_diagnostics.sql` after the Product Issues migration, configure `SUPABASE_SERVICE_ROLE_KEY` on the app server, and ensure `admin@gmail.com` has an active administrator profile.
**Acceptance criteria:**
- Trigger a safe, deliberate server failure and verify the page shows its operation, Manila timestamp, reason, code or stack when available, and reference ID.
- Confirm a different administrator, manager, cashier, and unauthenticated visitor cannot open `/diagnostics` or read `failure_logs` directly.
- Confirm a secret-looking error is redacted before storage and the original operation still returns its normal result when diagnostic storage fails.
- Verify search, pagination, and the server-log fallback when the service-role key or database is unavailable.
