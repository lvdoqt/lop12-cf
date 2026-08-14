import type { APIRoute } from 'astro';
import { db } from '../services/db';

export const GET: APIRoute = async ({ request }) => {
  const origin = new URL(request.url).origin;
  const base = import.meta.env.BASE_URL; // '/lms'

  // Escape ký tự đặc biệt XML
  const escapeXml = (text: string): string =>
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const buildDate = new Date().toUTCString();





  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
>
  <channel>
    <title>Lớp 12 LMS - Bí kíp học tập &amp; Tin tức Giáo dục</title>
    <link>${origin}${base}</link>
    <description>Cập nhật nhanh các thông báo tuyển sinh, cấu trúc đề thi tham khảo THPT và phương pháp giải nhanh trắc nghiệm đạt điểm cao.</description>
    <language>vi</language>
    <managingEditor>admin@lop12.vn (Lớp 12 LMS)</managingEditor>
    <webMaster>admin@lop12.vn (Lớp 12 LMS)</webMaster>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <ttl>60</ttl>
    <image>
      <url>${origin}${base}/favicon.svg</url>
      <title>Lớp 12 LMS</title>
      <link>${origin}${base}</link>
    </image>
    <atom:link href="${origin}${base}/rss.xml" rel="self" type="application/rss+xml"/>
${(await Promise.all([
    db.getExams().then(exams => exams.map(e => ({
      title: `[Đề thi] ${escapeXml(e.title)}`,
      link: `${origin}${base}/exams/${e.slug}`,
      pubDate: new Date(e.created_at).toUTCString(),
      description: escapeXml(e.title),
      guid: `exam-${e.id}`
    }))),
    db.getCourses().then(courses => courses.map(c => ({
      title: `[Khóa học] ${escapeXml(c.title)}`,
      link: `${origin}${base}/khoa-hoc/${c.slug}`,
      pubDate: new Date(c.created_at).toUTCString(),
      description: escapeXml(c.description || c.title),
      guid: `course-${c.id}`
    })))
  ])).flat().sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .map(item => `    <item>
      <title>${item.title}</title>
      <link>${item.link}</link>
      <description>${item.description}</description>
      <pubDate>${item.pubDate}</pubDate>
      <guid isPermaLink="false">${item.guid}</guid>
    </item>`).join('\n')}
  </channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800, s-maxage=1800',
    },
  });
};
