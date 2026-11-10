-- Reggie: tables (Implementation Plan §4.1)
create extension if not exists pgcrypto;

create type event_status as enum ('draft', 'published');
create type email_status as enum ('pending', 'sent', 'failed');

create table public.events (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references auth.users(id) on delete cascade,
  title       text not null check (char_length(title) between 3 and 120),
  description text not null default '',
  date_time   timestamptz not null,
  venue       text not null check (char_length(venue) between 2 and 200),
  capacity    integer not null check (capacity > 0 and capacity <= 10000),
  status      event_status not null default 'draft',
  created_at  timestamptz not null default now()
);
create index events_admin_idx on public.events (admin_id);
create index events_published_idx on public.events (status, date_time);

create table public.registrations (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events(id) on delete cascade,
  full_name      text not null check (char_length(full_name) between 2 and 100),
  email          text not null,
  organization   text not null check (char_length(organization) between 1 and 120),
  contact_number text not null,                       -- normalized +639XXXXXXXXX
  qr_token       text not null unique,                -- base64url, 128-bit random
  email_status   email_status not null default 'pending',
  checked_in_at  timestamptz,
  created_at     timestamptz not null default now(),
  constraint registrations_event_email_uq unique (event_id, email)
);
create index registrations_event_idx on public.registrations (event_id);
