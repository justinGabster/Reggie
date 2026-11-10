-- Reggie: row level security, the second layer of defense (Implementation Plan §4.2).
-- The Worker uses the service-role key, which bypasses RLS.
alter table public.events        enable row level security;
alter table public.registrations enable row level security;

-- Anyone may read published events (harmless public info).
create policy "public reads published events" on public.events
  for select using (status = 'published');

-- Admins manage only their own events.
create policy "admin reads own events" on public.events
  for select to authenticated using (admin_id = auth.uid());
create policy "admin inserts own events" on public.events
  for insert to authenticated with check (admin_id = auth.uid());
create policy "admin updates own events" on public.events
  for update to authenticated using (admin_id = auth.uid()) with check (admin_id = auth.uid());

-- Registrations: no anon access at all; admins read their own events' registrants.
create policy "admin reads own registrants" on public.registrations
  for select to authenticated
  using (exists (select 1 from public.events e
                 where e.id = event_id and e.admin_id = auth.uid()));
-- No insert/update policies on registrations: all writes go through the Worker.
