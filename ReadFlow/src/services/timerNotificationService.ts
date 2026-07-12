import { Platform } from 'react-native';

let Notifications: any = null;
if (Platform.OS !== 'web') {
  try { Notifications = require('expo-notifications'); } catch {}
}

const TIMER_CHANNEL = 'timer-channel';
const TIMER_NOTIFICATION_ID = 'reading-timer';
const TIMER_CATEGORY = 'timer-actions';

/** 确保 Android 通知频道和操作类别已创建 */
export async function ensureTimerChannel(): Promise<void> {
  if (!Notifications || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(TIMER_CHANNEL, {
    name: '阅读计时器',
    importance: Notifications.AndroidImportance.LOW,
    vibrationPattern: null as any,
    sound: null as any,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
    showBadge: false,
  });
}

/** 注册计时器操作类别（暂停/恢复 + 停止按钮） */
export async function ensureTimerCategory(): Promise<void> {
  if (!Notifications) return;
  await Notifications.setNotificationCategoryAsync(TIMER_CATEGORY, [
    {
      identifier: 'timer-pause',
      buttonTitle: '暂停',
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'timer-stop',
      buttonTitle: '结束',
      options: { opensAppToForeground: false, isDestructive: true },
    },
  ]);
}

/** 显示/更新计时器通知（含操作按钮） */
export async function showTimerNotification(params: {
  bookTitle: string;
  elapsedMs: number;
  isPaused: boolean;
}): Promise<void> {
  if (!Notifications) return;
  const { bookTitle, elapsedMs, isPaused } = params;

  const hours = Math.floor(elapsedMs / 3600000);
  const minutes = Math.floor((elapsedMs % 3600000) / 60000);
  const seconds = Math.floor((elapsedMs % 60000) / 1000);
  const timeStr = hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;

  await Notifications.scheduleNotificationAsync({
    identifier: TIMER_NOTIFICATION_ID,
    content: {
      title: isPaused ? '⏸ 计时已暂停' : `📖 正在阅读: ${bookTitle}`,
      body: `${timeStr}${isPaused ? ' (已暂停)' : ''}`,
      data: { type: 'timer', isPaused },
      color: '#7C6BFF',
      categoryIdentifier: TIMER_CATEGORY,
      ...(Platform.OS === 'android' ? {
        channelId: TIMER_CHANNEL,
        ongoing: true,
        autoCancel: false,
      } : {}),
    },
    trigger: null,
  });
}

/** 取消计时器通知 */
export async function dismissTimerNotification(): Promise<void> {
  if (!Notifications) return;
  await Notifications.dismissNotificationAsync(TIMER_NOTIFICATION_ID);
}

/** 更新计时器通知（30秒节流） */
let lastUpdateTime = 0;
export async function updateTimerNotificationThrottled(params: {
  bookTitle: string;
  elapsedMs: number;
  isPaused: boolean;
}): Promise<void> {
  const now = Date.now();
  if (now - lastUpdateTime < 30_000) return;
  lastUpdateTime = now;
  await showTimerNotification(params);
}
