// Helper tập trung để xử lý base path (ví dụ: '/lms') cho cả SSR và client.
// Khi cấu hình `base` trong astro.config.mjs, Astro KHÔNG tự động thêm base
// vào thẻ <a href>, fetch, redirect... nên ta phải thêm thủ công.

// '/lms' (không có dấu gạch chéo cuối, lấy từ Vite env)
export const BASE = import.meta.env.BASE_URL;

// Thêm base vào một đường dẫn tuyệt đối nội bộ (bắt đầu bằng '/').
// Trả về nguyên bản nếu đã có base, là URL ngoài, hoặc relative.
export function withBase(path: string): string {
  if (!path) return path;
  const base = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE;
  if (!base) return path;
  if (path.startsWith('/') && !path.startsWith('//') && !path.startsWith(base + '/')) {
    return base + path;
  }
  return path;
}
