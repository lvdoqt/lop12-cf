import type { APIRoute } from 'astro';
import { getAdsenseClient } from '../lib/adsense';

export const GET: APIRoute = ({ locals }) => {
  const client = getAdsenseClient(locals.runtimeEnv);
  return new Response(client ? `google.com, ${client.slice(3)}, DIRECT, f08c47fec0942fa0\n` : '# AdSense publisher ID is not configured.\n', {
    status: client ? 200 : 503,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': client ? 'public, max-age=300' : 'no-store',
    },
  });
};
