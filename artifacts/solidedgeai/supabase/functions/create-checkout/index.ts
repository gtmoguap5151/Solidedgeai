const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const OFFERS: Record<string, { priceId: string; name: string }> = {
  starter_playbook: { priceId: "price_1UEYyvCZRLLet9afNBgLWEZw", name: "Solid Edge AI Starter Playbook" },
  sales_marketing: { priceId: "price_1UEYyzCZRLLet9afcx0rw6GQ", name: "AI Sales & Marketing Playbook" },
  operations_automation: { priceId: "price_1UEYz3CZRLLet9af03CP1zQQ", name: "AI Operations & Automation Playbook" },
  contractor_course: { priceId: "price_1U9F8GCZRLLet9afZQqbWxgo", name: "AI Automation for Contractors" },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return new Response(JSON.stringify({ error: "Payment system is not configured." }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* empty body is fine */ }
    const productKey = typeof body.product_key === "string" ? body.product_key : "contractor_course";
    const offer = OFFERS[productKey];
    if (!offer) return new Response(JSON.stringify({ error: "Unknown product." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const configuredSite = (Deno.env.get("SITE_URL") || "").replace(/\/$/, "");
    const isAllowedOrigin = (candidate: string): boolean => {
      let url: URL;
      try { url = new URL(candidate); } catch { return false; }
      if (url.protocol !== "https:" && url.protocol !== "http:") return false;
      const host = url.hostname.toLowerCase();
      if (configuredSite) {
        try { if (host === new URL(configuredSite).hostname.toLowerCase()) return true; } catch { /* ignore */ }
      }
      if (host === "localhost" || host === "127.0.0.1") return true;
      if (host.endsWith(".netlify.app") || host.endsWith(".bolt.host") || host.endsWith(".replit.app") || host.endsWith(".replit.dev")) return true;
      return false;
    };

    const rawOrigin = req.headers.get("origin") || "";
    const rawReferer = req.headers.get("referer") || "";
    let baseUrl = "";
    if (rawOrigin && isAllowedOrigin(rawOrigin)) baseUrl = new URL(rawOrigin).origin;
    else if (rawReferer) {
      try { const refOrigin = new URL(rawReferer).origin; if (isAllowedOrigin(refOrigin)) baseUrl = refOrigin; } catch { /* ignore */ }
    }
    if (!baseUrl && configuredSite) baseUrl = configuredSite;
    if (!baseUrl) return new Response(JSON.stringify({ error: "Could not determine site URL." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const params = new URLSearchParams({
      "mode": "payment",
      "line_items[0][price]": offer.priceId,
      "line_items[0][quantity]": "1",
      "success_url": `${baseUrl}/download?session_id={CHECKOUT_SESSION_ID}`,
      "cancel_url": productKey === "contractor_course" ? `${baseUrl}/checkout` : `${baseUrl}/programs`,
      "billing_address_collection": "auto",
      "metadata[product_key]": productKey,
      "metadata[product_name]": offer.name,
    });

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Stripe checkout creation failed:", errText);
      let safeMessage = "Could not start checkout. Please try again.";
      try { const parsed = JSON.parse(errText); if (parsed?.error?.message) safeMessage = parsed.error.message; } catch { /* ignore */ }
      return new Response(JSON.stringify({ error: safeMessage }), { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const session = await response.json();
    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Checkout error:", err);
    return new Response(JSON.stringify({ error: "Something went wrong. Please try again." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
