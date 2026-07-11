import { useRef, useEffect } from 'react';
import { Animated } from 'react-native';

/**
 * useSheetAnimation — 底部弹窗弹簧滑入动画 Hook
 *
 * 返回 sheetStyle（底部弹窗滑入）和 backdropStyle（背景渐显）。
 * 供底部弹窗组件复用。
 *
 * @param visible - 弹窗是否可见
 */
export function useSheetAnimation(visible: boolean) {
  const translateY = useRef(new Animated.Value(300)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          speed: 14,
          bounciness: 4,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 300,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  return {
    sheetStyle: { transform: [{ translateY }] },
    backdropStyle: { opacity },
  };
}
