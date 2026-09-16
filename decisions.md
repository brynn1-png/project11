# Decision Log

## Current State Summary (Updated: 2026-09-16)
- **Active Decision:** Receipt-based sales and verification workflow
- **Status:** 🟢 Confirmed
- **Latest Decision:** Task #006 remains based on protected inventory read functions and repeatable development-only seed data; its hosted development deployment is verified
- **Open Questions:** Task #007 hosted migration verification, hosting, final branding, and physical scanner testing

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
