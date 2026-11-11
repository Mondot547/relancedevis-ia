-- RelanceDevis AI — fonctions du moteur de relance
-- Appelées uniquement par le worker (service_role). Protection contre les exécutions multiples :
-- FOR UPDATE SKIP LOCKED + statut 'processing' + contrainte unique (campaign_id, step).

-- Réserve un lot de relances échues, éligibles. Rend les lignes réservées.
create or replace function claim_due_followups(batch_size int default 25, max_attempts int default 3)
returns setof follow_up_logs
language plpgsql security definer set search_path = public as $$
begin
  -- Reprise des verrous périmés (worker planté)
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
     where l.status in ('scheduled', 'failed')
       and l.attempts < max_attempts
       and l.scheduled_at <= now()
       and c.status = 'active'
       and q.status = 'sent'
       and q.responded_at is null
       and p.email is not null
       and p.email_opt_out = false
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

-- Stoppe toutes les relances en attente d'un devis (réponse, acceptation, refus)
create or replace function cancel_pending_followups(p_quote uuid, p_reason text default 'quote_closed')
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update follow_up_logs
     set status = 'cancelled', error = p_reason
   where quote_id = p_quote and status in ('scheduled', 'failed');
  get diagnostics n = row_count;
  update follow_up_campaigns set status = 'stopped'
   where quote_id = p_quote and status in ('active', 'paused');
  return n;
end $$;

-- Quand un devis est accepté/refusé/expiré ou que le client a répondu : on stoppe tout automatiquement
create or replace function on_quote_closed() returns trigger language plpgsql as $$
begin
  if (new.status in ('accepted', 'rejected', 'expired') and old.status is distinct from new.status)
     or (new.responded_at is not null and old.responded_at is null) then
    perform cancel_pending_followups(new.id, 'quote_closed_or_replied');
  end if;
  return new;
end $$;
create trigger trg_quote_closed after update on quotes
  for each row execute function on_quote_closed();
