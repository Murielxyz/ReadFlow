import { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTimerStore } from '../../stores/useTimerStore';
import { formatTimer } from '../../utils/format';
import { spacing, radii } from '../../theme';
import { softShadow } from '../../theme/shadows';
import { useColors } from '../../stores/useThemeStore';

/**
 * TimerModal — 全屏计时弹窗 (v3.0)
 *
 * 替代旧版 TimerFloating 底部浮动条。
 * 温暖简约风格：居中白色卡片 + 大号计时数字 + 暂停/停止按钮。
 *
 * 使用 useTimerStore 管理所有状态，停止后触发 StopTimerSheet。
 */
export default function TimerModal() {
  const t = useColors();
  const bookId = useTimerStore((s) => s.bookId);
  const segmentStart = useTimerStore((s) => s.segmentStart);
  const accumulatedMs = useTimerStore((s) => s.accumulatedMs);
  const pausedAt = useTimerStore((s) => s.pausedAt);
  const sourceLabel = useTimerStore((s) => s.sourceLabel);
  const pauseTimer = useTimerStore((s) => s.pauseTimer);
  const resumeTimer = useTimerStore((s) => s.resumeTimer);
  const stopTimer = useTimerStore((s) => s.stopTimer);
  const getElapsedMs = useTimerStore((s) => s.getElapsedMs);

  const [displayMs, setDisplayMs] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  const isRunning = segmentStart !== null && pausedAt === null;
  const isPaused = pausedAt !== null;
  const visible = bookId !== null && (segmentStart !== null || accumulatedMs > 0);

  // 动画
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 4 }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
    }
  }, [visible]);

  // 每秒更新显示
  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setDisplayMs(getElapsedMs());
    }, 200);
    setDisplayMs(getElapsedMs());
    return () => clearInterval(interval);
  }, [visible, getElapsedMs, segmentStart, accumulatedMs]);

  const handlePauseResume = useCallback(() => {
    if (isRunning) pauseTimer();
    else if (isPaused) resumeTimer();
  }, [isRunning, isPaused, pauseTimer, resumeTimer]);

  const handleStop = useCallback(async () => {
    await stopTimer();
  }, [stopTimer]);

  if (!bookId) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, {
          backgroundColor: t.paper.primary,
          borderColor: t.outline.standard,
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        }]}>
          {/* 来源标签 */}
          {sourceLabel && (
            <Text style={[styles.sourceLabel, { color: t.ink.tertiary }]} numberOfLines={1}>
              {sourceLabel}
            </Text>
          )}

          {/* 状态指示器 */}
          <View style={[styles.statusDot, {
            backgroundColor: isRunning ? t.accent.green : isPaused ? t.accent.yellow : t.ink.tertiary,
          }]} />

          {/* 计时数字 */}
          <Text style={[styles.timerText, { color: t.ink.primary }]}>
            {formatTimer(displayMs)}
          </Text>

          {/* 暂停提示 */}
          {isPaused && (
            <Text style={[styles.pausedLabel, { color: t.accent.yellow, backgroundColor: t.accent.yellowBg }]}>
              已暂停
            </Text>
          )}

          {/* 控制按钮 */}
          <View style={styles.controls}>
            {/* 暂停/继续 */}
            <TouchableOpacity
              style={[styles.controlBtn, {
                backgroundColor: isRunning ? t.accent.yellowBg : t.accent.greenBg,
                borderColor: isRunning ? t.accent.yellow : t.accent.green,
              }]}
              onPress={handlePauseResume}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isRunning ? 'pause' : 'play'}
                size={28}
                color={isRunning ? t.accent.yellow : t.accent.green}
              />
            </TouchableOpacity>

            {/* 停止 */}
            <TouchableOpacity
              style={[styles.controlBtn, styles.stopBtn, {
                backgroundColor: t.error.container,
                borderColor: t.error.primary,
              }]}
              onPress={handleStop}
              activeOpacity={0.7}
            >
              <Ionicons name="stop" size={28} color={t.error.primary} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.xxl,
    alignItems: 'center',
    ...softShadow,
  },
  sourceLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: spacing.lg,
  },
  timerText: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 48,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
    marginBottom: spacing.md,
  },
  pausedLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.full,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.xl,
  },
  controlBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopBtn: {},
});
