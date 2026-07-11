import { create } from 'zustand';
import { localISO } from '../utils/format';
import { getDatabase } from '../db/database';
import { generateId } from '../utils/id';
import type { ReadingSource, ReadingSourceType } from '../models';

export interface SourceStats {
  sessionCount: number;
  totalMs: number;
}

interface SourceStore {
  sources: ReadingSource[];
  loading: boolean;
  sourceStats: Record<string, SourceStats>; // sourceId → stats

  fetchSources: (bookId: string) => Promise<void>;
  fetchSourceStats: (bookId: string) => Promise<void>;
  addSource: (
    bookId: string,
    type: ReadingSourceType,
    label: string,
    fileUri?: string,
    fileName?: string
  ) => Promise<ReadingSource>;
  updateSourceProgress: (sourceId: string, currentPage: number) => Promise<void>;
  deleteSource: (id: string) => Promise<void>;
}

export const useSourceStore = create<SourceStore>((set, get) => ({
  sources: [],
  loading: false,
  sourceStats: {},

  // ===== 获取某本书的阅读来源 =====
  fetchSources: async (bookId: string) => {
    set({ loading: true });
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<ReadingSource>(
        'SELECT * FROM reading_sources WHERE book_id = ? ORDER BY created_at DESC',
        [bookId]
      );
      set({ sources: rows, loading: false });
    } catch (e) {
      console.error('fetchSources error:', e);
      set({ loading: false });
    }
  },

  // ===== 获取所有来源的 session 统计（含手动记录） =====
  fetchSourceStats: async (bookId: string) => {
    try {
      const db = await getDatabase();
      // 取原始行，JS 按 source_id 汇总（避免 GROUP BY/SUM 失败）
      const [srcSess, srcMan] = await Promise.all([
        db.getAllAsync<{ source_id: string; duration_ms: number }>('SELECT source_id, duration_ms FROM reading_sessions WHERE book_id = ? AND source_id IS NOT NULL', [bookId]),
        db.getAllAsync<{ source_id: string; duration_ms: number }>('SELECT source_id, duration_ms FROM manual_logs WHERE book_id = ? AND source_id IS NOT NULL', [bookId]),
      ]);
      const stats: Record<string, SourceStats> = {};
      const update = (sid: string, ms: number) => {
        if (!stats[sid]) stats[sid] = { sessionCount: 0, totalMs: 0 };
        stats[sid].sessionCount++;
        stats[sid].totalMs += ms || 0;
      };
      for (const r of srcSess) update(r.source_id, r.duration_ms);
      for (const r of srcMan) update(r.source_id, r.duration_ms);
      // 总数分配到第一个来源
      if (Object.keys(stats).length === 0) {
        const totalMs = srcSess.reduce((s,r) => s+(r.duration_ms||0), 0) + srcMan.reduce((s,r) => s+(r.duration_ms||0), 0);
        if ((srcSess.length + srcMan.length) > 0) {
          const sources = get().sources;
          if (sources.length > 0) {
            stats[sources[0].id] = { sessionCount: srcSess.length + srcMan.length, totalMs };
          }
        }
      }
      set({ sourceStats: stats });
    } catch (e) {
      console.error('fetchSourceStats error:', e);
    }
  },

  // ===== 添加阅读来源 =====
  addSource: async (bookId, type, label, fileUri, fileName) => {
    const db = await getDatabase();
    const id = generateId();

    const source: ReadingSource = {
      id,
      book_id: bookId,
      type,
      label: label || getDefaultLabel(type, fileName),
      file_uri: fileUri ?? null,
      file_name: fileName ?? null,
      current_page: 0,
      created_at: localISO(),
    };

    await db.runAsync(
      `INSERT INTO reading_sources (id, book_id, type, label, file_uri, file_name, current_page)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [source.id, source.book_id, source.type, source.label, source.file_uri, source.file_name, source.current_page]
    );

    // 乐观更新
    set((s) => ({ sources: [source, ...s.sources] }));
    return source;
  },

  // ===== 更新来源阅读进度 =====
  updateSourceProgress: async (sourceId: string, currentPage: number) => {
    const db = await getDatabase();
    // 乐观更新
    set((s) => ({
      sources: s.sources.map((src) =>
        src.id === sourceId ? { ...src, current_page: currentPage } : src
      ),
    }));
    try {
      await db.runAsync(
        'UPDATE reading_sources SET current_page = ? WHERE id = ?',
        [currentPage, sourceId],
      );
    } catch (e) {
      console.error('updateSourceProgress error:', e);
    }
  },

  // ===== 删除来源 =====
  deleteSource: async (id) => {
    const db = await getDatabase();
    const prev = get().sources;

    // 乐观删除
    set((s) => ({ sources: s.sources.filter((src) => src.id !== id) }));

    try {
      await db.runAsync('DELETE FROM reading_sources WHERE id = ?', [id]);
    } catch (e) {
      set({ sources: prev });
      console.error('deleteSource error:', e);
    }
  },
}));

/** 根据类型生成默认标签 */
function getDefaultLabel(type: ReadingSourceType, fileName?: string): string {
  switch (type) {
    case 'epub':
      return fileName || 'EPUB 电子书';
    case 'pdf':
      return fileName || 'PDF 文档';
    case 'physical':
      return '纸质书';
    case 'external':
      return '外部平台';
  }
}
