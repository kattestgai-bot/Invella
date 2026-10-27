-- Payment confirmation is atomic and idempotent. Only the trusted server can call it.
create or replace function public.confirm_invella_payment(
 p_payment_id text, p_owner_id uuid, p_invitation_id uuid, p_plan text,
 p_amount_minor integer, p_currency text, p_promo_id uuid default null,
 p_provider text default 'yookassa'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
 inv public.invitations%rowtype;
 pay public.payments%rowtype;
 redemption_id uuid;
 target_plan text;
begin
 if p_plan not in ('basic','pro','premium') or p_plan is null
    or p_provider not in ('yookassa','yookassa_test') or p_provider is null
    or p_payment_id is null or p_payment_id !~ '^[a-zA-Z0-9-]{1,100}$'
    or p_currency is distinct from 'RUB' or p_amount_minor is null
    or p_amount_minor < 100 or p_amount_minor > (case p_plan when 'basic' then 99000 when 'pro' then 149000 else 249000 end) then
   raise exception 'Invalid verified payment';
 end if;
 select * into inv from public.invitations where id=p_invitation_id for update;
 if inv.id is null or inv.owner_id is distinct from p_owner_id then raise exception 'Invitation owner mismatch'; end if;
 insert into public.payments(owner_id,invitation_id,provider,provider_payment_id,plan_key,amount_minor,currency,status,confirmed_at)
 values(p_owner_id,p_invitation_id,p_provider,p_payment_id,p_plan,p_amount_minor,p_currency,'succeeded',now())
 on conflict(provider_payment_id) do nothing;
 select * into pay from public.payments where provider_payment_id=p_payment_id for update;
 if pay.owner_id is distinct from p_owner_id or pay.invitation_id is distinct from p_invitation_id
    or pay.plan_key is distinct from p_plan or pay.amount_minor is distinct from p_amount_minor
    or pay.provider is distinct from p_provider or pay.status is distinct from 'succeeded' then
   raise exception 'Payment record mismatch';
 end if;
 target_plan := case
   when inv.plan='premium' or p_plan='premium' then 'premium'
   when inv.plan in ('pro','extended') or p_plan='pro' then 'pro'
   else 'basic' end;
 -- An old payment must not reactivate an invitation disabled by the administrator.
 if inv.status in ('draft','published') then
   update public.invitations set plan=target_plan,status='published',preview_published=false,
     published_at=coalesce(published_at,now()) where id=inv.id returning * into inv;
 end if;
 if p_promo_id is not null then
   insert into public.promo_redemptions(promo_code_id,payment_id,owner_id,invitation_id,provider_payment_id)
   values(p_promo_id,pay.id,p_owner_id,p_invitation_id,p_payment_id)
   on conflict do nothing returning id into redemption_id;
   if redemption_id is not null then
     update public.promo_codes set uses_count=uses_count+1 where id=p_promo_id;
   end if;
 end if;
 return jsonb_build_object('paymentId',p_payment_id,'status','succeeded','paid',true,
   'plan',inv.plan,'invitationStatus',inv.status,'invitationId',inv.id,'published',inv.status='published','slug',inv.slug);
end; $$;
revoke all on function public.confirm_invella_payment(text,uuid,uuid,text,integer,text,uuid,text) from public,anon,authenticated;
grant execute on function public.confirm_invella_payment(text,uuid,uuid,text,integer,text,uuid,text) to service_role;

create or replace function public.protect_invitation_commercial_fields()
returns trigger language plpgsql set search_path=public as $$
begin
 if current_user in ('authenticated','anon') then
   if tg_op='INSERT' then
     new.plan:='draft';new.status:='draft';new.published_at:=null;new.preview_published:=false;new.expires_at:=null;
   else
     new.plan:=old.plan;new.status:=old.status;new.published_at:=old.published_at;
     new.preview_published:=old.preview_published;new.expires_at:=old.expires_at;
   end if;
 end if;
 return new;
end; $$;
alter function public.preserve_premium_content() set search_path=public;
revoke truncate, references, trigger on all tables in schema public from anon,authenticated;
create index if not exists invitation_assets_invitation_id_idx on public.invitation_assets(invitation_id);
create index if not exists invitation_assets_owner_id_idx on public.invitation_assets(owner_id);
create index if not exists payments_invitation_id_idx on public.payments(invitation_id);
create index if not exists promo_redemptions_invitation_id_idx on public.promo_redemptions(invitation_id);
create index if not exists promo_redemptions_owner_id_idx on public.promo_redemptions(owner_id);
create index if not exists promo_redemptions_payment_id_idx on public.promo_redemptions(payment_id);
create index if not exists promo_redemptions_promo_code_id_idx on public.promo_redemptions(promo_code_id);
