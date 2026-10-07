import type { APIRoute } from 'astro';
import {
  getNopBaiAdminClient,
  uploadSubmissionImages,
  submitAssignment,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_SUBMISSION,
} from '../../../services/nopBai';

export const prerender = false;

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async (ctx) => {
  try {
    const runtimeEnv = (ctx.locals as any)?.runtimeEnv;
    const client = getNopBaiAdminClient(runtimeEnv);
    const user = ctx.locals.user;

    const contentType = ctx.request.headers.get('content-type') || '';
    let studentName = '';
    let className = '';
    let content = '';
    const imageFilesToUpload: Array<{ name: string; type: string; buffer: ArrayBuffer }> = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await ctx.request.formData();
      studentName = String(formData.get('studentName') || '').trim();
      className = String(formData.get('className') || '').trim();
      content = String(formData.get('content') || '').trim();

      // Collect image files
      const rawFiles = formData.getAll('images');
      for (const item of rawFiles) {
        if (typeof item === 'object' && item !== null && 'arrayBuffer' in item) {
          const file = item as File;
          if (file.size > 0) {
            if (file.size > MAX_IMAGE_BYTES) {
              return json({ error: `File ảnh "${file.name}" vượt quá giới hạn 10MB` }, 400);
            }
            const buffer = await file.arrayBuffer();
            imageFilesToUpload.push({
              name: file.name || 'anh-nop-bai.jpg',
              type: file.type || 'image/jpeg',
              buffer,
            });
          }
        }
      }

      // Hỗ trợ thêm base64 images nếu được truyền dạng JSON string (tiện lợi khi dán ảnh từ clipboard)
      const base64ListRaw = formData.get('base64Images');
      if (base64ListRaw && typeof base64ListRaw === 'string') {
        try {
          const parsed = JSON.parse(base64ListRaw);
          if (Array.isArray(parsed)) {
            for (let i = 0; i < parsed.length; i++) {
              const b64 = parsed[i];
              if (typeof b64 === 'string' && b64.startsWith('data:image/')) {
                const parts = b64.split(';base64,');
                const mimeType = parts[0].replace('data:', '');
                const binaryStr = atob(parts[1]);
                const bytes = new Uint8Array(binaryStr.length);
                for (let j = 0; j < binaryStr.length; j++) {
                  bytes[j] = binaryStr.charCodeAt(j);
                }
                imageFilesToUpload.push({
                  name: `clipboard-image-${Date.now()}-${i + 1}.png`,
                  type: mimeType,
                  buffer: bytes.buffer,
                });
              }
            }
          }
        } catch {
          // Bỏ qua nếu parse lỗi
        }
      }
    } else {
      // JSON payload
      const body = await ctx.request.json().catch(() => ({}));
      studentName = String(body.studentName || '').trim();
      className = String(body.className || '').trim();
      content = String(body.content || '').trim();

      if (Array.isArray(body.images)) {
        for (let i = 0; i < body.images.length; i++) {
          const img = body.images[i];
          if (typeof img === 'string' && img.startsWith('data:image/')) {
            const parts = img.split(';base64,');
            const mimeType = parts[0].replace('data:', '');
            const binaryStr = atob(parts[1]);
            const bytes = new Uint8Array(binaryStr.length);
            for (let j = 0; j < binaryStr.length; j++) {
              bytes[j] = binaryStr.charCodeAt(j);
            }
            imageFilesToUpload.push({
              name: `clipboard-image-${Date.now()}-${i + 1}.png`,
              type: mimeType,
              buffer: bytes.buffer,
            });
          }
        }
      }
    }

    if (!studentName) {
      return json({ error: 'Vui lòng nhập Họ và tên' }, 400);
    }
    if (!className) {
      return json({ error: 'Vui lòng chọn hoặc nhập Lớp học' }, 400);
    }
    if (!content && imageFilesToUpload.length === 0) {
      return json({ error: 'Vui lòng nhập nội dung bài làm hoặc dán ít nhất 1 ảnh' }, 400);
    }

    if (imageFilesToUpload.length > MAX_IMAGES_PER_SUBMISSION) {
      return json({ error: `Tối đa ${MAX_IMAGES_PER_SUBMISSION} ảnh mỗi lần nộp bài` }, 400);
    }

    // 1. Upload ảnh lên Supabase Storage bucket `nop-bai`
    let uploadedImages: Array<{ url: string; name?: string; path?: string }> = [];
    if (imageFilesToUpload.length > 0) {
      uploadedImages = await uploadSubmissionImages(
        client,
        imageFilesToUpload,
        className,
        studentName
      );
    }

    // 2. Lưu thông tin nộp bài vào Supabase & ghi nhận số lần nộp
    const result = await submitAssignment(client, {
      studentName,
      className,
      content,
      images: uploadedImages,
      userId: user?.id || null,
    });

    return json({
      success: true,
      message: `Nộp bài thành công! Bạn đã nộp bài lần thứ ${result.submissionCount}.`,
      submissionId: result.id,
      submissionCount: result.submissionCount,
      studentName,
      className,
      createdAt: result.createdAt,
      images: uploadedImages,
    }, 201);
  } catch (error: any) {
    console.error('[API /api/nop-bai/submit] error:', error);
    return json({ error: error.message || 'Lỗi xử lý nộp bài' }, 500);
  }
};
