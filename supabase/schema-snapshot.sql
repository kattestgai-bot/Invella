-- Invella application schema snapshot, 2026-10-27. No customer data or credentials.

-- For review and a clean Supabase project; do not run over existing tables.

create table public.invitation_assets (
  id uuid default gen_random_uuid() not null,
  invitation_id uuid not null,
  owner_id uuid not null,
  kind text not null,
  storage_path text not null,
  sort_order integer default 0 not null,
  created_at timestamp with time zone default now() not null
);

create table public.invella_admins (
  user_id uuid not null,
  created_at timestamp with time zone default now() not null
);

create table public.profiles (
  id uuid not null,
  display_name text,
  created_at timestamp with time zone default now() not null,
  email text,
  updated_at timestamp with time zone default now() not null
);

create table public.invitations (
  id uuid default gen_random_uuid() not null,
  owner_id uuid not null,
  title text default 'Новое приглашение'::text not null,
  event_type text default 'wedding'::text not null,
  slug text not null,
  status text default 'draft'::text not null,
  event_date timestamp with time zone,
  venue_name text,
  venue_address text,
  template_key text default 'editorial'::text not null,
  content jsonb default '{}'::jsonb not null,
  design jsonb default '{}'::jsonb not null,
  privacy_mode text default 'unlisted'::text not null,
  pin_hash text,
  published_at timestamp with time zone,
  expires_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  plan text default 'draft'::text not null,
  cover_url text,
  music_url text,
  gallery jsonb default '[]'::jsonb not null,
  preview_published boolean default false not null
);

create table public.promo_codes (
  id uuid default gen_random_uuid() not null,
  code text not null,
  discount_type text not null,
  discount_value integer not null,
  plan_key text,
  active boolean default true not null,
  starts_at timestamp with time zone,
  expires_at timestamp with time zone,
  max_uses integer,
  uses_count integer default 0 not null,
  created_at timestamp with time zone default now() not null
);

create table public.payments (
  id uuid default gen_random_uuid() not null,
  owner_id uuid not null,
  invitation_id uuid,
  provider text not null,
  provider_payment_id text,
  plan_key text not null,
  amount_minor integer not null,
  currency text default 'RUB'::text not null,
  status text default 'pending'::text not null,
  created_at timestamp with time zone default now() not null,
  confirmed_at timestamp with time zone
);

create table public.rsvp_responses (
  id uuid default gen_random_uuid() not null,
  invitation_id uuid not null,
  guest_name text not null,
  attendance text not null,
  guest_count integer default 1 not null,
  companion_name text,
  food_preferences text,
  alcohol_preferences text,
  comment text,
  answers jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null
);

create table public.promo_redemptions (
  id uuid default gen_random_uuid() not null,
  promo_code_id uuid not null,
  payment_id uuid,
  owner_id uuid,
  invitation_id uuid,
  provider_payment_id text,
  created_at timestamp with time zone default now() not null
);

alter table profiles add constraint profiles_pkey PRIMARY KEY (id);

alter table profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table invitations add constraint invitations_slug_check CHECK ((slug ~ '^[a-z0-9][a-z0-9-]{2,62}$'::text));

alter table promo_redemptions add constraint promo_redemptions_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;

alter table promo_redemptions add constraint promo_redemptions_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table invitations add constraint invitations_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'completed'::text, 'disabled'::text])));

alter table invitations add constraint invitations_privacy_mode_check CHECK ((privacy_mode = ANY (ARRAY['public'::text, 'unlisted'::text, 'pin'::text])));

alter table invitations add constraint invitations_pkey PRIMARY KEY (id);

alter table invitations add constraint invitations_slug_key UNIQUE (slug);

alter table invitations add constraint invitations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table rsvp_responses add constraint rsvp_responses_attendance_check CHECK ((attendance = ANY (ARRAY['yes'::text, 'no'::text, 'maybe'::text])));

alter table rsvp_responses add constraint rsvp_responses_guest_count_check CHECK (((guest_count >= 1) AND (guest_count <= 20)));

alter table rsvp_responses add constraint rsvp_responses_pkey PRIMARY KEY (id);

alter table rsvp_responses add constraint rsvp_responses_invitation_id_fkey FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE;

alter table invitation_assets add constraint invitation_assets_kind_check CHECK ((kind = ANY (ARRAY['cover'::text, 'photo'::text, 'gallery'::text, 'audio'::text])));

alter table invitation_assets add constraint invitation_assets_pkey PRIMARY KEY (id);

alter table invitation_assets add constraint invitation_assets_invitation_id_fkey FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE;

alter table invitation_assets add constraint invitation_assets_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table payments add constraint payments_amount_minor_check CHECK ((amount_minor >= 0));

