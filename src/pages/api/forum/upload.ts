import type { APIRoute } from 'astro';
import { createAdminSupabase } from '../../../lib/supabase';
import { jsonError, requireForumUser } from '../../../lib/forum-auth';
import { checkForumRateLimit } from '../../../lib/forum-security';

export const prerender = false;

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

/** Phase 3: upload ảnh/PDF lên bucket Supabase Storage `forum-files`. */
export const POST: APIRoute = async (context) => {
  const user = await requireForumUser(context);
  if (!user) return jsonError('Bạn cần đăng nhập để đính kèm tệp.', 401);

  const rate = checkForumRateLimit(`forum-upload:${user.id}`, 10, 60_000);
  if (!rate.ok) return jsonError('Upload quá nhiều tệp, thử lại sau.', 429);

  try {
    const form = await context.request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return jsonError('Chưa chọn tệp.', 400);
    const ext = ALLOWED[file.type];
    if (!ext) return jsonError('Chỉ hỗ trợ PNG, JPG, GIF, WebP hoặc PDF.', 400);
    if (file.size > MAX_SIZE) return jsonError('Tệp tối đa 5 MB.', 400);

    const runtimeEnv = (context.locals as any).runtimeEnv as Record<string, string | undefined> | undefined;
    const supabase = createAdminSupabase(runtimeEnv);
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const bytes = await file.arrayBuffer();
    const { error } = await supabase.storage.from('forum-files').upload(path, bytes, {
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      console.error('[api.forum.upload]', error);
      return jsonError('Không thể upload. Kiểm tra bucket `forum-files` đã được tạo chưa.', 500);
    }
    const { data: publicUrl } = supabase.storage.from('forum-files').getPublicUrl(path);
    return new Response(JSON.stringify({ success: true, url: publicUrl.publicUrl, name: file.name }), {
      status: 201, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[api.forum.upload.POST]', err);
    return jsonError(err?.message || 'Không thể upload tệp.', 500);
  }
};
