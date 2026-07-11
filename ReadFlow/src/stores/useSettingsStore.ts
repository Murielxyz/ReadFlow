import { create } from 'zustand';
import { getDatabase } from '../db/database';

/**
 * 每日阅读目标预设选项（分钟）
 */
export const GOAL_OPTIONS = [
  { label: '15 分钟', value: 15 },
  { label: '30 分钟', value: 30 },
  { label: '45 分钟', value: 45 },
  { label: '60 分钟', value: 60 },
  { label: '90 分钟', value: 90 },
  { label: '120 分钟', value: 120 },
] as const;

/**
 * 每日阅读提醒时间预设选项
 */
export const REMINDER_TIME_OPTIONS = [
  { label: '08:00', value: '08:00' },
  { label: '12:00', value: '12:00' },
  { label: '18:00', value: '18:00' },
  { label: '20:00', value: '20:00' },
  { label: '21:00', value: '21:00' },
  { label: '22:00', value: '22:00' },
] as const;

interface SettingsState {
  /** 每日阅读目标（分钟） */
  dailyGoalMinutes: number;
  /** 设置每日阅读目标 */
  setDailyGoal: (minutes: number) => void;
  /** 获取每日阅读目标（毫秒） */
  dailyGoalMs: () => number;

  // ---- 用户资料 ----

  /** 用户显示名称 */
  userName: string;
  /** 用户个性签名 */
  userBio: string;
  /** 设置用户名称（持久化到 SQLite） */
  setUserName: (name: string) => Promise<void>;
  /** 设置用户个性签名（持久化到 SQLite） */
  setUserBio: (bio: string) => Promise<void>;

  // ---- 每日阅读提醒 ----

  /** 提醒是否开启 */
  reminderEnabled: boolean;
  /** 提醒时间（HH:MM 格式） */
  reminderTime: string;
  /** 设置提醒开关状态（持久化到 SQLite） */
  setReminderEnabled: (enabled: boolean) => Promise<void>;
  /** 设置提醒时间（持久化到 SQLite） */
  setReminderTime: (time: string) => Promise<void>;
  /** 从 SQLite 加载已保存的设置 */
  loadSettings: () => Promise<void>;
}

/**
 * 将设置写入 user_settings 表
 */
async function saveSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)',
    [key, value],
  );
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  dailyGoalMinutes: 30,

  setDailyGoal: (minutes: number) => {
    set({ dailyGoalMinutes: minutes });
    saveSetting('daily_goal', String(minutes)); // fire-and-forget 持久化
  },

  dailyGoalMs: () => {
    return get().dailyGoalMinutes * 60 * 1000;
  },

  // ---- 用户资料 ----

  userName: 'ReadFlow 读者',
  userBio: '热爱阅读，每天进步一点点 📚',

  setUserName: async (name: string) => {
    set({ userName: name });
    await saveSetting('user_name', name);
  },

  setUserBio: async (bio: string) => {
    set({ userBio: bio });
    await saveSetting('user_bio', bio);
  },

  // ---- 每日阅读提醒 ----

  reminderEnabled: false,
  reminderTime: '20:00',

  setReminderEnabled: async (enabled: boolean) => {
    set({ reminderEnabled: enabled });
    await saveSetting('reminder_enabled', enabled ? 'true' : 'false');
  },

  setReminderTime: async (time: string) => {
    set({ reminderTime: time });
    await saveSetting('reminder_time', time);
  },

  loadSettings: async () => {
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<{ key: string; value: string }>(
        'SELECT key, value FROM user_settings',
      );
      const map: Record<string, string> = {};
      for (const row of rows) {
        map[row.key] = row.value;
      }
      set({
        dailyGoalMinutes: parseInt(map['daily_goal'] ?? '30', 10),
        userName: map['user_name'] ?? 'ReadFlow 读者',
        userBio: map['user_bio'] ?? '热爱阅读，每天进步一点点 📚',
        reminderEnabled: map['reminder_enabled'] === 'true',
        reminderTime: map['reminder_time'] ?? '20:00',
      });
    } catch (e) {
      // 首次启动时 user_settings 表可能还没创建（迁移未运行），忽略错误
      console.warn('loadSettings: failed to load settings', e);
    }
  },
}));
