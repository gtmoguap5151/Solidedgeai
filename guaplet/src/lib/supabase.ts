import { createClient } from "@supabase/supabase-js";

const fallbackUrl = "https://xesfpthmlcpjaeljekay.supabase.co";
const fallbackPublishableKey = "sb_publishable_7D0J3A6wzoAXl_wteIZGig_xnjm97jb";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || fallbackUrl,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || fallbackPublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
