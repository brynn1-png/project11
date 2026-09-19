# Decision Log

## Current State Summary (Updated: 2026-09-19)
- **Active Decision:** Archive recoverable product records; keep receipts and returns as immutable history
- **Status:** 🟢 Confirmed
- **Latest Decision:** Place Archived products under Products and receipt/return history under Transactions rather than Settings
- **Open Questions:** Future adjustment approval and hosting

---

## 2026-09-19 — Task #017: Archive and History Structure
**Decision:** Products uses Active and Archived views, while Transactions uses Inventory activity, Sales receipts, and Returns views.
**Why:** Archiving represents a recoverable catalog state. Receipts and returns are permanent evidence and must never be treated as deletable or restorable configuration.
**Archive safeguards:** An archive reason is required. Products must have zero remaining stock and no pending resellable returns. New resellable returns cannot target archived products; damaged and expired returns remain valid.
**Permissions:** Any signed-in operational user may view archive and permitted history. Only administrators and managers may archive or restore products. Receipt and return visibility follows the existing rule: elevated operational roles see all records, while cashiers see their own.
**History scope:** The first 100 receipts and returns load with product details and search; database functions cap requests at 500. Receipt printing uses an 80 mm layout.
**Alternative rejected:** A Settings archive, because discontinued products and historical transactions are operational records rather than application configuration.

---

## 2026-09-19 — Task #016: Product Barcode Confirmation
**Decision:** Treat Enter in the product barcode field as the end of a scanner input, not as permission to submit the form.
**Why:** USB scanners emulate a keyboard and commonly append Enter. Native form behavior was therefore saving a valid product before the user could review its details.
**Scope:** The safeguard applies to manufacturer-barcode entry in both registration and editing. It does not alter the purpose-built scanner workflows in Sales or Stock In.
**Confirmation rule:** Register product and Save changes remain explicit button actions after scanning.
**Alternative rejected:** Removing the scanner's Enter suffix globally, because Sales and Stock In use it to delimit scan input safely.

---

## 2026-09-19 — Task #015: Opening Stock Registration
**Decision:** Let administrators and managers optionally create the first inventory batch while registering a product.
**Why:** This removes the extra trip to Stock In without bypassing purchase-cost, expiry, batch, audit, and inventory-movement records.
**Required fields:** Enabling the shortcut requires a whole-number quantity and purchase price per unit. An expiry date is also required when the product uses expiry tracking.
**Atomicity:** Product creation and opening-stock receipt run inside one database function and transaction. If either step fails, neither record remains.
**Default behavior:** The option is off by default, so a product can still be registered with zero stock and received later through Stock In.
**Alternative rejected:** Adding a quantity directly to the product record, because on-hand inventory is derived from batches and movements rather than stored as an untraceable product field.

---

## 2026-09-19 — Task #014: Product Unit Model
**Decision:** Keep one user-facing Unit of measure field and remove Package size and Package unit from registration, editing, and operational displays.
**Why:** The system counts sellable inventory rather than calculating package contents. One unit such as box, kilo, piece, bottle, or can is sufficient for sales, receiving, thresholds, and reporting.
**Description use:** Packaging details such as `175g`, `1.5L`, or `5kg` may be written in the product name or optional description. Descriptions are now visible in the Products list and Stock In product details.
**Database compatibility:** The existing schema still requires `package_size` and `package_unit`. Existing values are preserved when products are edited. New products receive internal values of `1` and the selected unit of measure, without exposing those compatibility fields in the form.
**Formatting:** Countable units receive basic singular/plural formatting, while measurement symbols such as `kg` and `ml` remain unchanged.
**Boundary:** No database migration or inventory calculation change was introduced.

---

## 2026-09-19 — Task #013: Stock Alert Behavior
**Decision:** Derive header notifications from the current inventory snapshot instead of creating stored notification records.
**Why:** Low-stock status is current operational state. Derived alerts cannot become stale, require no migration, and resolve automatically after receiving raises stock above the threshold.
**Threshold:** Quantity `0` is Out of Stock. A positive quantity at or below `minimumStock` is Low Stock. Quantities above `minimumStock` do not produce alerts.
**Ordering:** Out-of-stock products appear first; products within each status are ordered by current quantity and then name.
**Permissions:** Administrators, managers, and inventory staff open an alert directly in Stock In with that product selected. Cashiers and other users without receiving permission open the matching Inventory status filter.
**Interaction:** The bell displays the current alert count. The panel closes through its close control, outside pointer input, Escape, navigation, or alert selection. Alerts cannot be dismissed independently while the inventory condition remains unresolved.
**Storage boundary:** No notification table or read/unread state was added.

