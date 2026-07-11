import { AppState, type AppStateStatus } from 'react-native';
import { create } from 'zustand';
import { getDatabase } from '../db/database';
import { generateId } from '../utils/id';
import { localISO } from '../utils/format';

// ---- 模块级 interval 引用（不存入 Zustand） ----
let timerInterval: ReturnType<typeof setInterval> | null = null;

// ---- AppState 监听器是否已注册 ----
let appStateListenerRegistered = false;

interface TimerState {
  /** 当前计时的书本 ID */
  bookId: string | null;
  /** 阅读来源 ID（可选） */
  sourceId: string | null;
  /** 来源标签 */
  sourceLabel: string | null;
  /** 当前连续计时段开始时间戳 (ms) */
  segmentStart: number | null;
  /** 之前已累计的毫秒数 */
  accumulatedMs: number;
  /** 暂停时间戳（null = 未暂停） */
  pausedAt: number | null;
  /** tick 计数器，每秒 +1 驱动组件重渲染 */
  tickCount: number;
  /** App 退到后台的时间戳（null = 在前台） */
  backgroundedAt: number | null;

  /** Reader 传来的最新进度（预填停止弹窗用） */
  lastProgress: {
    pageNumber?: number;
    chapter?: string;
  };

  /** 停止弹窗状态 */
  stopSheet: {
    visible: boolean;
    bookId: string | null;
    sourceId: string | null;
    sessionId: string | null;
    durationMs: number;
  };
}

interface TimerActions {
  /** 开始计时（新会话） */
  startTimer: (bookId: string, sourceId?: string, sourceLabel?: string) => void;
  /** 暂停计时 */
  pauseTimer: () => void;
  /** 恢复计时 */
  resumeTimer: () => void;
  /** 停止计时，保存基础会话，返回 { sessionId, durationMs }（不含页数/章节） */
  stopTimer: () => Promise<{ sessionId: string; durationMs: number } | null>;
  /** 补填会话的页数/章节/读完标记 */
  finalizeSession: (
    sessionId: string,
    data: { pageNumber?: number; chapter?: string; completedBook?: boolean },
  ) => Promise<void>;
  /** 关闭停止弹窗 */
  dismissStopSheet: () => void;
  /** Reader 调用：更新最新阅读进度（预填停止弹窗用） */
  updateReadingProgress: (pageNumber: number | null, chapter: string | null) => void;
  /** AppState 变化处理（后台计时补偿） */
  handleAppStateChange: (nextState: AppStateStatus) => void;
  /** 内部 tick（每秒调用） */
  tick: () => void;
  /** 内部重置 */
  _reset: () => void;
  /** 获取当前已流逝毫秒数 */
  getElapsedMs: () => number;
}

/** 注册全局 AppState 监听（仅一次） */
function ensureAppStateListener() {
  if (appStateListenerRegistered) return;
  appStateListenerRegistered = true;
  AppState.addEventListener('change', (nextState) => {
    useTimerStore.getState().handleAppStateChange(nextState);
  });
}

