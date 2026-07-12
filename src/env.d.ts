/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

type CloudflareRuntime = import('@astrojs/cloudflare').Runtime<{
  PUBLIC_SUPABASE_URL: string;
  PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  GEMINI_API_KEY: string;
  WORDPRESS_API_URL: string;
}>;

declare namespace App {
  interface Locals extends CloudflareRuntime {
    user: import('./types').User | null;
    /** Cloudflare Workers runtime env — available on CF Pages, undefined on local dev */
    runtimeEnv: Record<string, string | undefined> | undefined;
  }
}
