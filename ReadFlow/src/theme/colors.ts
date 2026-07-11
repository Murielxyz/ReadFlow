/**
 * ReadFlow 色彩系统 — 温暖简约风格
 *
 * 设计理念（来自 v2.0 设计规范）：
 * - 纯白背景 #FFFFFF
 * - 极浅灰卡片 #F6F6F8 + 1px 细边框 #E5E0DB
 * - 每张卡片使用单一强调色（蓝/紫/黄/绿/粉）
 * - 大量留白，极轻阴影
 *
 * 禁止：渐变、毛玻璃、厚重 Material Design 阴影
 */

// ===== 纸张色系 (Surface & Background) =====
export const paper = {
  /** 主背景：纯白 #FFFFFF */
  primary: '#FFFFFF',
  /** 卡片/表面：纯白 #FFFFFF（v3.0 用户要求去灰） */
  white: '#FFFFFF',
  /** 微暗表面 */
  dim: '#F7F4EF',
  /** 浅灰容器 */
  container: '#F0EDE8',
  /** 高亮容器 */
  containerHigh: '#E8E5E0',
} as const;

// ===== 墨水色系 (Ink / On-Surface) =====
export const ink = {
  /** 主文字：暖深棕黑 #1A1512 */
  primary: '#1A1512',
  /** 次文字：暖灰棕 #8A7A6E */
  secondary: '#8A7A6E',
  /** 辅助/禁用文字 */
  tertiary: '#A39E99',
  /** 反色（深底白字） */
  inverse: '#FFFFFF',
  /** 反色背景 */
  inverseBg: '#303030',
} as const;

// ===== 边框色 (Outline) =====
export const outline = {
  /** 标准边框：细线 #E5E0DB */
  standard: '#E5E0DB',
  /** 浅色边框变体 */
  variant: '#D5D0CB',
  /** 分隔线 */
  divider: '#E5E0DB',
} as const;

// ===== 功能强调色 (Functional Accents) =====
export const accent = {
  /** 蓝色 — 计时、进度 */
  blue: '#4A90D9',
  blueBg: '#EEF5FC',
  /** 紫色 — 标签、分类 */
  purple: '#7C6BFF',
  purpleBg: '#F4F2FF',
  /** 黄色 — 评分、收藏 */
  yellow: '#F5A623',
  yellowBg: '#FEF8EC',
  /** 绿色 — 完成、成功 */
  green: '#50C878',
  greenBg: '#EDF9F2',
  /** 粉色 — 书单、推荐 */
  pink: '#FF6B8A',
  pinkBg: '#FFF0F3',

  // ---- 向后兼容旧版别名 (v1 Neo-Brutalist → v2 温暖简约) ----
  /** @deprecated 使用 purpleBg */
  lavender: '#F4F2FF',
  /** @deprecated 使用 purple */
  lavenderDark: '#7C6BFF',
  /** @deprecated 使用 purple */
  lavenderText: '#7C6BFF',
  /** @deprecated 使用 yellowBg */
  gold: '#FEF8EC',
  /** @deprecated 使用 yellow */
  goldDark: '#F5A623',
  /** @deprecated 使用 yellow */
  goldText: '#F5A623',
  /** @deprecated 使用 greenBg */
  sage: '#EDF9F2',
  /** @deprecated 使用 green */
  sageDark: '#50C878',
  /** @deprecated 使用 green */
  sageText: '#50C878',
} as const;

// ===== 状态色 =====
export const status = {
  /** 阅读中 — 蓝色 */
  reading: '#4A90D9',
  readingBg: '#EEF5FC',
  /** 待读 — 中灰 */
  toRead: '#A39E99',
  toReadBg: '#F0EDE8',
  /** 已完成 — 绿色 */
  finished: '#50C878',
  finishedBg: '#EDF9F2',
  /** 弃读 — 暗粉灰 */
  abandoned: '#D4A0A0',
  abandonedBg: '#FAF0F0',
} as const;

// ===== 错误色 =====
export const error = {
  primary: '#E05555',
  container: '#FFECEC',
  onContainer: '#B03030',
} as const;

// ===== 书本强调色（5 色轮换，每卡片一色） =====
export const BOOK_ACCENT_COLORS = [
  '#4A90D9', // 蓝
  '#7C6BFF', // 紫
  '#F5A623', // 黄
  '#50C878', // 绿
  '#FF6B8A', // 粉
] as const;

// ===== 全局强调色预设 =====
export type AccentPreset = 'purple' | 'blue' | 'green' | 'yellow';

export const ACCENT_PRESETS: Record<AccentPreset, { primary: string; bg: string }> = {
  purple: { primary: '#7C6BFF', bg: '#F4F2FF' },
  blue:   { primary: '#4A90D9', bg: '#EEF5FC' },
  green:  { primary: '#50C878', bg: '#EDF9F2' },
  yellow: { primary: '#F5A623', bg: '#FEF8EC' },
};

// ===== 暗色模式调色板 =====
export const darkPaper = {
  primary: '#1A1A1C',
  white: '#222226',
  dim: '#2A2A2E',
  container: '#323236',
  containerHigh: '#3A3A3E',
} as const;

export const darkInk = {
  primary: '#EDEBE8',
  secondary: '#C8C5C1',
  tertiary: '#8B8985',
  inverse: '#1A1A1C',
  inverseBg: '#EDEBE8',
} as const;

export const darkOutline = {
  standard: '#3A3A3E',
  variant: '#2E2E32',
  divider: '#3A3A3E',
} as const;

export const darkAccent = {
  blue: '#5BA0E9',
  blueBg: '#1E2D3D',
  purple: '#9B8DFF',
  purpleBg: '#24203D',
  yellow: '#F7B83D',
  yellowBg: '#3D3018',
  green: '#62D88A',
  greenBg: '#1D3D28',
  pink: '#FF8AA3',
  pinkBg: '#3D1E26',

  // 向后兼容旧版别名
  lavender: '#24203D',
  lavenderDark: '#9B8DFF',
  lavenderText: '#9B8DFF',
  gold: '#3D3018',
  goldDark: '#F7B83D',
  goldText: '#F7B83D',
  sage: '#1D3D28',
  sageDark: '#62D88A',
  sageText: '#62D88A',
} as const;

export const darkStatus = {
  reading: '#5BA0E9',
  readingBg: '#1E2D3D',
  toRead: '#8B8985',
  toReadBg: '#323236',
  finished: '#62D88A',
  finishedBg: '#1D3D28',
  abandoned: '#D4A0A0',
  abandonedBg: '#2D1E1E',
} as const;

export const darkError = {
  primary: '#FF8A8A',
  container: '#3D1E1E',
  onContainer: '#FFC8C8',
} as const;
