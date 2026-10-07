import type { APIRoute } from 'astro';
import {
  getNopBaiAdminClient,
  getStudentSubmissionCount,
} from '../../../services/nopBai';

export const prerender = false;

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/nop-bai/check-count?studentName=...&className=...
export const GET: APIRoute = async (ctx) => {
  try {
    const studentName = ctx.url.searchParams.get('studentName') || '';
    const className = ctx.url.searchParams.get('className') || '';

    if (!studentName || !className) {
      return json({ count: 0 });
    }

    const runtimeEnv = (ctx.locals as any)?.runtimeEnv;
    const client = getNopBaiAdminClient(runtimeEnv);

    const count = await getStudentSubmissionCount(client, studentName, className);
    return json({ count });
  } catch (error: any) {
    return json({ count: 0, error: error.message });
  }
};
