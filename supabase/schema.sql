create table public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  label text not null,
  config jsonb not null,
  result jsonb not null
);

alter table public.runs enable row level security;

create policy "own runs select" on public.runs
  for select to authenticated using (auth.uid() = user_id);
create policy "own runs insert" on public.runs
  for insert to authenticated with check (auth.uid() = user_id);
create policy "own runs delete" on public.runs
  for delete to authenticated using (auth.uid() = user_id);
