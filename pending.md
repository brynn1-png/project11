# Pending Work

## Current State Summary (Updated: 2026-09-16)
- **Open items:** 6
- **Highest priority:** Apply and live-test the Task #008 product-registration and receiving migration; physical device tests remain pending hardware
- **Purpose:** Track work that cannot be completed until required hardware, credentials, assets, decisions, or external access become available

---

## PND-001 — Physical USB Barcode Scanner Testing
**Status:** Pending hardware
**Added:** 2026-09-15
**Reason:** A physical USB barcode scanner is not currently available.
**Prerequisites:** Obtain a keyboard-emulating USB barcode scanner and representative grocery-product barcodes.
**Acceptance criteria:**
- The scanner enters EAN-13, EAN-8, UPC-A, UPC-E, Code 128, and Code 39 values correctly when supported by the device.
- A scan can identify a product without requiring mouse interaction.
- Rapid consecutive scans do not merge, duplicate, or drop values.
- Focus loss and scanner suffix keys such as Enter are handled safely.
- The workflow is verified in the supported Windows browser environment.

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
**Status:** Partially complete — Task #008 migration pending; production deployment pending
**Added:** 2026-09-15
**Reason:** The hosted development project has all migrations through `20260916000300_recent_sales_picker.sql`, seed data, authentication, and verified Task #007 workflows. The new `20260916000400_product_registration_and_receiving.sql` migration must be applied and live-tested. This checkout is not linked to Supabase and Docker remains unavailable, so local database reset testing and the future production deployment remain external work.
**Prerequisites:** For production, create a separate Supabase project and apply all reviewed migrations without the development seed.
**Acceptance criteria:**
- Development and production environments are separate.
- Credentials are stored outside source control.
- Task #006 migration and development seed apply successfully. (Completed 2026-09-16)
- Task #007 sales migrations apply successfully to development. (Completed 2026-09-16)
- Task #007 corrective and recent-sales migrations apply successfully to development. (Completed 2026-09-16)
- Task #008 product-registration and stock-receiving migration applies successfully to development. (Pending)
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
**Status:** Pending client assets
**Added:** 2026-09-15
**Reason:** Final store name, logo, and approved brand assets have not been supplied.
**Prerequisites:** Receive approved branding and permission to use it.
**Acceptance criteria:**
- Placeholder branding is replaced without changing application behavior.
- Assets are optimized and verified at desktop and mobile sizes.
