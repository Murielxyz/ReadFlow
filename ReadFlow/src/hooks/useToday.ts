import { useState, useEffect, useCallback } from 'react';
import { getDatabase } from '../db/database';
import { useBookStore } from '../stores/useBookStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { localDate } from '../utils/format';
import type { Book } from '../models';

// ============================================================
// 类型定义
// ============================================================

/** 最近阅读时间线条目 */
export interface TodayTimelineEntry {
  id: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string | null;
  durationMs: number;
  startTime: string;
  type: 'session' | 'manual' | 'completed' | 'added';
}

/** Today 页面数据 */
export interface TodayData {
  /** 今日阅读时长 (ms) */
  todayMs: number;
  /** 今日阅读次数（计时 + 手动） */
  sessionCount: number;
  /** 连续阅读天数 */
  streak: number;
  /** 今日阅读页数合计 */
  totalPages: number;
  /** 今日读过书籍数 */
  booksReadToday: number;
  /** 阅读笔记总数（想法 + 高亮） */
  readingNotes: number;
  /** 每日阅读目标 (ms)，默认 30 分钟 */
  dailyGoalMs: number;
  /** 最近阅读时间线（跨所有书，最近 15 条：阅读 / 读完 / 加入书架） */
  recentTimeline: TodayTimelineEntry[];
  /** 当前在读书籍（最近更新的一本） */
  currentBook: Book | null;
  /** 当前在读书籍的总阅读时长 (ms) */
  currentBookTotalMs: number;
  /** 当前在读书籍已读页数（所有阅读来源 current_page 之和） */
  currentBookPageCurrent: number;
  /** 当前在读书籍总页数（来自 books.page_count） */
  currentBookPageTotal: number | null;
  /** 是否有任何藏书 */
  hasAnyBooks: boolean;
  /** 加载状态 */
  loading: boolean;
  /** 刷新数据 */
  refresh: () => Promise<void>;
}

// ============================================================
// 默认每日目标（仅当 Store 未初始化时使用）
// ============================================================

const FALLBACK_DAILY_GOAL_MS = 30 * 60 * 1000;

// ============================================================
// Hook
// ============================================================

