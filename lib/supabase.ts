import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Avoid crashing at module import time in dev environments where env vars
// haven't been configured yet. Requests will fail until env vars are set.
const safeUrl = supabaseUrl ?? "https://invalid.supabase.co";
const safeAnonKey = supabaseAnonKey ?? "invalid-anon-key";

export const supabase = createClient(
  safeUrl,
  safeAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

