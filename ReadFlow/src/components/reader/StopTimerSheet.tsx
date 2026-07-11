import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radii } from '../../theme';
import { softShadow } from '../../theme/shadows';
import { formatTimer } from '../../utils/format';
import { useSheetAnimation } from '../../hooks/useSheetAnimation';
import { useColors } from '../../stores/useThemeStore';

interface StopTimerSheetProps {
  visible: boolean;
  bookId: string | null;
  sourceId: string | null;
  sessionId: string | null;
  durationMs: number;
  prefillPage?: number;
  prefillChapter?: string;
  onSave: (data: { pageNumber?: number; chapter?: string; completedBook: boolean }) => void;
  onClose: () => void;
}

/**
 * StopTimerSheet — 停止计时弹窗 (v3.0 新增)
 *
 * 计时器停止后弹出，让用户输入：
 * - 读到的页数
 * - 当前章节（选填）
 * - "标记为已读完" 按钮
 *
 * 参考 Bookmory 计时逻辑：
 * 停止 → 弹窗 → 输入页数/章节 → 可选标记读完 → 保存
 */
export default function StopTimerSheet({
  visible,
  bookId,
  sourceId: _sourceId,
  sessionId,
  durationMs,
  prefillPage,
  prefillChapter,
  onSave,
  onClose,
}: StopTimerSheetProps) {
  const t = useColors();
  const { sheetStyle, backdropStyle } = useSheetAnimation(visible);

  const [pageNumber, setPageNumber] = useState(prefillPage ? String(prefillPage) : '');
  const [chapter, setChapter] = useState(prefillChapter ?? '');
  const [markFinished, setMarkFinished] = useState(false);
  const [saving, setSaving] = useState(false);

  // 当弹窗关闭后重置状态（预填值在 visible 变化时会更新）
  const handleClose = useCallback(() => {
    setPageNumber(prefillPage ? String(prefillPage) : '');
    setChapter(prefillChapter ?? '');
    setMarkFinished(false);
    onClose();
  }, [prefillPage, prefillChapter, onClose]);

  const pageNum = parseInt(pageNumber, 10);
  const hasInput = pageNumber.trim().length > 0 || chapter.trim().length > 0 || markFinished;

  const handleSave = useCallback(async () => {
    if (!sessionId) return;
    setSaving(true);
    onSave({
      pageNumber: isNaN(pageNum) ? undefined : pageNum,
      chapter: chapter.trim() || undefined,
      completedBook: markFinished,
    });
    setSaving(false);
    handleClose();
  }, [sessionId, pageNum, chapter, markFinished, onSave, handleClose]);

  if (!bookId) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={handleClose} />
        </Animated.View>

        <Animated.View style={[styles.sheet, sheetStyle]}>
          <View style={[styles.sheetBody, { backgroundColor: t.paper.primary, borderColor: t.outline.standard }]}>
            {/* 标题栏 */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: t.ink.primary }]}>本次阅读</Text>
              <TouchableOpacity onPress={handleClose} activeOpacity={0.7}>
                <Text style={[styles.closeBtn, { color: t.ink.tertiary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* 计时结果 */}
            <View style={[styles.timerResult, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}>
              <Text style={[styles.timerLabel, { color: t.ink.tertiary }]}>阅读时长</Text>
              <Text style={[styles.timerValue, { color: t.accent.primary }]}>{formatTimer(durationMs)}</Text>
            </View>

            {/* 页数输入 */}
            <Text style={[styles.label, { color: t.ink.secondary }]}>读到的页数</Text>
            <View style={styles.pageRow}>
              <TextInput
                style={[styles.pageInput, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary }]}
                value={pageNumber}
                onChangeText={setPageNumber}
                keyboardType="number-pad"
                placeholder="输入页数"
                placeholderTextColor={t.ink.tertiary}
                maxLength={5}
              />
              <Text style={[styles.pageUnit, { color: t.ink.secondary }]}>页</Text>
            </View>

            {/* 章节输入 */}
            <Text style={[styles.label, { color: t.ink.secondary }]}>当前章节（选填）</Text>
            <TextInput
              style={[styles.chapterInput, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary }]}
              value={chapter}
              onChangeText={setChapter}
              placeholder="例如：第三章"
              placeholderTextColor={t.ink.tertiary}
              maxLength={100}
            />

            {/* 标记已读完 */}
            <TouchableOpacity
              style={[
                styles.finishedBtn,
                {
                  backgroundColor: markFinished ? t.accent.greenBg : t.paper.white,
                  borderColor: markFinished ? t.accent.green : t.outline.standard,
                },
              ]}
              onPress={() => setMarkFinished(!markFinished)}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-circle" size={18} color={markFinished ? t.accent.green : t.ink.secondary} />
              <Text
                style={[
                  styles.finishedText,
                  { color: markFinished ? t.accent.green : t.ink.secondary },
                ]}
              >
                {markFinished ? '已标记为读完 ✓' : '标记为已读完'}
              </Text>
            </TouchableOpacity>

            {/* 保存按钮 */}
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: t.ink.primary, opacity: saving ? 0.6 : 1 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={[styles.saveText, { color: t.ink.inverse }]}>
                {saving ? '保存中...' : '保存记录'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },

  sheet: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xxl,
  },
  sheetBody: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.lg,
    zIndex: 1,
    ...softShadow,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    fontWeight: '700',
    padding: spacing.xs,
  },

  timerResult: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  timerLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timerValue: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 36,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  label: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  pageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pageInput: {
    flex: 1,
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 20,
    fontWeight: '800',
  },
  pageUnit: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    width: 28,
  },

  chapterInput: {
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    marginBottom: spacing.lg,
  },

  finishedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  finishedIcon: {
    fontSize: 18,
  },
  finishedText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    fontWeight: '700',
  },

  saveButton: {
    height: 48,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...softShadow,
  },
  saveText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    fontWeight: '700',
  },
});
