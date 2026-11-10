-- Reggie: atomic capacity check (Implementation Plan §4.3).
-- Locks the event row so two people submitting at once can't overbook.
create or replace function public.register_for_event(
  p_event_id uuid, p_full_name text, p_email text,
  p_organization text, p_contact_number text, p_qr_token text
) returns public.registrations
language plpgsql security definer set search_path = public as $$
declare
  v_event public.events;
  v_count integer;
  v_row   public.registrations;
begin
  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status <> 'published' then
    raise exception 'EVENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  select count(*) into v_count from public.registrations where event_id = p_event_id;
  if v_count >= v_event.capacity then
    raise exception 'EVENT_FULL' using errcode = 'P0001';
  end if;

  insert into public.registrations
    (event_id, full_name, email, organization, contact_number, qr_token)
  values
    (p_event_id, p_full_name, p_email, p_organization, p_contact_number, p_qr_token)
  returning * into v_row;           -- unique_violation (23505) => DUPLICATE
  return v_row;
end $$;

revoke execute on function public.register_for_event from public, anon, authenticated;
grant execute on function public.register_for_event to service_role;
