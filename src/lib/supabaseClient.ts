import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function resolveSupabaseUrl(): string | null {
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (publicUrl && publicUrl.startsWith("http")) {
    return publicUrl;
  }

  const postgresUrl = process.env.POSTGRES_URL;
  if (postgresUrl && postgresUrl.startsWith("http")) {
    return postgresUrl;
  }

  return null;
}

function resolveAnonKey(): string | null {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return key && key.length > 0 ? key : null;
}

let browserClient: SupabaseClient | null = null;
let missingKeysWarned = false;

export function getSupabase(): SupabaseClient | null {
  if (browserClient) {
    return browserClient;
  }

  const url = resolveSupabaseUrl();
  const anonKey = resolveAnonKey();

  if (!url || !anonKey) {
    if (!missingKeysWarned) {
      missingKeysWarned = true;
      console.warn(
        "Supabase URL or anon key is missing. Auth and cloud sync stay in guest/offline mode."
      );
    }
    return null;
  }

  browserClient = createClient(url, anonKey);
  return browserClient;
}
