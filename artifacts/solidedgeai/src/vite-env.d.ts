interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_CHECKOUT_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
