import { create } from 'zustand';
import { getDatabase } from '../db/database';
import { generateId } from '../utils/id';
import { localISO } from '../utils/format';
import { BOOK_ACCENT_COLORS } from '../theme';
import type { Book, CreateBookInput } from '../models';

interface BookStore {
  // 状态
  books: Book[];
  loading: boolean;

  // 操作
  fetchBooks: () => Promise<void>;
  addBook: (input: CreateBookInput) => Promise<Book>;
  updateBook: (id: string, updates: Partial<Book>) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
}

export const useBookStore = create<BookStore>((set, get) => ({
  books: [],
  loading: false,

  // ========== 数据获取 ==========
  fetchBooks: async () => {
    set({ loading: true });
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<Book>(
        'SELECT * FROM books ORDER BY updated_at DESC'
      );
      // 清洗损坏数据：rating 非数字 → 置 null（修复旧版 URL 编码 bug 导致的文本泄漏）
      const cleaned = rows.map((b: any) => ({
        ...b,
        rating: typeof b.rating === 'number' ? b.rating : null,
      }));
      set({ books: cleaned });
    } catch (e) {
      console.error('fetchBooks error:', e);
    } finally {
      set({ loading: false });
    }
  },

  // ========== 新增书本 ==========
  addBook: async (input: CreateBookInput) => {
    const db = await getDatabase();
    const id = generateId();

    // 根据书名哈希分配强调色
    const colorIndex =
      Math.abs(
        input.title.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
      ) % BOOK_ACCENT_COLORS.length;

    const now = localISO();
    const book: Book = {
      id,
      title: input.title,
      author: input.author ?? null,
      publisher: input.publisher ?? null,
      description: input.description ?? null,
      cover_url: input.cover_url ?? null,
      isbn: input.isbn ?? null,
      page_count: input.page_count ?? null,
      status: input.status ?? 'to_read',
      rating: typeof input.rating === 'number' ? Math.round(input.rating) : null,
      accent_color: BOOK_ACCENT_COLORS[colorIndex],
      category: (input as any).category ?? null,
      finished_date: input.status === 'finished' ? now : null,
      created_at: now,
      updated_at: now,
    };

    await db.runAsync(
      `INSERT INTO books (id, title, author, publisher, description, cover_url, isbn, page_count, status, rating, accent_color, category, finished_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        book.id, book.title, book.author, book.publisher, book.description, book.cover_url,
        book.isbn, book.page_count, book.status, book.rating, book.accent_color,
        book.category, book.finished_date, book.created_at, book.updated_at,
      ]
    );

    // 乐观更新：直接插入列表头部
    set((state) => ({ books: [book, ...state.books] }));
    return book;
  },

  // ========== 更新书本 ==========
  updateBook: async (id, updates) => {
    const db = await getDatabase();
    const prev = get().books.find((b) => b.id === id);

    // 如果状态变为 finished 且之前不是 finished，自动设置读完日期
    const enrichedUpdates = { ...updates };
    if (updates.status === 'finished' && prev?.status !== 'finished') {
      (enrichedUpdates as any).finished_date = localISO();
    }

    // 乐观更新 UI
    set((state) => ({
      books: state.books.map((b) =>
        b.id === id ? { ...b, ...enrichedUpdates, updated_at: localISO() } : b
      ),
    }));

    try {
      // 构建动态 SQL
      const fields: string[] = [];
      const values: (string | number | null)[] = [];

      for (const [key, value] of Object.entries(enrichedUpdates)) {
        if (value !== undefined) {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      }

      if (fields.length > 0) {
        fields.push("updated_at = datetime('now')");
        values.push(id);
        await db.runAsync(
          `UPDATE books SET ${fields.join(', ')} WHERE id = ?`,
          values
        );
      }
    } catch (e) {
      // 回滚
      if (prev) {
        set((state) => ({
          books: state.books.map((b) => (b.id === id ? prev : b)),
        }));
      }
      console.error('updateBook error:', e);
    }
  },

  // ========== 删除书本 ==========
  deleteBook: async (id) => {
    const db = await getDatabase();
    const prev = get().books;

    // 乐观删除
    set((state) => ({ books: state.books.filter((b) => b.id !== id) }));

    try {
      await db.runAsync('DELETE FROM books WHERE id = ?', [id]);
    } catch (e) {
      // 回滚
      set({ books: prev });
      console.error('deleteBook error:', e);
    }
  },

}));