alter table promo_redemptions add constraint promo_redemptions_invitation_id_fkey FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE SET NULL;

alter table payments add constraint payments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'succeeded'::text, 'cancelled'::text, 'failed'::text, 'refunded'::text])));

alter table payments add constraint payments_pkey PRIMARY KEY (id);

alter table payments add constraint payments_provider_payment_id_key UNIQUE (provider_payment_id);

alter table payments add constraint payments_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table payments add constraint payments_invitation_id_fkey FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE SET NULL;

alter table invella_admins add constraint invella_admins_pkey PRIMARY KEY (user_id);

alter table invella_admins add constraint invella_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table promo_codes add constraint promo_codes_discount_type_check CHECK ((discount_type = ANY (ARRAY['percent'::text, 'fixed'::text])));

alter table promo_codes add constraint promo_codes_discount_value_check CHECK ((discount_value > 0));

alter table promo_codes add constraint promo_codes_plan_key_check CHECK ((plan_key = ANY (ARRAY['basic'::text, 'pro'::text, 'premium'::text])));

alter table promo_codes add constraint promo_codes_max_uses_check CHECK (((max_uses IS NULL) OR (max_uses > 0)));

alter table promo_codes add constraint promo_codes_uses_count_check CHECK ((uses_count >= 0));

alter table promo_codes add constraint promo_codes_code_upper CHECK ((code = upper(btrim(code))));

alter table promo_codes add constraint promo_codes_pkey PRIMARY KEY (id);

alter table promo_redemptions add constraint promo_redemptions_pkey PRIMARY KEY (id);

alter table promo_redemptions add constraint promo_redemptions_promo_code_id_fkey FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id) ON DELETE RESTRICT;

CREATE INDEX invitation_assets_invitation_id_idx ON public.invitation_assets USING btree (invitation_id);

CREATE INDEX invitation_assets_owner_id_idx ON public.invitation_assets USING btree (owner_id);

CREATE INDEX invitations_owner_idx ON public.invitations USING btree (owner_id);

CREATE INDEX invitations_slug_idx ON public.invitations USING btree (slug);

CREATE INDEX invitations_owner_id_idx ON public.invitations USING btree (owner_id);

CREATE UNIQUE INDEX promo_codes_code_unique ON public.promo_codes USING btree (code);

CREATE INDEX payments_owner_idx ON public.payments USING btree (owner_id);

CREATE UNIQUE INDEX payments_provider_payment_id_unique ON public.payments USING btree (provider_payment_id) WHERE (provider_payment_id IS NOT NULL);

CREATE INDEX payments_invitation_id_idx ON public.payments USING btree (invitation_id);

CREATE INDEX rsvp_invitation_idx ON public.rsvp_responses USING btree (invitation_id);

CREATE INDEX rsvp_invitation_id_idx ON public.rsvp_responses USING btree (invitation_id);

CREATE UNIQUE INDEX promo_redemptions_provider_payment_unique ON public.promo_redemptions USING btree (provider_payment_id) WHERE (provider_payment_id IS NOT NULL);

CREATE INDEX promo_redemptions_invitation_id_idx ON public.promo_redemptions USING btree (invitation_id);

CREATE INDEX promo_redemptions_owner_id_idx ON public.promo_redemptions USING btree (owner_id);

CREATE INDEX promo_redemptions_payment_id_idx ON public.promo_redemptions USING btree (payment_id);

CREATE INDEX promo_redemptions_promo_code_id_idx ON public.promo_redemptions USING btree (promo_code_id);

