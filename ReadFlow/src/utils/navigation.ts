import { router } from 'expo-router';

/**
 * Safe router.back() — falls back to library tab when no navigation history exists.
 * Prevents "GO_BACK was not handled by any navigator" warning on web.
 */
export function safeGoBack(fallbackRoute: string = '/(tabs)/library') {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallbackRoute);
  }
}
