import { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useTimerStore } from '../../stores/useTimerStore';
import { formatTimer } from '../../utils/format';
import { hapticMedium, hapticHeavy } from '../../utils/haptics';
import { spacing, radii } from '../../theme';
import { softShadow } from '../../theme/shadows';
import { useColors } from '../../stores/useThemeStore';

/**
 * TimerFloating — 计时器浮动条 (v2.0 + 深色模式)
 *
 * 当计时器运行时，在书籍详情页底部显示。
 * 包含计时数字 + 暂停/停止按钮。
 * 温暖简约风格：软阴影 + 1px 边框 + Pill 形状
 */
export default function TimerFloating() {
  const t = useColors();
  const bookId = useTimerStore((s) => s.bookId);
  const segmentStart = useTimerStore((s) => s.segmentStart);
  const accumulatedMs = useTimerStore((s) => s.accumulatedMs);
  const pausedAt = useTimerStore((s) => s.pausedAt);
  const pauseTimer = useTimerStore((s) => s.pauseTimer);
  const resumeTimer = useTimerStore((s) => s.resumeTimer);
  const stopTimer = useTimerStore((s) => s.stopTimer);
  const getElapsedMs = useTimerStore((s) => s.getElapsedMs);

  const slideAnim = useRef(new Animated.Value(100)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isRunning = segmentStart !== null && pausedAt === null;
  const isPaused = pausedAt !== null;

  useEffect(() => {
    if (bookId) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 20,
        bounciness: 4,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [!!bookId]);

  useEffect(() => {
    if (!isRunning) {
      pulseAnim.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isRunning]);

  const handlePauseResume = useCallback(() => {
    hapticMedium();
    if (isRunning) {
      pauseTimer();
    } else if (isPaused) {
      resumeTimer();
    }
  }, [isRunning, isPaused, pauseTimer, resumeTimer]);

  const handleStop = useCallback(async () => {
    hapticHeavy();
    // stopTimer 会自动保存基础会话并设置 stopSheet 状态（在 useTimerStore 中）
    // 弹窗由书籍详情页渲染，TimerFloating 只需调用 stopTimer
    await stopTimer();
    // refreshStats 会在 StopTimerSheet 的 onSave 回调中触发
  }, [stopTimer]);

  if (!bookId) return null;

  const elapsedMs = getElapsedMs();
  const timeDisplay = formatTimer(elapsedMs);

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY: slideAnim }] }]}
    >
      <Animated.View style={[styles.bar, { transform: [{ scale: pulseAnim }] }]}>
        <View style={[styles.body, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}>
          {/* 运行指示器 */}
          <View
            style={[
              styles.indicator,
              {
                backgroundColor: isRunning ? t.accent.primary : t.accent.yellow,
              },
            ]}
          />

          {/* 计时数字 */}
          <Text style={[styles.timerText, { color: t.ink.primary }]}>{timeDisplay}</Text>

          {/* 暂停状态标签 */}
          {isPaused && (
            <Text style={[styles.pausedLabel, { color: t.accent.yellow, backgroundColor: t.accent.yellowBg }]}>
              已暂停
            </Text>
          )}

          {/* 控制按钮 */}
          <View style={styles.controls}>
            <TouchableOpacity
              style={[
                styles.controlBtn,
                {
                  backgroundColor: isRunning ? t.accent.yellowBg : t.accent.primaryBg,
                  borderColor: isRunning ? t.accent.yellow : t.accent.primary,
                },
              ]}
              onPress={handlePauseResume}
              activeOpacity={0.7}
            >
              <Text style={styles.controlBtnText}>
                {isRunning ? '⏸' : '▶'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.controlBtn,
                styles.stopBtn,
                { backgroundColor: t.error.container, borderColor: t.error.primary },
              ]}
              onPress={handleStop}
              activeOpacity={0.7}
            >
              <Text style={styles.controlBtnText}>⏹</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  bar: {
    borderRadius: radii.full,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.full,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    gap: spacing.sm,
    ...softShadow,
  },
  indicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timerText: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    flex: 1,
  },
  pausedLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopBtn: {},
  controlBtnText: {
    fontSize: 14,
  },
});
