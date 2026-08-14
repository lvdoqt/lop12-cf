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
