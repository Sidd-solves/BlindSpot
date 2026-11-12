-- Cross-user isolation check for follow_up_lists (row-level security). Run in the Supabase SQL editor or via
-- execute_sql. It creates two throwaway users, acts as each through the `authenticated` and `anon` roles, records
-- what each can see or change, then deletes the users (their rows cascade). Expected: every "bad" case is 0 or blocked.
create temp table rls_result(n serial, test text, result text);
grant all on rls_result to authenticated, anon;
grant usage on sequence rls_result_n_seq to authenticated, anon;
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
 ('aaaaaaaa-0000-4000-8000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-test-a@example.invalid','',now(),now(),'{}','{}'),
 ('bbbbbbbb-0000-4000-8000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-test-b@example.invalid','',now(),now(),'{}','{}');
insert into public.follow_up_lists(user_id, name, since) values
 ('aaaaaaaa-0000-4000-8000-00000000000a','A list','2025-01-01'),
 ('bbbbbbbb-0000-4000-8000-00000000000b','B list','2025-01-01');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-00000000000a","role":"authenticated"}', true);
insert into rls_result(test,result) select 'User A sees own lists', count(*)::text from public.follow_up_lists;
insert into rls_result(test,result) select 'User A selects B rows by id', count(*)::text from public.follow_up_lists where user_id='bbbbbbbb-0000-4000-8000-00000000000b';
with u as (update public.follow_up_lists set name='changed by A' where user_id='bbbbbbbb-0000-4000-8000-00000000000b' returning 1) insert into rls_result(test,result) select 'User A updates B rows', count(*)::text from u;
with d as (delete from public.follow_up_lists where user_id='bbbbbbbb-0000-4000-8000-00000000000b' returning 1) insert into rls_result(test,result) select 'User A deletes B rows', count(*)::text from d;
do $$ begin
  insert into public.follow_up_lists(user_id,name,since) values ('bbbbbbbb-0000-4000-8000-00000000000b','forged','2025-01-01');
  insert into rls_result(test,result) values ('User A inserts a row owned by B','ALLOWED (bad)');
exception when others then insert into rls_result(test,result) values ('User A inserts a row owned by B','blocked: '||sqlerrm); end $$;
do $$ begin
  update public.follow_up_lists set user_id='bbbbbbbb-0000-4000-8000-00000000000b' where user_id='aaaaaaaa-0000-4000-8000-00000000000a';
  insert into rls_result(test,result) values ('User A hands own row to B','ALLOWED (bad)');
exception when others then insert into rls_result(test,result) values ('User A hands own row to B','blocked: '||sqlerrm); end $$;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-00000000000b","role":"authenticated"}', true);
insert into rls_result(test,result) select 'User B (switched account) sees own lists', count(*)::text from public.follow_up_lists;
insert into rls_result(test,result) select 'User B list name unchanged', max(name) from public.follow_up_lists;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into rls_result(test,result) select 'Signed out (anon) sees lists', count(*)::text from public.follow_up_lists;
do $$ begin
  insert into public.follow_up_lists(user_id,name,since) values ('aaaaaaaa-0000-4000-8000-00000000000a','anon','2025-01-01');
  insert into rls_result(test,result) values ('Signed out inserts','ALLOWED (bad)');
exception when others then insert into rls_result(test,result) values ('Signed out inserts','blocked: '||sqlerrm); end $$;
reset role;
delete from auth.users where id in ('aaaaaaaa-0000-4000-8000-00000000000a','bbbbbbbb-0000-4000-8000-00000000000b');
insert into rls_result(test,result) select 'Cleanup: test rows left', count(*)::text from public.follow_up_lists where user_id in ('aaaaaaaa-0000-4000-8000-00000000000a','bbbbbbbb-0000-4000-8000-00000000000b');
select test, result from rls_result order by n;
