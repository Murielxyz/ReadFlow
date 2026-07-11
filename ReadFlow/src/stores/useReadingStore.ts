import { create } from 'zustand';
import { getDatabase } from '../db/database';
import { generateId } from '../utils/id';
import { localISO } from '../utils/format';
import type { ReadingSession, ManualLog, TimelineEntry } from '../models';

interface ReadingStats {
  totalMs: number;
  sessionCount: number;
  manualLogCount: number;
  lastReadAt: string | null;
}

interface ReadingStore {
  // 状态
  sessions: ReadingSession[];
  manualLogs: ManualLog[];
  timeline: TimelineEntry[];
  stats: ReadingStats | null;
  loading: boolean;

  // 操作
  fetchBookData: (bookId: string) => Promise<void>;
  addManualLog: (
    bookId: string,
    durationMs: number,
    note?: string,
    sourceLabel?: string,
    pageNumber?: number,
    chapter?: string,
    completedBook?: boolean,
    sourceId?: string,
  ) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  deleteManualLog: (id: string) => Promise<void>;
  refreshStats: (bookId: string) => Promise<void>;
}

export const useReadingStore = create<ReadingStore>((set, get) => ({
  sessions: [],
  manualLogs: [],
  timeline: [],
  stats: null,
  loading: false,

  // ===== 获取某本书的全部阅读数据 =====
  fetchBookData: async (bookId: string) => {
    set({ loading: true });
    try {
      const db = await getDatabase();

      // 获取阅读会话
      const sessions = await db.getAllAsync<ReadingSession>(
        `SELECT * FROM reading_sessions
         WHERE book_id = ?
         ORDER BY start_time DESC`,
        [bookId],
      );

      // 获取手动记录
      const manualLogs = await db.getAllAsync<ManualLog>(
        `SELECT * FROM manual_logs
         WHERE book_id = ?
         ORDER BY logged_at DESC`,
        [bookId],
      );

      // 构建统一时间线
      const timeline: TimelineEntry[] = [
        ...sessions.map((s) => ({
          id: s.id,
          type: 'session' as const,
          book_id: s.book_id,
          source_label: s.source_label,
          start_time: s.start_time,
          end_time: s.end_time,
          duration_ms: s.duration_ms,
          note: null,
          page_number: s.page_number,
          chapter: s.chapter,
          completed_book: s.completed_book,
        })),
        ...manualLogs.map((m) => ({
          id: m.id,
          type: 'manual' as const,
          book_id: m.book_id,
          source_label: m.source_label,
          start_time: m.logged_at,
          end_time: null,
          duration_ms: m.duration_ms,
          note: m.note,
          page_number: m.page_number,
          chapter: m.chapter,
          completed_book: m.completed_book,
        })),
      ].sort(
        (a, b) =>
          new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
      );

      // 计算统计
      const totalMs =
        sessions.reduce((sum, s) => sum + (typeof s.duration_ms === 'number' ? s.duration_ms : 0), 0) +
        manualLogs.reduce((sum, m) => sum + (typeof m.duration_ms === 'number' ? m.duration_ms : 0), 0);

      const sessionCount = sessions.length + manualLogs.length;
      const lastReadAt =
        timeline.length > 0 ? timeline[0].start_time : null;

      set({
        sessions,
        manualLogs,
        timeline,
        stats: {
          totalMs,
          sessionCount,
          manualLogCount: manualLogs.length,
          lastReadAt,
        },
        loading: false,
      });
    } catch (e) {
      console.error('fetchBookData error:', e);
      set({ loading: false });
    }
  },

  // ===== 手动补录时间 =====
  addManualLog: async (bookId, durationMs, note, sourceLabel, pageNumber, chapter, completedBook, sourceId) => {
    const db = await getDatabase();
    const id = generateId();
    const now = localISO();

    const log: ManualLog = {
      id,
      book_id: bookId,
      source_id: sourceId ?? null,
      duration_ms: durationMs,
      logged_at: now,
      note: note ?? null,
      source_label: sourceLabel ?? null,
      page_number: pageNumber ?? null,
      chapter: chapter ?? null,
      completed_book: completedBook ? 1 : 0,
      created_at: now,
    };

    await db.runAsync(
      `INSERT INTO manual_logs (id, book_id, source_id, duration_ms, logged_at, note, source_label, page_number, chapter, completed_book, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [log.id, log.book_id, log.source_id, log.duration_ms, log.logged_at, log.note, log.source_label, log.page_number, log.chapter, log.completed_book, log.created_at],
    );

    // 如果标记为读完，更新书籍状态
    if (completedBook) {
      await db.runAsync(
        `UPDATE books SET status = 'finished', finished_date = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
        [bookId],
      );
    }

    // 如果记录了阅读页数，同步到阅读来源的 current_page
    if (pageNumber != null && pageNumber > 0) {
      try {
        let targetSourceId = log.source_id;
        if (!targetSourceId) {
          // 查找该书的第一个 epub/pdf 来源
          const sources = await db.getAllAsync<{ id: string }>(
            'SELECT id FROM reading_sources WHERE book_id = ?',
            [bookId],
          );
          if (sources.length > 0) targetSourceId = sources[0].id;
        }
        if (targetSourceId) {
          await db.runAsync(
            'UPDATE reading_sources SET current_page = ? WHERE id = ?',
            [pageNumber, targetSourceId],
          );
        }
      } catch {
        // reading_sources 表可能没有对应行，忽略
      }
    }

    // 乐观更新
    const entry: TimelineEntry = {
      id: log.id,
      type: 'manual',
      book_id: log.book_id,
      source_label: log.source_label,
      start_time: log.logged_at,
      end_time: null,
      duration_ms: log.duration_ms,
      note: log.note,
      page_number: log.page_number,
      chapter: log.chapter,
      completed_book: log.completed_book,
    };

    set((s) => ({
      manualLogs: [log, ...s.manualLogs],
      timeline: [entry, ...s.timeline].sort(
        (a, b) =>
          new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
      ),
      stats: s.stats
        ? {
            ...s.stats,
            totalMs: s.stats.totalMs + durationMs,
            sessionCount: s.stats.sessionCount + 1,
            manualLogCount: s.stats.manualLogCount + 1,
            lastReadAt: now,
          }
        : null,
    }));
  },

  // ===== 删除阅读会话 =====
  deleteSession: async (id) => {
    const db = await getDatabase();
    const prev = get().sessions;
    const removed = prev.find((s) => s.id === id);

    // 乐观删除
    set((s) => ({
      sessions: s.sessions.filter((x) => x.id !== id),
      timeline: s.timeline.filter((x) => x.id !== id),
      stats: s.stats && removed
        ? {
            ...s.stats,
            totalMs: s.stats.totalMs - (removed.duration_ms ?? 0),
            sessionCount: Math.max(0, s.stats.sessionCount - 1),
          }
        : s.stats,
    }));

    try {
      await db.runAsync('DELETE FROM reading_sessions WHERE id = ?', [id]);
    } catch (e) {
      // 回滚
      set((s) => ({
        sessions: prev,
        timeline: [
          ...prev.map((x) => ({
            id: x.id,
            type: 'session' as const,
            book_id: x.book_id,
            source_label: x.source_label,
            start_time: x.start_time,
            end_time: x.end_time,
            duration_ms: x.duration_ms,
            note: null,
            page_number: x.page_number,
            chapter: x.chapter,
            completed_book: x.completed_book,
          })),
          ...s.manualLogs.map((m) => ({
            id: m.id,
            type: 'manual' as const,
            book_id: m.book_id,
            source_label: m.source_label,
            start_time: m.logged_at,
            end_time: null,
            duration_ms: m.duration_ms,
            note: m.note,
            page_number: m.page_number,
            chapter: m.chapter,
            completed_book: m.completed_book,
          })),
        ].sort(
          (a, b) =>
            new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
        ),
      }));
      console.error('deleteSession error:', e);
    }
  },

  // ===== 删除手动记录 =====
  deleteManualLog: async (id) => {
    const db = await getDatabase();
    const prev = get().manualLogs;
    const removed = prev.find((m) => m.id === id);

    set((s) => ({
      manualLogs: s.manualLogs.filter((x) => x.id !== id),
      timeline: s.timeline.filter((x) => x.id !== id),
      stats: s.stats && removed
        ? {
            ...s.stats,
            totalMs: s.stats.totalMs - removed.duration_ms,
            sessionCount: Math.max(0, s.stats.sessionCount - 1),
            manualLogCount: Math.max(0, s.stats.manualLogCount - 1),
          }
        : s.stats,
    }));

    try {
      await db.runAsync('DELETE FROM manual_logs WHERE id = ?', [id]);
    } catch (e) {
      set((s) => ({
        manualLogs: prev,
        timeline: [
          ...s.sessions.map((x) => ({
            id: x.id,
            type: 'session' as const,
            book_id: x.book_id,
            source_label: x.source_label,
            start_time: x.start_time,
            end_time: x.end_time,
            duration_ms: x.duration_ms,
            note: null,
            page_number: x.page_number,
            chapter: x.chapter,
            completed_book: x.completed_book,
          })),
          ...prev.map((m) => ({
            id: m.id,
            type: 'manual' as const,
            book_id: m.book_id,
            source_label: m.source_label,
            start_time: m.logged_at,
            end_time: null,
            duration_ms: m.duration_ms,
            note: m.note,
            page_number: m.page_number,
            chapter: m.chapter,
            completed_book: m.completed_book,
          })),
        ].sort(
          (a, b) =>
            new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
        ),
      }));
      console.error('deleteManualLog error:', e);
    }
  },

  // ===== 刷新统计 =====
  refreshStats: async (bookId: string) => {
    const db = await getDatabase();

    const sessions = await db.getAllAsync<ReadingSession>(
      'SELECT * FROM reading_sessions WHERE book_id = ?',
      [bookId],
    );
    const manualLogs = await db.getAllAsync<ManualLog>(
      'SELECT * FROM manual_logs WHERE book_id = ?',
      [bookId],
    );

    const totalMs =
      sessions.reduce((sum, s) => sum + (typeof s.duration_ms === 'number' ? s.duration_ms : 0), 0) +
      manualLogs.reduce((sum, m) => sum + (typeof m.duration_ms === 'number' ? m.duration_ms : 0), 0);

    const allEntries = [
      ...sessions.map((s) => s.start_time),
      ...manualLogs.map((m) => m.logged_at),
    ].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    set({
      stats: {
        totalMs,
        sessionCount: sessions.length + manualLogs.length,
        manualLogCount: manualLogs.length,
        lastReadAt: allEntries.length > 0 ? allEntries[0] : null,
      },
    });
  },
}));
