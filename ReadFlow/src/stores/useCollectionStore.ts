import { create } from 'zustand';
import { localISO } from '../utils/format';
import { getDatabase } from '../db/database';
import { generateId } from '../utils/id';
import type { Collection, CollectionWithCount } from '../models';
import type { Book } from '../models/book';

interface CollectionStore {
  collections: CollectionWithCount[];
  bookCollections: Collection[];
  loading: boolean;
  /** bookId → Set<collectionId> — 用于 Library 书单筛选 */
  bookCollectionMap: Map<string, Set<string>>;
  /** 书单详情页：当前书单内的书籍列表 */
  collectionBooks: Book[];

  fetchCollections: () => Promise<void>;
  fetchBookCollections: (bookId: string) => Promise<void>;
  /** 加载全部 book-collection 关联，用于书单筛选 */
  fetchAllBookCollectionIds: () => Promise<void>;
  createCollection: (name: string, description?: string, color?: string) => Promise<Collection>;
  updateCollection: (id: string, updates: { name?: string; description?: string | null; color?: string | null; sort_order?: number }) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  addBookToCollection: (bookId: string, collectionId: string) => Promise<void>;
  removeBookFromCollection: (bookId: string, collectionId: string) => Promise<void>;
  /** 获取书单内的所有书籍（用于书单详情页） */
  fetchBooksInCollection: (collectionId: string) => Promise<void>;
}

