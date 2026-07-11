import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../src/stores/useThemeStore';
import { radii } from '../../src/theme';

/**
 * 底部 Tab 导航 — 温暖简约 + Stitch 粉彩激活态
 *
 * 激活态：紫色背景容器 + 1px 边框（Stitch 采纳）
 * 未激活：线框图标 + 灰色
 *
 * 4 个 Tab：Today | Library | Statistics | Profile
 */

/** 自定义 TabBar 按钮 — 激活时显示紫色背景容器 */
function TabBarButton(props: any) {
  const { onPress, children, accessibilityState, style } = props;
  const focused = accessibilityState?.selected;
  const t = useColors();

  return (
    <TouchableOpacity
      style={[
        tabStyles.btn,
        style,
        focused && {
          backgroundColor: t.accent.primaryBg,
          borderColor: t.outline.standard,
          borderWidth: 1,
          paddingHorizontal: 12,
          paddingVertical: 2,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {children}
    </TouchableOpacity>
  );
}

const tabStyles = StyleSheet.create({
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    marginHorizontal: 2,
  },
});

export default function TabLayout() {
  const { paper, ink, accent, outline } = useColors();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: accent.primary,
        tabBarInactiveTintColor: ink.tertiary,
        tabBarStyle: {
          backgroundColor: paper.white,
          borderTopWidth: 1,
          borderTopColor: outline.standard,
          paddingTop: 4,
          paddingBottom: 4,
          height: 60,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontFamily: 'PlusJakartaSans_600SemiBold',
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarButton: (props) => <TabBarButton {...props} />,
        headerStyle: {
          backgroundColor: paper.primary,
        },
        headerTitleStyle: {
          fontFamily: 'PlusJakartaSans_800ExtraBold',
          fontSize: 22,
          fontWeight: '800',
          color: ink.primary,
        },
        headerShadowVisible: false,
      }}
    >
      {/* Today — 今日 */}
      <Tabs.Screen
        name="today"
        options={{
          title: '今日',
          headerShown: true,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'today' : 'today-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* Library — 书库 */}
      <Tabs.Screen
        name="library"
        options={{
          title: '书架',
          headerShown: true,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'library' : 'library-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* Statistics — 阅读统计 */}
      <Tabs.Screen
        name="statistics"
        options={{
          title: '统计',
          headerShown: true,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'stats-chart' : 'stats-chart-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* Profile — 我的 */}
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          headerShown: true,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
