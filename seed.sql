-- Clean up any existing seed data to avoid primary key conflicts
delete from public.submissions;
delete from public.assignments;
delete from public.answers;
delete from public.student_question_order;
delete from public.questions;
delete from public.attendance;
delete from public.cheat_logs;
delete from public.sessions;
delete from public.enrollments;
delete from public.classes;
delete from public.users;
delete from auth.users where email in ('teacher@school.edu', 'student1@school.edu', 'student2@school.edu', 'student3@school.edu');

-- 1. Create Auth Users with encrypted passwords ('password123')
-- Blowfish crypt is used by Supabase Auth
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
values 
  ('4a2f8b50-d4fb-40c2-9e8c-32b0a96f1b1a', 'teacher@school.edu', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"name":"Prof. Santhosh Kumar","role":"teacher","college":"IIT Madras","department":"Computer Science"}', now(), now(), 'authenticated', 'authenticated'),
  ('9e5c4d60-7c2a-4318-80f2-7489ab1cd30b', 'student1@school.edu', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"name":"Aarav Sharma","role":"student","college":"IIT Madras","department":"Computer Science","semester":"6"}', now(), now(), 'authenticated', 'authenticated'),
  ('3f1b6a70-8b1e-450a-bf41-6923bc4dc50a', 'student2@school.edu', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"name":"Diya Patel","role":"student","college":"IIT Madras","department":"Computer Science","semester":"6"}', now(), now(), 'authenticated', 'authenticated'),
  ('c7d8e9f0-2a3b-4c5d-6e7f-8a9b0c1d2e3f', 'student3@school.edu', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"name":"Kabir Singh","role":"student","college":"IIT Madras","department":"Computer Science","semester":"6"}', now(), now(), 'authenticated', 'authenticated');

-- Note: The triggers on auth.users will automatically copy these users into public.users. 
-- However, just in case triggers aren't running, we insert them into public.users explicitly (on conflict do nothing)
insert into public.users (id, name, email, role, college, department, semester)
values
  ('4a2f8b50-d4fb-40c2-9e8c-32b0a96f1b1a', 'Prof. Santhosh Kumar', 'teacher@school.edu', 'teacher', 'IIT Madras', 'Computer Science', ''),
  ('9e5c4d60-7c2a-4318-80f2-7489ab1cd30b', 'Aarav Sharma', 'student1@school.edu', 'student', 'IIT Madras', 'Computer Science', '6'),
  ('3f1b6a70-8b1e-450a-bf41-6923bc4dc50a', 'Diya Patel', 'student2@school.edu', 'student', 'IIT Madras', 'Computer Science', '6'),
  ('c7d8e9f0-2a3b-4c5d-6e7f-8a9b0c1d2e3f', 'Kabir Singh', 'student3@school.edu', 'student', 'IIT Madras', 'Computer Science', '6')
on conflict (id) do update set
  role = excluded.role,
  college = excluded.college,
  department = excluded.department,
  semester = excluded.semester;

-- 2. Create Class
insert into public.classes (id, name, subject, teacher_id, join_code)
values ('11111111-1111-1111-1111-111111111111', 'Advanced Web Development', 'Computer Science CS-402', '4a2f8b50-d4fb-40c2-9e8c-32b0a96f1b1a', '123456');

-- 3. Enroll Students
insert into public.enrollments (student_id, class_id)
values 
  ('9e5c4d60-7c2a-4318-80f2-7489ab1cd30b', '11111111-1111-1111-1111-111111111111'),
  ('3f1b6a70-8b1e-450a-bf41-6923bc4dc50a', '11111111-1111-1111-1111-111111111111'),
  ('c7d8e9f0-2a3b-4c5d-6e7f-8a9b0c1d2e3f', '11111111-1111-1111-1111-111111111111');

-- 4. Create Session
insert into public.sessions (id, class_id, transcript, summary, timer_duration, is_active, questions_released)
values (
  '22222222-2222-2222-2222-222222222222', 
  '11111111-1111-1111-1111-111111111111', 
  'Today we discussed how React components re-render when state changes. We talked about virtual DOM, useState Hooks, and using Supabase Realtime subscriptions to listen to database modifications over WebSockets.',
  '### 📚 Web Development Lecture Summary

* **State Rendering**:
  - React components re-render whenever the `state` or `props` change.
  - The Virtual DOM calculates discrepancies and updates the real DOM efficiently.
* **Supabase Realtime**:
  - Utilizes WebSockets under the hood to broadcast changes.
  - Allows listening to INSERT, UPDATE, and DELETE triggers on specific database tables.',
  15,
  false,
  true
);

