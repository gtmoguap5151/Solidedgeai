import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const session_id = body?.session_id;
    const token = body?.token;

    // Verify a download token directly (the download page's primary path).
    // download_links is service-role-only, so this lookup must happen here.
    if (token) {
      const { data: link } = await supabase
        .from("download_links")
        .select("id, token, download_count, max_downloads, expires_at, purchase_id")
        .eq("token", token)
        .maybeSingle();

      if (!link) {
        return new Response(
          JSON.stringify({ error: "This download link was not found. Check your email for the correct link." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (new Date(link.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "This download link has expired. Please contact support for a new one." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (link.download_count >= link.max_downloads) {
        return new Response(
          JSON.stringify({ error: "You have reached the maximum number of downloads for this link. Please contact support for assistance." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ status: "valid", link }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: "Session ID is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up the purchase by Stripe session ID, then find its download link
    const { data: purchase, error: purchaseError } = await supabase
      .from("course_purchases")
      .select("id, stripe_session_id")
      .eq("stripe_session_id", session_id)
      .maybeSingle();

    if (purchaseError || !purchase) {
      // The webhook may not have processed yet — tell the client to retry
      return new Response(
        JSON.stringify({ status: "pending", message: "Your payment is being processed. Please wait a moment." }),
        { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: link, error: linkError } = await supabase
      .from("download_links")
      .select("token, download_count, max_downloads, expires_at")
      .eq("purchase_id", purchase.id)
      .maybeSingle();

    if (linkError || !link) {
      return new Response(
        JSON.stringify({ status: "pending", message: "Your download link is being prepared. Please wait a moment." }),
        { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ status: "ready", token: link.token }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Resolve download error:", err);
    return new Response(
      JSON.stringify({ error: "Something went wrong." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
