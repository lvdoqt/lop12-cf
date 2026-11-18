/** Tạo vector nhúng cho tính năng tìm kiếm ngữ nghĩa (Phase 4).
 *  Dùng Gemini text-embedding-004 (768 chiều). Không có key → trả null,
 *  API sẽ fallback sang tìm kiếm theo tag/từ khoá.
 */

const GEMINI_EMBED_MODEL = 'text-embedding-004';
const VECTOR_SIZE = 768;

function resolveKey(runtimeEnv?: Record<string, string | undefined>): string {
  const key = (runtimeEnv && runtimeEnv['GEMINI_API_KEY']) || import.meta.env.GEMINI_API_KEY || '';
  if (!key || key.includes('placeholder') || key.includes('YOUR_KEY') || key.length < 15) return '';
  return key;
}

/**
 * @param taskType RETRIEVAL_DOCUMENT khi lưu thread, RETRIEVAL_QUERY khi tìm kiếm.
 */
export async function getForumEmbedding(
  text: string,
  runtimeEnv?: Record<string, string | undefined>,
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_DOCUMENT',
): Promise<number[] | null> {
  const apiKey = resolveKey(runtimeEnv);
  if (!apiKey || !text.trim()) return null;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBED_MODEL}:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${GEMINI_EMBED_MODEL}`,
          taskType,
          content: { parts: [{ text: text.slice(0, 8000) }] },
        }),
      },
    );
    if (!response.ok) return null;
    const data = await response.json();
    const values: unknown = data?.embedding?.values;
    if (!Array.isArray(values) || values.length !== VECTOR_SIZE) return null;
    const numbers = values.map(Number).filter(Number.isFinite);
    return numbers.length === VECTOR_SIZE ? numbers : null;
  } catch (error) {
    console.warn('[forum-embeddings] Gemini unavailable:', error);
    return null;
  }
}

/** Chuyển mảng số sang literal pgvector: '[0.0123,-0.0456,...]' */
export function toPgVector(values: number[]): string {
  return `[${values.map(v => Number(v.toFixed(6))).join(',')}]`;
}
