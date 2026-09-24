create table if not exists public.sounds (
  id text primary key,
  title text not null,
  category text not null,
  file_url text not null,
  duration numeric not null default 0,
  license_type text not null,
  source text not null default 'Freesound',
  created_at timestamptz not null default now()
);
create index if not exists sounds_category_idx on public.sounds(category);
alter table public.sounds enable row level security;
create policy "Public can read sounds" on public.sounds for select using (true);
