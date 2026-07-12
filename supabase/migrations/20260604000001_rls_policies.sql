-- Helpers to check user roles
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  );
end;
$$ language plpgsql security definer;

create or replace function public.is_teacher_or_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.users
    where id = auth.uid() and role in ('teacher', 'admin')
  );
end;
$$ language plpgsql security definer;

-- 1. Users policies
create policy "Allow public read access to profiles"
  on public.users for select
  using (auth.uid() is not null);

create policy "Allow users to update their own profile"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Allow admins full control on profiles"
  on public.users for all
  using (public.is_admin());


-- 2. Subjects policies
create policy "Allow anyone to read subjects"
  on public.subjects for select
  using (true);

create policy "Allow admins and teachers to manage subjects"
  on public.subjects for all
  using (public.is_teacher_or_admin());


-- 3. Lessons policies
create policy "Allow authenticated users to read lessons"
  on public.lessons for select
  using (auth.uid() is not null);

create policy "Allow admins and teachers to manage lessons"
  on public.lessons for all
  using (public.is_teacher_or_admin());


-- 4. Questions policies
create policy "Allow authenticated users to read questions"
  on public.questions for select
  using (auth.uid() is not null);

create policy "Allow admins and teachers to manage questions"
  on public.questions for all
  using (public.is_teacher_or_admin());


-- 5. Answers policies
create policy "Allow authenticated users to read answers"
  on public.answers for select
  using (auth.uid() is not null);

create policy "Allow admins and teachers to manage answers"
  on public.answers for all
  using (public.is_teacher_or_admin());


-- 6. Exams policies
create policy "Allow authenticated users to read exams"
  on public.exams for select
  using (auth.uid() is not null);

create policy "Allow admins and teachers to manage exams"
  on public.exams for all
  using (public.is_teacher_or_admin());


-- 7. Exam Questions policies
create policy "Allow authenticated users to read exam questions"
  on public.exam_questions for select
  using (auth.uid() is not null);

create policy "Allow admins and teachers to manage exam questions"
  on public.exam_questions for all
  using (public.is_teacher_or_admin());


-- 8. Attempts policies
create policy "Allow users to view their own attempts"
  on public.attempts for select
  using (auth.uid() = user_id or public.is_teacher_or_admin());

create policy "Allow users to insert their own attempts"
  on public.attempts for insert
  with check (auth.uid() = user_id);

create policy "Allow users to update their own attempts"
  on public.attempts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Allow admins and teachers to manage attempts"
  on public.attempts for delete
  using (public.is_teacher_or_admin());
