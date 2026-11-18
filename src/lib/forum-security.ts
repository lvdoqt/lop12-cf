/** Tiện ích chống spam nhẹ cho các API viết của diễn đàn. */

/** Honeypot: field ẩn mà người dùng thật không bao giờ điền. */
export function isHoneypotTrapped(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const body = payload as Record<string, unknown>;
  return ['website', 'hp_field', 'confirm_email'].some(
    key => typeof body[key] === 'string' && body[key]!.trim().length > 0
  );
}

type Bucket = { hits: number[] };

const buckets = new Map<string, Bucket>();

/**
 * Rate limit đơn giản theo user (đã đăng nhập) trong bộ nhớ process.
 * Trên Cloudflare mỗi instance có bộ nhớ riêng — đây là lớp đầu tiên,
 * lớp chắc chắn hơn là RLS/quyền + báo cáo của Phase 3.
 */
export function checkForumRateLimit(
  key: string,
  limit = 10,
  windowMs = 60_000,
): { ok: boolean; remaining: number; retryAfter: number } {
  const now = Date.now();
  const bucket = buckets.get(key) || { hits: [] };
  bucket.hits = bucket.hits.filter(t => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket);
    return { ok: false, remaining: 0, retryAfter: Math.ceil((bucket.hits[0] + windowMs - now) / 1000) };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  // Dọn rác định kỳ để Map không phình ra.
  if (buckets.size > 500) {
    for (const [k, v] of buckets) if (v.hits.length === 0) buckets.delete(k);
  }
  return { ok: true, remaining: limit - bucket.hits.length, retryAfter: 0 };
}

/** Tên được @mention trong nội dung (dùng cho mock mode; production dùng RPC SQL). */
export function extractMentionedNames(text: string): string[] {
  const matches = text.match(/@[\p{L}][\p{L}\p{N}_.-]{2,39}/gu) || [];
  return Array.from(new Set(matches.map(m => m.slice(1))));
}
