-- 0008 · Realtime + pg_cron schedules — docs/04 §6.
-- Requires: alter database ... set app.edge_url / app.cron_secret (docs/11 §1).

alter publication supabase_realtime add table signal_deliveries;   -- feed live inserts (RLS applies)

-- claim expiry (SA-05)
select cron.schedule('claims-expire','*/30 * * * *', $$
  update signal_deliveries set status='new', claimed_by=null, claimed_at=null
  where status='claimed' and claimed_at < now() - interval '7 days'$$);

-- snooze resurface (PS-08)
select cron.schedule('snooze-wake','*/15 * * * *', $$
  update signal_deliveries set status='new', snoozed_until=null
  where status='snoozed' and snoozed_until <= now()$$);

-- urgency decay refresh (CS-07 ≤1h)
select cron.schedule('score-decay','5 * * * *', $$select private.refresh_urgency()$$);

-- delivery pruning (storage budget, 03 §1): archive-done >90d
select cron.schedule('deliv-prune','15 3 * * *', $$
  delete from signal_deliveries where status='done' and done_at < now() - interval '90 days'$$);

-- edge-function invokers
select cron.schedule('ingest-rss','*/15 * * * *', $$select net.http_post(
  url:=current_setting('app.edge_url')||'/ingest-rss',
  headers:=jsonb_build_object('Authorization','Bearer '||current_setting('app.cron_secret')))$$);
select cron.schedule('ingest-careers','*/30 * * * *', $$select net.http_post(
  url:=current_setting('app.edge_url')||'/ingest-careers',
  headers:=jsonb_build_object('Authorization','Bearer '||current_setting('app.cron_secret')))$$);
select cron.schedule('news-hot','0 * * * *', $$select net.http_post(
  url:=current_setting('app.edge_url')||'/ingest-news',
  headers:=jsonb_build_object('Authorization','Bearer '||current_setting('app.cron_secret')))$$);
select cron.schedule('session-flush','*/5 * * * *', $$select net.http_post(
  url:=current_setting('app.edge_url')||'/flush-visits',
  headers:=jsonb_build_object('Authorization','Bearer '||current_setting('app.cron_secret')))$$);
select cron.schedule('gmail-sync','*/7 * * * *', $$select net.http_post(
  url:=current_setting('app.edge_url')||'/gmail-sync',
  headers:=jsonb_build_object('Authorization','Bearer '||current_setting('app.cron_secret')))$$);
select cron.schedule('followups','*/10 * * * *', $$select net.http_post(
  url:=current_setting('app.edge_url')||'/followup-scan',
  headers:=jsonb_build_object('Authorization','Bearer '||current_setting('app.cron_secret')))$$);
select cron.schedule('digest-hourly','0 * * * *', $$select net.http_post(
  url:=current_setting('app.edge_url')||'/digest-send',
  headers:=jsonb_build_object('Authorization','Bearer '||current_setting('app.cron_secret')))$$);
select cron.schedule('weekly-suggest','0 6 * * 1', $$select net.http_post(
  url:=current_setting('app.edge_url')||'/suggest-accounts',
  headers:=jsonb_build_object('Authorization','Bearer '||current_setting('app.cron_secret')))$$);
select cron.schedule('why-lines','*/10 * * * *', $$select net.http_post(
  url:=current_setting('app.edge_url')||'/why-lines',
  headers:=jsonb_build_object('Authorization','Bearer '||current_setting('app.cron_secret')))$$);
