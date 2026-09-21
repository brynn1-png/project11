# Pending Work

## Current State Summary (Updated: 2026-09-21)
- **Open items:** 7
- **Highest priority:** Apply the latest hosted database migrations, then complete production deployment and visual acceptance
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
