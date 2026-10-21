export interface PadletComment {
  id: string;
  author_name: string;
  content: string;
  created_at: string;
}

export type PadletColor = 'yellow' | 'blue' | 'green' | 'pink' | 'purple' | 'orange';
export type PadletTheme = 'chalkboard' | 'corkboard' | 'gradient' | 'minimal' | 'dark' | 'lavender';
export type PadletLayoutMode = 'wall' | 'columns';

export interface PadletNote {
  id: string;
  board_code: string;
  author_name: string;
  title?: string;
  content: string;
  color: PadletColor;
  column_id?: string;
  likes: number;
  is_pinned: boolean;
  comments: PadletComment[];
  created_at: string;
}

export interface PadletColumn {
  id: string;
  title: string;
}

export interface PadletBoard {
  id: string;
  code: string; // 6 alphanumeric characters
  title: string;
  description?: string;
  theme: PadletTheme;
  layout_mode: PadletLayoutMode;
  columns?: PadletColumn[];
  is_locked: boolean;
  allow_comments: boolean;
  allow_likes: boolean;
  created_by: string;
  created_at: string;
  notes: PadletNote[];
}

// In-memory data store for Padlet boards
const boards = new Map<string, PadletBoard>();

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid O, 0, 1, I for readability
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Seed sample board
const sampleCode = 'LOP12A';
boards.set(sampleCode, {
  id: 'board-sample-1',
  code: sampleCode,
  title: 'Hộp thư Ý kiến & Thảo luận bài học',
  description: 'Gửi thắc mắc, chia sẻ cảm nghĩ hoặc câu hỏi về bài giảng hôm nay!',
  theme: 'corkboard',
  layout_mode: 'columns',
  columns: [
    { id: 'col-1', title: '💡 Ý tưởng & Sáng kiến' },
    { id: 'col-2', title: '❓ Thắc mắc cần giải đáp' },
    { id: 'col-3', title: '🌟 Cảm nhận sau tiết học' }
  ],
  is_locked: false,
  allow_comments: true,
  allow_likes: true,
  created_by: 'teacher-1',
  created_at: new Date(Date.now() - 3600000).toISOString(),
  notes: [
    {
      id: 'note-1',
      board_code: sampleCode,
      author_name: 'Thầy Hùng (GV)',
      title: 'Chào mừng các em!',
      content: 'Hãy dán các mẩu ghi chú chia sẻ thắc mắc hoặc ý tưởng cho dự án tuần này nhé.',
      color: 'yellow',
      column_id: 'col-1',
      likes: 5,
      is_pinned: true,
      comments: [
        {
          id: 'cmt-1',
          author_name: 'Minh Anh',
          content: 'Dạ vâng thầy ơi!',
          created_at: new Date(Date.now() - 3000000).toISOString()
        }
      ],
      created_at: new Date(Date.now() - 3500000).toISOString()
    },
    {
      id: 'note-2',
      board_code: sampleCode,
      author_name: 'Tuấn Khang (Lớp phó)',
      title: 'Câu hỏi phần Đạo hàm',
      content: 'Thầy có thể giải thích lại phương pháp tìm tiệm cận xiên khi bậc tử lớn hơn bậc mẫu 1 bậc được không ạ?',
      color: 'pink',
      column_id: 'col-2',
      likes: 3,
      is_pinned: false,
      comments: [],
      created_at: new Date(Date.now() - 2500000).toISOString()
    },
    {
      id: 'note-3',
      board_code: sampleCode,
      author_name: 'Hải Đăng',
      title: 'Tiết học thú vị',
      content: 'Hôm nay học phần ứng dụng thực tế rất hay và dễ hiểu ạ. Cảm ơn thầy nhiều!',
      color: 'green',
      column_id: 'col-3',
      likes: 4,
      is_pinned: false,
      comments: [],
      created_at: new Date(Date.now() - 1800000).toISOString()
    }
  ]
});

