-- Aucune relance n'est envoyée si l'abonnement de l'entreprise n'est pas actif.
-- active/trialing uniquement ; marge de 2 jours après la fin de période (renouvellement Stripe en retard).
create or replace function claim_due_followups(batch_size int default 25, max_attempts int default 3)
returns setof follow_up_logs
language plpgsql security definer set search_path = public as $$
begin
  update follow_up_logs
     set status = 'scheduled', locked_at = null
   where status = 'processing' and locked_at < now() - interval '15 minutes';

  return query
  with due as (
    select l.id
      from follow_up_logs l
      join follow_up_campaigns c on c.id = l.campaign_id
      join quotes q on q.id = l.quote_id
      join prospects p on p.id = q.prospect_id
      join subscriptions s on s.organization_id = l.organization_id
     where l.status in ('scheduled', 'failed')
       and l.attempts < max_attempts
       and l.scheduled_at <= now()
       and c.status = 'active'
       and q.status = 'sent'
       and q.responded_at is null
       and p.email is not null
       and p.email_opt_out = false
       and s.status in ('active', 'trialing')
       and (s.current_period_end is null or s.current_period_end > now() - interval '2 days')
     order by l.scheduled_at
     limit batch_size
     for update of l skip locked
  )
  update follow_up_logs l
     set status = 'processing', locked_at = now(), attempts = l.attempts + 1
    from due
   where l.id = due.id
  returning l.*;
end $$;

revoke all on function claim_due_followups(int, int) from public, anon, authenticated;
grant execute on function claim_due_followups(int, int) to service_role;
