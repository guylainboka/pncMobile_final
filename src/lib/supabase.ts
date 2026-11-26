import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient | null> | null = null;
let configuredFlag = false;

export async function initSupabaseClient(): Promise<SupabaseClient | null> {
  if (cachedClient) return cachedClient;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    let url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
    let anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

    if (!url || !anonKey) {
      try {
        const res = await fetch('/api/config/supabase');
        if (res.ok) {
          const data = (await res.json()) as {
            configured?: boolean;
            url?: string | null;
            anonKey?: string | null;
          };
          if (data.configured && data.url && data.anonKey) {
            url = data.url;
            anonKey = data.anonKey;
          }
        }
      } catch {
        // Fallback silently to local backend mode
      }
    }

    if (!url || !anonKey) {
      configuredFlag = false;
      return null;
    }

    configuredFlag = true;
    cachedClient = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
    return cachedClient;
  })();

  return initPromise;
}

export function getSupabaseClientSync(): SupabaseClient | null {
  return cachedClient;
}

export function isSupabaseConfiguredSync(): boolean {
  return (
    configuredFlag ||
    Boolean(
      (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() &&
        (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()
    )
  );
}
