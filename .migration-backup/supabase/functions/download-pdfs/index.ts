import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, serviceRoleKey);

// The PDF files are stored in Supabase Storage in a private bucket called "course-pdfs".
// This function verifies the download token, increments the count, and streams the ZIP.
// If the storage bucket/PDFs aren't set up yet, it returns a clear error.

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

    // Atomically claim one download: the cap and expiry are re-checked inside a single
    // conditional UPDATE, so concurrent requests cannot all pass a stale count.
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
      // Unknown token, expired link, or the download cap is already reached.
      // Distinguish the cases only as far as is useful to a legitimate buyer.
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

    // If the file cannot be served, give the claimed download back so a server-side
    // failure does not cost the buyer one of their five downloads.
    const releaseClaim = async () => {
      await supabase
        .from("download_links")
        .update({ download_count: Math.max(0, link.download_count - 1) })
        .eq("id", link.id);
    };

    // Fetch the ZIP file from Supabase Storage
    const { data: fileData, error: fileError } = await supabase
      .storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(ZIP_FILE_PATH, 60, {
        download: true,
      });

    if (fileError || !fileData) {
      await releaseClaim();
      // The PDFs haven't been uploaded to storage yet
      return new Response(
        JSON.stringify({
          error: "Course files are not yet available. Please contact support at support@aiautomationforcontractors.com.",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the signed URL and stream the file back
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
