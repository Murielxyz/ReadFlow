import { create } from 'zustand';
import { localISO } from '../utils/format';
import { getDatabase } from '../db/database';
import { generateId } from '../utils/id';
import type { Note, CreateNoteInput, UpdateNoteInput } from '../models';

interface NoteState {
  notes: Note[];
  loading: boolean;

  /** 获取某本书的所有笔记（按创建时间倒序） */
  fetchNotes: (bookId: string) => Promise<void>;

  /** 添加一条笔记 */
  addNote: (input: CreateNoteInput) => Promise<Note>;

  /** 更新笔记内容 */
  updateNote: (id: string, updates: UpdateNoteInput) => Promise<void>;

  /** 删除笔记 */
  deleteNote: (id: string) => Promise<void>;
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  loading: false,

  // ===== 获取笔记 =====
  fetchNotes: async (bookId) => {
    set({ loading: true });
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<Note>(
        'SELECT * FROM notes WHERE book_id = ? ORDER BY created_at DESC',
        [bookId],
      );
      set({ notes: rows });
    } catch (e) {
      console.error('fetchNotes error:', e);
    } finally {
      set({ loading: false });
    }
  },

  // ===== 添加笔记 =====
  addNote: async (input) => {
    const db = await getDatabase();
    const id = generateId();
    const now = localISO();
    const note: Note = {
      id,
      book_id: input.book_id,
      content: input.content,
      page_number: input.page_number ?? null,
      chapter: input.chapter ?? null,
      created_at: now,
      updated_at: now,
    };

    await db.runAsync(
      `INSERT INTO notes (id, book_id, content, page_number, chapter, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [note.id, note.book_id, note.content, note.page_number, note.chapter, note.created_at, note.updated_at],
    );

    // 乐观更新：插入到列表最前面
    set((s) => ({ notes: [note, ...s.notes] }));
    return note;
  },

  // ===== 更新笔记 =====
  updateNote: async (id, updates) => {
    const db = await getDatabase();
    const prev = get().notes.find((n) => n.id === id);

    // 乐观更新
    set((s) => ({
      notes: s.notes.map((n) =>
        n.id === id ? { ...n, ...updates, updated_at: localISO() } : n,
      ),
    }));

    try {
      const fields: string[] = [];
      const values: (string | number | null)[] = [];
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      }
      if (fields.length > 0) {
        fields.push("updated_at = datetime('now')");
        values.push(id);
        await db.runAsync(`UPDATE notes SET ${fields.join(', ')} WHERE id = ?`, values);
      }
    } catch (e) {
      // 回滚
      if (prev) {
        set((s) => ({ notes: s.notes.map((n) => (n.id === id ? prev : n)) }));
      }
      console.error('updateNote error:', e);
    }
  },

  // ===== 删除笔记 =====
  deleteNote: async (id) => {
    const db = await getDatabase();
    const prev = get().notes;

    // 乐观删除
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));

    try {
      await db.runAsync('DELETE FROM notes WHERE id = ?', [id]);
    } catch (e) {
      // 回滚
      set({ notes: prev });
      console.error('deleteNote error:', e);
    }
  },
}));
