import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity } from 'react-native';
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

/**
 * Web 端根布局
 * - 不导入任何原生模块（expo-notifications, expo-file-system, gesture-handler）
 * - 仅展示 UI 布局和导航结构
 * - 数据库使用 database.web.ts 内存实现
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

  // Web 端字体加载可能超时，3 秒后强制进入
  const [fontTimedOut, setFontTimedOut] = useState(false);
  useEffect(() => {
    if (fontsLoaded) return;
    const t = setTimeout(() => setFontTimedOut(true), 3000);
    return () => clearTimeout(t);
  }, [fontsLoaded]);

  const ready = fontsLoaded || fontTimedOut;

  useEffect(() => {
    async function init() {
      try {
        await getDatabase();
        await seedDefaultData();
        await useSettingsStore.getState().loadSettings();
        await useThemeStore.getState().loadTheme();
        setDbReady(true);
      } catch (e) {
        console.warn('Web DB init failed:', e);
        // Web 端数据库初始化失败，仍允许浏览 UI
        setDbReady(true);
      }
    }
    init();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 24, color: '#1A1512' }}>
          ReadFlow
        </Text>
      </View>
    );
  }

  if (dbError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', padding: 40 }}>
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: '#1A1512', marginBottom: 12 }}>
          初始化失败
        </Text>
        <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: '#8A7A6E', textAlign: 'center', marginBottom: 24 }}>
          {dbError}
        </Text>
        <TouchableOpacity
          onPress={() => { setDbError(null); setDbReady(false); }}
          style={{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, backgroundColor: '#4A90D9' }}
        >
          <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: '#FFFFFF' }}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!dbReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 24, color: '#1A1512' }}>
          ReadFlow
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#FFFFFF' },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="book/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="timer" options={{ headerShown: false }} />
        <Stack.Screen name="reader/[sourceId]" options={{ presentation: 'fullScreenModal', headerShown: false }} />
        <Stack.Screen name="add-book" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="my-reading" options={{ headerShown: false }} />
        <Stack.Screen name="collection-manage" options={{ headerShown: false }} />
        <Stack.Screen name="collection/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="calendar-heatmap" options={{ headerShown: false }} />
        <Stack.Screen name="reading-books" options={{ headerShown: false }} />
      </Stack>
    </View>
  );
}
