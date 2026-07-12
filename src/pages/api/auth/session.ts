import type { APIRoute } from 'astro';

export const prerender = false;

function getCookieOptions(maxAge: number) {
  const isProd = import.meta.env.PROD;
  return {
    path: '/',
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    maxAge,
  };
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    
    // Support both Supabase tokens and Mock mode user ID
    if (body.mockUserId) {
      cookies.set('mock-user-id', body.mockUserId, getCookieOptions(60 * 60 * 24 * 7));
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    const { access_token, refresh_token } = body;
    if (!access_token) {
      return new Response(JSON.stringify({ error: 'Access token is required' }), { status: 400 });
    }

    const cookieOpts = getCookieOptions(60 * 60 * 24 * 7);

    cookies.set('sb-access-token', access_token, cookieOpts);
    if (refresh_token) {
      cookies.set('sb-refresh-token', refresh_token, cookieOpts);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ cookies }) => {
  const cookieOpts = getCookieOptions(0);
  // Set maxAge=0 to expire immediately
  const deleteOpts = { ...cookieOpts, maxAge: 0, expires: new Date(0) };

  cookies.delete('sb-access-token', deleteOpts);
  cookies.delete('sb-refresh-token', deleteOpts);
  cookies.delete('mock-user-id', deleteOpts);

  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
