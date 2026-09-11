import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");

async function withProduct(link: any) {
  const { data: purchase } = await supabase
    .from('course_purchases')
    .select('product_key')
    .eq('id', link.purchase_id)
    .maybeSingle();
  return { ...link, product_key: purchase?.product_key || 'contractor_course' };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const body = await req.json();
    const session_id = body?.session_id;
    const token = body?.token;

    if (token) {
      const { data: link } = await supabase
        .from("download_links")
        .select("id, token, download_count, max_downloads, expires_at, purchase_id")
        .eq("token", token)
        .maybeSingle();

      if (!link) return new Response(JSON.stringify({ error: "This download link was not found." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (new Date(link.expires_at) < new Date()) return new Response(JSON.stringify({ error: "This download link has expired." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (link.download_count >= link.max_downloads) return new Response(JSON.stringify({ error: "Maximum downloads reached for this link." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      return new Response(JSON.stringify({ status: "valid", link: await withProduct(link) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!session_id) return new Response(JSON.stringify({ error: "Session ID is required." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: purchase, error: purchaseError } = await supabase
      .from("course_purchases")
      .select("id, stripe_session_id, product_key")
      .eq("stripe_session_id", session_id)
      .maybeSingle();

    if (purchaseError || !purchase) return new Response(JSON.stringify({ status: "pending", message: "Your payment is being processed." }), { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: link, error: linkError } = await supabase
      .from("download_links")
      .select("token, download_count, max_downloads, expires_at")
      .eq("purchase_id", purchase.id)
      .maybeSingle();

    if (linkError || !link) return new Response(JSON.stringify({ status: "pending", message: "Your access is being prepared." }), { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    return new Response(JSON.stringify({ status: "ready", token: link.token, product_key: purchase.product_key || 'contractor_course' }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Resolve download error:", err);
    return new Response(JSON.stringify({ error: "Something went wrong." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
