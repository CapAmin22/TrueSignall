-- 0007 · Urgency refresh — SQL implementation of docs/05 §7 (decay job).
-- urgency(account) = clamp( Σ [W × D × M] × F + B, 0, 100 )

create or replace function private.signal_weight(sig_type text, payload jsonb)
returns table (weight numeric, halflife numeric)
language sql immutable as $$
  select
    case sig_type
      when 'pricing_visit'  then case when payload ? 'person' then 34 else 28 end
      when 'funding'        then 32
      when 'champion_move'  then 30
      when 'exec_change'    then 26
      when 'linkedin_clip'  then 22
      when 'hiring'         then case payload->>'confidence'
                                   when 'high' then 20 when 'medium' then 14 else 8 end
      when 'site_visit'     then 18
      when 'product_launch' then 14
      when 'geo_expansion'  then 14
      when 'tech_change'    then case when payload->>'flag' = 'competitive' then 20 else 14 end
      when 'news'           then 8
      else 8
    end::numeric,
    case sig_type
      when 'pricing_visit'  then 24
      when 'funding'        then 168
      when 'champion_move'  then 336
      when 'exec_change'    then 240
      when 'linkedin_clip'  then 96
      when 'hiring'         then 240
      when 'site_visit'     then 72
      when 'product_launch' then 168
      when 'geo_expansion'  then 168
      when 'tech_change'    then 336
      when 'news'           then 72
      else 72
    end::numeric;
$$;

create or replace function private.refresh_urgency() returns void
language plpgsql security definer set search_path = public as $$
begin
  update accounts a set urgency_score = coalesce(scored.score, 0)
  from (
    select
      acc.id as account_id,
      least(100, greatest(0, round(
        coalesce(sum(
          w.weight
          * power(0.5, extract(epoch from (now() - s.occurred_at)) / 3600.0 / w.halflife)
        ), 0)
        * (0.6 + 0.8 * coalesce(acc.fit_score, 50) / 100.0)
        + least(30, greatest(0, 10 * (
            (select count(distinct s2.type)
             from signals s2
             where s2.company_id = acc.company_id
               and s2.occurred_at > now() - interval '72 hours') - 1)))
      )))::int as score
    from accounts acc
    left join signals s
      on s.company_id = acc.company_id
     and s.occurred_at > now() - interval '21 days'
    left join lateral private.signal_weight(s.type, s.payload) w on true
    where acc.status = 'active'
    group by acc.id, acc.fit_score, acc.company_id
  ) scored
  where a.id = scored.account_id;
end $$;
