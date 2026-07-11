import { useState, useEffect, useCallback } from 'react';
import { getDatabase } from '../db/database';
import type { Book, ReadingSession, ManualLog, ReadingGoal } from '../models';

// ============================================================
// 类型定义
// ============================================================

export interface FinishedBook {
  id: string;
  title: string;
  author: string | null;
  rating: number | null;
  accent_color: string | null;
  totalReadingMs: number;
  finished_date: string | null;
}

export interface WeeklyRecord {
  date: string;
  bookId: string;
  bookTitle: string;
  durationMs: number;
  type: 'session' | 'manual';
}

export interface DailyBreakdown {
  dayLabel: string;   // 一/二/三/四/五/六/日
  date: string;
  minutes: number;
  completedBooks: string[]; // 当天读完的书名
}

export interface MonthlyBreakdown {
  month: number; // 1-12
  label: string; // "1月"
  completedCount: number;
  totalMs: number;
}

export interface MonthlyFinishedBook extends FinishedBook {
  /** 读完日期（日，1-31） */
  finishedDay: number | null;
}

export interface StatisticsData {
  // ---- 基础统计 ----
  totalMs: number;
  completedBooks: number;
  readingDays: number;
  notesCount: number;
  highlightsCount: number;
  monthlyMs: number;
  weeklyMs: number;

  // ---- 书本统计 ----
  readingCount: number;
  finishedCount: number;
  totalCount: number;

  // ---- 热力图 ----
  heatmap: { date: string; minutes: number }[];

  // ---- 已读完书籍 ----
  finishedBooks: FinishedBook[];
  allFinishedBooks: FinishedBook[]; // 所有已读完（含 finished_date）

  // ---- 年度 ----
  yearlyGoal: ReadingGoal | null;
  yearlyCompleted: number;
  yearlyTotalMs: number;
  yearlyReadingDays: number;
  yearlyMonthlyBreakdown: MonthlyBreakdown[];
  yearlyFinishedBooks: FinishedBook[];

  // ---- 月度 ----
  monthlyCompletedBooks: number;
  monthlyReadingDays: number;
  monthlyFinishedBooks: MonthlyFinishedBook[];
  monthlyCalendarDays: { day: number; date: string; minutes: number; hasFinished: boolean }[];

  // ---- 周度 ----
  weeklyCompletedBooks: number;
  weeklyReadingDays: number;
  weeklyDailyBreakdown: DailyBreakdown[];
  weeklyRecords: WeeklyRecord[];

  // ---- 状态 ----
  loading: boolean;
  refresh: () => Promise<void>;
}

// ============================================================
// 辅助
// ============================================================

