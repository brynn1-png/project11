# System test report

**Date:** 2026-11-06 (Asia/Manila)  
**Repository:** `project11` / South Emerald Supermarket Inventory  
**Scope:** Local automated checks, build, database SQL generation, and attempted runtime smoke checks. No application data was changed.

## Follow-up after fixes

The three reported local code/build issues were addressed. Current verification: `npm run lint` **passed**, `npx tsc --noEmit` **passed**, 107/107 unit tests **passed**, and `npm run build` **passed** using Next's documented webpack build option. The first webpack-script run hit an intermittent Windows `EPERM` while creating a generated `.next` directory; a fresh rerun completed successfully. The font now uses the system font stack, so typography may differ slightly from Figtree. Browser, Supabase, camera, and physical scanner workflows remain unverified.

## Initial findings (before fixes)

| Result | Check | Evidence |
| --- | --- | --- |
| **PASS** | Unit tests | 15 test files, 107 tests passed using a workspace temp directory and one Vitest worker. |
| **PASS** | TypeScript | `npx tsc --noEmit` exited 0. |
| **PASS** | Database master SQL consistency | `npm run db:master:check` exited 0; `supabase/master.sql` matches 23 migrations. |
| **FAIL** | ESLint | `npm run lint` exited 1 with 2 errors in `src/components/inventory-app.tsx`. |
| **BLOCKED** | Production build | `npm run build` exited 1 because `next/font` could not fetch Figtree from Google Fonts in this network environment. Compilation beyond that point is unverified. |
| **BLOCKED** | Browser smoke test | A dev server was already running on `localhost:3000`, but shell requests to localhost were denied by socket permissions. Computer Use stopped because it could not confidently verify the Windows browser URL. No page behavior was verified in a browser. |

## Automated test coverage

The passing tests cover role permissions; barcode normalization and matching; scanner capture; receiving selection; sales cart behavior; stock alerts; pagination; receipt activity grouping; reporting and CSV escaping; units; environment validation; rate-limit identifiers; and input validation for login, inventory writes, and sales. These are library-level tests. They do not prove that the full UI or Supabase workflows work end to end.

The first `npm test -- --reporter=verbose` attempt reported **49 passing tests and 6 suites that could not load**. Each failed suite had an `ENOENT` error in the sandbox's temporary Vite client files. This was a test-environment failure, not a reported assertion failure. Rerunning with `TEMP` and `TMP` set to a workspace directory and `--maxWorkers=1 --no-file-parallelism` produced **15/15 passing files and 107/107 passing tests**. The temporary directory was removed afterward.

## Failures and warnings

1. **Lint error, `src/components/inventory-app.tsx:138`:** `react-hooks/set-state-in-effect` rejects a synchronous `setDarkMode(isDark)` call inside an effect. This is a code-quality failure; no runtime symptom was established.
2. **Lint error, `src/components/inventory-app.tsx:342`:** `react/no-unescaped-entities` flags an apostrophe in JSX text. This is a code-quality failure.
3. **Build blocked by font download:** Next.js 16.3.5/Turbopack could not reach `https://fonts.googleapis.com` for Figtree. This does not establish whether the app would build in a network-enabled environment.
4. **Development-server warnings:** The existing `.next/dev/logs/next-development.log` contains `Invalid Refresh Token: Refresh Token Not Found` and a Next image aspect-ratio warning for the South Emerald logo. The log does not establish whether either warning is still reproducible or causes a user-visible failure.

## Workflow coverage and limits

| Area | What was checked | What remains unverified |
| --- | --- | --- |
| Authentication and roles | Login input validation and role permission unit tests passed. | Real sign-in, session refresh, protected navigation, and per-role UI/server behavior. |
| Products and stock receiving | Inventory-write validation, barcode matching, and receiving-selection tests passed. | Creating/editing/archiving products, receiving batches, expiry rules, and database persistence. |
| Sales and checkout | Cart, scanner capture, and sale-input validation tests passed. | Live stock checks, FEFO allocation, cash payment, receipt creation/printing, and idempotency. |
| Returns and daily verification | No automated test suite directly exercises these workflows. | Request, approval/rejection, stock restoration, and business-day verification. |
| Dashboard, stock levels, history, and reports | Alerts, pagination, activity grouping, reporting, and CSV helper tests passed. | Rendered views, live data, filtering, print/PDF output, and role-scoped data. |
| Staff accounts and rate limits | Role permissions and rate-limit key tests passed. | Account management actions and database-backed rate-limit enforcement. |
| Database | Master SQL generation consistency passed. | Applying migrations, RLS policies, RPC behavior, seed/reset, and database tests. Supabase CLI and Docker were unavailable. |
| UI, accessibility, and devices | No browser or device check completed. | Desktop/mobile layouts, keyboard navigation, camera permissions/scanning, and physical USB scanner behavior. |

## Recommended next verification

1. Run a browser test against a known local URL and exercise each role with disposable development accounts.
2. In a **non-production** Supabase environment, apply the migrations and test product receiving, sales, returns, daily verification, reports, staff permissions, and rate limiting with disposable data.
3. Test camera and USB scanner flows on the target devices and browsers.

## Commands run

```text
npm test -- --reporter=verbose             # exit 1: sandbox temp-file ENOENT in 6 suites
npx vitest run --maxWorkers=1 --no-file-parallelism
                                           # exit 0 with workspace TEMP/TMP; 107 tests pass
npm run lint                               # exit 1: 2 errors
npx tsc --noEmit                            # exit 0
npm run db:master:check                     # exit 0; 23 migrations current
npm run build                               # exit 1: Figtree fetch failed
npm run dev -- --hostname 127.0.0.1 --port 3100
                                           # existing dev server reported at localhost:3000
```
