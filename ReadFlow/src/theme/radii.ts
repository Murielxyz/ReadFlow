/**
 * 圆角系统 — Soft-Square
 *
 * 设计理念（来自 DESIGN.md）：
 * - 按钮和小卡片：8px（0.5rem）
 * - 大容器/封面：16px（1rem）
 * - 标签/搜索框：全圆角 Pill
 */

export const radii = {
  /** 4px — 极小圆角 */
  xs: 4,
  /** 8px — 按钮、小卡片（默认） */
  sm: 8,
  /** 12px — 中等 */
  md: 12,
  /** 16px — 大卡片、封面 */
  lg: 16,
  /** 24px */
  xl: 24,
  /** 全圆角 — 标签 Pill、搜索框 */
  full: 9999,
} as const;
