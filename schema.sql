-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- 1. USERS Table
create table public.users (
  id uuid references auth.users not null primary key,
  name text not null,
  email text not null unique,
  role text not null check (role in ('teacher', 'student')),
  college text,
  department text,
  semester text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on users
alter table public.users enable row level security;

create policy "Allow public read access to users"
  on public.users for select
  to authenticated
  using (true);

create policy "Allow users to update their own data"
  on public.users for update
  to authenticated
  using (auth.uid() = id);

-- Trigger to copy signups from auth.users to public.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, name, email, role, college, department, semester)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'User'),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'student'),
    coalesce(new.raw_user_meta_data->>'college', ''),
    coalesce(new.raw_user_meta_data->>'department', ''),
    coalesce(new.raw_user_meta_data->>'semester', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. CLASSES Table
create table public.classes (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  subject text not null,
  teacher_id uuid references public.users(id) on delete cascade not null,
  join_code varchar(6) unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.classes enable row level security;

create policy "Allow authenticated users to read all classes"
  on public.classes for select
  to authenticated
  using (true);

create policy "Allow teachers to insert classes"
  on public.classes for insert
  to authenticated
  with check (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'teacher'
    )
  );

create policy "Allow teachers to update/delete their own classes"
  on public.classes for all
  to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());


