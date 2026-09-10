import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Keep the storefront renderable even when Replit has not exposed the
// production Supabase environment variables to this artifact yet. Calls that
// require Supabase will fail normally until the real values are configured,
// but a missing secret must never crash the entire React app at startup.
const safeUrl = supabaseUrl || 'https://placeholder.supabase.co';
const safeAnonKey = supabaseAnonKey || 'placeholder-anon-key';

export const supabase = createClient(safeUrl, safeAnonKey);
