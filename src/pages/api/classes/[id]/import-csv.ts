import type { APIRoute } from 'astro';
import { db } from '../../../../services/db';

export const prerender = false;

/**
 * POST /api/classes/[id]/import-csv
 * Body: multipart/form-data with field "file" (CSV)
 * CSV format: email,fullname (header row ignored)
 */
export const POST: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return new Response(JSON.stringify({ error: 'Không có file CSV.' }), { status: 400 });

    const text = await file.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // Detect and skip header row
    const rows: { email: string }[] = [];
    let isFirst = true;
    for (const line of lines) {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const emailCol = cols[0]?.toLowerCase();
      // Skip header row
      if (isFirst && (emailCol === 'email' || emailCol === 'e-mail' || !emailCol.includes('@'))) {
        isFirst = false;
        continue;
      }
      isFirst = false;
      if (cols[0]) rows.push({ email: cols[0] });
    }

    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: 'File CSV không có dữ liệu hợp lệ.' }), { status: 400 });
    }

    const result = await db.importClassMembersCSV(params.id!, rows);
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
