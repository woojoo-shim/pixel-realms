/**
 * Supabase auth client (browser). Used only for OAuth sign-in flows
 * (Google / GitHub / Discord). The game server is the source of truth
 * for character data — Supabase here is purely an identity broker.
 *
 * Env (set in apps/client/.env.local or on Vercel):
 *   VITE_SUPABASE_URL       e.g. https://xxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY  the publishable / anon key (safe to ship)
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type OAuthProvider = "google" | "github" | "discord";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Null if OAuth env not configured — caller should hide OAuth UI. */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true, // parses #access_token=... after redirect
        },
      })
    : null;

export const oauthEnabled = supabase !== null;

/** Begin OAuth sign-in — browser redirects to provider, returns to our origin. */
export async function signInWithProvider(provider: OAuthProvider) {
  if (!supabase) throw new Error("Supabase not configured");
  await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin },
  });
  // signInWithOAuth triggers a top-level redirect — code after this won't run.
}

/** Get current session (if user previously signed in or just returned from OAuth). */
export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

/** Strip the OAuth hash fragment (#access_token=...) from the URL after parsing. */
export function cleanOAuthHash() {
  if (window.location.hash.includes("access_token")) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
}