export const padletStore = {
  createBoard: (params: {
    title: string;
    description?: string;
    theme?: PadletTheme;
    layout_mode?: PadletLayoutMode;
    columns?: string[];
    allow_comments?: boolean;
    allow_likes?: boolean;
    created_by: string;
  }): PadletBoard => {
    let code = generateCode();
    while (boards.has(code)) {
      code = generateCode();
    }

    const layout_mode = params.layout_mode || 'wall';
    const columns: PadletColumn[] | undefined = 
      layout_mode === 'columns' && params.columns && params.columns.length > 0
        ? params.columns.map((c, idx) => ({ id: `col-${Date.now()}-${idx}`, title: c }))
        : layout_mode === 'columns'
        ? [
            { id: `col-${Date.now()}-1`, title: 'Cột 1' },
            { id: `col-${Date.now()}-2`, title: 'Cột 2' },
            { id: `col-${Date.now()}-3`, title: 'Cột 3' }
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
      notes: []
    };

    boards.set(code, board);
    return board;
  },

  getAllBoards: (userId?: string): PadletBoard[] => {
    const list = Array.from(boards.values());
    if (userId) {
      return list.filter(b => b.created_by === userId || b.created_by === 'teacher-1');
    }
    return list;
  },

  getBoardByCode: (code: string): PadletBoard | null => {
    if (!code) return null;
    return boards.get(code.toUpperCase()) || null;
  },

  updateBoard: (code: string, updates: Partial<PadletBoard>, userId?: string): PadletBoard | null => {
    const board = boards.get(code.toUpperCase());
    if (!board) return null;
    if (userId && board.created_by !== userId && board.created_by !== 'teacher-1') {
      return null;
    }

    if (updates.title !== undefined) board.title = updates.title;
    if (updates.description !== undefined) board.description = updates.description;
    if (updates.theme !== undefined) board.theme = updates.theme;
    if (updates.is_locked !== undefined) board.is_locked = updates.is_locked;
    if (updates.allow_comments !== undefined) board.allow_comments = updates.allow_comments;
    if (updates.allow_likes !== undefined) board.allow_likes = updates.allow_likes;

    return board;
  },

  deleteBoard: (code: string, userId?: string): boolean => {
    const board = boards.get(code.toUpperCase());
    if (!board) return false;
    if (userId && board.created_by !== userId && board.created_by !== 'teacher-1') {
      return false;
    }
    return boards.delete(code.toUpperCase());
  },

  addNote: (
    code: string,
    data: {
      author_name: string;
      title?: string;
      content: string;
      color?: PadletColor;
      column_id?: string;
    }
  ): PadletNote | null => {
    const board = boards.get(code.toUpperCase());
    if (!board || board.is_locked) return null;

    const validColors: PadletColor[] = ['yellow', 'blue', 'green', 'pink', 'purple', 'orange'];
    const color = validColors.includes(data.color as PadletColor) ? (data.color as PadletColor) : 'yellow';

    const note: PadletNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      board_code: board.code,
      author_name: data.author_name.trim() || 'Học sinh',
      title: data.title?.trim() || undefined,
      content: data.content.trim(),
      color,
      column_id: data.column_id || (board.columns?.[0]?.id),
      likes: 0,
      is_pinned: false,
      comments: [],
      created_at: new Date().toISOString()
    };

    board.notes.push(note);
    return note;
  },

  updateNote: (
    code: string,
    noteId: string,
    updates: { is_pinned?: boolean; color?: PadletColor; title?: string; content?: string }
  ): PadletNote | null => {
    const board = boards.get(code.toUpperCase());
    if (!board) return null;

    const note = board.notes.find(n => n.id === noteId);
    if (!note) return null;

    if (updates.is_pinned !== undefined) note.is_pinned = updates.is_pinned;
    if (updates.color !== undefined) note.color = updates.color;
    if (updates.title !== undefined) note.title = updates.title;
    if (updates.content !== undefined) note.content = updates.content;

    return note;
  },

  deleteNote: (code: string, noteId: string): boolean => {
    const board = boards.get(code.toUpperCase());
    if (!board) return false;

    const idx = board.notes.findIndex(n => n.id === noteId);
    if (idx !== -1) {
      board.notes.splice(idx, 1);
      return true;
    }
    return false;
  },

  toggleLike: (code: string, noteId: string): { likes: number } | null => {
    const board = boards.get(code.toUpperCase());
    if (!board || !board.allow_likes) return null;

    const note = board.notes.find(n => n.id === noteId);
    if (!note) return null;

    note.likes += 1;
    return { likes: note.likes };
  },

  addComment: (code: string, noteId: string, author_name: string, content: string): PadletComment | null => {
    const board = boards.get(code.toUpperCase());
    if (!board || !board.allow_comments || board.is_locked) return null;

    const note = board.notes.find(n => n.id === noteId);
    if (!note) return null;

    const comment: PadletComment = {
      id: `cmt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      author_name: author_name.trim() || 'Học sinh',
      content: content.trim(),
      created_at: new Date().toISOString()
    };

    note.comments.push(comment);
    return comment;
  }
};
