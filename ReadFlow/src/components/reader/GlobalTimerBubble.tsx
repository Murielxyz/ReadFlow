import { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTimerStore } from '../../stores/useTimerStore';
import { formatTimer } from '../../utils/format';
import { useColors } from '../../stores/useThemeStore';
import { radii, spacing } from '../../theme';
import { softShadow } from '../../theme/shadows';
import {
  showTimerNotification,
  dismissTimerNotification,
  updateTimerNotificationThrottled,
  ensureTimerChannel,
  ensureTimerCategory,
} from '../../services/timerNotificationService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BUBBLE_SIZE = 56;

/**
 * GlobalTimerBubble — 全局悬浮计时气泡 (v3.0)
 *
 * 当计时器运行时，在所有页面显示一个悬浮气泡。
 * - 可拖动定位（吸附到屏幕边缘）
 * - 显示实时计时数字
 * - 点击展开控制面板（暂停/停止）
 * - 锁屏/后台显示持续通知
 *
 * 在 reader/[bookId] 和 timer 页面自动隐藏（页面有自己的完整计时 UI）。
 */
export default function GlobalTimerBubble() {
  const t = useColors();
  const pathname = usePathname();
  const bookId = useTimerStore((s) => s.bookId);
  const segmentStart = useTimerStore((s) => s.segmentStart);
  const accumulatedMs = useTimerStore((s) => s.accumulatedMs);
  const pausedAt = useTimerStore((s) => s.pausedAt);
  const bookTitle = useTimerStore((s) => s.sourceLabel);
  const pauseTimer = useTimerStore((s) => s.pauseTimer);
  const resumeTimer = useTimerStore((s) => s.resumeTimer);
  const stopTimer = useTimerStore((s) => s.stopTimer);
  const getElapsedMs = useTimerStore((s) => s.getElapsedMs);
  const tickCount = useTimerStore((s) => s.tickCount);

  const [expanded, setExpanded] = useState(false);
  const [displayMs, setDisplayMs] = useState(0);
  const posAnim = useRef(new Animated.ValueXY({ x: SCREEN_WIDTH - BUBBLE_SIZE - 16, y: SCREEN_HEIGHT * 0.5 })).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isRunning = segmentStart !== null && pausedAt === null;
  const isPaused = pausedAt !== null;
  const isActive = bookId !== null;

  // 在 reader 或 timer 页面隐藏（这些页面有自己的计时 UI）
  const shouldHide = pathname.startsWith('/reader/') || pathname === '/timer';

  // 初始化和清理通知频道
  useEffect(() => {
    ensureTimerChannel();
    ensureTimerCategory();
  }, []);

  // 实时更新显示时间
  useEffect(() => {
    if (!isActive) {
      setDisplayMs(0);
      return;
    }
    const interval = setInterval(() => {
      setDisplayMs(getElapsedMs());
    }, 1000);
    setDisplayMs(getElapsedMs());
    return () => clearInterval(interval);
  }, [isActive, getElapsedMs, tickCount]);

  // 锁屏通知：计时激活时显示通知，停止/暂停时更新
  useEffect(() => {
    if (!isActive) {
      dismissTimerNotification();
      return;
    }
    showTimerNotification({
      bookTitle: bookTitle ?? '阅读中',
      elapsedMs: displayMs,
      isPaused,
    });
    return () => {
      dismissTimerNotification();
    };
  }, [isActive, isPaused]); // 只在激活/暂停状态变化时重建通知

  // 后台时每 30 秒更新一次通知
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      updateTimerNotificationThrottled({
        bookTitle: bookTitle ?? '阅读中',
        elapsedMs: getElapsedMs(),
        isPaused,
      });
    }, 30_000);
    return () => clearInterval(interval);
  }, [isActive, isPaused, bookTitle, getElapsedMs]);

  // 拖动处理
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        Animated.spring(scaleAnim, { toValue: 1.1, useNativeDriver: true }).start();
      },
      onPanResponderMove: (_, gesture) => {
        const newX = Math.max(0, Math.min(SCREEN_WIDTH - BUBBLE_SIZE, gesture.moveX - BUBBLE_SIZE / 2));
        const newY = Math.max(60, Math.min(SCREEN_HEIGHT - BUBBLE_SIZE - 60, gesture.moveY - BUBBLE_SIZE / 2));
        posAnim.setValue({ x: newX, y: newY });
      },
      onPanResponderRelease: (_, gesture) => {
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
        // 吸附到左边缘或右边缘
        const currentX = (gesture.moveX ?? SCREEN_WIDTH - BUBBLE_SIZE - 16) - BUBBLE_SIZE / 2;
        const snapToLeft = currentX < SCREEN_WIDTH / 2;
        Animated.spring(posAnim, {
          toValue: {
            x: snapToLeft ? 8 : SCREEN_WIDTH - BUBBLE_SIZE - 8,
            y: Math.max(60, Math.min(SCREEN_HEIGHT - BUBBLE_SIZE - 60, (gesture.moveY ?? SCREEN_HEIGHT * 0.5) - BUBBLE_SIZE / 2)),
          },
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  const handlePauseResume = useCallback(() => {
    if (isRunning) pauseTimer();
    else if (isPaused) resumeTimer();
  }, [isRunning, isPaused, pauseTimer, resumeTimer]);

  const handleStop = useCallback(async () => {
    setExpanded(false);
    const result = await stopTimer();
    if (result) {
      // 导航到书籍详情页显示停止弹窗
      const currentBookId = useTimerStore.getState().stopSheet.bookId;
      if (currentBookId) {
        try { router.push(`/book/${currentBookId}`); } catch {}
      }
    }
  }, [stopTimer]);

  const handleBubblePress = useCallback(() => {
    if (!expanded) {
      setExpanded(true);
    }
  }, [expanded]);

  if (!isActive || shouldHide) return null;

  const timeDisplay = formatTimer(displayMs);

  return (
    <Animated.View
      style={[
        styles.root,
        { transform: [...posAnim.getTranslateTransform(), { scale: scaleAnim }] },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        style={[styles.bubble, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}
        onPress={handleBubblePress}
        activeOpacity={0.8}
      >
        {expanded ? (
          <View style={styles.expandedContent}>
            {/* 收起按钮 + 时间 */}
            <View style={styles.expandedHeader}>
              <TouchableOpacity onPress={() => setExpanded(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="chevron-down" size={16} color={t.ink.tertiary} />
              </TouchableOpacity>
              <Text style={[styles.expandedTime, { color: t.ink.primary }]} numberOfLines={1}>{timeDisplay}</Text>
              <View style={{ width: 16 }} />
            </View>
            {isPaused && (
              <Text style={[styles.pausedHint, { color: t.accent.yellow }]}>已暂停</Text>
            )}
            <View style={styles.expandedControls}>
              <TouchableOpacity
                style={[styles.ctrlBtn, { backgroundColor: isRunning ? t.accent.yellowBg : t.accent.primaryBg, borderColor: isRunning ? t.accent.yellow : t.accent.primary }]}
                onPress={handlePauseResume}
                activeOpacity={0.7}
              >
                <Ionicons name={isRunning ? 'pause' : 'play'} size={18} color={isRunning ? t.accent.yellow : t.accent.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ctrlBtn, { backgroundColor: t.error.container, borderColor: t.error.primary }]}
                onPress={handleStop}
                activeOpacity={0.7}
              >
                <Ionicons name="stop" size={18} color={t.error.primary} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.collapsedContent}>
            <View style={[styles.miniIndicator, { backgroundColor: isRunning ? t.accent.primary : t.accent.yellow }]} />
            <Text style={[styles.miniTime, { color: t.ink.primary }]} numberOfLines={1}>
              {timeDisplay}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    zIndex: 9999,
    elevation: 100,
  },
  bubble: {
    width: BUBBLE_SIZE,
    minHeight: BUBBLE_SIZE,
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...softShadow,
  },
  // 收起状态
  collapsedContent: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  miniIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  miniTime: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 9,
    fontVariant: ['tabular-nums'],
  },
  // 展开状态
  expandedContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 140,
    alignItems: 'center',
    gap: spacing.xs,
  },
  expandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  expandedTime: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  pausedHint: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 10,
  },
  expandedControls: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  ctrlBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
