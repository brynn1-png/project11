# Cashier Remittance Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Let each cashier submit only their own daily sales while management retains store-wide verification.

**Architecture:** A remittance table and security-definer RPCs enforce ownership and status transitions. The existing sale insert and business-day submit paths enforce the workflow. Server Actions and Daily Verification render role-specific data.

**Tech Stack:** PostgreSQL/Supabase, Next.js 16 Server Actions, React 19, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-07-cashier-remittance-design.md`

## Global Constraints

- Cashiers see only their own completed sales and remittance totals.
- Only administrators may reopen a cashier remittance while the store day is open.
- Management retains store-wide submission, verification, and return review.
- Remittance has no physical cash count.

## Review Focus

- A cashier supplying another day's ID must receive only their own sales.
- Concurrent sale confirmation and remittance must serialize safely.
- A duplicate remittance must not create a second record.
- A store day with an unremitted cashier must not be submitted.
- Reopening after store submission must fail.
- A role or status change must not erase a cashier's remittance history or strand an open day.

---

### Task 1: Database boundary

**Files:** Create `supabase/migrations/20261107000100_cashier_remittance.sql`; regenerate `supabase/master.sql`.

**Interfaces:** `get_cashier_remittance_summaries(integer)` returns per-day, per-cashier counts, totals, and remitted timestamp; `submit_cashier_remittance(uuid)` and `reopen_cashier_remittance(uuid,uuid)` mutate one record. `get_business_day_sales(uuid)` becomes self-filtered for cashiers.

- [x] Add table, indexes, RLS, and RPCs with authorization in SQL.
- [x] Create a remittance row at the first cashier sale; guard later sales and staff role/status changes; serialize operations with the existing business-day row lock; require all cashier sales remitted before store submission.
- [x] Regenerate master SQL and verify `npm run db:master:check`.

### Task 2: Actions and interface

**Files:** Modify `src/lib/auth/permissions.ts`, `src/lib/auth/permissions.test.ts`, `src/app/sales/actions.ts`, `src/components/inventory-app.tsx`, and `src/components/sales-verification-view.tsx`.

**Interfaces:** `loadSalesVerification()` includes cashier remittance rows; `submitCashierRemittance(dayId)` and `reopenCashierRemittance(dayId,cashierId)` call the new RPCs.

- [x] Add the cashier's remittance permission and its focused role test.
- [x] Add role-checked Server Actions with validated IDs and rate-limited reads.
- [x] Show own sales and submit status to cashiers; show all cashier submissions and administrator reopen to management.
- [x] Run tests, typecheck, lint, build, and inspect the changed files.

### Task 3: Documentation and handoff

**Files:** Update `PRODUCT.md`, `docs/page-guide.md`, `docs/supabase-setup.md`, `progress.md`, `decisions.md`, `results.md`.

- [x] Document workflow and migration deployment requirement.
- [x] Record result and remaining hosted migration/manual acceptance work in the three project logs.