CREATE OR REPLACE FUNCTION public.confirm_invella_payment(p_payment_id text, p_owner_id uuid, p_invitation_id uuid, p_plan text, p_amount_minor integer, p_currency text, p_promo_id uuid DEFAULT NULL::uuid, p_provider text DEFAULT 'yookassa'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end; $function$


CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.increment_promo_use(p_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update public.promo_codes
  set uses_count = uses_count + 1
  where id = p_id;
$function$


CREATE OR REPLACE FUNCTION public.preserve_premium_content()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  oldc jsonb := coalesce(old.content, '{}'::jsonb);
  newc jsonb := coalesce(new.content, '{}'::jsonb);
  k text;
begin
  if jsonb_typeof(oldc) = 'object' and jsonb_typeof(newc) = 'object' then
    foreach k in array array['premiumMusicUrl','premiumMusicStart','premiumMusicEnd','premiumGallery','premiumGalleryText','premiumCoverUrl','showPremiumTimer'] loop
      if oldc ? k and not (newc ? k) then
        newc := jsonb_set(newc, array[k], oldc -> k, true);
      end if;
    end loop;
    new.content := newc;
  end if;
  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.protect_invitation_commercial_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
end; $function$


CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ begin new.updated_at = now(); return new; end $function$


CREATE OR REPLACE FUNCTION public.submit_rsvp(p_slug text, p_guest_name text, p_attendance text, p_guest_count integer DEFAULT 1, p_comment text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare inv public.invitations%rowtype; response_id uuid;
begin
 if p_slug is null or length(p_slug)>63 or p_guest_name is null
   or length(btrim(p_guest_name)) not between 1 and 200
   or p_attendance is null or p_attendance not in ('yes','no','maybe')
   or length(coalesce(p_comment,''))>2000 then
   raise exception 'Invalid guest response';
 end if;
 select * into inv from public.invitations where slug=p_slug and status='published'
   and coalesce(content->>'showRSVP','true')<>'false' limit 1;
 if inv.id is null then raise exception 'Invitation not found';end if;
 if lower(coalesce(inv.plan,'basic')) not in ('pro','premium') then
   raise exception 'RSVP is not available for this plan';
 end if;
 insert into public.rsvp_responses(invitation_id,guest_name,attendance,guest_count,comment)
 values(inv.id,btrim(p_guest_name),p_attendance,greatest(1,least(coalesce(p_guest_count,1),20)),nullif(btrim(coalesce(p_comment,'')),''))
 returning id into response_id;
 return response_id;
end; $function$


CREATE TRIGGER invitations_updated_at BEFORE UPDATE ON public.invitations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER protect_invitation_commercial_fields BEFORE INSERT OR UPDATE ON public.invitations FOR EACH ROW EXECUTE FUNCTION protect_invitation_commercial_fields();

CREATE TRIGGER invitations_preserve_premium_content BEFORE UPDATE OF content ON public.invitations FOR EACH ROW EXECUTE FUNCTION preserve_premium_content();

alter table public."invitation_assets" enable row level security;

alter table public."invella_admins" enable row level security;

alter table public."profiles" enable row level security;

alter table public."invitations" enable row level security;

alter table public."promo_codes" enable row level security;

alter table public."payments" enable row level security;

alter table public."rsvp_responses" enable row level security;

alter table public."promo_redemptions" enable row level security;

create policy "assets_owner_all" on "public"."invitation_assets" for ALL to "authenticated" using ((( SELECT auth.uid() AS uid) = owner_id)) with check ((( SELECT auth.uid() AS uid) = owner_id));

create policy "invitations_owner_delete" on "public"."invitations" for DELETE to "authenticated" using ((( SELECT auth.uid() AS uid) = owner_id));

create policy "invitations_owner_insert" on "public"."invitations" for INSERT to "authenticated" with check ((( SELECT auth.uid() AS uid) = owner_id));

create policy "invitations_owner_select" on "public"."invitations" for SELECT to "authenticated" using ((( SELECT auth.uid() AS uid) = owner_id));

create policy "invitations_owner_update" on "public"."invitations" for UPDATE to "authenticated" using ((( SELECT auth.uid() AS uid) = owner_id)) with check ((( SELECT auth.uid() AS uid) = owner_id));

create policy "payments_owner_read" on "public"."payments" for SELECT to "authenticated" using ((( SELECT auth.uid() AS uid) = owner_id));

create policy "profiles_own" on "public"."profiles" for ALL to "authenticated" using ((( SELECT auth.uid() AS uid) = id)) with check ((( SELECT auth.uid() AS uid) = id));

create policy "rsvp_owner_read" on "public"."rsvp_responses" for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM invitations i
  WHERE ((i.id = rsvp_responses.invitation_id) AND (i.owner_id = ( SELECT auth.uid() AS uid))))));