export function useToday(): TodayData {
  // 从 BookStore 获取当前书籍列表
  const books = useBookStore((s) => s.books);
  const fetchBooks = useBookStore((s) => s.fetchBooks);

  // 从 SettingsStore 获取每日目标
  const dailyGoalMs = useSettingsStore((s) => s.dailyGoalMs);

  const [todayMs, setTodayMs] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [booksReadToday, setBooksReadToday] = useState(0);
  const [readingNotes, setReadingNotes] = useState(0);
  const [recentTimeline, setRecentTimeline] = useState<TodayTimelineEntry[]>([]);
  const [currentBookTotalMs, setCurrentBookTotalMs] = useState(0);
  const [currentBookPageCurrent, setCurrentBookPageCurrent] = useState(0);
  const [currentBookPageTotal, setCurrentBookPageTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Hero 卡片书籍：排除弃读和待读，按最近阅读时间排序
  const currentBook = (() => {
    const activeBooks = books.filter((b) => b.status !== 'abandoned' && b.status !== 'to_read');
    if (activeBooks.length === 0) return null;
    // 从时间线中取每本书的最近一次活动时间
    const latestByBook = new Map<string, string>();
    for (const t of recentTimeline) {
      const existing = latestByBook.get(t.bookId);
      if (!existing || t.startTime > existing) latestByBook.set(t.bookId, t.startTime);
    }
    const withTime = activeBooks
      .filter(b => latestByBook.has(b.id))
      .sort((a, b) => latestByBook.get(b.id)!.localeCompare(latestByBook.get(a.id)!));
    if (withTime.length > 0) return withTime[0];
    // 无时间线数据时，取最近更新的
    return activeBooks.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
  })();

  const hasAnyBooks = books.length > 0;

  const fetchTodayData = useCallback(async () => {
    try {
      const db = await getDatabase();

      // ------ 今日阅读时长 & 次数 ------
      const todayStr = localDate();

      // 取原始行，JS 中过滤今天 + 计算时长和次数
      const [todaySessAll, todayManAll] = await Promise.all([
        db.getAllAsync<{ duration_ms: number; start_time: string }>('SELECT duration_ms, start_time FROM reading_sessions'),
        db.getAllAsync<{ duration_ms: number; logged_at: string }>('SELECT duration_ms, logged_at FROM manual_logs'),
      ]);
      const todaySessRows = todaySessAll.filter(r => (r.start_time||'').startsWith(todayStr));
      const todayManRows = todayManAll.filter(r => (r.logged_at||'').startsWith(todayStr));

      const sessionMs = todaySessRows.reduce((s, r) => s + (r.duration_ms || 0), 0);
      const manualMs = todayManRows.reduce((s, r) => s + (r.duration_ms || 0), 0);
      const sCount = todaySessRows.length + todayManRows.length;

      setTodayMs(sessionMs + manualMs);
      setSessionCount(sCount);

      // ------ 连续阅读天数 (streak) ------
      const [adSess, adMan] = await Promise.all([
        db.getAllAsync<{ start_time: string }>('SELECT start_time FROM reading_sessions'),
        db.getAllAsync<{ logged_at: string }>('SELECT logged_at FROM manual_logs'),
      ]);
      const daySet2 = new Set<string>();
      for (const r of adSess) if (r.start_time) daySet2.add(r.start_time.slice(0, 10));
      for (const r of adMan) if (r.logged_at) daySet2.add(r.logged_at.slice(0, 10));
      const activeDays = [...daySet2].sort((a,b) => b.localeCompare(a)).map(day => ({ day }));

      const streakCount = calculateStreak(activeDays.map((r) => r.day));
      setStreak(streakCount);

      // ------ 今日阅读页数（每本书取最新记录页数，多本书合计） ------
      // 取所有记录，JS 中过滤今天 + 按书分组取最新
      const [manualRows, sessionRows] = await Promise.all([
        db.getAllAsync<{ book_id: string; page_number: number; logged_at: string }>(
          'SELECT book_id, page_number, logged_at FROM manual_logs ORDER BY logged_at DESC',
        ),
        db.getAllAsync<{ book_id: string; page_number: number; start_time: string }>(
          'SELECT book_id, page_number, start_time FROM reading_sessions ORDER BY start_time DESC',
        ),
      ]);
      // JS 中合并：过滤今天 + 每本书取最新 page_number
      const allRows = [
        ...manualRows.filter(r => (r.logged_at||'').startsWith(todayStr)).map(r => ({ book_id: r.book_id, page: Number(r.page_number) || 0, ts: r.logged_at })),
        ...sessionRows.filter(r => (r.start_time||'').startsWith(todayStr)).map(r => ({ book_id: r.book_id, page: Number(r.page_number) || 0, ts: r.start_time })),
      ];
      allRows.sort((a, b) => b.ts.localeCompare(a.ts));
      const seen = new Set<string>();
      let total = 0;
      for (const r of allRows) {
        if (!seen.has(r.book_id)) {
          seen.add(r.book_id);
          total += r.page;
        }
      }
      setTotalPages(total);

      // ------ 今日读过书籍数（全量查询 + JS 过滤今天）------
      const [brSessAll, brManAll] = await Promise.all([
        db.getAllAsync<{ book_id: string; start_time: string }>('SELECT book_id, start_time FROM reading_sessions'),
        db.getAllAsync<{ book_id: string; logged_at: string }>('SELECT book_id, logged_at FROM manual_logs'),
      ]);
      const bookIdSet = new Set<string>();
      for (const r of brSessAll) if ((r.start_time||'').startsWith(todayStr)) bookIdSet.add(r.book_id);
      for (const r of brManAll) if ((r.logged_at||'').startsWith(todayStr)) bookIdSet.add(r.book_id);
      setBooksReadToday(bookIdSet.size);

      // ------ 阅读笔记总数（想法 + 高亮） ------
      const [notesRow, highlightsRow] = await Promise.all([
        db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM notes'),
        db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM highlights'),
      ]);
      setReadingNotes((notesRow?.cnt ?? 0) + (highlightsRow?.cnt ?? 0));

      // ------ 阅读时间线（简单查询 + JS join，避免 Web DB JOIN 解析失败） ------
      const [allBooks, sessions, manualLogs] = await Promise.all([
        db.getAllAsync<{ id: string; title: string; author: string | null; created_at: string }>(
          'SELECT id, title, author, created_at FROM books'
        ),
        db.getAllAsync<{ id: string; book_id: string; duration_ms: number; start_time: string }>(
          'SELECT id, book_id, duration_ms, start_time FROM reading_sessions WHERE duration_ms > 0 ORDER BY start_time DESC LIMIT 30'
        ),
        db.getAllAsync<{ id: string; book_id: string; duration_ms: number; logged_at: string; completed_book: number }>(
          'SELECT id, book_id, duration_ms, logged_at, completed_book FROM manual_logs ORDER BY logged_at DESC LIMIT 30'
        ),
      ]);

      // 构建 bookId → book 映射
      const bookMap = new Map(allBooks.map((b) => [b.id, b]));

      // 组装时间线条目
      const timelineEntries: TodayTimelineEntry[] = [];

      for (const s of sessions) {
        const b = bookMap.get(s.book_id);
        if (b) timelineEntries.push({
          id: s.id, bookId: s.book_id, bookTitle: b.title, bookAuthor: b.author ?? null,
          durationMs: s.duration_ms, startTime: s.start_time, type: 'session',
        });
      }

      for (const m of manualLogs) {
        const b = bookMap.get(m.book_id);
        if (b) {
          if (m.duration_ms > 0) {
            timelineEntries.push({
              id: m.id, bookId: m.book_id, bookTitle: b.title, bookAuthor: b.author ?? null,
              durationMs: m.duration_ms, startTime: m.logged_at, type: 'manual',
            });
          }
          if (m.completed_book) {
            timelineEntries.push({
              id: m.id + '_c', bookId: m.book_id, bookTitle: b.title, bookAuthor: b.author ?? null,
              durationMs: 0, startTime: m.logged_at, type: 'completed',
            });
          }
        }
      }

      for (const b of allBooks) {
        timelineEntries.push({
          id: b.id + '_a', bookId: b.id, bookTitle: b.title, bookAuthor: b.author ?? null,
          durationMs: 0, startTime: b.created_at, type: 'added',
        });
      }

      // 按时间倒序，取最近 15 条
      timelineEntries.sort((a, b) => b.startTime.localeCompare(a.startTime));
      setRecentTimeline(timelineEntries.slice(0, 15));

      // ------ 当前书籍总阅读时长 + 页码 ------
      // 在 fetchTodayData 内重新选取 hero 书籍，确保与最新的 recentTimeline 同步
      const heroBook = (() => {
        const activeBooks = books.filter((b: Book) => b.status !== 'abandoned' && b.status !== 'to_read');
        if (activeBooks.length === 0) return null;
        const latestByBook = new Map<string, string>();
        for (const t of recentTimeline) {
          const existing = latestByBook.get(t.bookId);
          if (!existing || t.startTime > existing) latestByBook.set(t.bookId, t.startTime);
        }
        const withTime = activeBooks
          .filter(b => latestByBook.has(b.id))
          .sort((a, b) => latestByBook.get(b.id)!.localeCompare(latestByBook.get(a.id)!));
        if (withTime.length > 0) return withTime[0];
        return null;
      })();
      if (heroBook) {
        // 取原始行，JS 计算总时长（避免 SUM 失败）
        const [hSess, hMan] = await Promise.all([
          db.getAllAsync<{ duration_ms: number }>('SELECT duration_ms FROM reading_sessions WHERE book_id = ? AND duration_ms IS NOT NULL', [heroBook.id]),
          db.getAllAsync<{ duration_ms: number }>('SELECT duration_ms FROM manual_logs WHERE book_id = ?', [heroBook.id]),
        ]);
        const sessMs = hSess.reduce((s,r) => s + (r.duration_ms||0), 0);
        const manMs = hMan.reduce((s,r) => s + (r.duration_ms||0), 0);
        setCurrentBookTotalMs(sessMs + manMs);

        // ------ 当前书籍页码进度（取最近一次记录的页数） ------
        const [heroManual, heroSession] = await Promise.all([
          db.getAllAsync<{ page_number: number; logged_at: string }>(
            'SELECT page_number, logged_at FROM manual_logs WHERE book_id = ?', [heroBook.id],
          ),
          db.getAllAsync<{ page_number: number; start_time: string }>(
            'SELECT page_number, start_time FROM reading_sessions WHERE book_id = ?', [heroBook.id],
          ),
        ]);
        const allHero = [...heroManual.map(r => ({ p: Number(r.page_number)||0, t: r.logged_at })), ...heroSession.map(r => ({ p: Number(r.page_number)||0, t: r.start_time }))];
        allHero.sort((a, b) => b.t.localeCompare(a.t));
        const validPages = allHero.filter(r => Number(r.p) > 0);
        setCurrentBookPageCurrent(validPages[0]?.p ?? 0);
        setCurrentBookPageTotal(heroBook.page_count ?? null);
      }
    } catch (e) {
      console.error('useToday fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [books]);

  // 初始化：确保 BookStore 已加载，然后拉取 Today 数据
  useEffect(() => {
    const init = async () => {
      if (books.length === 0) {
        await fetchBooks();
      }
      await fetchTodayData();
    };
    init();
  }, []);

  // 当 books 变化时刷新（例如从其他页面返回后新增了书）
  useEffect(() => {
    if (books.length > 0) {
      fetchTodayData();
    }
  }, [books.length]);

  return {
    todayMs,
    sessionCount,
    streak,
    totalPages,
    booksReadToday,
    readingNotes,
    dailyGoalMs: dailyGoalMs(),
    recentTimeline,
    currentBook,
    currentBookTotalMs,
    currentBookPageCurrent,
    currentBookPageTotal,
    hasAnyBooks,
    loading,
    refresh: fetchTodayData,
  };
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 计算连续阅读天数
 * 从今天开始往回数，遇到第一个没有记录的天就停止。
 * 如果今天没有记录但昨天有，从昨天开始算。
 */
function calculateStreak(days: string[]): number {
  if (days.length === 0) return 0;

  const daySet = new Set(days);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;

  // 最近一次阅读既不是今天也不是昨天 → streak = 0
  if (!daySet.has(todayStr) && !daySet.has(yesterdayStr)) {
    return 0;
  }

  let streak = 0;
  const checkDate = new Date(today);

  // 如果今天没有记录但从昨天开始有，streak 从昨天算起
  if (!daySet.has(todayStr)) {
    streak = 1;
    checkDate.setDate(checkDate.getDate() - 2); // 从前天开始继续检查
  }

  // 从 checkDate 往回数连续天数
  while (true) {
    const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth()+1).padStart(2,'0')}-${String(checkDate.getDate()).padStart(2,'0')}`;
    if (daySet.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}
