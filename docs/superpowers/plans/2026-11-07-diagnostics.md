# Private Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Record actionable server failures and show them only to the active administrator `admin@gmail.com`.

**Architecture:** A service-role server logger writes redacted failures into a dedicated table. Auth email plus active administrator role are checked by both the route/action and PostgreSQL RLS. The page reads a paginated, searchable list.

**Tech Stack:** Next.js 16.3.5, React 19, Supabase PostgreSQL, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-07-diagnostics-design.md`

## Global Constraints

- The only permitted email is `admin@gmail.com`, with an active administrator profile.
- Never record secrets or raw request content.
- Logging failure must not change the result of the original operation.

## Review Focus

- A different administrator cannot read direct SQL rows or the page.
- A cashier with a spoofed UI route cannot read the log.
- A secret-looking error message is redacted before storage.
- A missing service-role key leaves the original action usable and emits fallback server output.
- Pagination and search remain bounded.

---

### Task 1: Storage and access

**Files:** Create `supabase/migrations/20261107000300_failure_diagnostics.sql`; modify `supabase/master.sql`.

- [x] Add failure table, timestamp index, read-only RLS policy requiring exact Auth email and active administrator profile; deny authenticated writes.
- [x] Regenerate master SQL and check generated output.

### Task 2: Logger and capture

**Files:** Create `src/lib/diagnostics.ts`, `src/lib/diagnostics-core.ts`, `src/lib/diagnostics-core.test.ts`, `src/instrumentation.ts`; modify major Server Action failure paths.

- [x] Write redaction/access tests and see them fail.
- [x] Implement best-effort service-role logger with server-console fallback and Next.js uncaught server error hook.
- [x] Record returned database errors in major sale, inventory, issue, report, history, and staff operations.
- [x] Run focused tests.

### Task 3: Restricted page

**Files:** Create `src/app/diagnostics/page.tsx`, `src/app/diagnostics/actions.ts`, `src/components/diagnostics-view.tsx`; modify `src/components/inventory-app.tsx`.

- [x] Add server route and data-action checks, search, newest-first pagination and detail disclosure.
- [x] Add a navigation entry visible only to the designated admin.
- [x] Run TypeScript, lint, tests, production build.

### Task 4: Documentation and handoff

**Files:** Modify `docs/supabase-setup.md`, `docs/page-guide.md`, `pending.md`, `progress.md`, `decisions.md`, `results.md`.

- [x] Document migration and service-role requirement, coverage, retention, and hosted acceptance.
- [x] Verify master SQL and diff; record results and remaining hosted checks.

