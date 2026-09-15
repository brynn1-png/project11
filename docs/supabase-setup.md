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

The migrations create the application schema, role helpers, profile trigger, expiry validation, protected inventory read models, indexes, grants, and Row-Level Security policies. `supabase/seed.sql` contains repeatable synthetic development data and must not be applied to a production database.

For a hosted development project, apply both migration files first. Then open the SQL editor and run `supabase/seed.sql` if you want the ten development products and their initial inventory batches. The application will show a recovery message until the inventory read-model migration has been applied.

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
