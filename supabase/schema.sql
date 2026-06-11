-- Supabase SQL Editor에서 실행하세요.

create table if not exists public.signups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists signups_phone_key on public.signups (phone);
create unique index if not exists signups_email_key on public.signups (email);

alter table public.signups enable row level security;
