import React, { useEffect, useMemo, useRef, useState } from 'react';
import { renderForumMarkdown, renderMathInContainer } from '../../../lib/markdown';

interface PadletRichContentProps {
  content: string;
  inline?: boolean;
  className?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export const PadletRichContent: React.FC<PadletRichContentProps> = React.memo(({
  content,
  inline = false,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const html = useMemo(() => {
    if (!content) return '';
    return inline ? escapeHtml(content) : renderForumMarkdown(content);
  }, [content, inline]);

  // Write HTML and render KaTeX imperatively so React re-renders (clicks, polls, modal state)
  // NEVER reset KaTeX-rendered DOM back to raw LaTeX text.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.innerHTML = html;

    let attempts = 0;
    let timer: number | undefined;

    const tryRender = () => {
      const node = containerRef.current;
      if (!node) return;
      if (typeof window !== 'undefined' && typeof (window as any).renderMathInElement === 'function') {
        renderMathInContainer(node);
      } else if (attempts++ < 15) {
        timer = window.setTimeout(tryRender, 150);
      }
    };

    tryRender();
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [html]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (target && target.tagName === 'IMG') {
      const src = (target as HTMLImageElement).getAttribute('src');
      if (src) {
        e.stopPropagation();
        setLightboxSrc(src);
      }
    }
  };

  if (inline) {
    return (
      <span
        ref={containerRef as React.RefObject<HTMLSpanElement>}
        className={className}
      />
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        onClick={handleClick}
        className={`padlet-rich-content [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-current/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-black/10 [&_code]:dark:bg-white/10 [&_code]:text-xs [&_pre]:overflow-x-auto [&_pre]:p-2 [&_pre]:rounded-lg [&_pre]:bg-black/10 [&_pre]:dark:bg-white/10 [&_img]:rounded-xl [&_img]:max-h-72 [&_img]:w-auto [&_img]:max-w-full [&_img]:object-contain [&_img]:my-2 [&_img]:border [&_img]:border-black/10 [&_img]:dark:border-white/10 [&_img]:cursor-zoom-in [&_img]:shadow-sm [&_.katex-display]:overflow-x-auto [&_.katex-display]:py-1 [&_.katex-display]:my-1 ${className}`}
      />

      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white text-lg font-bold flex items-center justify-center transition"
            aria-label="Đóng ảnh"
          >
            ✕
          </button>
          <img
            src={lightboxSrc}
            alt="Ảnh phóng to"
            className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
});
