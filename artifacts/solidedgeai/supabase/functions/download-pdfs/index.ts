import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, serviceRoleKey);

const STORAGE_BUCKET = "course-pdfs";
const ZIP_FILE_PATH = "AI-Automation-for-Contractors-Complete-Course.zip";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Download token is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: claimed, error: claimError } = await supabase
      .rpc("claim_download", { p_token: token });

    if (claimError) {
      console.error("Failed to claim download:", claimError);
      return new Response(
        JSON.stringify({ error: "Something went wrong during download." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const link = Array.isArray(claimed) ? claimed[0] : claimed;

    if (!link) {
      const { data: existing } = await supabase
        .from("download_links")
        .select("expires_at, download_count, max_downloads")
        .eq("token", token)
        .maybeSingle();

      if (!existing) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired download link." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (new Date(existing.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "This download link has expired." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Maximum downloads reached for this link." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const releaseClaim = async () => {
      await supabase
        .from("download_links")
        .update({ download_count: Math.max(0, link.download_count - 1) })
        .eq("id", link.id);
    };

    const { data: fileData, error: fileError } = await supabase
      .storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(ZIP_FILE_PATH, 60, {
        download: true,
      });

    if (fileError || !fileData) {
      await releaseClaim();
      return new Response(
        JSON.stringify({
          error: "Course files are not yet available. Please contact support at support@aiautomationforcontractors.com.",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fileResponse = await fetch(fileData.signedUrl);
    if (!fileResponse.ok) {
      await releaseClaim();
      return new Response(
        JSON.stringify({ error: "Failed to retrieve course files." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const blob = await fileResponse.blob();

    return new Response(blob, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${ZIP_FILE_PATH}"`,
      },
    });
  } catch (err) {
    console.error("Download error:", err);
    return new Response(
      JSON.stringify({ error: "Something went wrong during download." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
