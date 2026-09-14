# Decision Log

## Current State Summary (Updated: 2026-09-14)
- **Active Decision:** Demo architecture and presentation scope
- **Status:** 🟢 Confirmed
- **Latest Decision:** Use restrained, purpose-driven animation without moving operational data
- **Open Questions:** Production database, authentication provider, hosting, and final branding remain future decisions

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
