-- Endesha kwenye Supabase > SQL Editor
-- Kama ulishatengeneza table ya "media" ya mwanzo, ondoa alama ya -- mbele ya mstari huu kwanza:
-- drop table if exists media;

create table if not exists media (
  id uuid primary key default gen_random_uuid(),
  drive_id text unique not null,
  title text,
  type text not null check (type in ('image', 'video')),
  url text not null,
  r2_key text not null,
  md5 text,
  drive_created timestamptz,
  album text,
  album_order int not null default 0,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

alter table media enable row level security;

-- Kila mtu anaweza kusoma. Kuandika kunafanywa na script ya sync tu (service role).
create policy "public read" on media for select using (true);

-- Kama ulishaendesha schema ya zamani (bila albamu), endesha hii pia (haidhuru ukirudia):
alter table media add column if not exists album text;
alter table media add column if not exists album_order int not null default 0;
alter table media add column if not exists sort_order int not null default 0;
