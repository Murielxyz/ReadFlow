import { create } from 'zustand';
import { localISO } from '../utils/format';
import { getDatabase } from '../db/database';
import { generateId } from '../utils/id';
import type { Highlight, CreateHighlightInput, UpdateHighlightInput } from '../models';

interface HighlightState {
  highlights: Highlight[];
  loading: boolean;

  /** 获取某本书的所有高亮（按创建时间倒序） */
  fetchHighlights: (bookId: string) => Promise<void>;

  /** 添加一条高亮 */
  addHighlight: (input: CreateHighlightInput) => Promise<Highlight>;

  /** 更新高亮 */
  updateHighlight: (id: string, updates: UpdateHighlightInput) => Promise<void>;

  /** 删除高亮 */
  deleteHighlight: (id: string) => Promise<void>;
}

export const useHighlightStore = create<HighlightState>((set, get) => ({
  highlights: [],
  loading: false,

  // ===== 获取高亮 =====
  fetchHighlights: async (bookId) => {
    set({ loading: true });
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<Highlight>(
        'SELECT * FROM highlights WHERE book_id = ? ORDER BY created_at DESC',
        [bookId],
      );
      set({ highlights: rows });
    } catch (e) {
      console.error('fetchHighlights error:', e);
    } finally {
      set({ loading: false });
    }
  },

  // ===== 添加高亮 =====
  addHighlight: async (input) => {
    const db = await getDatabase();
    const id = generateId();
    const now = localISO();
    const highlight: Highlight = {
      id,
      book_id: input.book_id,
      content: input.content,
      color: input.color ?? '#F5A623',
      note: input.note ?? null,
      page_number: input.page_number ?? null,
      chapter: input.chapter ?? null,
      created_at: now,
      updated_at: now,
    };

    await db.runAsync(
      `INSERT INTO highlights (id, book_id, content, color, note, page_number, chapter, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        highlight.id, highlight.book_id, highlight.content, highlight.color,
        highlight.note, highlight.page_number, highlight.chapter,
        highlight.created_at, highlight.updated_at,
      ],
    );

    // 乐观更新：插入到列表最前面
    set((s) => ({ highlights: [highlight, ...s.highlights] }));
    return highlight;
  },

  // ===== 更新高亮 =====
  updateHighlight: async (id, updates) => {
    const db = await getDatabase();
    const prev = get().highlights.find((h) => h.id === id);

    // 乐观更新
    set((s) => ({
      highlights: s.highlights.map((h) =>
        h.id === id ? { ...h, ...updates, updated_at: localISO() } : h,
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
        await db.runAsync(`UPDATE highlights SET ${fields.join(', ')} WHERE id = ?`, values);
      }
    } catch (e) {
      // 回滚
      if (prev) {
        set((s) => ({ highlights: s.highlights.map((h) => (h.id === id ? prev : h)) }));
      }
      console.error('updateHighlight error:', e);
    }
  },

  // ===== 删除高亮 =====
  deleteHighlight: async (id) => {
    const db = await getDatabase();
    const prev = get().highlights;

    // 乐观删除
    set((s) => ({ highlights: s.highlights.filter((h) => h.id !== id) }));

    try {
      await db.runAsync('DELETE FROM highlights WHERE id = ?', [id]);
    } catch (e) {
      // 回滚
      set({ highlights: prev });
      console.error('deleteHighlight error:', e);
    }
  },
}));
