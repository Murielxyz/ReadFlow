import { TextStyle } from 'react-native';

/**
 * 字体系统 — Plus Jakarta Sans
 *
 * 设计理念（来自 DESIGN.md）：
 * - 超粗字重用于书名和主标题，强调 Neo-Brutalist 结构
 * - label-xs 用于分类和小标签，提供清晰的技术感
 * - 正文行高宽松，奶油底色上阅读舒适
 */

// 字体家族
export const fontFamily = {
  /** Plus Jakarta Sans — 主字体 */
  sans: 'PlusJakartaSans_400Regular',
  sansMedium: 'PlusJakartaSans_500Medium',
  sansSemiBold: 'PlusJakartaSans_600SemiBold',
  sansBold: 'PlusJakartaSans_700Bold',
  sansExtraBold: 'PlusJakartaSans_800ExtraBold',
};

// 字体大小（rem 转 px：1rem = 16px）
export const fontSize = {
  /** 10px — 极小标签（label-xs） */
  xs: 10,
  /** 12px — 标签（label-md） */
  sm: 12,
  /** 14px — 正文（body-md） */
  body: 14,
  /** 16px — 大正文（body-lg） */
  bodyLarge: 16,
  /** 18px — 中等标题（headline-md） */
  subtitle: 18,
  /** 24px — 标题 */
  title: 24,
  /** 30px — 大标题（headline-xl） */
  heading: 30,
} as const;

// 行高倍率
export const lineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.6,
};

// 预设文本样式
export const textStyles: Record<string, TextStyle> = {
  // headline-xl: 30px / ExtraBold / tight — 主标题、书名
  h1: {
    fontFamily: fontFamily.sansExtraBold,
    fontSize: fontSize.heading,
    fontWeight: '800',
    lineHeight: fontSize.heading * lineHeight.tight,
    letterSpacing: -0.02 * fontSize.heading,
  },
  // headline-md: 18px / Bold — 区块标题
  h2: {
    fontFamily: fontFamily.sansBold,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
    lineHeight: fontSize.subtitle * lineHeight.normal,
  },
  // body-lg: 16px / Bold — 强调正文
  bodyLarge: {
    fontFamily: fontFamily.sansBold,
    fontSize: fontSize.bodyLarge,
    fontWeight: '700',
    lineHeight: fontSize.bodyLarge * lineHeight.normal,
  },
  // body-md: 14px / Regular — 正文
  body: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.body,
    fontWeight: '400',
    lineHeight: fontSize.body * lineHeight.relaxed,
  },
  // label-md: 12px / Bold — 按钮、Chip 文字
  label: {
    fontFamily: fontFamily.sansBold,
    fontSize: fontSize.sm,
    fontWeight: '700',
    lineHeight: fontSize.sm * lineHeight.tight,
  },
  // label-xs: 10px / Bold — 小标签、分类
  caption: {
    fontFamily: fontFamily.sansBold,
    fontSize: fontSize.xs,
    fontWeight: '700',
    lineHeight: fontSize.xs * lineHeight.tight,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
};

// 兼容旧版引用
export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};