export const useCollectionStore = create<CollectionStore>((set, get) => ({
  collections: [],
  bookCollections: [],
  loading: false,
  bookCollectionMap: new Map(),
  collectionBooks: [],

  // ===== 获取全部书单（含书本数量） =====
  fetchCollections: async () => {
    set({ loading: true });
    try {
      const db = await getDatabase();
      // 分两次简单查询，避免 Web DB 解析 JOIN / GROUP BY 失败
      const [collections, bcRows] = await Promise.all([
        db.getAllAsync<Collection>('SELECT * FROM collections ORDER BY sort_order ASC, created_at DESC'),
        db.getAllAsync<{ collection_id: string }>('SELECT collection_id FROM book_collections'),
      ]);
      // JavaScript 侧聚合 book_count
      const countMap = new Map<string, number>();
      for (const r of bcRows) {
        countMap.set(r.collection_id, (countMap.get(r.collection_id) || 0) + 1);
      }
      const withCount: CollectionWithCount[] = collections.map((c) => ({
        ...c,
        book_count: countMap.get(c.id) || 0,
      }));
      set({ collections: withCount, loading: false });
    } catch (e) {
      console.error('fetchCollections error:', e);
      set({ loading: false });
    }
  },

  // ===== 获取某本书所属书单 =====
  fetchBookCollections: async (bookId: string) => {
    try {
      const db = await getDatabase();
      // 分两次简单查询，避免 Web DB JOIN 解析失败
      const [allCollections, bcRows] = await Promise.all([
        db.getAllAsync<Collection>('SELECT * FROM collections ORDER BY name ASC'),
        db.getAllAsync<{ collection_id: string }>('SELECT collection_id FROM book_collections WHERE book_id = ?', [bookId]),
      ]);
      const collIds = new Set(bcRows.map((r) => r.collection_id));
      const matched = allCollections.filter((c) => collIds.has(c.id));
      set({ bookCollections: matched });
    } catch (e) {
      console.error('fetchBookCollections error:', e);
    }
  },

  // ===== 加载全部 book-collection 关联（用于 Library 书单筛选） =====
  fetchAllBookCollectionIds: async () => {
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<{ book_id: string; collection_id: string }>(
        'SELECT book_id, collection_id FROM book_collections',
      );
      const map = new Map<string, Set<string>>();
      for (const row of rows) {
        if (!map.has(row.book_id)) map.set(row.book_id, new Set());
        map.get(row.book_id)!.add(row.collection_id);
      }
      set({ bookCollectionMap: map });
    } catch (e) {
      console.error('fetchAllBookCollectionIds error:', e);
    }
  },

  // ===== 创建书单 =====
  createCollection: async (name, description, color) => {
    const db = await getDatabase();
    const id = generateId();

    const collection: Collection = {
      id,
      name,
      description: description ?? null,
      color: color ?? '#DFDEFE',
      sort_order: 0,
      created_at: localISO(),
    };

    await db.runAsync(
      'INSERT INTO collections (id, name, description, color, sort_order) VALUES (?, ?, ?, ?, 0)',
      [collection.id, collection.name, collection.description, collection.color]
    );

    const withCount: CollectionWithCount = { ...collection, book_count: 0 };
    set((s) => ({ collections: [...s.collections, withCount] }));
    return collection;
  },

  // ===== 更新书单 =====
  updateCollection: async (id, updates) => {
    const db = await getDatabase();
    const prevCollections = get().collections;
    const prevBookCollections = get().bookCollections;

    // 乐观更新 collections 列表
    set((s) => ({
      collections: s.collections.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
      bookCollections: s.bookCollections.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    }));

    try {
      const fields: string[] = [];
      const values: (string | number | null)[] = [];

      if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
      }
      if (updates.description !== undefined) {
        fields.push('description = ?');
        values.push(updates.description);
      }
      if (updates.color !== undefined) {
        fields.push('color = ?');
        values.push(updates.color);
      }
      if (updates.sort_order !== undefined) {
        fields.push('sort_order = ?');
        values.push(updates.sort_order);
      }

      if (fields.length > 0) {
        values.push(id);
        await db.runAsync(
          `UPDATE collections SET ${fields.join(', ')} WHERE id = ?`,
          values
        );
      }
    } catch (e) {
      // 回滚
      set({ collections: prevCollections, bookCollections: prevBookCollections });
      console.error('updateCollection error:', e);
    }
  },

  // ===== 删除书单 =====
  deleteCollection: async (id) => {
    const db = await getDatabase();
    const prev = get().collections;

    set((s) => ({
      collections: s.collections.filter((c) => c.id !== id),
      bookCollections: s.bookCollections.filter((c) => c.id !== id),
    }));
    // 清理 bookCollectionMap 中该 collectionId
    set((s) => {
      const next = new Map(s.bookCollectionMap);
      for (const [bookId, collSet] of next) {
        collSet.delete(id);
        if (collSet.size === 0) next.delete(bookId);
      }
      return { bookCollectionMap: next };
    });

    try {
      const result = await db.runAsync('DELETE FROM collections WHERE id = ?', [id]);
      // 如果 DB 未删除任何行（Web 端 SQL 解析失败等），回滚乐观更新
      if (result.changes === 0) {
        set({ collections: prev });
        console.warn('[deleteCollection] No rows deleted, reverted optimistic update');
      }
    } catch (e) {
      set({ collections: prev });
      console.error('deleteCollection error:', e);
    }
  },

  // ===== 将书加入书单 =====
  addBookToCollection: async (bookId, collectionId) => {
    const db = await getDatabase();

    // 乐观更新
    const coll = get().collections.find((c) => c.id === collectionId);
    if (coll && !get().bookCollections.find((c) => c.id === collectionId)) {
      set((s) => ({
        bookCollections: [...s.bookCollections, coll],
        collections: s.collections.map((c) =>
          c.id === collectionId ? { ...c, book_count: c.book_count + 1 } : c
        ),
      }));
    }
    // 同步更新 bookCollectionMap
    set((s) => {
      const next = new Map(s.bookCollectionMap);
      if (!next.has(bookId)) next.set(bookId, new Set());
      next.get(bookId)!.add(collectionId);
      return { bookCollectionMap: next };
    });

    try {
      await db.runAsync(
        'INSERT OR IGNORE INTO book_collections (book_id, collection_id, added_at) VALUES (?, ?, ?)',
        [bookId, collectionId, localISO()]
      );
    } catch (e) {
      set((s) => ({
        bookCollections: s.bookCollections.filter((c) => c.id !== collectionId),
        collections: s.collections.map((c) =>
          c.id === collectionId ? { ...c, book_count: Math.max(0, c.book_count - 1) } : c
        ),
      }));
      console.error('addBookToCollection error:', e);
    }
  },

  // ===== 将书移出书单 =====
  removeBookFromCollection: async (bookId, collectionId) => {
    const db = await getDatabase();

    set((s) => ({
      bookCollections: s.bookCollections.filter((c) => c.id !== collectionId),
      collections: s.collections.map((c) =>
        c.id === collectionId ? { ...c, book_count: Math.max(0, c.book_count - 1) } : c
      ),
    }));
    // 同步更新 bookCollectionMap
    set((s) => {
      const next = new Map(s.bookCollectionMap);
      const collSet = next.get(bookId);
      if (collSet) {
        collSet.delete(collectionId);
        if (collSet.size === 0) next.delete(bookId);
      }
      return { bookCollectionMap: next };
    });

    try {
      await db.runAsync(
        'DELETE FROM book_collections WHERE book_id = ? AND collection_id = ?',
        [bookId, collectionId]
      );
    } catch (e) {
      const coll = get().collections.find((c) => c.id === collectionId);
      if (coll) {
        set((s) => ({
          bookCollections: [...s.bookCollections, coll],
          collections: s.collections.map((c) =>
            c.id === collectionId ? { ...c, book_count: c.book_count + 1 } : c
          ),
        }));
      }
      console.error('removeBookFromCollection error:', e);
    }
  },

  // ===== 获取书单内的所有书籍（书单详情页用） =====
  fetchBooksInCollection: async (collectionId: string) => {
    try {
      const db = await getDatabase();
      // 分两次简单查询，避免 Web DB JOIN 解析失败
      const [allBooks, bcRows] = await Promise.all([
        db.getAllAsync<Book>('SELECT * FROM books ORDER BY updated_at DESC'),
        db.getAllAsync<{ book_id: string }>('SELECT book_id FROM book_collections WHERE collection_id = ?', [collectionId]),
      ]);
      const bookIds = new Set(bcRows.map((r) => r.book_id));
      const matched = allBooks.filter((b) => bookIds.has(b.id));
      set({ collectionBooks: matched });
    } catch (e) {
      console.error('fetchBooksInCollection error:', e);
    }
  },
}));
