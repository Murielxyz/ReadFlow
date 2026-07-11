/**
 * ReadFlow 设计令牌 — 温暖简约风格
 *
 * 这是整个应用的设计系统唯一真实来源（Single Source of Truth）。
 * 所有页面和组件应通过此文件和 src/theme/ 导入设计令牌。
 *
 * 版本: v2.0 | 更新: 2026-07-03
 */

import { paper, ink, outline, accent, status, error, BOOK_ACCENT_COLORS } from '../theme/colors';
import { spacing, GUTTER, MARGIN_MOBILE, MAX_WIDTH } from '../theme/spacing';
import { radii } from '../theme/radii';
import { fontFamily, fontSize, fontWeight, lineHeight, textStyles } from '../theme/typography';
import { softShadow, softShadowMd, thinBorder, softCard, dividerBottom, dividerTop } from '../theme/shadows';

// ============================================================
// 应用级设计令牌（聚合导出）
// ============================================================

export const DESIGN_TOKENS = {
  // 色彩
  colors: {
    paper,
    ink,
    outline,
    accent,
    status,
    error,
    bookAccents: BOOK_ACCENT_COLORS,
  },

  // 间距
  spacing: {
    ...spacing,
    gutter: GUTTER,
    marginMobile: MARGIN_MOBILE,
    maxWidth: MAX_WIDTH,
    /** 4px 网格基准 */
    grid: 4,
  },

  // 圆角
  radii,

  // 字体
  typography: {
    fontFamily,
    fontSize,
    fontWeight,
    lineHeight,
    textStyles,
  },

  // 阴影 + 边框
  shadows: {
    soft: softShadow,
    softMd: softShadowMd,
    thinBorder,
    softCard,
    dividerBottom,
    dividerTop,
  },
} as const;

// ============================================================
// 设计规范常量
// ============================================================

/** Tab 导航栏 */
export const TAB_BAR = {
  height: 56,
  paddingTop: 6,
  borderTopWidth: 1,
  borderTopColor: '#E5E0DB',
  backgroundColor: '#FFFFFF',
  activeTintColor: accent.blue,
  inactiveTintColor: ink.tertiary,
  labelFontSize: 10,
  labelFontFamily: 'PlusJakartaSans_600SemiBold',
} as const;

/** 卡片预设 */
export const CARD_PRESET = {
  backgroundColor: paper.white,
  borderRadius: radii.lg,
  borderWidth: 1,
  borderColor: outline.standard,
  padding: spacing.lg,
  ...softShadow,
} as const;

/** 搜索框预设 */
export const SEARCH_BAR_PRESET = {
  height: 44,
  borderRadius: radii.full,
  borderWidth: 1,
  borderColor: outline.standard,
  backgroundColor: '#FFFFFF',
  paddingHorizontal: spacing.lg,
} as const;

/** 页面标题预设 */
export const PAGE_TITLE_PRESET = {
  fontFamily: 'PlusJakartaSans_800ExtraBold',
  fontSize: 30,
  fontWeight: '800' as const,
  letterSpacing: -0.6,
} as const;

/** 区块标题预设 */
export const SECTION_TITLE_PRESET = {
  fontFamily: 'PlusJakartaSans_800ExtraBold',
  fontSize: 18,
  fontWeight: '800' as const,
} as const;
