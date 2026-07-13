-- Ejecutar en el SQL Editor de Supabase (Dashboard → SQL Editor → New query).
-- Crea el esquema de canciones/pistas y las políticas de acceso público
-- (v1 sin login: cualquiera con el enlace puede leer y escribir).

create table if not exists songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text,
  original_key text,
  tags text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tracks (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references songs(id) on delete cascade,
  slot text not null check (slot in ('melodia', 'voz2', 'voz3')),
  label text,
  voice_type text check (voice_type in ('soprano', 'contralto', 'tenor', 'bajo')),
  storage_path text not null,
  duration_sec numeric,
  recorded_key_hint text,
  suggested_range_min int,
  suggested_range_max int,
  file_size_bytes bigint,
  mime_type text,
  uploaded_at timestamptz not null default now(),
  unique (song_id, slot)
);

alter table songs enable row level security;
alter table tracks enable row level security;

create policy "public read songs" on songs for select using (true);
create policy "public write songs" on songs for insert with check (true);
create policy "public update songs" on songs for update using (true);
create policy "public delete songs" on songs for delete using (true);

create policy "public read tracks" on tracks for select using (true);
create policy "public write tracks" on tracks for insert with check (true);
create policy "public update tracks" on tracks for update using (true);
create policy "public delete tracks" on tracks for delete using (true);
