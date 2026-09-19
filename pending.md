# Pending Work

## Current State Summary (Updated: 2026-09-19)
- **Open items:** 6
- **Highest priority:** Production deployment, final visual acceptance, and remaining physical camera coverage
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

## PND-007 — Latest Product, Archive, and History Migrations
**Status:** Pending hosted database application and acceptance tests
**Added:** 2026-09-19
**Reason:** Tasks #015 and #017 require new atomic registration, archive, restoration, receipt-history, and return-history functions in the hosted Supabase project.
**Prerequisites:** Apply `supabase/migrations/20260919000100_product_initial_stock.sql` and then `supabase/migrations/20260919000200_archive_and_history.sql` through the Supabase SQL editor or migration workflow.
**Acceptance criteria:**
- A non-expiring product can be registered with quantity and purchase price in one submission.
- An expiry-tracked product requires an expiry date and creates an expiring batch.
- Product quantity, receipt history, cost data, and inventory activity reflect the opening batch.
- A failed receipt leaves neither a product nor a partial stock record.
- A zero-stock product can be archived with a reason and restored.
- A product with stock or a pending resellable return cannot be archived.
- Receipt and return history follows role visibility and displays complete line details.
- Receipt printing produces a readable 80 mm record.