create policy "invitation_media_owner_insert" on "storage"."objects" for INSERT to "authenticated" with check (((bucket_id = 'invitation-media'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

create policy "invitation_media_owner_update" on "storage"."objects" for UPDATE to "authenticated" using (((bucket_id = 'invitation-media'::text) AND (owner_id = ( SELECT (auth.uid())::text AS uid)))) with check (((bucket_id = 'invitation-media'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

create policy "invitation_media_owner_delete" on "storage"."objects" for DELETE to "authenticated" using (((bucket_id = 'invitation-media'::text) AND (owner_id = ( SELECT (auth.uid())::text AS uid))));

revoke all on all tables in schema public from anon,authenticated,service_role;

grant TRUNCATE on public."invitation_assets" to "service_role";

grant REFERENCES on public."invitation_assets" to "service_role";

grant TRIGGER on public."invitation_assets" to "service_role";

grant SELECT on public."invella_admins" to "service_role";

grant TRUNCATE on public."invella_admins" to "service_role";

grant REFERENCES on public."invella_admins" to "service_role";

grant TRIGGER on public."invella_admins" to "service_role";

grant SELECT on public."profiles" to "service_role";

grant TRUNCATE on public."profiles" to "service_role";

grant REFERENCES on public."profiles" to "service_role";

grant TRIGGER on public."profiles" to "service_role";

grant INSERT on public."invitations" to "authenticated";

grant SELECT on public."invitations" to "authenticated";

grant UPDATE on public."invitations" to "authenticated";

grant DELETE on public."invitations" to "authenticated";

grant SELECT on public."invitations" to "service_role";

grant UPDATE on public."invitations" to "service_role";

grant TRUNCATE on public."invitations" to "service_role";

grant REFERENCES on public."invitations" to "service_role";

grant TRIGGER on public."invitations" to "service_role";

grant INSERT on public."promo_codes" to "service_role";

grant SELECT on public."promo_codes" to "service_role";

grant UPDATE on public."promo_codes" to "service_role";

grant TRUNCATE on public."promo_codes" to "service_role";

grant REFERENCES on public."promo_codes" to "service_role";

grant TRIGGER on public."promo_codes" to "service_role";

grant INSERT on public."payments" to "service_role";

grant SELECT on public."payments" to "service_role";

grant UPDATE on public."payments" to "service_role";

grant TRUNCATE on public."payments" to "service_role";

grant REFERENCES on public."payments" to "service_role";

grant TRIGGER on public."payments" to "service_role";

grant SELECT on public."rsvp_responses" to "authenticated";

grant TRUNCATE on public."rsvp_responses" to "service_role";

grant REFERENCES on public."rsvp_responses" to "service_role";

grant TRIGGER on public."rsvp_responses" to "service_role";

grant INSERT on public."promo_redemptions" to "service_role";

grant SELECT on public."promo_redemptions" to "service_role";

grant TRUNCATE on public."promo_redemptions" to "service_role";

grant REFERENCES on public."promo_redemptions" to "service_role";

grant TRIGGER on public."promo_redemptions" to "service_role";

grant SELECT ("alcohol_preferences") on public."rsvp_responses" to "authenticated";

grant SELECT ("answers") on public."rsvp_responses" to "authenticated";

grant SELECT ("attendance") on public."rsvp_responses" to "authenticated";

grant SELECT ("comment") on public."rsvp_responses" to "authenticated";

grant SELECT ("companion_name") on public."rsvp_responses" to "authenticated";

grant INSERT ("content") on public."invitations" to "authenticated";

grant SELECT ("content") on public."invitations" to "authenticated";

grant UPDATE ("content") on public."invitations" to "authenticated";

grant INSERT ("cover_url") on public."invitations" to "authenticated";

grant SELECT ("cover_url") on public."invitations" to "authenticated";

grant UPDATE ("cover_url") on public."invitations" to "authenticated";

grant INSERT ("created_at") on public."invitations" to "authenticated";

grant SELECT ("created_at") on public."invitations" to "authenticated";

grant UPDATE ("created_at") on public."invitations" to "authenticated";

grant SELECT ("created_at") on public."rsvp_responses" to "authenticated";

grant INSERT ("design") on public."invitations" to "authenticated";

grant SELECT ("design") on public."invitations" to "authenticated";

grant UPDATE ("design") on public."invitations" to "authenticated";

grant INSERT ("event_date") on public."invitations" to "authenticated";

grant SELECT ("event_date") on public."invitations" to "authenticated";

grant UPDATE ("event_date") on public."invitations" to "authenticated";

grant INSERT ("event_type") on public."invitations" to "authenticated";

grant SELECT ("event_type") on public."invitations" to "authenticated";

grant UPDATE ("event_type") on public."invitations" to "authenticated";

grant INSERT ("expires_at") on public."invitations" to "authenticated";

grant SELECT ("expires_at") on public."invitations" to "authenticated";

grant UPDATE ("expires_at") on public."invitations" to "authenticated";

grant SELECT ("food_preferences") on public."rsvp_responses" to "authenticated";

grant INSERT ("gallery") on public."invitations" to "authenticated";

grant SELECT ("gallery") on public."invitations" to "authenticated";

grant UPDATE ("gallery") on public."invitations" to "authenticated";

grant SELECT ("guest_count") on public."rsvp_responses" to "authenticated";

grant SELECT ("guest_name") on public."rsvp_responses" to "authenticated";

grant INSERT ("id") on public."invitations" to "authenticated";

grant SELECT ("id") on public."invitations" to "authenticated";

grant UPDATE ("id") on public."invitations" to "authenticated";

grant SELECT ("id") on public."rsvp_responses" to "authenticated";

grant SELECT ("invitation_id") on public."rsvp_responses" to "authenticated";

grant INSERT ("music_url") on public."invitations" to "authenticated";

grant SELECT ("music_url") on public."invitations" to "authenticated";

grant UPDATE ("music_url") on public."invitations" to "authenticated";

grant INSERT ("owner_id") on public."invitations" to "authenticated";

grant SELECT ("owner_id") on public."invitations" to "authenticated";

grant UPDATE ("owner_id") on public."invitations" to "authenticated";

grant INSERT ("pin_hash") on public."invitations" to "authenticated";

grant SELECT ("pin_hash") on public."invitations" to "authenticated";

grant UPDATE ("pin_hash") on public."invitations" to "authenticated";

grant INSERT ("plan") on public."invitations" to "authenticated";

grant SELECT ("plan") on public."invitations" to "authenticated";

grant UPDATE ("plan") on public."invitations" to "authenticated";

grant INSERT ("preview_published") on public."invitations" to "authenticated";

grant SELECT ("preview_published") on public."invitations" to "authenticated";

grant UPDATE ("preview_published") on public."invitations" to "authenticated";

grant INSERT ("privacy_mode") on public."invitations" to "authenticated";

grant SELECT ("privacy_mode") on public."invitations" to "authenticated";

grant UPDATE ("privacy_mode") on public."invitations" to "authenticated";

grant INSERT ("published_at") on public."invitations" to "authenticated";

grant SELECT ("published_at") on public."invitations" to "authenticated";

grant UPDATE ("published_at") on public."invitations" to "authenticated";

grant INSERT ("slug") on public."invitations" to "authenticated";

grant SELECT ("slug") on public."invitations" to "authenticated";

grant UPDATE ("slug") on public."invitations" to "authenticated";

grant INSERT ("status") on public."invitations" to "authenticated";

grant SELECT ("status") on public."invitations" to "authenticated";

grant UPDATE ("status") on public."invitations" to "authenticated";

grant INSERT ("template_key") on public."invitations" to "authenticated";

grant SELECT ("template_key") on public."invitations" to "authenticated";

grant UPDATE ("template_key") on public."invitations" to "authenticated";

grant INSERT ("title") on public."invitations" to "authenticated";

grant SELECT ("title") on public."invitations" to "authenticated";

grant UPDATE ("title") on public."invitations" to "authenticated";

grant INSERT ("updated_at") on public."invitations" to "authenticated";

grant SELECT ("updated_at") on public."invitations" to "authenticated";

grant UPDATE ("updated_at") on public."invitations" to "authenticated";

grant INSERT ("venue_address") on public."invitations" to "authenticated";

grant SELECT ("venue_address") on public."invitations" to "authenticated";

grant UPDATE ("venue_address") on public."invitations" to "authenticated";

grant INSERT ("venue_name") on public."invitations" to "authenticated";

grant SELECT ("venue_name") on public."invitations" to "authenticated";

grant UPDATE ("venue_name") on public."invitations" to "authenticated";

grant INSERT ("active") on public."promo_codes" to "service_role";

grant REFERENCES ("active") on public."promo_codes" to "service_role";

grant SELECT ("active") on public."promo_codes" to "service_role";

grant UPDATE ("active") on public."promo_codes" to "service_role";

grant REFERENCES ("alcohol_preferences") on public."rsvp_responses" to "service_role";

grant INSERT ("amount_minor") on public."payments" to "service_role";

grant REFERENCES ("amount_minor") on public."payments" to "service_role";

grant SELECT ("amount_minor") on public."payments" to "service_role";

grant UPDATE ("amount_minor") on public."payments" to "service_role";

grant REFERENCES ("answers") on public."rsvp_responses" to "service_role";

grant REFERENCES ("attendance") on public."rsvp_responses" to "service_role";

grant INSERT ("code") on public."promo_codes" to "service_role";

grant REFERENCES ("code") on public."promo_codes" to "service_role";

grant SELECT ("code") on public."promo_codes" to "service_role";

grant UPDATE ("code") on public."promo_codes" to "service_role";

grant REFERENCES ("comment") on public."rsvp_responses" to "service_role";

grant REFERENCES ("companion_name") on public."rsvp_responses" to "service_role";

grant INSERT ("confirmed_at") on public."payments" to "service_role";

grant REFERENCES ("confirmed_at") on public."payments" to "service_role";

grant SELECT ("confirmed_at") on public."payments" to "service_role";

grant UPDATE ("confirmed_at") on public."payments" to "service_role";

grant REFERENCES ("content") on public."invitations" to "service_role";

grant SELECT ("content") on public."invitations" to "service_role";

grant UPDATE ("content") on public."invitations" to "service_role";

grant REFERENCES ("cover_url") on public."invitations" to "service_role";

grant SELECT ("cover_url") on public."invitations" to "service_role";

grant UPDATE ("cover_url") on public."invitations" to "service_role";

grant REFERENCES ("created_at") on public."invella_admins" to "service_role";

grant SELECT ("created_at") on public."invella_admins" to "service_role";

grant REFERENCES ("created_at") on public."invitation_assets" to "service_role";

grant REFERENCES ("created_at") on public."invitations" to "service_role";

grant SELECT ("created_at") on public."invitations" to "service_role";

grant UPDATE ("created_at") on public."invitations" to "service_role";

grant INSERT ("created_at") on public."payments" to "service_role";

grant REFERENCES ("created_at") on public."payments" to "service_role";

grant SELECT ("created_at") on public."payments" to "service_role";

grant UPDATE ("created_at") on public."payments" to "service_role";

grant REFERENCES ("created_at") on public."profiles" to "service_role";

grant SELECT ("created_at") on public."profiles" to "service_role";

grant INSERT ("created_at") on public."promo_codes" to "service_role";

grant REFERENCES ("created_at") on public."promo_codes" to "service_role";

grant SELECT ("created_at") on public."promo_codes" to "service_role";

grant UPDATE ("created_at") on public."promo_codes" to "service_role";

grant INSERT ("created_at") on public."promo_redemptions" to "service_role";

grant REFERENCES ("created_at") on public."promo_redemptions" to "service_role";

grant SELECT ("created_at") on public."promo_redemptions" to "service_role";

grant REFERENCES ("created_at") on public."rsvp_responses" to "service_role";

grant INSERT ("currency") on public."payments" to "service_role";

grant REFERENCES ("currency") on public."payments" to "service_role";

grant SELECT ("currency") on public."payments" to "service_role";

grant UPDATE ("currency") on public."payments" to "service_role";

grant REFERENCES ("design") on public."invitations" to "service_role";

grant SELECT ("design") on public."invitations" to "service_role";

grant UPDATE ("design") on public."invitations" to "service_role";

grant INSERT ("discount_type") on public."promo_codes" to "service_role";

grant REFERENCES ("discount_type") on public."promo_codes" to "service_role";

grant SELECT ("discount_type") on public."promo_codes" to "service_role";

grant UPDATE ("discount_type") on public."promo_codes" to "service_role";

grant INSERT ("discount_value") on public."promo_codes" to "service_role";

grant REFERENCES ("discount_value") on public."promo_codes" to "service_role";

grant SELECT ("discount_value") on public."promo_codes" to "service_role";

grant UPDATE ("discount_value") on public."promo_codes" to "service_role";

grant REFERENCES ("display_name") on public."profiles" to "service_role";

grant SELECT ("display_name") on public."profiles" to "service_role";

grant REFERENCES ("email") on public."profiles" to "service_role";

grant SELECT ("email") on public."profiles" to "service_role";

grant REFERENCES ("event_date") on public."invitations" to "service_role";

grant SELECT ("event_date") on public."invitations" to "service_role";

grant UPDATE ("event_date") on public."invitations" to "service_role";

grant REFERENCES ("event_type") on public."invitations" to "service_role";

grant SELECT ("event_type") on public."invitations" to "service_role";

grant UPDATE ("event_type") on public."invitations" to "service_role";

grant REFERENCES ("expires_at") on public."invitations" to "service_role";

grant SELECT ("expires_at") on public."invitations" to "service_role";

grant UPDATE ("expires_at") on public."invitations" to "service_role";

grant INSERT ("expires_at") on public."promo_codes" to "service_role";

grant REFERENCES ("expires_at") on public."promo_codes" to "service_role";

grant SELECT ("expires_at") on public."promo_codes" to "service_role";

grant UPDATE ("expires_at") on public."promo_codes" to "service_role";

grant REFERENCES ("food_preferences") on public."rsvp_responses" to "service_role";

grant REFERENCES ("gallery") on public."invitations" to "service_role";

grant SELECT ("gallery") on public."invitations" to "service_role";

grant UPDATE ("gallery") on public."invitations" to "service_role";

grant REFERENCES ("guest_count") on public."rsvp_responses" to "service_role";

grant REFERENCES ("guest_name") on public."rsvp_responses" to "service_role";

grant REFERENCES ("id") on public."invitation_assets" to "service_role";

grant REFERENCES ("id") on public."invitations" to "service_role";

grant SELECT ("id") on public."invitations" to "service_role";

grant UPDATE ("id") on public."invitations" to "service_role";

grant INSERT ("id") on public."payments" to "service_role";

grant REFERENCES ("id") on public."payments" to "service_role";

grant SELECT ("id") on public."payments" to "service_role";

grant UPDATE ("id") on public."payments" to "service_role";

grant REFERENCES ("id") on public."profiles" to "service_role";

grant SELECT ("id") on public."profiles" to "service_role";

grant INSERT ("id") on public."promo_codes" to "service_role";

grant REFERENCES ("id") on public."promo_codes" to "service_role";

grant SELECT ("id") on public."promo_codes" to "service_role";

grant UPDATE ("id") on public."promo_codes" to "service_role";

grant INSERT ("id") on public."promo_redemptions" to "service_role";

grant REFERENCES ("id") on public."promo_redemptions" to "service_role";

grant SELECT ("id") on public."promo_redemptions" to "service_role";

grant REFERENCES ("id") on public."rsvp_responses" to "service_role";

grant REFERENCES ("invitation_id") on public."invitation_assets" to "service_role";

grant INSERT ("invitation_id") on public."payments" to "service_role";

grant REFERENCES ("invitation_id") on public."payments" to "service_role";

grant SELECT ("invitation_id") on public."payments" to "service_role";

grant UPDATE ("invitation_id") on public."payments" to "service_role";

grant INSERT ("invitation_id") on public."promo_redemptions" to "service_role";

grant REFERENCES ("invitation_id") on public."promo_redemptions" to "service_role";

grant SELECT ("invitation_id") on public."promo_redemptions" to "service_role";

grant REFERENCES ("invitation_id") on public."rsvp_responses" to "service_role";

grant REFERENCES ("kind") on public."invitation_assets" to "service_role";

grant INSERT ("max_uses") on public."promo_codes" to "service_role";

grant REFERENCES ("max_uses") on public."promo_codes" to "service_role";

grant SELECT ("max_uses") on public."promo_codes" to "service_role";

grant UPDATE ("max_uses") on public."promo_codes" to "service_role";

grant REFERENCES ("music_url") on public."invitations" to "service_role";

grant SELECT ("music_url") on public."invitations" to "service_role";

grant UPDATE ("music_url") on public."invitations" to "service_role";

grant REFERENCES ("owner_id") on public."invitation_assets" to "service_role";

grant REFERENCES ("owner_id") on public."invitations" to "service_role";

grant SELECT ("owner_id") on public."invitations" to "service_role";

grant UPDATE ("owner_id") on public."invitations" to "service_role";

grant INSERT ("owner_id") on public."payments" to "service_role";

grant REFERENCES ("owner_id") on public."payments" to "service_role";

grant SELECT ("owner_id") on public."payments" to "service_role";

grant UPDATE ("owner_id") on public."payments" to "service_role";

grant INSERT ("owner_id") on public."promo_redemptions" to "service_role";

grant REFERENCES ("owner_id") on public."promo_redemptions" to "service_role";

grant SELECT ("owner_id") on public."promo_redemptions" to "service_role";

grant INSERT ("payment_id") on public."promo_redemptions" to "service_role";

grant REFERENCES ("payment_id") on public."promo_redemptions" to "service_role";

grant SELECT ("payment_id") on public."promo_redemptions" to "service_role";

grant REFERENCES ("pin_hash") on public."invitations" to "service_role";

grant SELECT ("pin_hash") on public."invitations" to "service_role";

grant UPDATE ("pin_hash") on public."invitations" to "service_role";

grant REFERENCES ("plan") on public."invitations" to "service_role";

grant SELECT ("plan") on public."invitations" to "service_role";

grant UPDATE ("plan") on public."invitations" to "service_role";

grant INSERT ("plan_key") on public."payments" to "service_role";

grant REFERENCES ("plan_key") on public."payments" to "service_role";

grant SELECT ("plan_key") on public."payments" to "service_role";

grant UPDATE ("plan_key") on public."payments" to "service_role";

grant INSERT ("plan_key") on public."promo_codes" to "service_role";

grant REFERENCES ("plan_key") on public."promo_codes" to "service_role";

grant SELECT ("plan_key") on public."promo_codes" to "service_role";

grant UPDATE ("plan_key") on public."promo_codes" to "service_role";

grant REFERENCES ("preview_published") on public."invitations" to "service_role";

grant SELECT ("preview_published") on public."invitations" to "service_role";

grant UPDATE ("preview_published") on public."invitations" to "service_role";

grant REFERENCES ("privacy_mode") on public."invitations" to "service_role";

grant SELECT ("privacy_mode") on public."invitations" to "service_role";

grant UPDATE ("privacy_mode") on public."invitations" to "service_role";

grant INSERT ("promo_code_id") on public."promo_redemptions" to "service_role";

grant REFERENCES ("promo_code_id") on public."promo_redemptions" to "service_role";

grant SELECT ("promo_code_id") on public."promo_redemptions" to "service_role";

grant INSERT ("provider") on public."payments" to "service_role";

grant REFERENCES ("provider") on public."payments" to "service_role";

grant SELECT ("provider") on public."payments" to "service_role";

grant UPDATE ("provider") on public."payments" to "service_role";

grant INSERT ("provider_payment_id") on public."payments" to "service_role";

grant REFERENCES ("provider_payment_id") on public."payments" to "service_role";

grant SELECT ("provider_payment_id") on public."payments" to "service_role";

grant UPDATE ("provider_payment_id") on public."payments" to "service_role";

grant INSERT ("provider_payment_id") on public."promo_redemptions" to "service_role";

grant REFERENCES ("provider_payment_id") on public."promo_redemptions" to "service_role";

grant SELECT ("provider_payment_id") on public."promo_redemptions" to "service_role";

grant REFERENCES ("published_at") on public."invitations" to "service_role";

grant SELECT ("published_at") on public."invitations" to "service_role";

grant UPDATE ("published_at") on public."invitations" to "service_role";

grant REFERENCES ("slug") on public."invitations" to "service_role";

grant SELECT ("slug") on public."invitations" to "service_role";

grant UPDATE ("slug") on public."invitations" to "service_role";

grant REFERENCES ("sort_order") on public."invitation_assets" to "service_role";

grant INSERT ("starts_at") on public."promo_codes" to "service_role";

grant REFERENCES ("starts_at") on public."promo_codes" to "service_role";

grant SELECT ("starts_at") on public."promo_codes" to "service_role";

grant UPDATE ("starts_at") on public."promo_codes" to "service_role";

grant REFERENCES ("status") on public."invitations" to "service_role";

grant SELECT ("status") on public."invitations" to "service_role";

grant UPDATE ("status") on public."invitations" to "service_role";

grant INSERT ("status") on public."payments" to "service_role";

grant REFERENCES ("status") on public."payments" to "service_role";

grant SELECT ("status") on public."payments" to "service_role";

grant UPDATE ("status") on public."payments" to "service_role";

grant REFERENCES ("storage_path") on public."invitation_assets" to "service_role";

grant REFERENCES ("template_key") on public."invitations" to "service_role";

grant SELECT ("template_key") on public."invitations" to "service_role";

grant UPDATE ("template_key") on public."invitations" to "service_role";

grant REFERENCES ("title") on public."invitations" to "service_role";

grant SELECT ("title") on public."invitations" to "service_role";

grant UPDATE ("title") on public."invitations" to "service_role";

grant REFERENCES ("updated_at") on public."invitations" to "service_role";

grant SELECT ("updated_at") on public."invitations" to "service_role";

grant UPDATE ("updated_at") on public."invitations" to "service_role";

grant REFERENCES ("updated_at") on public."profiles" to "service_role";

grant SELECT ("updated_at") on public."profiles" to "service_role";

grant REFERENCES ("user_id") on public."invella_admins" to "service_role";

grant SELECT ("user_id") on public."invella_admins" to "service_role";

grant INSERT ("uses_count") on public."promo_codes" to "service_role";

grant REFERENCES ("uses_count") on public."promo_codes" to "service_role";

grant SELECT ("uses_count") on public."promo_codes" to "service_role";

grant UPDATE ("uses_count") on public."promo_codes" to "service_role";

grant REFERENCES ("venue_address") on public."invitations" to "service_role";

grant SELECT ("venue_address") on public."invitations" to "service_role";

grant UPDATE ("venue_address") on public."invitations" to "service_role";

grant REFERENCES ("venue_name") on public."invitations" to "service_role";

grant SELECT ("venue_name") on public."invitations" to "service_role";

grant UPDATE ("venue_name") on public."invitations" to "service_role";

revoke all on function confirm_invella_payment(text,uuid,uuid,text,integer,text,uuid,text) from public,anon,authenticated,service_role;

revoke all on function handle_new_user() from public,anon,authenticated,service_role;

revoke all on function increment_promo_use(uuid) from public,anon,authenticated,service_role;

revoke all on function preserve_premium_content() from public,anon,authenticated,service_role;

revoke all on function protect_invitation_commercial_fields() from public,anon,authenticated,service_role;

revoke all on function set_updated_at() from public,anon,authenticated,service_role;

revoke all on function submit_rsvp(text,text,text,integer,text) from public,anon,authenticated,service_role;

grant execute on function confirm_invella_payment(text,uuid,uuid,text,integer,text,uuid,text) to "service_role";

grant execute on function increment_promo_use(uuid) to "service_role";

grant execute on function preserve_premium_content() to "authenticated";

grant execute on function preserve_premium_content() to "anon";

grant execute on function preserve_premium_content() to "service_role";

grant execute on function set_updated_at() to "authenticated";

grant execute on function set_updated_at() to "anon";

grant execute on function set_updated_at() to "service_role";

grant execute on function submit_rsvp(text,text,text,integer,text) to "authenticated";

grant execute on function submit_rsvp(text,text,text,integer,text) to "anon";

-- Auth profile creation trigger (app-owned, on the managed auth table).
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
