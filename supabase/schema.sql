-- Sylve : schéma Supabase
-- À coller dans Supabase > SQL Editor > New query, puis "Run".

-- ============ Profils ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null default '',
  avatar_url text,
  invite_code text unique not null default substr(md5(random()::text), 1, 10),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base text;
begin
  base := lower(regexp_replace(coalesce(split_part(new.email, '@', 1), 'sylve'), '[^a-z0-9_]', '', 'g'));
  if base = '' then base := 'sylve'; end if;
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    base || '_' || substr(md5(new.id::text), 1, 4),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', base),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ Amis ============
-- Une amitié est stockée dans les deux sens (a->b et b->a).
create table if not exists public.friendships (
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a <> user_b)
);

create or replace function public.is_friend(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friendships where user_a = a and user_b = b);
$$;

-- Accepter une invitation : crée l'amitié dans les deux sens.
create or replace function public.accept_invite(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  other uuid;
begin
  select id into other from public.profiles where invite_code = code;
  if other is null then raise exception 'Invitation introuvable'; end if;
  if other = auth.uid() then return other; end if;
  insert into public.friendships (user_a, user_b) values (auth.uid(), other) on conflict do nothing;
  insert into public.friendships (user_a, user_b) values (other, auth.uid()) on conflict do nothing;
  return other;
end $$;

create or replace function public.remove_friend(other uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.friendships
  where (user_a = auth.uid() and user_b = other) or (user_a = other and user_b = auth.uid());
$$;

-- ============ État du jardin (pièces, tuiles, réglages…) ============
create table if not exists public.user_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ============ Sessions de focus ============
create table if not exists public.sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null,
  minutes int not null default 0,
  subject text,
  ok boolean not null default false,
  species text not null default 'chene',
  group_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists sessions_user_idx on public.sessions (user_id, started_at);

-- ============ Sessions de groupe ============
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby','running','done','failed')),
  minutes int not null default 25,
  species text not null default 'chene',
  starts_at timestamptz,
  ends_at timestamptz,
  failed_by uuid,
  grace int not null default 120,
  created_at timestamptz not null default now()
);
alter table public.groups add column if not exists grace int not null default 120;

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create or replace function public.is_group_member(g uuid, u uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = g and user_id = u);
$$;

-- ============ Classement de la semaine (toi + tes amis) ============
create or replace function public.weekly_leaderboard()
returns table (user_id uuid, username text, display_name text, avatar_url text, minutes bigint, trees bigint)
language sql stable security definer set search_path = public as $$
  with circle as (
    select auth.uid() as id
    union select user_b from public.friendships where user_a = auth.uid()
  )
  select p.id, p.username, p.display_name, p.avatar_url,
         coalesce(sum(s.minutes) filter (where s.ok), 0) as minutes,
         count(s.id) filter (where s.ok) as trees
  from circle c
  join public.profiles p on p.id = c.id
  left join public.sessions s on s.user_id = p.id
    and s.started_at >= date_trunc('week', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris'
  group by p.id
  order by minutes desc, trees desc;
$$;

-- ============ Sécurité (RLS) ============
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.user_state enable row level security;
alter table public.sessions enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

drop policy if exists "profiles lisibles" on public.profiles;
create policy "profiles lisibles" on public.profiles for select to authenticated using (true);
drop policy if exists "profil modifiable par soi" on public.profiles;
create policy "profil modifiable par soi" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "mes amitiés" on public.friendships;
create policy "mes amitiés" on public.friendships for select to authenticated using (user_a = auth.uid());

drop policy if exists "état lisible soi et amis" on public.user_state;
create policy "état lisible soi et amis" on public.user_state for select to authenticated
  using (user_id = auth.uid() or public.is_friend(auth.uid(), user_id));
drop policy if exists "état écrit par soi" on public.user_state;
create policy "état écrit par soi" on public.user_state for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "état modifié par soi" on public.user_state;
create policy "état modifié par soi" on public.user_state for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "sessions lisibles soi et amis" on public.sessions;
create policy "sessions lisibles soi et amis" on public.sessions for select to authenticated
  using (user_id = auth.uid() or public.is_friend(auth.uid(), user_id));
drop policy if exists "sessions écrites par soi" on public.sessions;
create policy "sessions écrites par soi" on public.sessions for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "groupes lisibles" on public.groups;
create policy "groupes lisibles" on public.groups for select to authenticated using (true);
drop policy if exists "groupe créé par l'hôte" on public.groups;
create policy "groupe créé par l'hôte" on public.groups for insert to authenticated with check (host_id = auth.uid());
drop policy if exists "groupe modifié par ses membres" on public.groups;
create policy "groupe modifié par ses membres" on public.groups for update to authenticated
  using (host_id = auth.uid() or public.is_group_member(id, auth.uid()));

drop policy if exists "membres lisibles" on public.group_members;
create policy "membres lisibles" on public.group_members for select to authenticated using (true);
drop policy if exists "rejoindre soi-même" on public.group_members;
create policy "rejoindre soi-même" on public.group_members for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "quitter soi-même" on public.group_members;
create policy "quitter soi-même" on public.group_members for delete to authenticated using (user_id = auth.uid());

grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.weekly_leaderboard() to authenticated;

-- ============ Temps réel ============
do $$ begin
  begin alter publication supabase_realtime add table public.groups; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.group_members; exception when duplicate_object then null; end;
end $$;