---

## 2026-09-19 — Task #012: Login Logo Placement
**Decision:** Place the full South Emerald logo directly on the light sign-in panel and remove its white card from the green presentation panel.
**Why:** The light surface naturally accommodates the logo's white areas, avoiding the appearance of a floating white tile and grouping the store identity with the authentication task.
**Layout:** Center the logo horizontally within the right sign-in section while keeping the heading, explanatory text, labels, fields, and button left-aligned for readability. Recenter the green-panel message vertically and leave the benefits row anchored below it.
**Responsive decision:** Retain the existing compact mark-and-name treatment on smaller screens so the full wordmark does not consume excessive vertical space.
**Boundary:** Authentication behavior, form fields, and login actions are unchanged.

---

## 2026-09-19 — Task #011: Logo Reconstruction Method
**Decision:** Manually rebuild the logo as native SVG geometry with a separate compact mark, rather than auto-tracing the low-resolution raster.
**Why:** Automatic tracing would preserve blurry edges and compression artifacts. Native shapes remain sharp at every size and are easier to adapt for the application shell and favicon.
**Boundary:** The reconstructed wording uses a close condensed system-font match because the official font and source paths are unavailable. The assets must be visually approved before being treated as final client branding.
**Implementation:** The user approved applying the reconstruction. The full logo is used on desktop sign-in, the compact mark is used in the application shell, mobile sign-in, and metadata icon, and the interface uses restrained brand colors without changing workflow hierarchy.
**Color decision:** Keep dark green as the dominant operational surface, use a darker accessible emerald for actions, reserve bright yellow for active navigation and small emphasis, and retain red for destructive or urgent meaning.

---

## 2026-09-19 — Task #010: Stock In Scanner Routing
**Decision:** Reuse the `F9` prefix and `Enter` suffix capture in Stock In, routing the completed barcode to product selection from any focused receiving field.
**Why:** Keyboard-emulating scanner input should not corrupt quantity, cost, date, batch, reference, or notes fields, and receiving must remain an explicit confirmed transaction.
**Draft safety:** Rescanning the selected product preserves the unfinished receipt. Selecting a different product clears all product-specific receipt fields before switching. Unknown codes leave the current selection and draft unchanged.
**Transaction boundary:** A scan only identifies a product and focuses Quantity. Only Confirm stock receipt calls the atomic database receiving action.
**Acceptance:** The user accepted the implemented behavior and continued to client-personalization work.

---

## 2026-09-19 — Task #009: Direct-to-Cart Sales Flow
**Decision:** Treat a completed barcode scan as an instruction to add one unit directly to Current sale. A repeated scan increments the same cart line, and manual quantity changes happen only in that cart.
**Why:** The previous selected-product staging card duplicated controls already present in Current sale and slowed keyboard-emulating scanner use.
**Transaction boundary:** Scanning and quantity edits are browser-only receipt preparation. Only Confirm sale calls the existing atomic receipt function, which revalidates stock and records the full sale in one database transaction.
**Safety details:** Use an explicit `F9` scanner prefix plus `Enter` suffix for deterministic global capture, including while quantity or notes has focus. Use rapid-input detection only when focus is outside editable fields, because timing alone cannot safely distinguish the first scanner keystroke from normal typing inside an input. Reject unknown and unavailable products, prevent quantities above loaded stock, and throttle duplicate camera frames while allowing deliberate repeat reads.
**Alternative rejected:** Globally treating every fast numeric sequence as a scan while an editable field has focus, because it can corrupt quantities or notes before the sequence is identifiable.
**Acceptance:** The user confirmed the YHD-8200L scan-anywhere workflow works in the Sales interface.

---

