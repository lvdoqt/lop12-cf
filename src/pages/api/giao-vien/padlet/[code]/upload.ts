import type { APIRoute } from 'astro';
import { createAdminSupabase } from '../../../../../lib/supabase';
import { padletStore } from '../../../../../services/db';

export const prerender = false;

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  const { code } = params;
  if (!code) {
    return new Response(JSON.stringify({ error: 'Thiếu mã bảng' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const board = await padletStore.getBoardByCode(code);
    if (!board) {
      return new Response(JSON.stringify({ error: 'Không tìm thấy bảng' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (board.is_locked) {
      return new Response(JSON.stringify({ error: 'Bảng đã bị khóa, không thể tải ảnh lên' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'Không tìm thấy tệp ảnh' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const ext = ALLOWED_MIME[file.type];
    if (!ext) {
      return new Response(JSON.stringify({ error: 'Chỉ hỗ trợ ảnh PNG, JPG, GIF hoặc WebP' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (file.size > MAX_SIZE) {
      return new Response(JSON.stringify({ error: 'Ảnh tối đa 5 MB' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const runtimeEnv = (locals as any).runtimeEnv as Record<string, string | undefined> | undefined;
    const supabase = createAdminSupabase(runtimeEnv);
    const upperCode = code.toUpperCase();
    const path = `padlet/${upperCode}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const bytes = await file.arrayBuffer();

    const { error } = await supabase.storage.from('lms').upload(path, bytes, {
      contentType: file.type,
      upsert: false,
    });

    if (error) {
      console.warn('[api.padlet.upload] Storage upload failed, fallback to Data URL:', error.message);
      if (file.size <= 1.5 * 1024 * 1024) {
        const base64 = Buffer.from(bytes).toString('base64');
        const dataUrl = `data:${file.type};base64,${base64}`;
        return new Response(JSON.stringify({ success: true, url: dataUrl, name: file.name || `image.${ext}` }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: `Không thể lưu ảnh lên Supabase Storage: ${error.message}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: publicUrl } = supabase.storage.from('lms').getPublicUrl(path);
    return new Response(
      JSON.stringify({
        success: true,
        url: publicUrl.publicUrl,
        name: file.name || `image.${ext}`,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('[api.padlet.upload.POST]', err);
    return new Response(JSON.stringify({ error: err?.message || 'Lỗi tải ảnh lên' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
