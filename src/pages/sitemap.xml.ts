import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { db } from '../services/db';

// Danh sách các trang tĩnh (không yêu cầu đăng nhập & public)
const STATIC_PAGES = [
  { url: '/',         changefreq: 'daily',   priority: '1.0' },
  { url: '/ly-thuyet', changefreq: 'weekly',  priority: '0.8' },
  { url: '/about',    changefreq: 'monthly', priority: '0.6' },
  { url: '/guide',    changefreq: 'monthly', priority: '0.6' },
  { url: '/contact',  changefreq: 'monthly', priority: '0.5' },
  { url: '/privacy',  changefreq: 'yearly',  priority: '0.3' },
  { url: '/sitemap',  changefreq: 'monthly', priority: '0.3' },
];

export const GET: APIRoute = async ({ request }) => {
  // Lấy base URL từ request header hoặc dùng mặc định
  const origin = new URL(request.url).origin;

  // Lấy dữ liệu động song song
  const [subjects, exams, lessonEntries] = await Promise.all([
    db.getSubjects(),
    db.getExams(),
    getCollection('lessons'),
  ]);

  const now = new Date().toISOString();

  // Build XML
  const urls: string[] = [];

  // ── Trang tĩnh ──────────────────────────────────────────────────────────────
  for (const page of STATIC_PAGES) {
    urls.push(`
  <url>
    <loc>${origin}${page.url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`);
  }

  // ── Môn học (/ly-thuyet/[slug]) ───────────────────────────────────────────────
  for (const subject of subjects) {
    urls.push(`
  <url>
    <loc>${origin}/ly-thuyet/${subject.slug}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.80</priority>
  </url>`);
  }

  // ── Bài học (/[subject]/[slug]) ────────────────────────────────────────────────
  for (const entry of lessonEntries) {
    const slug = entry.id.split('/').pop() || entry.id;
    const lastmod = entry.data.created_at
      ? new Date(entry.data.created_at).toISOString()
      : now;
    urls.push(`
  <url>
    <loc>${origin}/${entry.data.subject}/${slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.75</priority>
  </url>`);
  }

  // ── Đề thi (public info page /exams/[id]) ───────────────────────────────────
  for (const exam of exams) {
    const lastmod = exam.created_at
      ? new Date(exam.created_at).toISOString()
      : now;
    urls.push(`
  <url>
    <loc>${origin}/exams/${exam.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.65</priority>
  </url>`);
  }



  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
    http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd"
>${urls.join('')}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Cache 24h — sitemap không cần index nên loại bỏ X-Robots-Tag: noindex
      'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
};
