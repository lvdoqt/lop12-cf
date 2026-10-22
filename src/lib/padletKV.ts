/**
 * padletKV.ts — Cloudflare KV-backed Padlet store
 *
 * Each board is stored under key `padlet:board:{CODE}`.
 * A list of all board codes lives at `padlet:index` (JSON string[]).
 *
 * Falls back gracefully when KV binding is unavailable
 * (local dev without wrangler dev, or missing binding).
 */

// @ts-ignore — cloudflare:workers only available in CF Workers runtime
import { env } from 'cloudflare:workers';

import type {
  PadletBoard,
  PadletNote,
  PadletComment,
  PadletColor,
  PadletTheme,
  PadletLayoutMode,
} from '../services/mockPadletStore';

export type { PadletBoard, PadletNote, PadletComment, PadletColor, PadletTheme, PadletLayoutMode };

/** Cloudflare KV namespace interface */
export interface KVNamespace {
  get(key: string, type: 'text'): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string }): Promise<{ keys: { name: string }[] }>;
}

/**
 * Returns the PADLET_KV namespace from the Cloudflare Workers env.
 * Returns null in local dev where the binding doesn't exist.
 */
export function getPadletKV(): KVNamespace | null {
  try {
    return (env as any).PADLET_KV ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const BOARD_PREFIX = 'padlet:board:';
const INDEX_KEY = 'padlet:index';

async function getIndex(kv: KVNamespace): Promise<string[]> {
  const raw = await kv.get(INDEX_KEY, 'text');
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

async function saveIndex(kv: KVNamespace, codes: string[]): Promise<void> {
  await kv.put(INDEX_KEY, JSON.stringify(codes));
}

async function getBoard(kv: KVNamespace, code: string): Promise<PadletBoard | null> {
  const raw = await kv.get(BOARD_PREFIX + code.toUpperCase(), 'text');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PadletBoard;
  } catch {
    return null;
  }
}

async function saveBoard(kv: KVNamespace, board: PadletBoard): Promise<void> {
  await kv.put(BOARD_PREFIX + board.code.toUpperCase(), JSON.stringify(board));
}

// ---------------------------------------------------------------------------
// Code generator (same charset as mockPadletStore)
// ---------------------------------------------------------------------------
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public store API — async version of mockPadletStore
// ---------------------------------------------------------------------------

export const padletKV = {
  // ------------------------------------------------------------------
  // BOARD CRUD
  // ------------------------------------------------------------------
  async createBoard(
    kv: KVNamespace,
    params: {
      title: string;
      description?: string;
      theme?: PadletTheme;
      layout_mode?: PadletLayoutMode;
      columns?: string[];
      allow_comments?: boolean;
      allow_likes?: boolean;
      created_by: string;
    }
  ): Promise<PadletBoard> {
    const index = await getIndex(kv);

    let code = generateCode();
    while (index.includes(code)) {
      code = generateCode();
    }

    const layout_mode = params.layout_mode || 'wall';
    const columns =
      layout_mode === 'columns' && params.columns && params.columns.length > 0
        ? params.columns.map((c, idx) => ({ id: `col-${Date.now()}-${idx}`, title: c }))
        : layout_mode === 'columns'
        ? [
            { id: `col-${Date.now()}-1`, title: 'Cột 1' },
            { id: `col-${Date.now()}-2`, title: 'Cột 2' },
            { id: `col-${Date.now()}-3`, title: 'Cột 3' },
          ]
        : undefined;

    const board: PadletBoard = {
      id: `board-${Date.now()}`,
      code,
      title: params.title.trim(),
      description: params.description?.trim(),
      theme: params.theme || 'corkboard',
      layout_mode,
      columns,
      is_locked: false,
      allow_comments: params.allow_comments !== false,
      allow_likes: params.allow_likes !== false,
      created_by: params.created_by,
      created_at: new Date().toISOString(),
      notes: [],
    };

    await saveBoard(kv, board);
    await saveIndex(kv, [...index, code]);
    return board;
  },

  async getAllBoards(kv: KVNamespace, userId?: string): Promise<PadletBoard[]> {
    const index = await getIndex(kv);
    const boards = await Promise.all(index.map((c) => getBoard(kv, c)));
    const valid = boards.filter(Boolean) as PadletBoard[];
    if (userId) {
      return valid.filter((b) => b.created_by === userId);
    }
    return valid;
  },

  async getBoardByCode(kv: KVNamespace, code: string): Promise<PadletBoard | null> {
    if (!code) return null;
    return getBoard(kv, code);
  },

  async updateBoard(
    kv: KVNamespace,
    code: string,
    updates: Partial<PadletBoard>,
    userId?: string
  ): Promise<PadletBoard | null> {
    const board = await getBoard(kv, code);
    if (!board) return null;
    if (userId && board.created_by !== userId) return null;

    if (updates.title !== undefined) board.title = updates.title;
    if (updates.description !== undefined) board.description = updates.description;
    if (updates.theme !== undefined) board.theme = updates.theme;
    if (updates.is_locked !== undefined) board.is_locked = updates.is_locked;
    if (updates.allow_comments !== undefined) board.allow_comments = updates.allow_comments;
    if (updates.allow_likes !== undefined) board.allow_likes = updates.allow_likes;

    await saveBoard(kv, board);
    return board;
  },

  async deleteBoard(kv: KVNamespace, code: string, userId?: string): Promise<boolean> {
    const board = await getBoard(kv, code);
    if (!board) return false;
    if (userId && board.created_by !== userId) return false;

    const upperCode = code.toUpperCase();
    await kv.delete(BOARD_PREFIX + upperCode);

    const index = await getIndex(kv);
    await saveIndex(kv, index.filter((c) => c !== upperCode));
    return true;
  },

  // ------------------------------------------------------------------
  // NOTE CRUD
  // ------------------------------------------------------------------
  async addNote(
    kv: KVNamespace,
    code: string,
    data: {
      author_name: string;
      title?: string;
      content: string;
      color?: PadletColor;
      column_id?: string;
    }
  ): Promise<PadletNote | null> {
    const board = await getBoard(kv, code);
    if (!board || board.is_locked) return null;

    const validColors: PadletColor[] = ['yellow', 'blue', 'green', 'pink', 'purple', 'orange'];
    const color = validColors.includes(data.color as PadletColor)
      ? (data.color as PadletColor)
      : 'yellow';

    const note: PadletNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      board_code: board.code,
      author_name: data.author_name.trim() || 'Học sinh',
      title: data.title?.trim() || undefined,
      content: data.content.trim(),
      color,
      column_id: data.column_id || board.columns?.[0]?.id,
      likes: 0,
      is_pinned: false,
      comments: [],
      created_at: new Date().toISOString(),
    };

    board.notes.push(note);
    await saveBoard(kv, board);
    return note;
  },

  async updateNote(
    kv: KVNamespace,
    code: string,
    noteId: string,
    updates: { is_pinned?: boolean; color?: PadletColor; title?: string; content?: string }
  ): Promise<PadletNote | null> {
    const board = await getBoard(kv, code);
    if (!board) return null;

    const note = board.notes.find((n) => n.id === noteId);
    if (!note) return null;

    if (updates.is_pinned !== undefined) note.is_pinned = updates.is_pinned;
    if (updates.color !== undefined) note.color = updates.color;
    if (updates.title !== undefined) note.title = updates.title;
    if (updates.content !== undefined) note.content = updates.content;

    await saveBoard(kv, board);
    return note;
  },

  async deleteNote(kv: KVNamespace, code: string, noteId: string): Promise<boolean> {
    const board = await getBoard(kv, code);
    if (!board) return false;

    const idx = board.notes.findIndex((n) => n.id === noteId);
    if (idx === -1) return false;
    board.notes.splice(idx, 1);
    await saveBoard(kv, board);
    return true;
  },

  async toggleLike(
    kv: KVNamespace,
    code: string,
    noteId: string
  ): Promise<{ likes: number } | null> {
    const board = await getBoard(kv, code);
    if (!board || !board.allow_likes) return null;

    const note = board.notes.find((n) => n.id === noteId);
    if (!note) return null;

    note.likes += 1;
    await saveBoard(kv, board);
    return { likes: note.likes };
  },

  async addComment(
    kv: KVNamespace,
    code: string,
    noteId: string,
    author_name: string,
    content: string
  ): Promise<PadletComment | null> {
    const board = await getBoard(kv, code);
    if (!board || !board.allow_comments || board.is_locked) return null;

    const note = board.notes.find((n) => n.id === noteId);
    if (!note) return null;

    const comment: PadletComment = {
      id: `cmt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      author_name: author_name.trim() || 'Học sinh',
      content: content.trim(),
      created_at: new Date().toISOString(),
    };

    note.comments.push(comment);
    await saveBoard(kv, board);
    return comment;
  },
};