-- 3. ENROLLMENTS Table (Many-to-Many student class relationship)
create table public.enrollments (
  student_id uuid references public.users(id) on delete cascade not null,
  class_id uuid references public.classes(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (student_id, class_id)
);

alter table public.enrollments enable row level security;

create policy "Allow users to read their own enrollments"
  on public.enrollments for select
  to authenticated
  using (
    student_id = auth.uid() or 
    exists (
      select 1 from public.classes
      where id = class_id and teacher_id = auth.uid()
    )
  );

create policy "Allow students to enroll themselves"
  on public.enrollments for insert
  to authenticated
  with check (student_id = auth.uid());


-- 4. SESSIONS Table
create table public.sessions (
  id uuid default gen_random_uuid() primary key,
  class_id uuid references public.classes(id) on delete cascade not null,
  transcript text,
  summary text,
  timer_duration integer default 15 not null, -- 10 or 15 seconds
  is_active boolean default false not null,
  questions_released boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.sessions enable row level security;

create policy "Allow authenticated users to read sessions"
  on public.sessions for select
  to authenticated
  using (true);

create policy "Allow class teachers to manage sessions"
  on public.sessions for all
  to authenticated
  using (
    exists (
      select 1 from public.classes
      where id = class_id and teacher_id = auth.uid()
    )
  );


-- 5. QUESTIONS Table
create table public.questions (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.sessions(id) on delete cascade not null,
  question_text text not null,
  options text[] not null, -- Exactly 4 strings
  correct_answer text not null, -- A, B, C, or D
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.questions enable row level security;

create policy "Allow authenticated users to read questions"
  on public.questions for select
  to authenticated
  using (true);

create policy "Allow teachers to manage questions"
  on public.questions for all
  to authenticated
  using (
    exists (
      select 1 from public.sessions s
      join public.classes c on s.class_id = c.id
      where s.id = session_id and c.teacher_id = auth.uid()
    )
  );


-- 6. STUDENT QUESTION ORDER Table
create table public.student_question_order (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.sessions(id) on delete cascade not null,
  student_id uuid references public.users(id) on delete cascade not null,
  question_order uuid[] not null, -- Array of question_ids representing randomized sequence
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (session_id, student_id)
);

alter table public.student_question_order enable row level security;

create policy "Allow students to view their own question order"
  on public.student_question_order for select
  to authenticated
  using (
    student_id = auth.uid() or 
    exists (
      select 1 from public.sessions s
      join public.classes c on s.class_id = c.id
      where s.id = session_id and c.teacher_id = auth.uid()
    )
  );

create policy "Allow students to store their question order"
  on public.student_question_order for insert
  to authenticated
  with check (student_id = auth.uid());


-- 7. ANSWERS Table
create table public.answers (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references public.users(id) on delete cascade not null,
  question_id uuid references public.questions(id) on delete cascade not null,
  selected_answer text, -- A, B, C, D (or null for unanswered)
  is_correct boolean,
  time_taken_ms integer not null default 0,
  flagged boolean default false not null,
  flag_reason text,
  submitted_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (student_id, question_id)
);

alter table public.answers enable row level security;

create policy "Allow students to view/insert their own answers"
  on public.answers for select
  to authenticated
  using (
    student_id = auth.uid() or
    exists (
      select 1 from public.questions q
      join public.sessions s on q.session_id = s.id
      join public.classes c on s.class_id = c.id
      where q.id = question_id and c.teacher_id = auth.uid()
    )
  );

create policy "Allow students to insert/update their own answers"
  on public.answers for insert
  to authenticated
  with check (student_id = auth.uid());

create policy "Allow students to update their own answers"
  on public.answers for update
  to authenticated
  using (student_id = auth.uid());


-- 8. ASSIGNMENTS Table
create table public.assignments (
  id uuid default gen_random_uuid() primary key,
  class_id uuid references public.classes(id) on delete cascade not null,
  title text not null,
  description text,
  due_date timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.assignments enable row level security;

create policy "Allow authenticated users to read assignments"
  on public.assignments for select
  to authenticated
  using (true);

create policy "Allow teachers to manage assignments"
  on public.assignments for all
  to authenticated
  using (
    exists (
      select 1 from public.classes
      where id = class_id and teacher_id = auth.uid()
    )
  );


-- 9. SUBMISSIONS Table
create table public.submissions (
  id uuid default gen_random_uuid() primary key,
  assignment_id uuid references public.assignments(id) on delete cascade not null,
  student_id uuid references public.users(id) on delete cascade not null,
  file_url text not null, -- Can be link, text copy, or descriptive submission text
  grade text, -- Manual grade by teacher (e.g. A, B, 95, etc.)
  submitted_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (assignment_id, student_id)
);

alter table public.submissions enable row level security;

create policy "Allow students to view/insert their own submissions"
  on public.submissions for select
  to authenticated
  using (
    student_id = auth.uid() or
    exists (
      select 1 from public.assignments a
      join public.classes c on a.class_id = c.id
      where a.id = assignment_id and c.teacher_id = auth.uid()
    )
  );

create policy "Allow students to submit work"
  on public.submissions for insert
  to authenticated
  with check (student_id = auth.uid());

create policy "Allow teachers to grade submissions"
  on public.submissions for update
  to authenticated
  using (
    exists (
      select 1 from public.assignments a
      join public.classes c on a.class_id = c.id
      where a.id = assignment_id and c.teacher_id = auth.uid()
    )
  );


-- 10. ATTENDANCE Table
create table public.attendance (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.sessions(id) on delete cascade not null,
  student_id uuid references public.users(id) on delete cascade not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (session_id, student_id)
);

alter table public.attendance enable row level security;

create policy "Allow user access to their own attendance"
  on public.attendance for select
  to authenticated
  using (
    student_id = auth.uid() or
    exists (
      select 1 from public.sessions s
      join public.classes c on s.class_id = c.id
      where s.id = session_id and c.teacher_id = auth.uid()
    )
  );

create policy "Allow students to mark attendance"
  on public.attendance for insert
  to authenticated
  with check (student_id = auth.uid());


-- 11. CHEAT LOGS Table
create table public.cheat_logs (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.sessions(id) on delete cascade not null,
  student_id uuid references public.users(id) on delete cascade not null,
  event_type text not null, -- tab_switch, right_click, keyboard_shortcut
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.cheat_logs enable row level security;

create policy "Allow users to view/insert cheat logs"
  on public.cheat_logs for select
  to authenticated
  using (
    student_id = auth.uid() or
    exists (
      select 1 from public.sessions s
      join public.classes c on s.class_id = c.id
      where s.id = session_id and c.teacher_id = auth.uid()
    )
  );

create policy "Allow students to write cheat logs"
  on public.cheat_logs for insert
  to authenticated
  with check (student_id = auth.uid());
