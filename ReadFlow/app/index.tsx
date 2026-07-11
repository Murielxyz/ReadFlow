import { Redirect } from 'expo-router';

/**
 * 根路由入口 — 重定向到 Today 页面
 *
 * Expo Router 需要 app/index.tsx 作为初始路由。
 * 直接将用户导向 (tabs)/today 首页。
 */
export default function Index() {
  return <Redirect href="/(tabs)/today" />;
}
