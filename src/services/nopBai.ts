import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminSupabase, resolveEnv } from '../lib/supabase';

export const NOP_BAI_BUCKET = 'nop-bai';
export const FALLBACK_BUCKET = 'group-images';
export const MAX_IMAGES_PER_SUBMISSION = 10;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export interface NopBaiClass {
  id: string;
  name: string;        // e.g. "12A4", "11A8"
  grade?: string;      // e.g. "12", "11"
  speciality?: string; // e.g. "KHTN & Tin Học"
  color?: string;      // e.g. "#4f46e5"
  initials?: string;   // e.g. "12"
  pinnedNotice?: string; // Hướng dẫn / Đề bài nộp
  createdAt?: string;
  createdBy?: string | null;     // ID giáo viên tạo lớp
  createdByName?: string | null; // Tên giáo viên tạo lớp
}

export interface NopBaiImage {
  url: string;
  name?: string;
  path?: string;
}

export interface NopBaiSubmission {
  id: string;
  studentName: string;
  className: string;
  content: string;
  images: NopBaiImage[];
  submissionCount: number;
  createdAt: string;
  userId?: string | null;
}

// In-memory fallback cache for submissions in dev/offline mode
const memorySubmissions: NopBaiSubmission[] = [];

// In-memory fallback cache for classes created in dev/offline mode
const memoryClasses: NopBaiClass[] = [];

// Seed default classes if database is empty
export const DEFAULT_CLASSES: NopBaiClass[] = [
  { id: 'c-12a4', name: '12A4', grade: '12', speciality: 'KHTN & Tin Học', color: '#4f46e5', initials: '12A4', pinnedNotice: 'Nộp bài tập Toán, Lí, Hoá và bài tập tuần tại đây.' },
  { id: 'c-11a8', name: '11A8', grade: '11', speciality: 'Khoa học Xã hội', color: '#059669', initials: '11A8', pinnedNotice: 'Nộp bài tập Ngữ văn, Lịch sử và Ngoại ngữ.' },
  { id: 'c-12a1', name: '12A1', grade: '12', speciality: 'Toán - Tin Chuyên sâu', color: '#2563eb', initials: '12A1', pinnedNotice: 'Hạn nộp bài trước 22h Chủ Nhật hàng tuần.' },
  { id: 'c-12a2', name: '12A2', grade: '12', speciality: 'Toán - Anh', color: '#7c3aed', initials: '12A2', pinnedNotice: 'Chụp rõ ảnh bài làm hoặc dán ảnh chụp màn hình.' },
  { id: 'c-10a1', name: '10A1', grade: '10', speciality: 'Khối cơ bản', color: '#ea580c', initials: '10A1', pinnedNotice: 'Các em nộp bài tập về nhà theo đúng hạn.' },
];

/** Tạo Supabase client sử dụng service role key để có toàn quyền ghi */
export function getNopBaiAdminClient(runtimeEnv?: Record<string, string | undefined>): SupabaseClient {
  return createAdminSupabase(runtimeEnv);
}

/** Transliterate tiếng Việt sang không dấu đơn giản cho file path */
function simpleSlug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'hs';
}