## 2026-09-19 — Task #008: MVP Scope Closure
**Decision:** Mark the implemented inventory system as the completed MVP based on explicit user acceptance.
**Why:** The core single-store workflows are present and the user considers the overall system good enough to move from MVP construction to personal refinements.
**Boundary:** Hardware testing, production deployment, final branding, and the deferred inventory-correction approval workflow remain backlog items rather than blockers to MVP acceptance.

---

## 2026-09-17 — Task #008: Stock In Selector Presentation
**Decision:** Keep the barcode icon in the dedicated search input and remove the redundant icon from the native existing-product selector.
**Why:** The shared selector padding overrode the icon-specific padding, causing product text to overlap the icon. The native selector is already understandable without decoration and now has an accessible label.

---

## 2026-09-17 — Task #008: Barcode Preview Behavior
**Decision:** Show a Code 128 preview containing `INV-######` and the entered product name before registration, but do not reserve or expose a real inventory number until the product is saved.
**Why:** Users can understand the physical label before committing the product without consuming sequence values for abandoned forms or mistaking an unsaved code for real inventory.
**Alternatives rejected:** Pre-allocating the next database sequence number during form entry was rejected because cancelled forms would create misleading gaps and require reservation cleanup. Enabling print on the placeholder was rejected because it could produce unusable labels.

---

## 2026-09-16 — Task #008: Product Registration and Receiving
**Decision:** Keep product identity separate from inventory movement: managers register a zero-stock product first, then authorized staff receive each supplier batch through one atomic database function.
**Why:** Product metadata and stock receipts have different audit, validation, expiry, and cost requirements. Separating them prevents a partially created product from also creating an incomplete batch.
**Additional decisions:**
- Product codes are generated as `PRD-######`; products without manufacturer barcodes receive `INV-######` Code 128 labels.
- Changing a barcode retires the previous value as a permanent inactive alias; it can never be assigned to another product.
- Administrators and managers can manage products and categories. Inventory staff can receive stock but cannot change catalog identity; cashiers cannot perform either write.
- Stock In provides administrators and managers a direct “Register new product” shortcut that opens the registration form, while inventory staff continue to see only receiving controls.
- Each receiving transaction represents one product batch. Quantity and purchase price are mandatory; expiry is mandatory only for tracked products; supplier batch, manufacture date, invoice reference, and notes are optional.
- A missing supplier batch number is replaced with `RCV-YYYYMMDD-####`. Receiving recalculates weighted-average cost but never changes selling price; managers see low- or negative-margin warnings.
- Stock corrections and approval remain a separate next phase.
**Alternatives rejected:** Direct table writes were rejected in favor of audited security-definer functions. Reusing retired barcodes was rejected because it could make old labels identify the wrong product.

---

## 2026-09-16 — Task #007: Sales, Returns, and Day Verification
**Decision:** Use one Sales workspace for scanning and stock-out, commit each completed customer sale atomically, and treat Supabase as the inventory source of truth.
**Why:** A receipt-level transaction prevents partial stock deductions, supports multiple products and quantities, preserves cost snapshots, and is safer under multiple counters than accumulating unapproved sales only in browser JSON.
**Additional decisions:**
- Repeated scanning and direct quantity entry both update a single cart.
- Inventory is allocated FEFO from non-expired batches inside the database transaction.
- Idempotency keys prevent accidental duplicate receipt submission.
- Returns are append-only records linked to the original sale; only manager- or administrator-approved resellable items restore stock.
- Business days move from open to pending review to verified, and their operational date uses `Asia/Manila`.
- Administrators and managers can select from all recent sales; other sales-capable roles see only their own recent sales. Exact number lookup remains available for older receipts.
- IndexedDB caches catalog and activity data only for lookup speed and transient recovery. Sales cannot be confirmed from cached-only data.
- Full offline/PWA startup is not required.
**Alternatives rejected:** A standalone scanner plus separate stock-out page was redundant. Holding the day’s authoritative sales only in browser JSON was rejected because it risks data loss, stale stock, and multi-counter overselling.

---

