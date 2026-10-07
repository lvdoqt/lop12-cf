import type { APIRoute } from 'astro';
import {
  listPosts,
  uploadImages,
  removeImages,
  sanitizeClassId,
  MAX_IMAGES_PER_POST,
} from '../../../../services/groupChat';
import { json, requireMember } from '../_shared';

export const prerender = false;

const ALLOWED_TAGS = ['💬 Thảo luận', '📢 Thông báo', '📚 Hỏi bài tập', '📝 Tài liệu học', '🎯 Nhắc lịch thi'];

// GET /api/nhom/posts?classId=12a4 — danh sách bài đăng của lớp
export const GET: APIRoute = async (ctx) => {
  const auth = requireMember(ctx);
  if ('error' in auth) return auth.error;

  const classId = sanitizeClassId(ctx.url.searchParams.get('classId'));
  if (!classId) return json({ error: 'classId không hợp lệ' }, 400);

  try {
    const posts = await listPosts(auth.client, classId, auth.user);
    return json({ posts });
  } catch (err: any) {
    return json({ error: err.message || 'Không tải được bài đăng' }, 500);
  }
};

// POST /api/nhom/posts — multipart/form-data: classId, tag, body, linkUrl, linkTitle, images[]
export const POST: APIRoute = async (ctx) => {
  const auth = requireMember(ctx);
  if ('error' in auth) return auth.error;
  const { user, client } = auth;

  let form: FormData;
  try {
    form = await ctx.request.formData();
  } catch {
    return json({ error: 'Dữ liệu gửi lên không hợp lệ' }, 400);
  }

  const classId = sanitizeClassId(form.get('classId'));
  if (!classId) return json({ error: 'classId không hợp lệ' }, 400);

  const body = String(form.get('body') || '').trim().slice(0, 4000);
  const rawTag = String(form.get('tag') || '');
  const tag = ALLOWED_TAGS.includes(rawTag) ? rawTag : ALLOWED_TAGS[0];

  let linkUrl = String(form.get('linkUrl') || '').trim().slice(0, 1000) || null;
  if (linkUrl && !/^https?:\/\//i.test(linkUrl)) linkUrl = null;
  const linkTitle = linkUrl ? String(form.get('linkTitle') || '').trim().slice(0, 300) || linkUrl : null;

  const files = form
    .getAll('images')
    .filter((f): f is File => typeof f === 'object' && f !== null && 'arrayBuffer' in f && (f as File).size > 0);
  if (files.length > MAX_IMAGES_PER_POST) {
    return json({ error: `Tối đa ${MAX_IMAGES_PER_POST} ảnh mỗi bài` }, 400);
  }

  if (!body && files.length === 0 && !linkUrl) {
    return json({ error: 'Bài đăng trống' }, 400);
  }

  // Chỉ giáo viên / admin mới được gắn tag Thông báo
  const finalTag = tag === '📢 Thông báo' && user.role === 'student' ? ALLOWED_TAGS[0] : tag;

  let images: { url: string; path: string }[] = [];
  try {
    images = await uploadImages(client, user.id, classId, files);
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }

  const { data, error } = await client
    .from('group_posts')
    .insert({
      class_id: classId,
      user_id: user.id,
      tag: finalTag,
      body: body || (images.length ? 'Đã chia sẻ hình ảnh đến lớp học.' : 'Đã chia sẻ liên kết đến lớp học.'),
      images,
      link_url: linkUrl,
      link_title: linkTitle,
    })
    .select('id')
    .single();

  if (error) {
    await removeImages(client, images);
    return json({ error: error.message }, 500);
  }

  return json({ id: data.id }, 201);
};
