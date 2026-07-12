-- Create blogs / news table
create table public.blogs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  summary text,
  content text, -- Markdown content
  cover_url text, -- Cover image URL
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.blogs enable row level security;

-- Policies
create policy "Allow anyone to read blogs"
  on public.blogs for select
  using (true);

create policy "Allow admins and teachers to manage blogs"
  on public.blogs for all
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role in ('teacher', 'admin')
    )
  );