/** Lấy danh sách lớp học từ Supabase `chat_groups` */
export async function getClasses(
  client: SupabaseClient,
  options?: { teacherId?: string; isAdmin?: boolean }
): Promise<NopBaiClass[]> {
  try {
    let query = client
      .from('chat_groups')
      .select('id, name, grade, speciality, color, initials, pinned_notice, created_at, created_by')
      .order('grade', { ascending: false })
      .order('name', { ascending: true });

    if (options?.teacherId && !options?.isAdmin) {
      query = query.eq('created_by', options.teacherId);
    }

    const { data, error } = await query;

    if (!error && Array.isArray(data)) {
      const dbClasses: NopBaiClass[] = data.map((g: any) => ({
        id: g.id,
        name: g.name,
        grade: g.grade || '',
        speciality: g.speciality || '',
        color: g.color || '#4f46e5',
        initials: g.initials || g.name,
        pinnedNotice: g.pinned_notice || '',
        createdAt: g.created_at,
        createdBy: g.created_by || null,
      }));

      // Hợp nhất memoryClasses
      let combined = [...dbClasses];
      for (const mc of memoryClasses) {
        if (!combined.some(c => c.id === mc.id || c.name.toLowerCase() === mc.name.toLowerCase())) {
          if (options?.teacherId && !options?.isAdmin && mc.createdBy !== options.teacherId) {
            continue;
          }
          combined.push(mc);
        }
      }

      // Nếu giáo viên lọc theo teacherId, chỉ trả về đúng các lớp của giáo viên đó
      if (options?.teacherId && !options?.isAdmin) {
        return combined.filter(c => c.createdBy === options.teacherId);
      }

      if (combined.length > 0) {
        return combined;
      }
    }
  } catch (err) {
    console.warn('[getClasses] Error fetching chat_groups:', err);
  }

  // Fallback memory
  if (options?.teacherId && !options?.isAdmin) {
    return memoryClasses.filter(c => c.createdBy === options.teacherId);
  }

  // Admin hoặc xem chung: kết hợp memoryClasses và DEFAULT_CLASSES
  const defaultList = [...memoryClasses];
  for (const d of DEFAULT_CLASSES) {
    if (!defaultList.some(c => c.id === d.id || c.name.toLowerCase() === d.name.toLowerCase())) {
      defaultList.push(d);
    }
  }
  return defaultList;
}

/** Lấy thông tin 1 lớp theo ID */
export async function getClassById(client: SupabaseClient, id: string): Promise<NopBaiClass | null> {
  try {
    const { data, error } = await client
      .from('chat_groups')
      .select('id, name, grade, speciality, color, initials, pinned_notice, created_at, created_by')
      .eq('id', id)
      .maybeSingle();

    if (!error && data) {
      return {
        id: data.id,
        name: data.name,
        grade: data.grade || '',
        speciality: data.speciality || '',
        color: data.color || '#4f46e5',
        initials: data.initials || data.name,
        pinnedNotice: data.pinned_notice || '',
        createdAt: data.created_at,
        createdBy: data.created_by || null,
      };
    }
  } catch (e) {}

  const mem = memoryClasses.find(c => c.id === id);
  if (mem) return mem;

  const def = DEFAULT_CLASSES.find(c => c.id === id);
  if (def) return def;

  return null;
}

/** Tạo lớp học mới (Admin/Teacher) */
export async function createClass(
  client: SupabaseClient,
  payload: { name: string; grade?: string; speciality?: string; color?: string; pinnedNotice?: string; userId?: string | null; userName?: string | null }
): Promise<NopBaiClass> {
  const name = payload.name.trim();
  if (!name) throw new Error('Tên lớp không được để trống');

  const grade = (payload.grade || name.replace(/[^0-9]/g, '').slice(0, 2) || '12').trim();
  const speciality = (payload.speciality || '').trim();
  const color = (payload.color || '#4f46e5').trim();
  const pinnedNotice = (payload.pinnedNotice || '').trim();
  const initials = name.slice(0, 4).toUpperCase();
  const nowIso = new Date().toISOString();
  const newId = crypto.randomUUID();

  try {
    const { data, error } = await client
      .from('chat_groups')
      .insert({
        name,
        grade,
        speciality,
        color,
        initials,
        pinned_notice: pinnedNotice,
        is_club: false,
        created_by: payload.userId || null,
      })
      .select('id, name, grade, speciality, color, initials, pinned_notice, created_at, created_by')
      .single();

    if (!error && data) {
      const cls: NopBaiClass = {
        id: data.id,
        name: data.name,
        grade: data.grade,
        speciality: data.speciality,
        color: data.color,
        initials: data.initials,
        pinnedNotice: data.pinned_notice,
        createdAt: data.created_at,
        createdBy: data.created_by || payload.userId || null,
        createdByName: payload.userName || null,
      };
      memoryClasses.push(cls);
      return cls;
    }
  } catch (err) {
    console.warn('[createClass] DB insert error, using memory fallback:', err);
  }

  const memClass: NopBaiClass = {
    id: newId,
    name,
    grade,
    speciality,
    color,
    initials,
    pinnedNotice,
    createdAt: nowIso,
    createdBy: payload.userId || null,
    createdByName: payload.userName || null,
  };
  memoryClasses.push(memClass);
  return memClass;
}