const DAY_LABELS_SHORT = ['日', '一', '二', '三', '四', '五', '六'];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getYearStart(year: number): Date {
  return new Date(year, 0, 1);
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ============================================================
// Hook
// ============================================================

export function useStatistics(selectedYear?: number, selectedMonth?: number): StatisticsData {
  // ---- 基础 ----
  const [totalMs, setTotalMs] = useState(0);
  const [completedBooks, setCompletedBooks] = useState(0);
  const [readingDays, setReadingDays] = useState(0);
  const [notesCount, setNotesCount] = useState(0);
  const [highlightsCount, setHighlightsCount] = useState(0);
  const [monthlyMs, setMonthlyMs] = useState(0);
  const [weeklyMs, setWeeklyMs] = useState(0);
  const [readingCount, setReadingCount] = useState(0);
  const [finishedCount, setFinishedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [heatmap, setHeatmap] = useState<{ date: string; minutes: number }[]>([]);
  const [finishedBooks, setFinishedBooks] = useState<FinishedBook[]>([]);
  const [allFinishedBooks, setAllFinishedBooks] = useState<FinishedBook[]>([]);

  // ---- 年度 ----
  const [yearlyGoal, setYearlyGoal] = useState<ReadingGoal | null>(null);
  const [yearlyCompleted, setYearlyCompleted] = useState(0);
  const [yearlyTotalMs, setYearlyTotalMs] = useState(0);
  const [yearlyReadingDays, setYearlyReadingDays] = useState(0);
  const [yearlyMonthlyBreakdown, setYearlyMonthlyBreakdown] = useState<MonthlyBreakdown[]>([]);
  const [yearlyFinishedBooks, setYearlyFinishedBooks] = useState<FinishedBook[]>([]);

  // ---- 月度 ----
  const [monthlyCompletedBooks, setMonthlyCompletedBooks] = useState(0);
  const [monthlyReadingDays, setMonthlyReadingDays] = useState(0);
  const [monthlyFinishedBooks, setMonthlyFinishedBooks] = useState<MonthlyFinishedBook[]>([]);
  const [monthlyCalendarDays, setMonthlyCalendarDays] = useState<
    { day: number; date: string; minutes: number; hasFinished: boolean }[]
  >([]);

  // ---- 周度 ----
  const [weeklyCompletedBooks, setWeeklyCompletedBooks] = useState(0);
  const [weeklyReadingDays, setWeeklyReadingDays] = useState(0);
  const [weeklyDailyBreakdown, setWeeklyDailyBreakdown] = useState<DailyBreakdown[]>([]);
  const [weeklyRecords, setWeeklyRecords] = useState<WeeklyRecord[]>([]);

  const [loading, setLoading] = useState(true);

  const year = selectedYear ?? new Date().getFullYear();
  const month = selectedMonth ?? new Date().getMonth() + 1;

  const fetchStats = useCallback(async () => {
    try {
      const db = await getDatabase();
      const now = new Date();

      // ===== 书本统计 =====
      const books = await db.getAllAsync<Book>(
        'SELECT * FROM books ORDER BY updated_at DESC',
      );
      setTotalCount(books.length);
      setReadingCount(books.filter((b) => b.status === 'reading').length);
      setFinishedCount(books.filter((b) => b.status === 'finished').length);
      setCompletedBooks(books.filter((b) => b.status === 'finished').length);

      // ===== 阅读记录 =====
      const sessions = await db.getAllAsync<ReadingSession>(
        'SELECT * FROM reading_sessions WHERE duration_ms IS NOT NULL',
      );
      const manualLogs = await db.getAllAsync<ManualLog>(
        'SELECT * FROM manual_logs',
      );

      const sessionTotal = sessions.reduce((sum, s) => sum + (s.duration_ms ?? 0), 0);
      const manualTotal = manualLogs.reduce((sum, m) => sum + m.duration_ms, 0);
      setTotalMs(sessionTotal + manualTotal);

      // 阅读天数（去重日期）
      const allDates = new Set<string>();
      for (const s of sessions) allDates.add(s.start_time.split('T')[0]);
      for (const m of manualLogs) allDates.add(m.logged_at.split('T')[0]);
      setReadingDays(allDates.size);

      // 本月 / 本周
      const monthStart = getMonthStart(now);
      const weekStart = getWeekStart(now);

      function inRange(dateStr: string, start: Date, end?: Date): boolean {
        const t = new Date(dateStr).getTime();
        if (end && t >= end.getTime()) return false;
        return t >= start.getTime();
      }

      const monthSess = sessions.filter((s) => inRange(s.start_time, monthStart)).reduce((sum, s) => sum + (s.duration_ms ?? 0), 0);
      const monthMan = manualLogs.filter((m) => inRange(m.logged_at, monthStart)).reduce((sum, m) => sum + m.duration_ms, 0);
      setMonthlyMs(monthSess + monthMan);

      const weekSessionMs = sessions.filter((s) => inRange(s.start_time, weekStart)).reduce((sum, s) => sum + (s.duration_ms ?? 0), 0);
      const weekManualMs = manualLogs.filter((m) => inRange(m.logged_at, weekStart)).reduce((sum, m) => sum + m.duration_ms, 0);
      setWeeklyMs(weekSessionMs + weekManualMs);

      // ===== 热力图（90天） =====
      setHeatmap(buildHeatmap(sessions, manualLogs));

      // ===== 年度目标 =====
      const goals = await db.getAllAsync<ReadingGoal>(
        'SELECT * FROM reading_goals WHERE year = ?', [year],
      );
      const goal = goals.length > 0 ? goals[0] : null;
      setYearlyGoal(goal);

      // ===== 年度数据 =====
      const yearStart = getYearStart(year);
      const yearEnd = getYearStart(year + 1);

      const yearSessions = sessions.filter((s) => inRange(s.start_time, yearStart, yearEnd));
      const yearManuals = manualLogs.filter((m) => inRange(m.logged_at, yearStart, yearEnd));
      const yearTotalMs = yearSessions.reduce((sum, s) => sum + (s.duration_ms ?? 0), 0) +
        yearManuals.reduce((sum, m) => sum + m.duration_ms, 0);
      setYearlyTotalMs(yearTotalMs);

      const yearDates = new Set<string>();
      for (const s of yearSessions) yearDates.add(s.start_time.split('T')[0]);
      for (const m of yearManuals) yearDates.add(m.logged_at.split('T')[0]);
      setYearlyReadingDays(yearDates.size);

      const yearFinished = books.filter((b) => {
        if (b.status !== 'finished') return false;
        if (!b.finished_date) return false;
        const t = new Date(b.finished_date).getTime();
        return t >= yearStart.getTime() && t < yearEnd.getTime();
      });
      setYearlyCompleted(yearFinished.length);

      // 月度细分
      const breakdown: MonthlyBreakdown[] = [];
      for (let m = 1; m <= 12; m++) {
        const ms = new Date(year, m - 1, 1);
        const me = new Date(year, m, 1);
        const mSess = yearSessions.filter((s) => inRange(s.start_time, ms, me)).reduce((sum, s) => sum + (s.duration_ms ?? 0), 0);
        const mMan = yearManuals.filter((ml) => inRange(ml.logged_at, ms, me)).reduce((sum, ml) => sum + ml.duration_ms, 0);
        const mFinished = yearFinished.filter((b) => {
          if (!b.finished_date) return false;
          const t = new Date(b.finished_date).getTime();
          return t >= ms.getTime() && t < me.getTime();
        }).length;
        breakdown.push({ month: m, label: `${m}月`, completedCount: mFinished, totalMs: mSess + mMan });
      }
      setYearlyMonthlyBreakdown(breakdown);

      // 年度已读
      const yearlyFB: FinishedBook[] = yearFinished.map((b) => {
        const bs = yearSessions.filter((s) => s.book_id === b.id).reduce((sum, s) => sum + (s.duration_ms ?? 0), 0);
        const bm = yearManuals.filter((ml) => ml.book_id === b.id).reduce((sum, ml) => sum + ml.duration_ms, 0);
        return { id: b.id, title: b.title, author: b.author, rating: b.rating, accent_color: b.accent_color, totalReadingMs: bs + bm, finished_date: b.finished_date };
      });
      setYearlyFinishedBooks(yearlyFB);

      // ===== 月度数据 =====
      const msDate = new Date(year, month - 1, 1);
      const meDate = new Date(year, month, 1);
      const monSess = sessions.filter((s) => inRange(s.start_time, msDate, meDate));
      const monMan = manualLogs.filter((m) => inRange(m.logged_at, msDate, meDate));
      const monDates = new Set<string>();
      for (const s of monSess) monDates.add(s.start_time.split('T')[0]);
      for (const m of monMan) monDates.add(m.logged_at.split('T')[0]);
      setMonthlyReadingDays(monDates.size);

      const monFinished = books.filter((b) => {
        if (b.status !== 'finished') return false;
        if (!b.finished_date) return false;
        const t = new Date(b.finished_date).getTime();
        return t >= msDate.getTime() && t < meDate.getTime();
      });
      setMonthlyCompletedBooks(monFinished.length);

      // 日历格子
      const daysInMonth = new Date(year, month, 0).getDate();
      const calDays: { day: number; date: string; minutes: number; hasFinished: boolean }[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        let mins = 0;
        for (const s of monSess) if (s.start_time.startsWith(date)) mins += Math.floor((s.duration_ms ?? 0) / 60000);
        for (const m of monMan) if (m.logged_at.startsWith(date)) mins += Math.floor(m.duration_ms / 60000);
        const hasFinished = monFinished.some((b) => b.finished_date?.startsWith(date));
        calDays.push({ day: d, date, minutes: mins, hasFinished });
      }
      setMonthlyCalendarDays(calDays);

      const monFB: MonthlyFinishedBook[] = monFinished.map((b) => {
        const bs = monSess.filter((s) => s.book_id === b.id).reduce((sum, s) => sum + (s.duration_ms ?? 0), 0);
        const bm = monMan.filter((ml) => ml.book_id === b.id).reduce((sum, ml) => sum + ml.duration_ms, 0);
        const fd = b.finished_date ? parseInt(b.finished_date.split('-')[2] ?? '0', 10) : null;
        return { id: b.id, title: b.title, author: b.author, rating: b.rating, accent_color: b.accent_color, totalReadingMs: bs + bm, finished_date: b.finished_date, finishedDay: fd };
      });
      setMonthlyFinishedBooks(monFB);

      // ===== 周度数据 =====
      const wsDate = getWeekStart(now);
      const weDate = new Date(wsDate);
      weDate.setDate(weDate.getDate() + 7);
      const weekSess = sessions.filter((s) => inRange(s.start_time, wsDate, weDate));
      const weekMan = manualLogs.filter((m) => inRange(m.logged_at, wsDate, weDate));
      const weekDates = new Set<string>();
      for (const s of weekSess) weekDates.add(s.start_time.split('T')[0]);
      for (const m of weekMan) weekDates.add(m.logged_at.split('T')[0]);
      setWeeklyReadingDays(weekDates.size);

      const weekFB = books.filter((b) => {
        if (b.status !== 'finished') return false;
        if (!b.finished_date) return false;
        const t = new Date(b.finished_date).getTime();
        return t >= wsDate.getTime() && t < weDate.getTime();
      });
      setWeeklyCompletedBooks(weekFB.length);

      // 每日细分
      const dailyBreakdown: DailyBreakdown[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(wsDate);
        d.setDate(d.getDate() + i);
        const ds = dateStr(d);
        let mins = 0;
        const completedTitles: string[] = [];
        for (const s of weekSess) if (s.start_time.startsWith(ds)) mins += Math.floor((s.duration_ms ?? 0) / 60000);
        for (const m of weekMan) if (m.logged_at.startsWith(ds)) mins += Math.floor(m.duration_ms / 60000);
        for (const b of weekFB) if (b.finished_date?.startsWith(ds)) completedTitles.push(b.title);
        dailyBreakdown.push({
          dayLabel: DAY_LABELS_SHORT[d.getDay()],
          date: ds,
          minutes: mins,
          completedBooks: completedTitles,
        });
      }
      setWeeklyDailyBreakdown(dailyBreakdown);

      // 本周记录列表
      const records: WeeklyRecord[] = [];
      for (const s of weekSess) {
        const book = books.find((b) => b.id === s.book_id);
        records.push({ date: s.start_time, bookId: s.book_id, bookTitle: book?.title ?? '未知', durationMs: s.duration_ms ?? 0, type: 'session' });
      }
      for (const m of weekMan) {
        const book = books.find((b) => b.id === m.book_id);
        records.push({ date: m.logged_at, bookId: m.book_id, bookTitle: book?.title ?? '未知', durationMs: m.duration_ms, type: 'manual' });
      }
      records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setWeeklyRecords(records);

      // ===== 所有已读完 =====
      const allFB: FinishedBook[] = books
        .filter((b) => b.status === 'finished')
        .map((b) => {
          const bs = sessions.filter((s) => s.book_id === b.id).reduce((sum, s) => sum + (s.duration_ms ?? 0), 0);
          const bm = manualLogs.filter((m) => m.book_id === b.id).reduce((sum, m) => sum + m.duration_ms, 0);
          return { id: b.id, title: b.title, author: b.author, rating: b.rating, accent_color: b.accent_color, totalReadingMs: bs + bm, finished_date: b.finished_date };
        })
        .sort((a, b) => {
          if (a.finished_date && b.finished_date) return new Date(b.finished_date).getTime() - new Date(a.finished_date).getTime();
          if (a.finished_date) return -1;
          if (b.finished_date) return 1;
          return b.totalReadingMs - a.totalReadingMs;
        });
      setAllFinishedBooks(allFB);

      // 笔记数量
      const noteRow = await db.getFirstAsync<{ cnt: number }>(
        'SELECT COUNT(*) as cnt FROM notes',
      );
      setNotesCount(noteRow?.cnt ?? 0);

      // 高亮数量
      const highlightRow = await db.getFirstAsync<{ cnt: number }>(
        'SELECT COUNT(*) as cnt FROM highlights',
      );
      setHighlightsCount(highlightRow?.cnt ?? 0);

      // 最近已读完（前20）
      setFinishedBooks(allFB.slice(0, 20));
    } catch (e) {
      console.error('useStatistics fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    totalMs, completedBooks, readingDays, notesCount, highlightsCount,
    monthlyMs, weeklyMs,
    readingCount, finishedCount, totalCount,
    heatmap,
    finishedBooks, allFinishedBooks,
    yearlyGoal, yearlyCompleted, yearlyTotalMs, yearlyReadingDays,
    yearlyMonthlyBreakdown, yearlyFinishedBooks,
    monthlyCompletedBooks, monthlyReadingDays, monthlyFinishedBooks, monthlyCalendarDays,
    weeklyCompletedBooks, weeklyReadingDays, weeklyDailyBreakdown, weeklyRecords,
    loading,
    refresh: fetchStats,
  };
}

// ============================================================
// 辅助函数
// ============================================================

function buildHeatmap(
  sessions: ReadingSession[],
  manualLogs: ManualLog[],
): { date: string; minutes: number }[] {
  const dayMap = new Map<string, number>();
  const now = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dayMap.set(dateStr(d), 0);
  }
  for (const s of sessions) {
    const key = s.start_time.split('T')[0];
    if (dayMap.has(key)) dayMap.set(key, dayMap.get(key)! + Math.floor((s.duration_ms ?? 0) / 60000));
  }
  for (const m of manualLogs) {
    const key = m.logged_at.split('T')[0];
    if (dayMap.has(key)) dayMap.set(key, dayMap.get(key)! + Math.floor(m.duration_ms / 60000));
  }
  const result: { date: string; minutes: number }[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = dateStr(d);
    result.push({ date: key, minutes: dayMap.get(key) ?? 0 });
  }
  return result;
}
