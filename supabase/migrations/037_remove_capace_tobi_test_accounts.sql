-- Permanently remove sandbox identities "Capace Test" / "Tobi test" and related rows.
-- Matches display names case-insensitively (trimmed). If your test users used different
-- names, adjust this migration or delete the remaining rows manually in Supabase.

-- 1) Contracts tied to test events, test exhibitors, or a test-named sales rep (cascades line items, booth brands, audit_log).
delete from public.contracts c
where
  c.event_id in (
    select e.id
    from public.events e
    where lower(trim(e.name)) in ('capace test', 'tobi test')
  )
  or lower(trim(c.exhibitor_company_name)) in ('capace test', 'tobi test')
  or lower(trim(c.exhibitor_legal_name)) in ('capace test', 'tobi test')
  or c.sales_rep_id in (
    select sr.id
    from public.sales_reps sr
    where lower(trim(sr.name)) in ('capace test', 'tobi test')
  );

-- 2) Test-named events (only when no contracts still reference them).
delete from public.events e
where lower(trim(e.name)) in ('capace test', 'tobi test')
  and not exists (select 1 from public.contracts c where c.event_id = e.id);

-- 3) Assistant assignments where the assistant login is a test app user (by name → email).
delete from public.rep_assistants ra
where exists (
  select 1
  from public.app_users au
  where lower(trim(coalesce(au.name, ''))) in ('capace test', 'tobi test')
    and lower(au.email) = lower(ra.assistant_email)
);

-- 4) Access requests for those names or emails (before dropping app_users).
delete from public.access_requests ar
where lower(trim(coalesce(ar.name, ''))) in ('capace test', 'tobi test')
   or lower(ar.email) in (
        select lower(au.email)
        from public.app_users au
        where lower(trim(coalesce(au.name, ''))) in ('capace test', 'tobi test')
      );

-- 5) Sales rep directory rows (contracts already cleared or rep id nulled by FK).
delete from public.sales_reps sr
where lower(trim(sr.name)) in ('capace test', 'tobi test');

-- 6) App allowlist / login identities.
delete from public.app_users au
where lower(trim(coalesce(au.name, ''))) in ('capace test', 'tobi test');
