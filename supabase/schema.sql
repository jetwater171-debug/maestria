-- Execute uma vez no SQL Editor do projeto Supabase.
create table if not exists public.venues (
 owner uuid primary key references auth.users(id) on delete cascade,
 state jsonb not null,
 version bigint not null default 0 check (version >= 0)
);
create table if not exists public.accesses (
 hash text primary key,
 owner uuid not null references public.venues(owner) on delete cascade,
 employee text not null,
 unique(owner,employee)
);
create table if not exists public.printers (
 owner uuid primary key references public.venues(owner) on delete cascade,
 hash text not null
);
alter table public.venues enable row level security;
alter table public.accesses enable row level security;
alter table public.printers enable row level security;
-- Navegador não altera estado operacional diretamente. API valida identidade e função.
revoke all on public.venues, public.accesses, public.printers from anon, authenticated;
grant select, insert, update, delete on public.venues, public.accesses, public.printers to service_role;
