/**
 * padletKV.ts — Unified Padlet store adapter (backed by Supabase + memory fallback)
 *
 * Provides backward-compatible interface for any code expecting padletKV or getPadletKV().
 */

import { padletStore } from '../services/db';
import type {
  PadletBoard,
  PadletNote,
  PadletComment,
  PadletColor,
  PadletTheme,
  PadletLayoutMode,
  PadletColumn,
} from '../types';

export type {
  PadletBoard,
  PadletNote,
  PadletComment,
  PadletColor,
  PadletTheme,
  PadletLayoutMode,
  PadletColumn,
};

/** Dummy KV interface for backward compatibility */
export interface KVNamespace {
  get(key: string, type: 'text'): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string }): Promise<{ keys: { name: string }[] }>;
}

/**
 * Returns a truthy handle so legacy checks like `if (!kv)` always succeed.
 */
export function getPadletKV(): any {
  return padletStore;
}

/**
 * Adapter that handles both legacy `(kv, ...args)` and direct `(...args)` calls.
 */
export const padletKV = {
  createBoard(first: any, second?: any) {
    const params = second !== undefined ? second : first;
    return padletStore.createBoard(params);
  },

  getAllBoards(first?: any, second?: any) {
    const userId = typeof first === 'string' ? first : (typeof second === 'string' ? second : undefined);
    return padletStore.getAllBoards(userId);
  },

  getBoardByCode(first: any, second?: any) {
    const code = typeof first === 'string' ? first : second;
    return padletStore.getBoardByCode(code || '');
  },

  updateBoard(first: any, second: any, third?: any, fourth?: any) {
    if (typeof first === 'string') {
      return padletStore.updateBoard(first, second, third);
    }
    return padletStore.updateBoard(second, third, fourth);
  },

  deleteBoard(first: any, second?: any, third?: any) {
    if (typeof first === 'string') {
      return padletStore.deleteBoard(first, second);
    }
    return padletStore.deleteBoard(second, third);
  },

  addNote(first: any, second: any, third?: any) {
    if (typeof first === 'string') {
      return padletStore.addNote(first, second);
    }
    return padletStore.addNote(second, third);
  },

  updateNote(first: any, second: any, third?: any, fourth?: any) {
    if (typeof first === 'string') {
      return padletStore.updateNote(first, second, third);
    }
    return padletStore.updateNote(second, third, fourth);
  },

  deleteNote(first: any, second: any, third?: any) {
    if (typeof first === 'string') {
      return padletStore.deleteNote(first, second);
    }
    return padletStore.deleteNote(second, third);
  },

  toggleLike(first: any, second: any, third?: any) {
    if (typeof first === 'string') {
      return padletStore.toggleLike(first, second);
    }
    return padletStore.toggleLike(second, third);
  },

  addComment(first: any, second: any, third?: any, fourth?: any, fifth?: any) {
    if (typeof first === 'string') {
      return padletStore.addComment(first, second, third, fourth);
    }
    return padletStore.addComment(second, third, fourth, fifth);
  },
};

export { padletStore };
