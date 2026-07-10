-- 0005 · Row-Level Security — docs/04 §5. Default-deny on every table; the
-- generic member pattern is expanded mechanically per the doc's instruction.

-- default deny
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('alter table %I enable row level security', t);
  end loop; end $$;

-- profiles: self
create policy p_profiles_self on profiles for all
  using (id = auth.uid()) with check (id = auth.uid());

-- workspaces: members read; owner update; insert by creator (becomes owner via app action)
create policy p_ws_read   on workspaces for select using (private.is_member(id));
create policy p_ws_update on workspaces for update using (private.is_owner(id));
create policy p_ws_insert on workspaces for insert with check (auth.uid() is not null);

create policy p_members_read on workspace_members for select using (private.is_member(workspace_id));
create policy p_members_owner_write on workspace_members for insert with check (private.is_owner(workspace_id));
create policy p_members_owner_del   on workspace_members for delete using  (private.is_owner(workspace_id));

-- generic member policies (docs/04 §5 pattern applied to every workspace_id table)
create policy p_accounts_member on accounts for all
  using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
create policy p_contacts_member on contacts for all
  using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
create policy p_deliveries_member on signal_deliveries for all
  using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
create policy p_drafts_member on outreach_drafts for all
  using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
create policy p_messages_member on outreach_messages for all
  using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
create policy p_followups_member on followups for all
  using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
create policy p_briefs_member on briefs for all
  using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
create policy p_competitors_member on competitors for all
  using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
create policy p_notes_member on notes for all
  using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
create policy p_activity_member on activity_log for all
  using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
create policy p_usage_member on usage_counters for select
  using (private.is_member(workspace_id));

-- user-scoped tables: members read; writes restricted to user_id = auth.uid()
create policy p_graph_read on email_graph_edges for select
  using (private.is_member(workspace_id));
create policy p_graph_self_write on email_graph_edges for insert
  with check (private.is_member(workspace_id) and user_id = auth.uid());
create policy p_graph_self_update on email_graph_edges for update
  using (private.is_member(workspace_id) and user_id = auth.uid());

create policy p_voice_read on voice_profiles for select
  using (private.is_member(workspace_id));
create policy p_voice_self_write on voice_profiles for insert
  with check (private.is_member(workspace_id) and user_id = auth.uid());
create policy p_voice_self_update on voice_profiles for update
  using (private.is_member(workspace_id) and user_id = auth.uid());

create policy p_notif_read on notification_prefs for select
  using (private.is_member(workspace_id));
create policy p_notif_self_write on notification_prefs for insert
  with check (private.is_member(workspace_id) and user_id = auth.uid());
create policy p_notif_self_update on notification_prefs for update
  using (private.is_member(workspace_id) and user_id = auth.uid());
create policy p_notif_self_delete on notification_prefs for delete
  using (private.is_member(workspace_id) and user_id = auth.uid());

-- invites: owner-managed; token acceptance handled by security-definer action
create policy p_invites_owner on invites for all
  using (private.is_owner(workspace_id)) with check (private.is_owner(workspace_id));

-- visitor sessions: members read; writes are service-role only
create policy p_visits_read on visitor_sessions for select
  using (private.is_member(workspace_id));

-- global corpus: read for any authed user; NO client writes (service role bypasses RLS)
create policy p_companies_read on companies for select using (auth.uid() is not null);
create policy p_signals_read   on signals   for select using (auth.uid() is not null);
-- sources / ingestion_runs: no policies → service-role only.
