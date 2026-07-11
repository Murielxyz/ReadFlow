import { Platform } from 'react-native';

// expo-notifications 仅原生可用
let Notifications: any = null;
if (Platform.OS !== 'web') {
  try { Notifications = require('expo-notifications'); } catch {}
}

const TIMER_CHANNEL = 'timer-channel';
const TIMER_NOTIFICATION_ID = 'reading-timer';

/**
 * 计时器通知服务 — 锁屏/后台计时显示。
 *
 * 当计时器在前台运行时，显示一个持续通知，包含当前计时和暂停/停止操作。
 * 用户可以在锁屏界面看到计时进度并控制。
 */

/** 确保 Android 通知频道已创建 */
export async function ensureTimerChannel(): Promise<void> {
  if (!Notifications || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(TIMER_CHANNEL, {
    name: '阅读计时器',
    importance: Notifications.AndroidImportance.LOW, // 低优先级：不发出提示音
    vibrationPattern: null as any,
    sound: null as any,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
    showBadge: false,
  });
}

/** 显示/更新计时器通知 */
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
      color: '#4A90D9',
      ...(Platform.OS === 'android' ? {
        channelId: TIMER_CHANNEL,
        ongoing: true, // 持续通知，不可滑动删除
        autoCancel: false,
      } : {}),
    },
    trigger: null, // 立即显示
  });
}

/** 取消计时器通知 */
export async function dismissTimerNotification(): Promise<void> {
  if (!Notifications) return;
  await Notifications.dismissNotificationAsync(TIMER_NOTIFICATION_ID);
}

/** 更新计时器通知（节流版本，每 30 秒调用一次） */
let lastUpdateTime = 0;
export async function updateTimerNotificationThrottled(params: {
  bookTitle: string;
  elapsedMs: number;
  isPaused: boolean;
}): Promise<void> {
  const now = Date.now();
  if (now - lastUpdateTime < 30_000) return; // 30 秒节流
  lastUpdateTime = now;
  await showTimerNotification(params);
}
