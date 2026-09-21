# Endpoint security

The application exposes Next.js Server Actions and Supabase RPC functions. It does not currently expose custom Route Handlers under `app/api`.

## Verification rules

Every Server Action is treated as a public entry point:

- Authentication is read from verified Supabase claims, followed by an active-profile lookup.
- Authorization is checked again inside each action; hiding a control in the interface is not considered authorization.
- Client values are parsed at runtime with Zod or explicit numeric checks.
- Database RPC functions repeat role and ownership checks for direct Supabase callers.
- Returned objects contain only fields required by the interface.
- Next.js provides same-origin checks for Server Actions and a default 1 MB action-body limit.

`logout` intentionally accepts an unauthenticated request because clearing an absent session is harmless.

## Rate-limit policy

| Scope | Limit | Enforcement |
| --- | ---: | --- |
| Login, per account and address | 5 per 15 minutes | Server Action + shared database counter |
| Login, per address | 30 per 15 minutes | Server Action + shared database counter |
| Completed sales | 30 per minute | Database trigger |
| Return requests | 20 per hour | Database trigger |
| Inventory writes | 60 per 10 minutes | Database trigger |
| Permanent deletion | 10 per hour | Database trigger |
| Verification and return reviews | 60 per hour | Database trigger |
| Reports | 60 per minute | Server Action + shared database counter |
| Receipt/history views | 60 per minute | Server Action + shared database counter |
| Sales lookups | 120 per minute | Server Action + shared database counter |
| Inventory lookups | 120 per minute | Server Action + shared database counter |

Write limits run in PostgreSQL triggers. An authenticated caller therefore cannot bypass them by calling a Supabase mutation RPC directly. Counters are atomic and shared across application instances. Raw email addresses and network addresses are not stored in the limiter table.

Read RPCs remain protected by database roles and ownership rules. Direct PostgREST traffic is additionally subject to the Supabase project's platform-level quotas; configure project or gateway limits appropriate to the production plan.

## Deployment requirements

1. Apply migrations through `20260921000800_endpoint_rate_limits.sql` before deploying the matching application build. The application fails closed when its shared limiter is unavailable.
2. Ensure the production reverse proxy replaces, rather than appends untrusted values to, `X-Forwarded-For`.
3. For multiple Next.js instances, configure the same `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` on every instance.
4. Monitor `RATE_LIMITED` database errors and repeated login failures. Do not log passwords, raw session tokens, or full payment details.
5. Keep Supabase Auth and PostgREST platform rate limits enabled as the outer traffic-control layer.
