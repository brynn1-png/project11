# Product Issues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Let staff report product issues, isolate affected stock immediately, and let management confirm or release it.

**Architecture:** A report and allocation table preserve status and batch provenance. Security-definer functions lock and change batch quantities atomically, write stock adjustments, and enforce manager resolution. Server Actions validate inputs and the new view uses the existing inventory catalog.

**Tech Stack:** PostgreSQL/Supabase, Next.js 16 Server Actions, React 19, TypeScript, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-07-product-issues-design.md`

## Global Constraints

- One product per report; preset Damaged and Other issue plus required Custom flag label.
- Submission isolates stock immediately; management alone resolves.
- Release must preserve original batch allocation and reject archived or expired stock.
- All active staff may submit and read reports; only administrators and managers resolve.

## Review Focus

- Concurrent sale and issue submission cannot make a batch negative.
- A forged batch from another product is rejected.
- Direct RPC calls cannot bypass active-account and management checks.
- Duplicate resolution cannot change stock twice.
- Release after expiry, archive, or batch-capacity change fails without partial restoration.

---

### Task 1: Database workflow

**Files:** Create `supabase/migrations/20261107000200_product_issues.sql`; regenerate `supabase/master.sql`.

**Interfaces:** `get_product_issue_batches(uuid)`, `get_product_issue_reports(integer)`, `submit_product_issue(uuid,uuid,integer,text,text,text)`, `resolve_product_issue(uuid,text,text)`.

- [x] Add report/allocation tables, indexes, RLS, and read functions.
- [x] Add atomic submit with batch allocation and stock adjustments.
- [x] Add manager-only confirm/release with batch-safe restoration and audit entries.
- [x] Regenerate and check master SQL.

### Task 2: Application workflow

**Files:** Create `src/lib/validation/product-issues.ts`, `src/lib/validation/product-issues.test.ts`, `src/app/issues/actions.ts`, `src/components/product-issues-view.tsx`; modify `src/lib/auth/permissions.ts`, `src/components/inventory-app.tsx`.

- [x] Write failing validation and role tests, then implement them.
- [x] Add validated, role-checked read and mutation actions.
- [x] Add product/batch form, shared report list, and manager resolution controls.
- [x] Run tests, typecheck, lint, build, and inspect the changed files.

### Task 3: Project documentation

**Files:** Update `PRODUCT.md`, `docs/page-guide.md`, `docs/supabase-setup.md`, `docs/endpoint-security.md`, `pending.md`, `progress.md`, `decisions.md`, `results.md`.

- [x] Document the workflow, migration dependency, and hosted acceptance checks.
- [x] Update all project logs at session end.
