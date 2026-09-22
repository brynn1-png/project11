# Supabase Setup

## Create and connect the project

1. Create separate Supabase projects for development and production.
2. In the project Connect dialog, copy the Project URL and publishable key.
3. Copy `.env.example` to `.env.local` and replace the placeholder values.
4. Never add `.env.local`, a secret key, or the legacy service-role key to Git.

```powershell
Copy-Item .env.example .env.local
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

The migrations create the application schema, role helpers, profile trigger, expiry validation, protected inventory read models, product registration, barcode aliases, atomic stock receiving, receipt-based sales, returns, business-day verification, reports, rate limits, indexes, grants, and Row-Level Security policies. `supabase/seed.sql` contains repeatable synthetic development data and must not be applied to a production database.

## Master SQL installer

`supabase/master.sql` is the complete database installer for a new, empty Supabase project. Open the project's SQL editor, paste the file, and run it once. The installer is transactional and stops before making changes if it detects an existing South Emerald schema.

Do not use the master installer to upgrade an existing database. Apply new files from `supabase/migrations` in filename order or use `npx supabase db push` instead. The migration files remain the source of truth.

Regenerate and verify the master installer after adding or editing a migration:

```powershell
npm run db:master
npm run db:master:check
```

Then open the SQL editor and run `supabase/seed.sql` if you want the ten development products and their initial inventory batches. The seed is repeatable but resets those fixed development batches to their declared quantities, so do not rerun it after recording test sales unless that reset is intentional.

## Reset development data

To return a development project to an empty testing state, run `supabase/reset-development-data.sql` in the Supabase SQL editor. The script permanently removes categories, products, inventory batches, adjustments, sales, returns, business days, and audit records, then resets their counters. It preserves Supabase Auth users and `public.profiles`, so existing logins and assigned roles continue to work.

Do not run the reset script against a production database. Run `supabase/seed.sql` afterward only when you want to repopulate the synthetic sample catalog; otherwise, refresh the application and begin with an empty inventory.

Sales are written through protected database functions rather than direct table updates. Confirming a sale writes its receipt and line items, snapshots costs, allocates non-expired batches using FEFO, and deducts inventory in one transaction. Returns and business-day verification likewise use protected functions so approval and stock restoration remain auditable.

## Create the first administrator

Public registration is disabled. Create the first user in Supabase Dashboard under Authentication > Users and include a `full_name` value in user metadata. The database trigger creates a cashier profile by default so a user cannot grant themselves elevated access.

Promote the first trusted account from the Supabase SQL editor:

```sql
update public.profiles
set role = 'administrator'
where id = (
  select id from auth.users where email = 'replace-with-admin-email@example.com'
);
```

After the first administrator is active, future account creation will move into the protected user-management module.

## Local verification

Docker or another compatible container runtime is required for the local Supabase stack.

```powershell
npx supabase start
npx supabase db reset
npx supabase test db
npm run test
npm run lint
npm run build
```

## Authentication settings

- Disable public email sign-ups in hosted Supabase Auth settings.
- Use administrator-created accounts only.
- Set the Site URL and allowed redirect URLs for local, preview, and production deployments.
- Configure production SMTP before enabling password recovery or invitations.
- Keep development and production credentials separate.
