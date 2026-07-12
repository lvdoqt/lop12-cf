import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const catId = url.searchParams.get('cat') || 'all';
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const perPage = parseInt(url.searchParams.get('per_page') || '100', 10);

  const wpApiUrl = import.meta.env.WORDPRESS_API_URL || '';

  if (!wpApiUrl) {
    return new Response(JSON.stringify({ posts: [], total: 0 }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    let apiUrl: string;
    if (catId === 'all') {
      apiUrl = `${wpApiUrl}/posts?_embed=1&per_page=${perPage}&page=${page}`;
    } else {
      apiUrl = `${wpApiUrl}/posts?_embed=1&categories=${catId}&per_page=${perPage}&page=${page}`;
    }

    const response = await fetch(apiUrl);
    if (!response.ok) {
      return new Response(JSON.stringify({ posts: [], total: 0 }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const totalHeader = response.headers.get('X-WP-Total') || '0';
    const total = parseInt(totalHeader, 10);
    const posts = await response.json();

    if (!Array.isArray(posts)) {
      return new Response(JSON.stringify({ posts: [], total: 0 }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const mapped = posts.map((post: any) => {
      const featuredMedia = post._embedded?.['wp:featuredmedia']?.[0];
      const cover_url = featuredMedia?.source_url || featuredMedia?.media_details?.sizes?.medium?.source_url || null;
      let summary = post.excerpt?.rendered || '';
      summary = summary.replace(/<\/?[^>]+(>|$)/g, '').trim();

      return {
        id: String(post.id),
        title: post.title?.rendered || '',
        slug: post.slug || '',
        summary: summary || null,
        cover_url,
        created_at: post.date || new Date().toISOString(),
        categories: post.categories || []
      };
    });

    return new Response(JSON.stringify({ posts: mapped, total }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('by-category API error:', err);
    return new Response(JSON.stringify({ posts: [], total: 0 }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
