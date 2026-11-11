-- Durcissement appliqué et testé sur le projet Supabase (koczoppruafsqfjvgsdv).
-- Rend les migrations 0001/0002 identiques à la base réellement déployée.

create index if not exists idx_followups_campaign on follow_up_logs(campaign_id);
create index if not exists idx_followups_quote on follow_up_logs(quote_id);
create index if not exists idx_notifications_org on notifications(organization_id);

-- Politiques : auth.uid() évalué une seule fois par requête
drop policy if exists users_self_select on users;
drop policy if exists users_self_update on users;
drop policy if exists memberships_select on memberships;
drop policy if exists notifications_select on notifications;
drop policy if exists notifications_update on notifications;
create policy users_self_select on users for select using (id = (select auth.uid()));
create policy users_self_update on users for update using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy memberships_select on memberships for select using (user_id = (select auth.uid()) or is_admin(organization_id));
create policy notifications_select on notifications for select
  using (is_member(organization_id) and (user_id is null or user_id = (select auth.uid())));
create policy notifications_update on notifications for update
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter function set_updated_at() set search_path = public;
alter function check_quote_org() set search_path = public;

revoke execute on function handle_new_user() from public, anon, authenticated;
revoke execute on function set_updated_at() from public, anon, authenticated;
revoke execute on function check_quote_org() from public, anon, authenticated;
revoke execute on function is_member(uuid) from public, anon;
revoke execute on function is_admin(uuid) from public, anon;
grant execute on function is_member(uuid) to authenticated, service_role;
grant execute on function is_admin(uuid) to authenticated, service_role;

revoke all on function cancel_pending_followups(uuid, text) from public, anon, authenticated;
grant execute on function cancel_pending_followups(uuid, text) to service_role;
create or replace function on_quote_closed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.status in ('accepted', 'rejected', 'expired') and old.status is distinct from new.status)
     or (new.responded_at is not null and old.responded_at is null) then
    perform cancel_pending_followups(new.id, 'quote_closed_or_replied');
  end if;
  return new;
end $$;
revoke all on function on_quote_closed() from public, anon, authenticated;

comment on table stripe_events is 'Accès service_role uniquement (idempotence des webhooks Stripe).';
