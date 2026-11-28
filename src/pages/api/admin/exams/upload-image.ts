import type { APIRoute } from 'astro';
import { createAdminSupabase } from '../../../../lib/supabase';

export const prerender = false;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'admin' && user.role !== 'teacher')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'Chưa có tệp hình ảnh.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const ext = ALLOWED_MIME[file.type];
    if (!ext) {
      return new Response(JSON.stringify({ error: 'Chỉ hỗ trợ ảnh PNG, JPG, WebP hoặc GIF.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return new Response(JSON.stringify({ error: 'Ảnh minh họa vượt quá giới hạn 5 MB.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const bytes = await file.arrayBuffer();
    const runtimeEnv = (locals as any).runtimeEnv as Record<string, string | undefined> | undefined;
    const adminSupabase = createAdminSupabase(runtimeEnv);

    if (adminSupabase) {
      const storagePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await adminSupabase.storage.from('exam-assets').upload(storagePath, bytes, {
        contentType: file.type,
        upsert: false,
      });

      if (!error) {
        const { data } = adminSupabase.storage.from('exam-assets').getPublicUrl(storagePath);
        return new Response(JSON.stringify({ success: true, url: data.publicUrl }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Fallback to `forum-files` bucket if `exam-assets` bucket hasn't been created yet on remote Supabase
      const { error: fallbackErr } = await adminSupabase.storage.from('forum-files').upload(`exams/${storagePath}`, bytes, {
        contentType: file.type,
        upsert: false,
      });
      if (!fallbackErr) {
        const { data } = adminSupabase.storage.from('forum-files').getPublicUrl(`exams/${storagePath}`);
        return new Response(JSON.stringify({ success: true, url: data.publicUrl }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      console.warn('[api.admin.exams.upload-image] Storage fallback to Data URL:', error.message);
    }

    // Local mock mode or missing bucket fallback -> base64 Data URL
    const bytesUint8 = new Uint8Array(bytes);
    let binary = '';
    for (let i = 0; i < bytesUint8.byteLength; i++) {
      binary += String.fromCharCode(bytesUint8[i]);
    }
    const base64 = btoa(binary);
    const dataUrl = `data:${file.type};base64,${base64}`;
    return new Response(JSON.stringify({ success: true, url: dataUrl }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Không thể tải ảnh minh họa lên hệ thống.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
