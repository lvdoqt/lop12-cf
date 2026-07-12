-- Create users profile table linked to Supabase auth.users
create table public.users (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  fullname text,
  avatar_url text,
  role text not null check (role in ('student', 'teacher', 'admin')) default 'student',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on users
alter table public.users enable row level security;

-- Create subjects table
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null
);

-- Enable RLS on subjects
alter table public.subjects enable row level security;

-- Create lessons table
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references public.subjects(id) on delete cascade not null,
  title text not null,
  slug text not null,
  content text, -- Markdown + LaTeX content
  video_url text, -- YouTube video URL
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on lessons
alter table public.lessons enable row level security;

-- Create questions table
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references public.subjects(id) on delete cascade not null,
  content text not null, -- Markdown/LaTeX question content
  explanation text, -- Solution details
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')) default 'medium',
  type text not null check (type in ('single_choice', 'multiple_choice', 'true_false')) default 'single_choice'
);

-- Enable RLS on questions
alter table public.questions enable row level security;

-- Create answers table
create table public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references public.questions(id) on delete cascade not null,
  content text not null,
  is_correct boolean default false not null
);

-- Enable RLS on answers
alter table public.answers enable row level security;

-- Create exams table
create table public.exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  duration integer not null, -- In minutes
  subject_id uuid references public.subjects(id) on delete cascade not null,
  exam_type text not null check (exam_type in ('15m', '45m', 'semester', 'mock_thpt')) default '15m',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on exams
alter table public.exams enable row level security;

-- Create exam_questions junction table
create table public.exam_questions (
  exam_id uuid references public.exams(id) on delete cascade not null,
  question_id uuid references public.questions(id) on delete cascade not null,
  primary key (exam_id, question_id)
);

-- Enable RLS on exam_questions
alter table public.exam_questions enable row level security;

-- Create attempts table for exam history
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  exam_id uuid references public.exams(id) on delete cascade not null,
  score numeric(5,2), -- Score out of 10
  answers_submitted jsonb, -- JSON containing question_id to selected answer_id(s) mapping
  started_at timestamp with time zone default timezone('utc'::text, now()) not null,
  finished_at timestamp with time zone
);

-- Enable RLS on attempts
alter table public.attempts enable row level security;

-- Insert default subjects
insert into public.subjects (name, slug) values
  ('Toán 12', 'toan-12'),
  ('Vật lý 12', 'vat-ly-12'),
  ('Hóa học 12', 'hoa-hoc-12'),
  ('Sinh học 12', 'sinh-hoc-12'),
  ('Tiếng Anh 12', 'tieng-anh-12');

-- Trigger to sync new auth.users to public.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, fullname, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'fullname', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    'student'
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
