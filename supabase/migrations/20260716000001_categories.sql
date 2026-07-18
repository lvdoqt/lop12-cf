-- Create categories table (subcategories of subjects)
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references public.subjects(id) on delete cascade not null,
  name text not null,
  slug text not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (subject_id, slug)
);

-- Enable RLS on categories
alter table public.categories enable row level security;

-- Policies: anyone can read, teachers/admins can manage
create policy "categories_select" on public.categories
  for select using (true);

create policy "categories_insert" on public.categories
  for insert with check (
    exists (
      select 1 from public.users
      where id = auth.uid() and role in ('teacher', 'admin')
    )
  );

create policy "categories_update" on public.categories
  for update using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role in ('teacher', 'admin')
    )
  );

create policy "categories_delete" on public.categories
  for delete using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role in ('teacher', 'admin')
    )
  );

-- Add category_id to exams table
alter table public.exams
  add column if not exists category_id uuid references public.categories(id) on delete set null;

-- Note: for questions, category_id is stored in metadata->>'category_id'
-- (questions table uses a single jsonb metadata column)