-- 5. Create Questions
insert into public.questions (id, session_id, question_text, options, correct_answer)
values
  (
    '33333333-3333-3333-3333-333333333331', 
    '22222222-2222-2222-2222-222222222222', 
    'What triggers a React component to re-render?', 
    array['A) Modifying global window variables', 'B) Changes in state or props', 'C) Direct DOM document writes', 'D) Changing local CSS classes'], 
    'B'
  ),
  (
    '33333333-3333-3333-3333-333333333332', 
    '22222222-2222-2222-2222-222222222222', 
    'What technology does Supabase Realtime use to sync data?', 
    array['A) WebSockets', 'B) Periodical HTTP polling', 'C) LocalCookies sync', 'D) Fetch interval loops'], 
    'A'
  ),
  (
    '33333333-3333-3333-3333-333333333333', 
    '22222222-2222-2222-2222-222222222222', 
    'What is the Virtual DOM used for in React?', 
    array['A) To store query indexes on the server', 'B) To calculate DOM changes and update the UI efficiently', 'C) To disable right-clicks on canvas tags', 'D) To run background Express proxy commands'], 
    'B'
  );

-- 6. Add Attendance
insert into public.attendance (session_id, student_id)
values 
  ('22222222-2222-2222-2222-222222222222', '9e5c4d60-7c2a-4318-80f2-7489ab1cd30b'),
  ('22222222-2222-2222-2222-222222222222', '3f1b6a70-8b1e-450a-bf41-6923bc4dc50a'),
  ('22222222-2222-2222-2222-222222222222', 'c7d8e9f0-2a3b-4c5d-6e7f-8a9b0c1d2e3f');

-- 7. Add Answers
insert into public.answers (student_id, question_id, selected_answer, is_correct, time_taken_ms, flagged, flag_reason)
values 
  -- Student 1 (3/3 Correct)
  ('9e5c4d60-7c2a-4318-80f2-7489ab1cd30b', '33333333-3333-3333-3333-333333333331', 'B', true, 4200, false, null),
  ('9e5c4d60-7c2a-4318-80f2-7489ab1cd30b', '33333333-3333-3333-3333-333333333332', 'A', true, 3100, false, null),
  ('9e5c4d60-7c2a-4318-80f2-7489ab1cd30b', '33333333-3333-3333-3333-333333333333', 'B', true, 5500, false, null),
  
  -- Student 2 (2/3 Correct)
  ('3f1b6a70-8b1e-450a-bf41-6923bc4dc50a', '33333333-3333-3333-3333-333333333331', 'B', true, 8100, false, null),
  ('3f1b6a70-8b1e-450a-bf41-6923bc4dc50a', '33333333-3333-3333-3333-333333333332', 'A', true, 6400, false, null),
  ('3f1b6a70-8b1e-450a-bf41-6923bc4dc50a', '33333333-3333-3333-3333-333333333333', 'A', false, 7900, false, null),

  -- Student 3 (1/3 Correct, 1 focus warning flag)
  ('c7d8e9f0-2a3b-4c5d-6e7f-8a9b0c1d2e3f', '33333333-3333-3333-3333-333333333331', 'B', true, 5000, false, null),
  ('c7d8e9f0-2a3b-4c5d-6e7f-8a9b0c1d2e3f', '33333333-3333-3333-3333-333333333332', 'C', false, 12000, true, 'focus_loss'),
  ('c7d8e9f0-2a3b-4c5d-6e7f-8a9b0c1d2e3f', '33333333-3333-3333-3333-333333333333', 'D', false, 2000, true, 'focus_loss');

-- 8. Add Cheat Logs
insert into public.cheat_logs (session_id, student_id, event_type, timestamp)
values 
  ('22222222-2222-2222-2222-222222222222', 'c7d8e9f0-2a3b-4c5d-6e7f-8a9b0c1d2e3f', 'tab_switch', now() - interval '2 minutes');

-- 9. Add Assignments
insert into public.assignments (id, class_id, title, description, due_date)
values ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'React Hooks Custom Implementations', 'Write a custom hook called useFetch that supports cache caching and abort signals.', now() + interval '5 days');

-- 10. Add Submissions
insert into public.submissions (assignment_id, student_id, file_url, grade)
values
  ('44444444-4444-4444-4444-444444444444', '9e5c4d60-7c2a-4318-80f2-7489ab1cd30b', 'https://github.com/aarav/custom-hook-fetch', '95'),
  ('44444444-4444-4444-4444-444444444444', '3f1b6a70-8b1e-450a-bf41-6923bc4dc50a', 'https://github.com/diya/react-usefetch', null);
