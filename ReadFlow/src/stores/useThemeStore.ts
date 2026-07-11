import { create } from 'zustand';
import { getDatabase } from '../db/database';
import {
  paper,
  darkPaper,
  ink,
  darkInk,
  outline,
  darkOutline,
  accent as lightAccent,
  darkAccent,
  status as lightStatus,
  darkStatus,
  error as lightError,
  darkError,
  ACCENT_PRESETS,
  type AccentPreset,
} from '../theme/colors';

export type ThemeMode = 'light' | 'dark';

/**
 * 将主题偏好写入 user_settings 表
 */
async function saveSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)',
    [key, value],
  );
}

interface ThemeState {
  mode: ThemeMode;
  accentPreset: AccentPreset;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggle: () => Promise<void>;
  setAccentPreset: (preset: AccentPreset) => Promise<void>;
  /** 从 SQLite 加载已保存的主题偏好 */
  loadTheme: () => Promise<void>;
}

/**
 * useThemeStore — 主题偏好状态
 *
 * 管理亮色/暗色模式 + 强调色预设切换，持久化到 SQLite user_settings 表。
 */
export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'light',
  accentPreset: 'purple',

  setMode: async (mode: ThemeMode) => {
    set({ mode });
    await saveSetting('theme_mode', mode);
  },

  toggle: async () => {
    set((s) => {
      const next = s.mode === 'light' ? 'dark' : 'light';
      saveSetting('theme_mode', next); // fire-and-forget
      return { mode: next };
    });
  },

  setAccentPreset: async (preset: AccentPreset) => {
    set({ accentPreset: preset });
    await saveSetting('accent_preset', preset);
  },

  loadTheme: async () => {
    try {
      const db = await getDatabase();
      const [themeRow, accentRow] = await Promise.all([
        db.getFirstAsync<{ value: string }>("SELECT value FROM user_settings WHERE key = 'theme_mode'"),
        db.getFirstAsync<{ value: string }>("SELECT value FROM user_settings WHERE key = 'accent_preset'"),
      ]);
      if (themeRow && (themeRow.value === 'light' || themeRow.value === 'dark')) {
        set({ mode: themeRow.value as ThemeMode });
      }
      if (accentRow && ['purple', 'blue', 'green', 'yellow'].includes(accentRow.value)) {
        set({ accentPreset: accentRow.value as AccentPreset });
      }
    } catch {
      // user_settings 表可能还未创建，忽略
    }
  },
}));

/**
 * useColors — 根据当前主题和强调色预设返回对应的颜色调色板
 *
 * 用法：
 *   const t = useColors();
 *   t.accent.primary  // 当前预设强调色
 *   t.accent.primaryBg // 当前预设强调色背景
 *   t.accent.purple   // 仍可用（始终为紫色原始值，用于需要固定色的场景）
 */
export function useColors() {
  const mode = useThemeStore((s) => s.mode);
  const preset = useThemeStore((s) => s.accentPreset);
  const isDark = mode === 'dark';

  const baseAccent = isDark ? darkAccent : lightAccent;
  const presetColors = ACCENT_PRESETS[preset];

  return {
    paper: isDark ? darkPaper : paper,
    ink: isDark ? darkInk : ink,
    outline: isDark ? darkOutline : outline,
    accent: {
      ...baseAccent,
      /** 当前预设强调色 — 用于按钮、高亮、选中态 */
      primary: presetColors.primary,
      /** 当前预设强调色背景 */
      primaryBg: presetColors.bg,
    },
    status: isDark ? darkStatus : lightStatus,
    error: isDark ? darkError : lightError,
    isDark,
  };
}
