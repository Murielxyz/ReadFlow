import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import GlobalTimerBubble from '../src/components/reader/GlobalTimerBubble';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { getDatabase } from '../src/db/database';
import { seedDefaultData } from '../src/db/seeds';
import { useThemeStore } from '../src/stores/useThemeStore';
import { useColors } from '../src/stores/useThemeStore';
import { useSettingsStore } from '../src/stores/useSettingsStore';

// expo-notifications 仅在原生平台可用，Web 端安全降级
let Notifications: any = null;
let updateReminder: any = null;
if (Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
    updateReminder = require('../src/services/notificationService').updateReminder;
  } catch {}
}

/**
 * 根布局
 * - 加载 Plus Jakarta Sans 字体
 * - 初始化数据库 + 种子数据
 * - 配置全局导航 + 暗色模式
 * - 设置通知处理器 + 恢复每日阅读提醒
 */
export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const { paper, ink } = useColors();

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    // 配置通知处理器：App 在前台时也显示通知横幅（仅原生平台）
    if (Notifications) {
      try {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
      } catch {}
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        await getDatabase();
        await seedDefaultData();

        // 加载持久化设置（每日目标 / 提醒开关 / 提醒时间）
        await useSettingsStore.getState().loadSettings();

        // 加载持久化主题偏好（亮色/暗色模式）
        await useThemeStore.getState().loadTheme();

        // 如果开启过提醒，恢复调度（expo-notifications 重启后可能丢失）— 仅原生
        if (updateReminder) {
          try {
            const { reminderEnabled, reminderTime } = useSettingsStore.getState();
            if (reminderEnabled) {
              await updateReminder(true, reminderTime);
            }
          } catch {}
        }
        setDbReady(true);
      } catch (e) {
        console.warn('数据库初始化失败:', e);
        setDbError('数据库初始化失败，请重启应用');
        // 不设 dbReady = true：阻止进入主界面，避免后续所有 DB 操作静默失败
      }
    }
    init();
  }, []);

  if (!fontsLoaded || (!dbReady && !dbError)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: paper.primary }}>
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 24, color: ink.primary }}>
          ReadFlow
        </Text>
      </View>
    );
  }

  if (dbError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: paper.primary, padding: 40 }}>
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: ink.primary, marginBottom: 12 }}>
          初始化失败
        </Text>
        <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: ink.secondary, textAlign: 'center', marginBottom: 24 }}>
          {dbError}
        </Text>
        <TouchableOpacity
          onPress={() => { setDbError(null); setDbReady(false); }}
          style={{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, backgroundColor: '#4A90D9' }}
          activeOpacity={0.7}
        >
          <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: '#FFFFFF' }}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: paper.primary }} edges={['top', 'left', 'right']}>
          <StatusBar style={paper.primary === '#1A1A1C' ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: paper.primary },
            }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="book/[id]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="timer"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="reader/[sourceId]"
          options={{
            presentation: 'fullScreenModal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="add-book"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="my-reading"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="collection-manage"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="calendar-heatmap"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="reading-books"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="month-calendar"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="collection/[id]"
          options={{ headerShown: false }}
        />
      </Stack>
      {/* 全局悬浮计时器气泡 — 在所有页面（除 reader/timer 外）显示 */}
      <GlobalTimerBubble />
        </SafeAreaView>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
