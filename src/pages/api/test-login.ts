import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const id = url.searchParams.get('id') || '5deefd02-f4c0-435e-af5e-8acce5540d44';
  cookies.set('mock-user-id', id, { path: '/' });
  return redirect('/dashboard');
};
