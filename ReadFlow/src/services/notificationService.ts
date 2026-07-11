import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const NOTIFICATION_ID = 'daily-reading-reminder';
const CHANNEL_ID = 'reading-reminder';

/**
 * 通知服务 — 每日阅读提醒的权限、调度、取消
 *
 * 使用 expo-notifications 本地定时通知（无需服务器）。
 * 每天在用户设定的时间触发一次重复提醒。
 */

/**
 * 设置 Android 通知频道（必须在调度通知前调用）
 */
async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: '阅读提醒',
      description: '每日阅读提醒通知',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

/**
 * 请求通知权限
 * @returns true 表示权限已授予，false 表示被拒绝
 */
export async function requestPermissions(): Promise<boolean> {
  // Android 13+ 需要先设置频道再请求权限
  await setupAndroidChannel();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // 仅在未决定时才弹系统对话框
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  // Android: 额外确保通知频道已创建
  if (Platform.OS === 'android') {
    await setupAndroidChannel();
  }

  return true;
}

/**
 * 调度每日阅读提醒
 * @param time HH:MM 格式，如 "20:00"
 */
export async function scheduleDailyReminder(time: string): Promise<void> {
  // 先清除旧的提醒
  await cancelReminder();

  // 确保 Android 频道存在
  await setupAndroidChannel();

  const [hourStr, minuteStr] = time.split(':');
  const hour = parseInt(hourStr!, 10);
  const minute = parseInt(minuteStr!, 10);

  if (isNaN(hour) || isNaN(minute)) {
    console.error('scheduleDailyReminder: invalid time format', time);
    return;
  }

  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID,
    content: {
      title: '📚 该读书啦',
      body: '每天进步一点点，今天也不要忘记阅读哦～',
      sound: 'default',
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

/**
 * 取消所有已调度的每日阅读提醒
 */
export async function cancelReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
}

/**
 * 便捷方法：根据开关状态更新提醒
 * @param enabled 是否开启
 * @param time HH:MM 格式
 */
export async function updateReminder(
  enabled: boolean,
  time: string,
): Promise<void> {
  if (enabled) {
    await scheduleDailyReminder(time);
  } else {
    await cancelReminder();
  }
}
