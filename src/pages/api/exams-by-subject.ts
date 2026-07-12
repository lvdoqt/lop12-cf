import type { APIRoute } from 'astro';
import { db } from '../../services/db';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const subjectSlug = url.searchParams.get('subject_slug');
    if (!subjectSlug) {
      return new Response(JSON.stringify({ error: 'Subject slug is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const subjects = await db.getSubjects();
    const subject = subjects.find(s => s.slug === subjectSlug);
    if (!subject) {
      return new Response(JSON.stringify({ error: 'Subject not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const exams = await db.getExams(subject.id);
    return new Response(JSON.stringify({ exams }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};
