// Helper tập trung để xử lý base path (ví dụ: '/lms') cho cả SSR và client.
// Khi cấu hình `base` trong astro.config.mjs, Astro KHÔNG tự động thêm base
// vào thẻ <a href>, fetch, redirect... nên ta phải thêm thủ công.

// Base path chuẩn hóa không có dấu gạch chéo cuối, ví dụ '/lms' (hoặc '' nếu ở root)
export const BASE = (import.meta.env.BASE_URL || '').replace(/\/+$/, '');

// Thêm base vào một đường dẫn tuyệt đối nội bộ (bắt đầu bằng '/').
// Trả về nguyên bản nếu đã có base, là URL ngoài, hoặc relative.
export function withBase(path: string): string {
  if (!path) return path;
  const base = BASE;
  if (!base) return path;

  // Handle absolute URL on same domain (lop12.com, localhost...)
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const u = new URL(path);
      if (u.hostname === 'lop12.com' || u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
        if (u.pathname === base || u.pathname.startsWith(base + '/')) {
          return path;
        }
        u.pathname = base + u.pathname;
        return u.toString();
      }
      return path;
    } catch {
      return path;
    }
  }

  // Handle path starting with base already
  if (path === base || path.startsWith(base + '/')) {
    return path;
  }

  // Handle internal absolute path
  if (path.startsWith('/') && !path.startsWith('//')) {
    return base + path;
  }

  return path;
}
