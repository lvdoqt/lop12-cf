import { createClient } from '@supabase/supabase-js';

// ── Public Supabase values (anon key — safe to commit, not a secret) ─────────
// These are fallback values when .env is absent (e.g. Cloudflare Pages CI build).
// They match wrangler.toml [vars] exactly.
const _SUPABASE_URL_DEFAULT = 'https://dwezesrukmwygqnmefbz.supabase.co';
const _SUPABASE_ANON_KEY_DEFAULT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3ZXplc3J1a213eWdxbm1lZmJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMzA0NjIsImV4cCI6MjA5NTcwNjQ2Mn0.LCojdG6LGAQDHw9ewbXFiJOFIvrFYNPZLr4KRNmystw';

// ── SSR env resolver ─────────────────────────────────────────────────────────
// Used by server-side factory functions to read runtime env from Cloudflare Workers.
// NOTE: Do NOT use dynamic `import.meta.env[key]` here — Vite only replaces STATIC
// access like `import.meta.env.PUBLIC_X` at build time. Dynamic bracket access is
// not replaced and returns undefined on CF Pages where there is no .env file.
export function resolveEnv(key: string, runtimeEnv?: Record<string, string | undefined>): string {
  // 1. Cloudflare Workers runtime env (injected at request time on CF Pages)
  if (runtimeEnv && runtimeEnv[key]) return runtimeEnv[key]!;
  // 2. Node.js process.env (local dev / nodejs_compat)
  const proc = (globalThis as Record<string, unknown>)['process'] as { env?: Record<string, string | undefined> } | undefined;
  if (proc?.env?.[key]) return proc.env[key]!;
  return '';
}

// ── Module-level browser Supabase client ─────────────────────────────────────
// CRITICAL: Use STATIC import.meta.env.PUBLIC_X (Vite replaces this at bundle time).
// The || fallback hardcodes the public anon key so the client is NEVER null on CF Pages.
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || _SUPABASE_URL_DEFAULT;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || _SUPABASE_ANON_KEY_DEFAULT;

// Always false — the hardcoded fallback guarantees we always have a real client.
export const isMockMode = false;

// Client used in browser scripts (login.astro, register.astro <script> blocks)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});

// ── Runtime-aware factory functions (SSR / Cloudflare Pages) ─────────────────

/** Supabase client with anon key — reads env from Cloudflare runtime */
export function createServerSupabase(runtimeEnv?: Record<string, string | undefined>) {
  const url = resolveEnv('PUBLIC_SUPABASE_URL', runtimeEnv) || _SUPABASE_URL_DEFAULT;
  const anonKey = resolveEnv('PUBLIC_SUPABASE_ANON_KEY', runtimeEnv) || _SUPABASE_ANON_KEY_DEFAULT;

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
}

/** Admin Supabase client (bypasses RLS) — reads service role key from Cloudflare runtime */
export function createAdminSupabase(runtimeEnv?: Record<string, string | undefined>) {
  const url = resolveEnv('PUBLIC_SUPABASE_URL', runtimeEnv) || _SUPABASE_URL_DEFAULT;
  const anonKey = resolveEnv('PUBLIC_SUPABASE_ANON_KEY', runtimeEnv) || _SUPABASE_ANON_KEY_DEFAULT;
  const svcKey = resolveEnv('SUPABASE_SERVICE_ROLE_KEY', runtimeEnv);

  if (!svcKey || svcKey.includes('placeholder')) {
    console.warn('[createAdminSupabase] No service role key — falling back to anon client. RLS applies.');
    return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return createClient(url, svcKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
}

/** Returns true only if both URL and anon key are missing (should never happen with fallbacks) */
export function isMockModeForEnv(runtimeEnv?: Record<string, string | undefined>): boolean {
  const url = resolveEnv('PUBLIC_SUPABASE_URL', runtimeEnv) || _SUPABASE_URL_DEFAULT;
  const key = resolveEnv('PUBLIC_SUPABASE_ANON_KEY', runtimeEnv) || _SUPABASE_ANON_KEY_DEFAULT;
  return !url || !key;
}
