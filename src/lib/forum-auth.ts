import type { APIContext } from 'astro';
import { db } from '../services/db';
import type { User } from '../types';

/** Resolve người dùng cho API diễn đàn: ưu tiên locals (middleware), fallback cookie mock. */
export async function requireForumUser(context: APIContext): Promise<User | null> {
  if (context.locals.user) return context.locals.user;

  const mockId = context.cookies.get('mock-user-id')?.value;
  if (!mockId) return null;

  return mockId.startsWith('mock-user-')
    ? db.getMockUserById(mockId)
    : db.getUserById(mockId);
}

export function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
