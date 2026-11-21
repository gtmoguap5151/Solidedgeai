-- 002_guest_licenses.sql — Guest / licensee private spaces
-- Owner's order, Nov 21, 2026. Design (owner's pick, same day): ONE app,
-- single sign-in. Each account carries a package stamp — the licenses table
-- below. At sign-in the shell reads the stamp and loads ONLY that package's
-- team. The owner keeps the full app; a firm sees only its own space.
--
-- HOW TO APPLY: paste this whole file into the Supabase dashboard SQL editor
-- (project galinyx) and run it. It is safe to run twice.
--
-- AFTER APPLYING, stamp the owner's account — one line, in the same SQL
-- editor, with the owner's own sign-in email in place of the placeholder:
--   update public.profiles set role = 'owner'
--   where email = '<the owner sign-in email>';
-- Until that line runs, the owner's account reads as a guest with no
-- package. Run it in the same session as this file.
--
-- HOW TO STAMP A FIRM (only when the owner says a firm is in — nobody is
-- invited yet). The firm must have signed up (created an account) first:
--   insert into public.licenses (user_id, package)
--   select id, 'property-management' from public.profiles
--   where email = '<firm sign-in email>';
-- Valid package slugs are the ten in the check constraint below.
--
-- PRIVACY RULE (owner's, Nov 21, 2026): once a firm is in, the owner's
-- sign-in must NOT open the firm's space. The app has no owner-peek path.
-- These tables enforce the shell side of that: a firm reads only its own
-- license row, and nobody can stamp or promote themselves through the app.

-- ------------------------------------------------------------------
-- profiles.role — owner vs guest
-- ------------------------------------------------------------------
alter table public.profiles
  add column if not exists role text not null default 'guest';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('owner', 'guest'));
  end if;
end $$;

-- A new account must not be able to insert itself as owner. The insert
-- policy previously checked only the id; now it also requires the role to
-- be the default guest (or left unset, which defaults to guest).
drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id and (role = 'guest' or role is null));

-- Nobody may change a profile's role through the app. Role changes happen
-- only from the dashboard SQL editor (no JWT claims present) or with the
-- service_role key. A signed-in user who tries is refused by the trigger.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
as $$
declare
  jwt_role text;
begin
  if tg_op = 'UPDATE' and old.role is distinct from new.role then
    begin
      jwt_role := (current_setting('request.jwt.claims', true)::jsonb ->> 'role');
    exception when others then
      jwt_role := null;
    end;
    -- No JWT (dashboard / SQL editor / postgres) or the service_role key
    -- may change roles. Any signed-in user JWT may not.
    if jwt_role is not null and jwt_role <> 'service_role' then
      raise exception 'profile role cannot be changed through the app';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ------------------------------------------------------------------
-- licenses — the package stamp on an account
-- ------------------------------------------------------------------
create table if not exists public.licenses (
  user_id uuid primary key references auth.users (id) on delete cascade,
  package text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint licenses_package_check check (package in (
    'home-services',
    'construction',
    'real-estate',
    'property-management',
    'restaurants',
    'hotels',
    'warehouse-logistics',
    'auto-repair',
    'medical-practices',
    'civil-law'
  ))
);

alter table public.licenses enable row level security;

-- A firm reads ONLY its own license row. There is deliberately NO insert,
-- update, or delete policy for signed-in users: licenses are stamped and
-- changed only from the dashboard (or with the service_role key). A firm
-- cannot stamp itself, change its package, or read another firm's row.
drop policy if exists "Users can read their own license" on public.licenses;
create policy "Users can read their own license"
  on public.licenses for select
  using (auth.uid() = user_id);

drop trigger if exists licenses_set_updated_at on public.licenses;
create trigger licenses_set_updated_at
  before update on public.licenses
  for each row execute function public.set_updated_at();
