import type { APIRoute } from 'astro';
import { getGroupClient, sanitizeClassId } from '../../../../services/groupChat';
import { json, requireMember } from './_shared';

export const prerender = false;

// GET /api/nhom/groups
export const GET: APIRoute = async (ctx) => {
  const auth = requireMember(ctx);
  if ('error' in auth) return auth.error;

  try {
    const { data, error } = await auth.client
      .from('chat_groups')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) throw new Error(error.message);
    
    // Map data to match GroupClass interface
    const groups = data.map((c: any) => ({
      id: c.id,
      name: c.name,
      grade: c.grade || '',
      members: c.members_count || 0,
      headTeacher: c.head_teacher || '',
      speciality: c.speciality || '',
      color: c.color || '#6366f1',
      initials: c.initials || c.name.substring(0, 2).toUpperCase(),
      isClub: c.is_club || false,
      pinnedNotice: c.pinned_notice || '',
      createdBy: c.created_by
    }));
    
    return json({ groups });
  } catch (err: any) {
    return json({ error: err.message || 'Không tải được danh sách nhóm' }, 500);
  }
};

// POST /api/nhom/groups - Create a new group
export const POST: APIRoute = async (ctx) => {
  const auth = requireMember(ctx);
  if ('error' in auth) return auth.error;
  
  if (auth.user.role !== 'teacher' && auth.user.role !== 'admin') {
    return json({ error: 'Chỉ giáo viên và admin mới được tạo nhóm' }, 403);
  }

  let payload;
  try {
    payload = await ctx.request.json();
  } catch {
    return json({ error: 'Dữ liệu không hợp lệ' }, 400);
  }

  const name = String(payload.name || '').trim();
  if (!name) return json({ error: 'Tên nhóm không được để trống' }, 400);
  
  const speciality = String(payload.speciality || '').trim();
  const color = String(payload.color || '#6366f1').trim();
  const isClub = Boolean(payload.isClub);

  try {
    const { data, error } = await auth.client
      .from('chat_groups')
      .insert({
        name,
        speciality,
        color,
        is_club: isClub,
        created_by: auth.user.id,
        initials: name.substring(0, 2).toUpperCase()
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);
    return json({ id: data.id }, 201);
  } catch (err: any) {
    return json({ error: err.message || 'Lỗi khi tạo nhóm' }, 500);
  }
};
