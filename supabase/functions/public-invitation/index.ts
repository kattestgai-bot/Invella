import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  if(req.method!=="POST")return new Response(JSON.stringify({error:"method not allowed"}),{status:405,headers:{...cors,"Content-Type":"application/json"}});
  try {
    let body;try{body=await req.json()}catch{return new Response(JSON.stringify({error:"invalid JSON"}),{status:400,headers:{...cors,"Content-Type":"application/json"}})}
    const {slug}=body||{};
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });

    if (!slug || !/^[-a-z0-9]{3,63}$/.test(slug)) return json({ error: "invalid slug" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("invitations")
      .select("id,title,slug,event_date,venue_name,venue_address,template_key,content,design,cover_url,music_url,gallery,plan,status,preview_published,privacy_mode")
      .eq("slug", slug)
      .in("privacy_mode", ["public", "unlisted"])
      .or("status.eq.published,preview_published.eq.true")
      .maybeSingle();

    if(error) throw error;
    if(!data) return json({ error: "not found" }, 404);

    const signedAsset = async (value: unknown): Promise<string | null> => {
      if (!value || typeof value !== "string") return null;
      if (/^https?:/i.test(value)) return value;
      const signed = await supabase.storage.from("invitation-media").createSignedUrl(value, 3600);
      return signed.data?.signedUrl ?? null;
    };

    const plan = String(data.plan || "basic").toLowerCase();
    const safeContent = { ...(data.content || {}) } as Record<string, unknown>;
    delete safeContent.owner_id;
    delete safeContent.email;
    delete safeContent.private_notes;

    const cover_url = await signedAsset(data.cover_url);
    let music_url: string | null = null;
    let gallery: string[] = [];

    if (plan === "premium") {
      music_url = await signedAsset(data.music_url);
      const sourceGallery = Array.isArray(data.gallery) ? data.gallery.slice(0, 5) : [];
      gallery = (await Promise.all(sourceGallery.map(signedAsset))).filter(
        (item): item is string => Boolean(item),
      );

      if (safeContent.backgroundCustomPath) {
        safeContent.backgroundCustomUrl =
          (await signedAsset(String(safeContent.backgroundCustomPath))) || "";
      }
    } else {
      delete safeContent.backgroundCustomUrl;
      delete safeContent.backgroundCustomPath;
      delete safeContent.premiumMusicUrl;
      delete safeContent.premiumGallery;
      delete safeContent.premiumTimer;
      delete safeContent.showPremiumTimer;
    }

    return json({ ...data, content: safeContent, cover_url, music_url, gallery });
  } catch (error) {
    console.error("public-invitation", error);
    return new Response(JSON.stringify({ error: "server error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
});
