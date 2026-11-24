-- Run in Supabase SQL editor before enabling WordFlow accounts.
create table if not exists public.wordflow_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 words jsonb not null default '[]'::jsonb check (jsonb_typeof(words)='array'),
 preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences)='object'),
 revision bigint not null default 0,
 updated_at timestamptz not null default now()
);
alter table public.wordflow_workspaces enable row level security;
revoke all on public.wordflow_workspaces from anon;
grant select, insert, update, delete on public.wordflow_workspaces to authenticated;
create policy "Read own workspace" on public.wordflow_workspaces for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own workspace" on public.wordflow_workspaces for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own workspace" on public.wordflow_workspaces for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own workspace" on public.wordflow_workspaces for delete to authenticated using ((select auth.uid()) = user_id);