/** Cập nhật thông tin lớp học (chỉ người tạo hoặc Admin) */
export async function updateClass(
  client: SupabaseClient,
  id: string,
  payload: { name: string; grade?: string; speciality?: string; color?: string; pinnedNotice?: string },
  requestingUser?: { id: string; role: string }
): Promise<void> {
  const name = payload.name.trim();
  if (!name) throw new Error('Tên lớp không được để trống');

  // Kiểm tra quyền: Giáo viên chỉ được sửa lớp do mình tạo, Admin sửa tất cả
  if (requestingUser && requestingUser.role !== 'admin') {
    const targetClass = await getClassById(client, id);
    if (!targetClass || targetClass.createdBy !== requestingUser.id) {
      throw new Error('Bạn không có quyền chỉnh sửa lớp của giáo viên khác');
    }
  }

  const initials = name.slice(0, 4).toUpperCase();
  const grade = (payload.grade || name.replace(/[^0-9]/g, '').slice(0, 2) || '12').trim();

  // Update in memory if present
  const memIdx = memoryClasses.findIndex(c => c.id === id);
  if (memIdx !== -1) {
    memoryClasses[memIdx] = {
      ...memoryClasses[memIdx],
      name,
      grade,
      initials,
      speciality: payload.speciality?.trim() || '',
      color: payload.color?.trim() || '#4f46e5',
      pinnedNotice: payload.pinnedNotice?.trim() || '',
    };
  }

  // Nếu id là id mặc định (bắt đầu bằng c-), kiểm tra xem trong database đã có lớp chưa
  if (id.startsWith('c-')) {
    const { data: existing } = await client.from('chat_groups').select('id').eq('name', name).maybeSingle();
    if (existing) {
      id = existing.id;
    } else {
      const { error: insErr } = await client.from('chat_groups').insert({
        name,
        grade,
        initials,
        speciality: payload.speciality?.trim() || '',
        color: payload.color?.trim() || '#4f46e5',
        pinned_notice: payload.pinnedNotice?.trim() || '',
        is_club: false,
      });
      if (insErr) throw new Error(`Lỗi lưu lớp: ${insErr.message}`);
      return;
    }
  }

  const { error } = await client
    .from('chat_groups')
    .update({
      name,
      grade,
      initials,
      speciality: payload.speciality?.trim(),
      color: payload.color?.trim(),
      pinned_notice: payload.pinnedNotice?.trim(),
    })
    .eq('id', id);

  if (error && memIdx === -1) throw new Error(`Lỗi cập nhật lớp: ${error.message}`);
}

/** Xóa lớp học (chỉ người tạo hoặc Admin) */
export async function deleteClass(
  client: SupabaseClient,
  id: string,
  requestingUser?: { id: string; role: string }
): Promise<void> {
  // Kiểm tra quyền: Giáo viên chỉ được xóa lớp do mình tạo, Admin xóa tất cả
  if (requestingUser && requestingUser.role !== 'admin') {
    const targetClass = await getClassById(client, id);
    if (!targetClass || targetClass.createdBy !== requestingUser.id) {
      throw new Error('Bạn không có quyền xóa lớp của giáo viên khác');
    }
  }

  // Xóa khỏi memory
  const memIdx = memoryClasses.findIndex(c => c.id === id);
  if (memIdx !== -1) memoryClasses.splice(memIdx, 1);

  const { error } = await client.from('chat_groups').delete().eq('id', id);
  if (error && memIdx === -1) throw new Error(`Lỗi xóa lớp: ${error.message}`);
}

