import { ViewStyle } from 'react-native';

/**
 * 阴影系统 — 温暖简约风格
 *
 * 设计理念（来自 Stitch 设计规范）：
 * - 极轻阴影，几乎不可见
 * - 不透明度极低
 * - 卡片靠边框和圆角区分层次，而非阴影
 *
 * 禁止：厚重 Material Design elevation，渐变阴影
 */

/**
 * 卡片阴影 — 极轻，仅用于微妙的层次感
 * iOS: 0.5px offset, 0.04 opacity
 */
export const softShadow: ViewStyle = {
  shadowColor: '#1C1B1A',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.04,
  shadowRadius: 2,
};

/**
 * 略强的阴影 — 用于浮动元素
 * iOS: 1px offset, 0.06 opacity
 */
export const softShadowMd: ViewStyle = {
  shadowColor: '#1C1B1A',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 4,
};

/**
 * 1px 细线边框（主卡片边界）
 */
export const thinBorder: ViewStyle = {
  borderWidth: 1,
  borderColor: '#E5E0DB',
};

/**
 * 底部细线分隔
 */
export const dividerBottom: ViewStyle = {
  borderBottomWidth: 1,
  borderBottomColor: '#E5E0DB',
};

/**
 * 顶部细线分隔
 */
export const dividerTop: ViewStyle = {
  borderTopWidth: 1,
  borderTopColor: '#E5E0DB',
};

/**
 * 卡片组合样式：白色背景 + 细边框 + 极轻阴影
 */
export const softCard: ViewStyle = {
  backgroundColor: '#FFFFFF',
  ...thinBorder,
  ...softShadow,
};

// ============================================================
// 兼容旧版导出（逐步迁移时使用）
// ============================================================

/** @deprecated 使用 softShadow 代替 */
export const hardShadow: ViewStyle = { ...softShadow };
/** @deprecated 使用 softShadowMd 代替 */
export const hardShadowSm: ViewStyle = { ...softShadowMd };
/** @deprecated 使用 thinBorder 代替 */
export const neoBorder: ViewStyle = { ...thinBorder };
/** @deprecated 使用 softCard 代替 */
export const neoCard: ViewStyle = { ...softCard };
/** @deprecated 不再使用 */
export const pressSink: ViewStyle = {};