export const useTimerStore = create<TimerState & TimerActions>((set, get) => {
  // 确保 AppState 监听已注册
  ensureAppStateListener();

  return {
    bookId: null,
    sourceId: null,
    sourceLabel: null,
    segmentStart: null,
    accumulatedMs: 0,
    pausedAt: null,
    tickCount: 0,
    backgroundedAt: null,
    lastProgress: {},
    stopSheet: {
      visible: false,
      bookId: null,
      sourceId: null,
      sessionId: null,
      durationMs: 0,
    },

    // ===== 获取当前流逝时间 =====
    getElapsedMs: () => {
      const { segmentStart, accumulatedMs, pausedAt } = get();
      if (segmentStart === null) return accumulatedMs;
      const endPoint = pausedAt ?? Date.now();
      return accumulatedMs + (endPoint - segmentStart);
    },

    // ===== 开始计时 =====
    startTimer: (bookId, sourceId, sourceLabel) => {
      const current = get();
      // 如果已有计时在运行，先停止
      if (current.segmentStart !== null && timerInterval) {
        clearInterval(timerInterval);
      }

      const now = Date.now();
      set({
        bookId,
        sourceId: sourceId ?? null,
        sourceLabel: sourceLabel ?? null,
        segmentStart: now,
        accumulatedMs: 0,
        pausedAt: null,
        tickCount: 0,
        backgroundedAt: null,
        lastProgress: {},
        stopSheet: { visible: false, bookId: null, sourceId: null, sessionId: null, durationMs: 0 },
      });

      // 启动每秒 tick
      timerInterval = setInterval(() => {
        get().tick();
      }, 1000);
    },

    // ===== 暂停计时 =====
    pauseTimer: () => {
      const { segmentStart, accumulatedMs } = get();
      if (segmentStart === null) return;

      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }

      const now = Date.now();
      set({
        accumulatedMs: accumulatedMs + (now - segmentStart),
        segmentStart: null,
        pausedAt: now,
      });
    },

    // ===== 恢复计时 =====
    resumeTimer: () => {
      const { pausedAt } = get();
      if (pausedAt === null) return;

      const now = Date.now();
      set({
        segmentStart: now,
        pausedAt: null,
      });

      timerInterval = setInterval(() => {
        get().tick();
      }, 1000);
    },

    // ===== 停止计时（保存基础会话，不保存页数/章节） =====
    stopTimer: async () => {
      const { bookId, sourceId, sourceLabel, segmentStart, accumulatedMs, backgroundedAt } = get();
      if (!bookId) return null;

      // 停止 interval
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }

      // 计算最终时长（含后台补偿）
      const now = Date.now();
      let bonusMs = 0;
      if (backgroundedAt && segmentStart !== null) {
        bonusMs = now - backgroundedAt;
      }
      const finalMs =
        segmentStart !== null
          ? accumulatedMs + (now - segmentStart) + bonusMs
          : accumulatedMs;

      // 时长太短不保存（< 10 秒）
      if (finalMs < 10_000) {
        set({
          bookId: null,
          sourceId: null,
          sourceLabel: null,
          segmentStart: null,
          accumulatedMs: 0,
          pausedAt: null,
          tickCount: 0,
          backgroundedAt: null,
          lastProgress: {},
        });
        return null;
      }

      // 写入基础会话（不含页数/章节）
      const db = await getDatabase();
      const sessionId = generateId();
      const startTime = localISO(now - finalMs);
      const endTime = localISO(now);

      await db.runAsync(
        `INSERT INTO reading_sessions (id, book_id, source_id, start_time, end_time, duration_ms, source_label)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [sessionId, bookId, sourceId ?? null, startTime, endTime, finalMs, sourceLabel ?? null],
      );

      // 显示停止弹窗
      set({
        bookId: null,
        sourceId: null,
        sourceLabel: null,
        segmentStart: null,
        accumulatedMs: 0,
        pausedAt: null,
        tickCount: 0,
        backgroundedAt: null,
        stopSheet: {
          visible: true,
          bookId,
          sourceId,
          sessionId,
          durationMs: finalMs,
        },
      });

      return { sessionId, durationMs: finalMs };
    },

    // ===== 补填会话的页数/章节/读完 =====
    finalizeSession: async (sessionId, data) => {
      const db = await getDatabase();

      await db.runAsync(
        `UPDATE reading_sessions
         SET page_number = ?, chapter = ?, completed_book = ?
         WHERE id = ?`,
        [
          data.pageNumber ?? null,
          data.chapter ?? null,
          data.completedBook ? 1 : 0,
          sessionId,
        ],
      );

      // 如果标记为读完，更新书籍状态
      if (data.completedBook) {
        const { stopSheet } = get();
        if (stopSheet.bookId) {
          await db.runAsync(
            `UPDATE books SET status = 'finished', finished_date = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
            [stopSheet.bookId],
          );
        }
      }
    },

    // ===== 关闭停止弹窗 =====
    dismissStopSheet: () => {
      set({
        stopSheet: { visible: false, bookId: null, sourceId: null, sessionId: null, durationMs: 0 },
        lastProgress: {},
      });
    },

    // ===== Reader 调用：更新最新阅读进度 =====
    updateReadingProgress: (pageNumber, chapter) => {
      set({
        lastProgress: {
          pageNumber: pageNumber ?? undefined,
          chapter: chapter ?? undefined,
        },
      });
    },

    // ===== AppState 变化处理（后台计时补偿） =====
    handleAppStateChange: (nextState: AppStateStatus) => {
      const { segmentStart, pausedAt } = get();

      if (nextState === 'active') {
        // 从后台回到前台：补上后台时间
        const { backgroundedAt, accumulatedMs } = get();
        if (backgroundedAt && segmentStart !== null && pausedAt === null) {
          const elapsed = Date.now() - backgroundedAt;
          set({
            accumulatedMs: accumulatedMs + elapsed,
            segmentStart: Date.now(),
            backgroundedAt: null,
          });
          // 重启 interval
          if (timerInterval) clearInterval(timerInterval);
          timerInterval = setInterval(() => {
            get().tick();
          }, 1000);
        } else {
          set({ backgroundedAt: null });
        }
      } else if (nextState === 'inactive' || nextState === 'background') {
        // 进入后台：记录时间戳，停止 interval
        if (segmentStart !== null && pausedAt === null) {
          set({ backgroundedAt: Date.now() });
          if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
          }
        }
      }
    },

    // ===== 每秒 tick =====
    tick: () => {
      const { backgroundedAt } = get();
      // 后台不 tick（timerInterval 应该在后台被清除，但作为安全网）
      if (backgroundedAt !== null) return;
      set((s) => ({ tickCount: s.tickCount + 1 }));
    },

    // ===== 内部重置 =====
    _reset: () => {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      set({
        bookId: null,
        sourceId: null,
        sourceLabel: null,
        segmentStart: null,
        accumulatedMs: 0,
        pausedAt: null,
        tickCount: 0,
        backgroundedAt: null,
        lastProgress: {},
        stopSheet: { visible: false, bookId: null, sourceId: null, sessionId: null, durationMs: 0 },
      });
    },
  };
});
