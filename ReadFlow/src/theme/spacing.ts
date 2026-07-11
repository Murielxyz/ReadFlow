/**
 * 间距系统
 *
 * 设计理念（来自 DESIGN.md）：
 * - 移动端：16px 侧边距
 * - 垂直区块间距：24px-40px
 * - Grid 间距：24px
 */

export const spacing = {
  /** 4px — 极小间距 */
  xs: 4,
  /** 8px — 基础间距 */
  sm: 8,
  /** 12px */
  md: 12,
  /** 16px — 移动端边距、卡片内边距 */
  lg: 16,
  /** 24px — 区块间距、Grid 间距 */
  xl: 24,
  /** 40px — 大区块间距 */
  xxl: 40,
  /** 64px — 桌面端大间距 */
  xxxl: 64,
} as const;

/** 移动端侧边距 */
export const GUTTER = 24;
/** 移动端页边距 */
export const MARGIN_MOBILE = 16;
/** 最大内容宽度（桌面端） */
export const MAX_WIDTH = 1200;
