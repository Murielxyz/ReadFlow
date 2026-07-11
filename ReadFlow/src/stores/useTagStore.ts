import { create } from 'zustand';
import { localISO } from '../utils/format';
import { getDatabase } from '../db/database';
import { generateId } from '../utils/id';
import type { Tag } from '../models';

interface TagStore {
  allTags: Tag[];
  bookTags: Tag[];
  loading: boolean;
  /** bookId → Set<tagId> — 用于 Library 标签筛选 */
  bookTagMap: Map<string, Set<string>>;

  fetchAllTags: () => Promise<void>;
  fetchBookTags: (bookId: string) => Promise<void>;
  /** 加载全部 book-tag 关联，用于标签筛选 */
  fetchAllBookTagIds: () => Promise<void>;
  createTag: (name: string, color?: string) => Promise<Tag>;
  deleteTag: (id: string) => Promise<void>;
  assignTag: (bookId: string, tagId: string) => Promise<void>;
  removeTag: (bookId: string, tagId: string) => Promise<void>;
}

export const useTagStore = create<TagStore>((set, get) => ({
  allTags: [],
  bookTags: [],
  loading: false,
  bookTagMap: new Map(),

  // ===== 获取全部标签 =====
  fetchAllTags: async () => {
    set({ loading: true });
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<Tag>(
        'SELECT * FROM tags ORDER BY is_system DESC, name ASC'
      );
      set({ allTags: rows, loading: false });
    } catch (e) {
      console.error('fetchAllTags error:', e);
      set({ loading: false });
    }
  },

  // ===== 获取某本书的标签 =====
  fetchBookTags: async (bookId: string) => {
    try {
      const db = await getDatabase();
      // 分两次简单查询，避免 Web DB JOIN 解析失败
      const [allTags, btRows] = await Promise.all([
        db.getAllAsync<Tag>('SELECT * FROM tags ORDER BY name ASC'),
        db.getAllAsync<{ tag_id: string }>('SELECT tag_id FROM book_tags WHERE book_id = ?', [bookId]),
      ]);
      const tagIds = new Set(btRows.map((r) => r.tag_id));
      const matched = allTags.filter((t) => tagIds.has(t.id));
      set({ bookTags: matched });
    } catch (e) {
      console.error('fetchBookTags error:', e);
    }
  },

  // ===== 加载全部 book-tag 关联（用于 Library 标签筛选） =====
  fetchAllBookTagIds: async () => {
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<{ book_id: string; tag_id: string }>(
        'SELECT book_id, tag_id FROM book_tags',
      );
      const map = new Map<string, Set<string>>();
      for (const row of rows) {
        if (!map.has(row.book_id)) map.set(row.book_id, new Set());
        map.get(row.book_id)!.add(row.tag_id);
      }
      set({ bookTagMap: map });
    } catch (e) {
      console.error('fetchAllBookTagIds error:', e);
    }
  },

  // ===== 创建自定义标签 =====
  createTag: async (name, color) => {
    const db = await getDatabase();
    const id = generateId();

    const tag: Tag = {
      id,
      name,
      color: color || '#77767E',
      is_system: 0,
      created_at: localISO(),
    };

    await db.runAsync(
      'INSERT INTO tags (id, name, color, is_system) VALUES (?, ?, ?, 0)',
      [tag.id, tag.name, tag.color]
    );

    set((s) => ({ allTags: [...s.allTags, tag].sort((a, b) => a.name.localeCompare(b.name)) }));
    return tag;
  },

  // ===== 删除标签 =====
  deleteTag: async (id) => {
    const db = await getDatabase();
    const prev = get().allTags;

    set((s) => ({
      allTags: s.allTags.filter((t) => t.id !== id),
      bookTags: s.bookTags.filter((t) => t.id !== id),
    }));
    // 清理 bookTagMap 中该 tagId
    set((s) => {
      const next = new Map(s.bookTagMap);
      for (const [bookId, tagSet] of next) {
        tagSet.delete(id);
        if (tagSet.size === 0) next.delete(bookId);
      }
      return { bookTagMap: next };
    });

    try {
      // book_tags 由外键级联删除
      await db.runAsync('DELETE FROM tags WHERE id = ?', [id]);
    } catch (e) {
      set({ allTags: prev });
      console.error('deleteTag error:', e);
    }
  },

  // ===== 给书本打标签 =====
  assignTag: async (bookId, tagId) => {
    const db = await getDatabase();

    // 乐观更新
    const tag = get().allTags.find((t) => t.id === tagId);
    if (tag && !get().bookTags.find((t) => t.id === tagId)) {
      set((s) => ({ bookTags: [...s.bookTags, tag] }));
    }
    // 同步更新 bookTagMap
    set((s) => {
      const next = new Map(s.bookTagMap);
      if (!next.has(bookId)) next.set(bookId, new Set());
      next.get(bookId)!.add(tagId);
      return { bookTagMap: next };
    });

    try {
      await db.runAsync(
        'INSERT OR IGNORE INTO book_tags (book_id, tag_id) VALUES (?, ?)',
        [bookId, tagId]
      );
    } catch (e) {
      set((s) => ({ bookTags: s.bookTags.filter((t) => t.id !== tagId) }));
      console.error('assignTag error:', e);
    }
  },

  // ===== 移除书本标签 =====
  removeTag: async (bookId, tagId) => {
    const db = await getDatabase();

    set((s) => ({ bookTags: s.bookTags.filter((t) => t.id !== tagId) }));
    // 同步更新 bookTagMap
    set((s) => {
      const next = new Map(s.bookTagMap);
      const tagSet = next.get(bookId);
      if (tagSet) {
        tagSet.delete(tagId);
        if (tagSet.size === 0) next.delete(bookId);
      }
      return { bookTagMap: next };
    });

    try {
      await db.runAsync(
        'DELETE FROM book_tags WHERE book_id = ? AND tag_id = ?',
        [bookId, tagId]
      );
    } catch (e) {
      // 回滚
      const tag = get().allTags.find((t) => t.id === tagId);
      if (tag) set((s) => ({ bookTags: [...s.bookTags, tag] }));
      console.error('removeTag error:', e);
    }
  },
}));
