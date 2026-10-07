// Service cho trang /nhom — lưu bài đăng, bình luận, cảm xúc vào Supabase
// và ảnh đính kèm vào Supabase Storage (bucket `group-images`).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createAdminSupabase, resolveEnv } from '../lib/supabase';

export const GROUP_IMAGES_BUCKET = 'group-images';
export const MAX_IMAGES_PER_POST = 4;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const REACTION_TYPES = ['heart', 'like', 'applause', 'idea', 'question'] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

type Env = Record<string, string | undefined> | undefined;

export interface GroupUser {
  id: string;
  fullname?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  role: 'student' | 'teacher' | 'admin';
}

export interface GroupAuthorDTO {
  id: string;
  name: string;
  avatar: string;
  role: string;
}

export interface GroupCommentDTO {
  id: string;
  author: GroupAuthorDTO;
  body: string;
  createdAt: string;
}

export interface GroupPostDTO {
  id: string;
  classId: string;
  author: GroupAuthorDTO;
  tag: string;
  body: string;
  images: string[];
  link: { url: string; title: string } | null;
  pinned: boolean;
  createdAt: string;
  reactions: Record<ReactionType, number>;
  userReaction: ReactionType | null;
  comments: GroupCommentDTO[];
  canManage: boolean;
}

/**
 * Trả về Supabase client cho thao tác nhóm:
 *  - Ưu tiên service role (bypass RLS, server đã tự kiểm tra quyền).
 *  - Nếu thiếu service key → dùng access token của user để RLS (auth.uid()) hoạt động.
 */
export function getGroupClient(runtimeEnv: Env, accessToken?: string): SupabaseClient {
  const svcKey = resolveEnv('SUPABASE_SERVICE_ROLE_KEY', runtimeEnv);
  if (svcKey && !svcKey.includes('placeholder')) {
    return createAdminSupabase(runtimeEnv);
  }
  const base = createAdminSupabase(runtimeEnv); // falls back to anon client
  if (!accessToken) return base;
  const url = resolveEnv('PUBLIC_SUPABASE_URL', runtimeEnv) || (base as any).supabaseUrl;
  const anonKey = resolveEnv('PUBLIC_SUPABASE_ANON_KEY', runtimeEnv) || (base as any).supabaseKey;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export function isStaff(user: Pick<GroupUser, 'role'> | null | undefined): boolean {
  return user?.role === 'teacher' || user?.role === 'admin';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

export function sanitizeClassId(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const id = v.trim().toLowerCase();
  return /^[a-z0-9-]{1,40}$/.test(id) ? id : null;
}

function roleLabel(role?: string | null): string {
  if (role === 'teacher') return 'Giáo viên';
  if (role === 'admin') return 'Quản trị viên';
  return 'Học sinh';
}

function toAuthor(u: GroupUser | undefined, fallbackId: string): GroupAuthorDTO {
  const name = u?.fullname || u?.email?.split('@')[0] || 'Thành viên';
  return {
    id: u?.id || fallbackId,
    name,
    avatar: u?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(fallbackId)}`,
    role: roleLabel(u?.role),
  };
}

async function fetchUsersMap(client: SupabaseClient, ids: string[]): Promise<Map<string, GroupUser>> {
  const map = new Map<string, GroupUser>();
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) return map;
  const { data } = await client.from('users').select('id, fullname, email, avatar_url, role').in('id', unique);
  (data || []).forEach((u: any) => map.set(u.id, u as GroupUser));
  return map;
}

/** Lấy danh sách bài đăng (kèm bình luận + cảm xúc) của một lớp */
export async function listPosts(
  client: SupabaseClient,
  classId: string,
  currentUser: GroupUser,
  limit = 50
): Promise<GroupPostDTO[]> {
  const { data: posts, error } = await client
    .from('group_posts')
    .select('*')
    .eq('class_id', classId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  if (!posts || posts.length === 0) return [];

  const postIds = posts.map((p: any) => p.id);
  const [{ data: comments }, { data: reactions }] = await Promise.all([
    client.from('group_comments').select('*').in('post_id', postIds).order('created_at', { ascending: true }),
    client.from('group_reactions').select('post_id, user_id, reaction').in('post_id', postIds),
  ]);

  const usersMap = await fetchUsersMap(client, [
    ...posts.map((p: any) => p.user_id),
    ...(comments || []).map((c: any) => c.user_id),
  ]);

  const staff = isStaff(currentUser);

  return posts.map((p: any): GroupPostDTO => {
    const counts: Record<ReactionType, number> = { heart: 0, like: 0, applause: 0, idea: 0, question: 0 };
    let userReaction: ReactionType | null = null;
    (reactions || [])
      .filter((r: any) => r.post_id === p.id)
      .forEach((r: any) => {
        if (r.reaction in counts) counts[r.reaction as ReactionType]++;
        if (r.user_id === currentUser.id) userReaction = r.reaction;
      });

    const images: string[] = Array.isArray(p.images)
      ? p.images.map((img: any) => (typeof img === 'string' ? img : img?.url)).filter(Boolean)
      : [];

    return {
      id: p.id,
      classId: p.class_id,
      author: toAuthor(usersMap.get(p.user_id), p.user_id),
      tag: p.tag,
      body: p.body,
      images,
      link: p.link_url ? { url: p.link_url, title: p.link_title || p.link_url } : null,
      pinned: !!p.pinned,
      createdAt: p.created_at,
      reactions: counts,
      userReaction,
      comments: (comments || [])
        .filter((c: any) => c.post_id === p.id)
        .map((c: any) => ({
          id: c.id,
          author: toAuthor(usersMap.get(c.user_id), c.user_id),
          body: c.body,
          createdAt: c.created_at,
        })),
      canManage: staff || p.user_id === currentUser.id,
    };
  });
}

/** Upload ảnh lên Supabase Storage, trả về [{ url, path }] */
export async function uploadImages(
  client: SupabaseClient,
  userId: string,
  classId: string,
  files: File[]
): Promise<{ url: string; path: string }[]> {
  const uploaded: { url: string; path: string }[] = [];
  for (const file of files.slice(0, MAX_IMAGES_PER_POST)) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      throw new Error(`Định dạng ảnh không hỗ trợ: ${file.type || 'không rõ'}`);
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error(`Ảnh "${file.name}" vượt quá 5MB`);
    }
    const ext = (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const path = `${userId}/${classId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const { error } = await client.storage
      .from(GROUP_IMAGES_BUCKET)
      .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false, cacheControl: '31536000' });
    if (error) {
      // Dọn ảnh đã upload nếu lỗi giữa chừng
      if (uploaded.length) await client.storage.from(GROUP_IMAGES_BUCKET).remove(uploaded.map(u => u.path));
      throw new Error(`Upload ảnh thất bại: ${error.message}`);
    }
    const { data } = client.storage.from(GROUP_IMAGES_BUCKET).getPublicUrl(path);
    uploaded.push({ url: data.publicUrl, path });
  }
  return uploaded;
}

export async function removeImages(client: SupabaseClient, images: any[]): Promise<void> {
  const paths = (images || []).map((i: any) => i?.path).filter(Boolean);
  if (paths.length) await client.storage.from(GROUP_IMAGES_BUCKET).remove(paths);
}

/** Danh sách thành viên đã đăng ký qua Supabase */
export async function listMembers(client: SupabaseClient, limit = 200): Promise<GroupAuthorDTO[]> {
  const { data, error } = await client
    .from('users')
    .select('id, fullname, email, avatar_url, role')
    .order('role', { ascending: false })
    .order('fullname', { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []).map((u: any) => toAuthor(u as GroupUser, u.id));
}
