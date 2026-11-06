# Private Diagnostics Design

The designated account `admin@gmail.com`, while active and in the administrator role, can open `/diagnostics`. No other account can read failure records, even through direct database access. The page lists the time, source, operation, reason, and reference ID of recent failures; it supports search and pagination.

Server actions record unexpected database and application failures through a shared, best-effort logger. Next.js `onRequestError` captures uncaught server errors. The logger stores a bounded error message, code, and stack when available, after redacting common credential patterns. It never deliberately includes raw inputs, request bodies, headers, or payment data. Arbitrary secrets embedded in free-text exception messages cannot be reliably detected, so exceptions should not include raw confidential values. Each event has a generated reference ID.

The failure table is separate from business audit logs. Only a server-side service-role client inserts; authenticated clients have read-only access guarded by RLS requiring both the active administrator profile and the exact current Auth email. If logging fails because the database is unavailable, the event is emitted to the server console without causing the original operation to fail. Older failures are retained for 30 days via an explicit cleanup function; no automatic deletion is assumed.

The dashboard states its coverage honestly: known server failures after deployment, not historic errors or all browser/network failures. SQL migrations must be applied before the page can display records.