/** Upload ảnh lên Supabase Storage bucket `nop-bai` */
export async function uploadSubmissionImages(
  client: SupabaseClient,
  files: Array<{ name: string; type: string; buffer: ArrayBuffer }>,
  className: string,
  studentName: string
): Promise<NopBaiImage[]> {
  const uploaded: NopBaiImage[] = [];
  const safeClass = simpleSlug(className);
  const safeStudent = simpleSlug(studentName);
  const now = Date.now();

  for (let i = 0; i < files.length && i < MAX_IMAGES_PER_SUBMISSION; i++) {
    const f = files[i];
    const mime = f.type || 'image/jpeg';
    const ext = (mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg').replace('svg+xml', 'svg');
    const fileName = `${now}-${i + 1}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const storagePath = `${safeClass}/${safeStudent}/${fileName}`;

    let bucketToUse = NOP_BAI_BUCKET;
    let uploadRes = await client.storage
      .from(bucketToUse)
      .upload(storagePath, f.buffer, {
        contentType: mime,
        upsert: true,
        cacheControl: '31536000',
      });

    // Nếu lỗi bucket nop-bai, thử fallback sang group-images
    if (uploadRes.error && uploadRes.error.message?.includes('Bucket not found')) {
      bucketToUse = FALLBACK_BUCKET;
      uploadRes = await client.storage
        .from(bucketToUse)
        .upload(storagePath, f.buffer, {
          contentType: mime,
          upsert: true,
          cacheControl: '31536000',
        });
    }

    if (uploadRes.error) {
      console.error('[uploadSubmissionImages] error:', uploadRes.error);
      throw new Error(`Tải ảnh "${f.name || 'ảnh'}" lên Supabase thất bại: ${uploadRes.error.message}`);
    }

    const { data: urlData } = client.storage.from(bucketToUse).getPublicUrl(storagePath);
    uploaded.push({
      url: urlData.publicUrl,
      name: f.name || `Ảnh ${i + 1}`,
      path: storagePath,
    });
  }

  return uploaded;
}

/** Đếm số lần học sinh đã nộp cho lớp này */
export async function getStudentSubmissionCount(
  client: SupabaseClient,
  studentName: string,
  className: string
): Promise<number> {
  const trimmedName = studentName.trim();
  const trimmedClass = className.trim();
  if (!trimmedName || !trimmedClass) return 0;

  // 1. Thử bảng `nop_bai_submissions`
  try {
    const { count, error } = await client
      .from('nop_bai_submissions')
      .select('id', { count: 'exact', head: true })
      .ilike('student_name', trimmedName)
      .ilike('class_name', trimmedClass);

    if (!error && typeof count === 'number') {
      return count;
    }
  } catch (err) {
    // Bỏ qua nếu bảng chưa tồn tại
  }

  // 2. Fallback: đếm từ `group_posts`
  try {
    const { data, error } = await client
      .from('group_posts')
      .select('id, body')
      .eq('class_id', trimmedClass)
      .eq('tag', '📝 Nộp bài');

    if (!error && Array.isArray(data)) {
      let matchingCount = 0;
      for (const item of data) {
        try {
          const parsed = JSON.parse(item.body);
          if (parsed && typeof parsed.student_name === 'string') {
            if (parsed.student_name.trim().toLowerCase() === trimmedName.toLowerCase()) {
              matchingCount++;
            }
          }
        } catch {
          if (item.body.toLowerCase().includes(trimmedName.toLowerCase())) {
            matchingCount++;
          }
        }
      }
      return matchingCount;
    }
  } catch (err) {
    // Bỏ qua
  }

  // 3. Fallback memory cache
  const inMem = memorySubmissions.filter(
    (s) =>
      s.studentName.trim().toLowerCase() === trimmedName.toLowerCase() &&
      s.className.trim().toLowerCase() === trimmedClass.toLowerCase()
  );
  return inMem.length;
}

/** Lưu bài nộp vào Supabase và ghi nhận số lần nộp */
export async function submitAssignment(
  client: SupabaseClient,
  payload: {
    studentName: string;
    className: string;
    content: string;
    images?: NopBaiImage[];
    userId?: string | null;
  }
): Promise<{ id: string; submissionCount: number; createdAt: string }> {
  const studentName = payload.studentName.trim();
  const className = payload.className.trim();
  const content = payload.content.trim();
  const images = payload.images || [];

  if (!studentName) throw new Error('Vui lòng nhập Họ và tên');
  if (!className) throw new Error('Vui lòng nhập hoặc chọn Lớp');
  if (!content && images.length === 0) {
    throw new Error('Vui lòng viết nội dung bài làm hoặc dán ảnh bài nộp');
  }

  // Tính số lần nộp trước đó + 1
  const prevCount = await getStudentSubmissionCount(client, studentName, className);
  const currentSubmissionCount = prevCount + 1;
  const nowIso = new Date().toISOString();

  // 1. Cố gắng ghi vào bảng `nop_bai_submissions`
  try {
    const { data, error } = await client
      .from('nop_bai_submissions')
      .insert({
        student_name: studentName,
        class_name: className,
        content,
        images,
        submission_count: currentSubmissionCount,
        user_id: payload.userId || null,
        created_at: nowIso,
      })
      .select('id, created_at')
      .single();

    if (!error && data) {
      // Lưu vào cache
      memorySubmissions.unshift({
        id: data.id,
        studentName,
        className,
        content,
        images,
        submissionCount: currentSubmissionCount,
        createdAt: data.created_at || nowIso,
        userId: payload.userId,
      });

      return {
        id: data.id,
        submissionCount: currentSubmissionCount,
        createdAt: data.created_at || nowIso,
      };
    }
  } catch (err) {
    console.warn('[submitAssignment] nop_bai_submissions insert error, trying fallback:', err);
  }

  // 2. Fallback: lưu vào bảng `group_posts` trong Supabase
  const fallbackId = crypto.randomUUID();
  try {
    const defaultUserId = payload.userId || '54b49693-33cd-42cb-8357-cce3c9fca8a4';
    const payloadBody = JSON.stringify({
      student_name: studentName,
      class_name: className,
      content,
      submission_count: currentSubmissionCount,
      sub_id: fallbackId,
    });

    const { data: postData, error: postErr } = await client
      .from('group_posts')
      .insert({
        class_id: className,
        user_id: defaultUserId,
        tag: '📝 Nộp bài',
        body: payloadBody,
        images,
        created_at: nowIso,
      })
      .select('id, created_at')
      .single();

    if (!postErr && postData) {
      const resultId = postData.id || fallbackId;
      memorySubmissions.unshift({
        id: resultId,
        studentName,
        className,
        content,
        images,
        submissionCount: currentSubmissionCount,
        createdAt: postData.created_at || nowIso,
        userId: payload.userId,
      });

      return {
        id: resultId,
        submissionCount: currentSubmissionCount,
        createdAt: postData.created_at || nowIso,
      };
    }
  } catch (err) {
    console.warn('[submitAssignment] group_posts fallback failed:', err);
  }

  // 3. Fallback memory
  memorySubmissions.unshift({
    id: fallbackId,
    studentName,
    className,
    content,
    images,
    submissionCount: currentSubmissionCount,
    createdAt: nowIso,
    userId: payload.userId,
  });

  return {
    id: fallbackId,
    submissionCount: currentSubmissionCount,
    createdAt: nowIso,
  };
}

/** Lấy danh sách bài nộp từ Supabase (Admin/Teacher) */
export async function listSubmissions(
  client: SupabaseClient,
  filter?: { className?: string; search?: string; allowedClassNames?: string[] }
): Promise<NopBaiSubmission[]> {
  // Nếu giáo viên có allowedClassNames và mảng rỗng (chưa tạo lớp nào)
  if (filter?.allowedClassNames && filter.allowedClassNames.length === 0) {
    return [];
  }

  const result: NopBaiSubmission[] = [];
  const filterClass = filter?.className?.trim();
  const search = filter?.search?.trim().toLowerCase();

  // 1. Thử lấy từ `nop_bai_submissions`
  try {
    let query = client
      .from('nop_bai_submissions')
      .select('id, student_name, class_name, content, images, submission_count, created_at, user_id')
      .order('created_at', { ascending: false });

    if (filterClass && filterClass !== 'all') {
      query = query.ilike('class_name', filterClass);
    } else if (filter?.allowedClassNames && filter.allowedClassNames.length > 0) {
      query = query.in('class_name', filter.allowedClassNames);
    }

    if (search) {
      query = query.or(`student_name.ilike.%${search}%,content.ilike.%${search}%`);
    }

    const { data, error } = await query.limit(200);

    if (!error && Array.isArray(data) && data.length > 0) {
      for (const item of data) {
        if (filter?.allowedClassNames && filter.allowedClassNames.length > 0) {
          if (!filter.allowedClassNames.some(c => c.toLowerCase() === (item.class_name || '').toLowerCase())) {
            continue;
          }
        }
        result.push({
          id: item.id,
          studentName: item.student_name,
          className: item.class_name,
          content: item.content || '',
          images: Array.isArray(item.images) ? item.images : [],
          submissionCount: Number(item.submission_count) || 1,
          createdAt: item.created_at,
          userId: item.user_id,
        });
      }
      return result;
    }
  } catch (err) {
    // Không có bảng nop_bai_submissions, tiếp tục fallback
  }

  // 2. Thử lấy từ `group_posts`
  try {
    let postQuery = client
      .from('group_posts')
      .select('id, class_id, body, images, created_at, user_id')
      .eq('tag', '📝 Nộp bài')
      .order('created_at', { ascending: false });

    if (filterClass && filterClass !== 'all') {
      postQuery = postQuery.eq('class_id', filterClass);
    } else if (filter?.allowedClassNames && filter.allowedClassNames.length > 0) {
      postQuery = postQuery.in('class_id', filter.allowedClassNames);
    }

    const { data: posts, error: postErr } = await postQuery.limit(200);

    if (!postErr && Array.isArray(posts) && posts.length > 0) {
      for (const p of posts) {
        let studentName = 'Học sinh';
        let className = p.class_id;
        let content = '';
        let submissionCount = 1;

        try {
          const parsed = JSON.parse(p.body);
          if (parsed && typeof parsed === 'object') {
            studentName = parsed.student_name || studentName;
            className = parsed.class_name || className;
            content = parsed.content || '';
            submissionCount = Number(parsed.submission_count) || 1;
          }
        } catch {
          content = p.body;
        }

        if (filter?.allowedClassNames && filter.allowedClassNames.length > 0) {
          if (!filter.allowedClassNames.some(c => c.toLowerCase() === className.toLowerCase())) {
            continue;
          }
        }

        if (search) {
          const text = (studentName + ' ' + content + ' ' + className).toLowerCase();
          if (!text.includes(search)) continue;
        }

        result.push({
          id: p.id,
          studentName,
          className,
          content,
          images: Array.isArray(p.images) ? p.images : [],
          submissionCount,
          createdAt: p.created_at,
          userId: p.user_id,
        });
      }
    }
  } catch (err) {
    console.warn('[listSubmissions] group_posts query error:', err);
  }

  // 3. Hợp nhất thêm dữ liệu từ bộ nhớ nếu có
  if (memorySubmissions.length > 0) {
    const existingIds = new Set(result.map((r) => r.id));
    for (const mem of memorySubmissions) {
      if (!existingIds.has(mem.id)) {
        if (filter?.allowedClassNames && filter.allowedClassNames.length > 0) {
          if (!filter.allowedClassNames.some(c => c.toLowerCase() === mem.className.toLowerCase())) {
            continue;
          }
        }
        if (filterClass && filterClass !== 'all' && mem.className.toLowerCase() !== filterClass.toLowerCase()) {
          continue;
        }
        if (search) {
          const text = (mem.studentName + ' ' + mem.content + ' ' + mem.className).toLowerCase();
          if (!text.includes(search)) continue;
        }
        result.push(mem);
      }
    }
  }

  return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Xóa bài nộp (Admin/Teacher) */
export async function deleteSubmission(
  client: SupabaseClient,
  id: string,
  requestingUser?: { id: string; role: string; allowedClassNames?: string[] }
): Promise<void> {
  // Giáo viên chỉ được xóa bài nộp của lớp do mình quản lý
  if (requestingUser && requestingUser.role !== 'admin' && requestingUser.allowedClassNames) {
    let subClassName: string | null = null;
    const memSub = memorySubmissions.find(s => s.id === id);
    if (memSub) {
      subClassName = memSub.className;
    } else {
      try {
        const { data } = await client.from('nop_bai_submissions').select('class_name').eq('id', id).maybeSingle();
        if (data) subClassName = data.class_name;
      } catch (e) {}
    }

    if (subClassName) {
      const allowed = requestingUser.allowedClassNames.some(
        c => c.toLowerCase() === subClassName!.toLowerCase()
      );
      if (!allowed) {
        throw new Error('Bạn không có quyền xóa bài nộp của lớp khác');
      }
    }
  }

  // 1. Thử xóa ở `nop_bai_submissions`
  await client.from('nop_bai_submissions').delete().eq('id', id);

  // 2. Thử xóa ở `group_posts`
  await client.from('group_posts').delete().eq('id', id);

  // 3. Xóa ở bộ nhớ cache
  const idx = memorySubmissions.findIndex((s) => s.id === id);
  if (idx !== -1) memorySubmissions.splice(idx, 1);
}