## 2026-09-15 — Task #006: Inventory Read Models and Development Seed
**Decision:** Load catalog quantities and activity through security-definer database functions that expose only role-appropriate operational fields.
**Why:** Cashiers need current quantities but must not receive purchase cost or batch-detail access. A protected read model enforces that boundary consistently instead of weakening table policies.
**Additional decisions:**
- The repository seed is development-only, repeatable, and contains synthetic categories, products, costs, and batches.
- Cashiers may see the shared product catalog and their own sales activity, while receiving activity and all-sales history remain limited to elevated roles.
- Browser localStorage and hardcoded presentation records are removed completely.
- Product creation, receiving, and sales controls remain disabled until atomic database functions are implemented.
- On-hand selling-price totals are labeled retail value, not stock cost.
**Alternative rejected:** Directly reading `inventory_batches` as every role, because that would expose purchase costs and batch metadata to cashiers.

**Hosted verification decision:** Treat the development deployment as complete only after the protected functions were visible through the hosted API, anonymous execution was denied as designed, and the signed-in dashboard showed all 10 seeded products with 397 units.

---

## 2026-09-15 — Task #005: Production Foundation Architecture
**Decision:** Use Supabase PostgreSQL and Auth with cookie-based SSR, Next.js Proxy token refresh, server-side user DTOs, explicit role permissions, database grants, and Row-Level Security.
**Why:** Authentication and authorization must be enforced beyond the client interface, and the database schema must support secure multi-user operation and later atomic inventory transactions.
**Alternatives considered:**
- Custom password and session handling was rejected in favor of managed authentication.
- Keeping the client-only simulated login was rejected because it provides no identity or access protection.
- Granting direct table writes for stock, sales, and adjustments was deferred because those operations require atomic database functions that will be introduced in their implementation phases.
**Additional decisions:**
- Public registration is disabled; new accounts default to cashier and must be promoted by a trusted administrator.
- Cost data is separated from general product data and protected for administrators and managers.
- The application builds into an explicit Supabase setup state when credentials are absent.
- Inventory screens remain labeled as demo data until Phase 2 replaces localStorage.

---

## 2026-09-15 — Task #004: Pending Work Tracking
**Decision:** Use `pending.md` for work that cannot be completed until hardware, credentials, assets, decisions, or external access are available.
**Why:** Hardware and external dependencies should remain visible without being mistaken for active implementation failures or completed verification.
**Alternative rejected:** Keeping unavailable-device tests only in general progress notes, where their prerequisites and acceptance criteria would be harder to track.

---

## 2026-09-14 — Task #003: Motion System
**Decision:** Animate only feedback, spatial transitions, and state indication.
**Why:** The dashboard is a frequently used operational interface, so motion should clarify changes without slowing repeated work.
**Implementation choices:**
- CSS transitions and keyframes for buttons, pages, the mobile drawer, dashboard entry, and scanner line
- Motion for dialog and toast entrance/exit presence
- Transform and opacity only, with interface transitions below 300ms except the documented 400ms toast recipe
- Reduced-motion mode removes spatial travel and retains gentle opacity feedback
**Rejected:** Animated numbers, bouncing cards, moving tables, decorative scroll effects, and ungated infinite animation.

---

## 2026-09-14 — Task #002: Retain Original Demo Design
**Decision:** Keep the original dark-green operational dashboard design.
**Why:** After reviewing a light mobile-finance reference and a proposed web translation, the user confirmed the existing design was already satisfactory.
**Alternative rejected:** A web-first soft-gray, white, near-black, and emerald redesign with floating navigation.
**Effect:** The partial global token and component-style changes were reverted; application behavior and the approved original interface remain unchanged.

---

## 2026-09-14 — Task #001: Demo Architecture and Interface
**Decision:** Build a single responsive Next.js demo using React, TypeScript, Tailwind CSS, and customized shadcn-compatible components.
**Why:** This matches the proposed technology stack and provides a realistic client presentation without committing to production infrastructure.
**Alternatives considered:**
- Production Supabase database and authentication were deferred because the user requested mock data.
- Comp-first design was declined in favor of the faster code-first workflow.
- Separate mobile and desktop applications were rejected because one responsive web interface supports webcams and phone cameras.
**Additional decisions:**
- Use localStorage for temporary demo persistence and include a reset control.
- Use `@zxing/browser` for camera scanning and keyboard-compatible manual input for USB barcode scanners.
- Use a slate and stock-green operational design with moderate variance, restrained motion, and higher data density.
- Apply relevant anti-slop guidance from the user-requested `design-taste-frontend` skill, while recognizing its documented dashboard limitation.

---
