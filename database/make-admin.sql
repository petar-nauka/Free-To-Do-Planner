-- Makes an existing user an administrator (access to /admin and to Settings → E-mail).
-- 1) Sign up in the app first.  2) Put your e-mail below.  3) Run in Supabase → SQL Editor.
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@example.com'
on conflict (user_id, role) do nothing;
