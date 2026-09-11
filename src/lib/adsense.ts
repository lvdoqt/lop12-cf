/** Shared configuration for the AdSense loader and ads.txt. */
export function getAdsenseClient(runtimeEnv?: Record<string, string | undefined>): string {
  const client = (runtimeEnv?.PUBLIC_ADSENSE_CLIENT_ID ?? import.meta.env.PUBLIC_ADSENSE_CLIENT_ID ?? '').trim();
  return /^ca-pub-\d{16}$/.test(client) ? client : '';
}

export function allowAdsense(pathname: string): boolean {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const path = base && (pathname === base || pathname.startsWith(`${base}/`))
    ? pathname.slice(base.length) || '/'
    : pathname;
  return !/^\/(admin|giao-vien|api|dashboard|profile|ai-chat|login|register|forgot-password|reset-password|auth|thi-online)(\/|$)/.test(path)
    && !/^\/exams\/[^/]+\/(take|result)(\/|$)/.test(path);
}
