import * as Haptics from 'expo-haptics';

/**
 * 震动反馈工具
 *
 * 使用 expo-haptics 提供触觉反馈，增强交互体验。
 * 所有函数都是安全的——如果设备不支持震动则静默忽略。
 *
 * 使用场景：
 * - light: 标签选择、筛选切换
 * - medium: 按钮按下、星级评分
 * - heavy: 计时开始/停止、删除确认
 * - selection: Picker 滚动变化
 * - success: 操作完成
 * - warning: 警告提示
 */

/** 轻量震动 — 轻触、切换 */
export function hapticLight() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** 中等震动 — 按钮按下、评分点击 */
export function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** 重震动 — 计时开始/停止、删除 */
export function hapticHeavy() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}

/** 选择器滚动震动 */
export function hapticSelection() {
  Haptics.selectionAsync().catch(() => {});
}

/** 成功通知震动 */
export function hapticSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** 警告通知震动 */
export function hapticWarning() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}
