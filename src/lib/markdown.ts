import { marked } from 'marked';

// Chuyển Markdown + công thức LaTeX thành HTML để render bằng dangerouslySetInnerHTML.
// LaTeX ($...$, $$...$$, \(...\), \[...\]) được tách riêng để KaTeX render sau khi mount.
export function parseMarkdownWithMath(text: string = '', isInline = false): string {
  if (!text) return '';
  const mathBlocks: string[] = [];
  let index = 0;
  const mathRegex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^$\n]*?\$)/g;

  const textWithoutMath = text.replace(mathRegex, (match) => {
    mathBlocks.push(match);
    return `@@MATH_BLOCK_${index++}@@`;
  });

  let html = (isInline ? marked.parseInline(textWithoutMath) : marked.parse(textWithoutMath)) as string;

  mathBlocks.forEach((block, i) => {
    html = html.replace(`@@MATH_BLOCK_${i}@@`, block);
  });

  return html;
}

// Render lại KaTeX bên trong một element sau khi nội dung HTML thay đổi.
// Hàm này phải chạy ở client (window). Layout đã nạp sẵn KaTeX auto-render.
export function renderMathInContainer(container: HTMLElement | null | undefined): void {
  if (!container || typeof window === 'undefined' || typeof (window as any).renderMathInElement !== 'function') return;
  (window as any).renderMathInElement(container, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false },
      { left: '\\(', right: '\\)', display: false },
      { left: '\\[', right: '\\]', display: true }
    ],
    throwOnError: false
  });
}

// ── Diễn đàn Học sinh ────────────────────────────────────────────────────────
const FORUM_MATH_RE = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^$\n]*?\$)/g;

/**
 * Render Markdown + LaTeX an toàn cho nội dung do người dùng đăng.
 * - Toán được giữ nguyên để KaTeX render.
 * - HTML thô trong source được escape -> không cho phép <script>, onerror=...
 * - Link nguy hiểm (javascript:, data:, vbscript:) bị chặn.
 */
export function renderForumMarkdown(source: string): string {
  if (!source) return '';

  const mathBlocks: string[] = [];
  const withoutMath = source.replace(FORUM_MATH_RE, (block) => {
    const index = mathBlocks.push(block) - 1;
    return `@@FORUMMATH${index}@@`;
  });

  const escaped = withoutMath
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  let html = marked.parse(escaped, { async: false, gfm: true, breaks: true }) as string;

  // marked tạo link từ markdown; chặn scheme nguy hiểm phòng trường hợp bản mới
  // không tự sanitize.
  html = html.replace(/href="(?:javascript|data|vbscript):[^"]*"/gi, 'href="#"');
  html = html.replace(/src="(?:javascript|vbscript):[^"]*"/gi, 'src="#"');
  // Chỉ cho phép data URL ảnh tĩnh do API upload hợp lệ tạo ra; vẫn chặn SVG/HTML.
  html = html.replace(/src="data:(?!image\/(?:png|jpe?g|gif|webp);base64,)[^"]*"/gi, 'src="#"');

  mathBlocks.forEach((block, index) => {
    const safe = block.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html = html.replace(`@@FORUMMATH${index}@@`, safe);
  });

  return html;
}

/** Excerpt ngắn cho danh sách thread, đã bỏ markdown/toán. */
export function forumExcerpt(source: string, maxLength = 180): string {
  const plain = source
    .replace(FORUM_MATH_RE, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~>#|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > maxLength ? `${plain.slice(0, maxLength).trim()}…` : plain;
}
