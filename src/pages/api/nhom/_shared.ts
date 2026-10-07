import type { APIContext } from 'astro';
import { getGroupClient, isUuid, type GroupUser } from '../../../services/groupChat';

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  });
}

/** Chỉ cho phép thành viên đã đăng ký qua Supabase (có UUID trong public.users) */
export function requireMember(ctx: Pick<APIContext, 'locals' | 'cookies'>) {
  const user = ctx.locals.user as GroupUser | null;
  if (!user || !isUuid(user.id)) {
    return { error: json({ error: 'Bạn cần đăng nhập bằng tài khoản đã đăng ký để dùng Nhóm lớp học.' }, 401) } as const;
  }
  const accessToken = ctx.cookies.get('sb-access-token')?.value;
  const client = getGroupClient((ctx.locals as any).runtimeEnv, accessToken);
  return { user, client } as const;
}
