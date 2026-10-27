create or replace function public.submit_rsvp(
 p_slug text,p_guest_name text,p_attendance text,p_guest_count integer default 1,p_comment text default null
) returns uuid language plpgsql security definer set search_path=public as $$
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
end; $$;
-- Guests intentionally submit via this restricted RPC, never by writing the table.
revoke all on function public.submit_rsvp(text,text,text,integer,text) from public;
grant execute on function public.submit_rsvp(text,text,text,integer,text) to anon,authenticated;
