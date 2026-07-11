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
import { useReadingStore } from '../../stores/useReadingStore';
import { useNoteStore } from '../../stores/useNoteStore';
import { spacing, radii } from '../../theme';
import { softShadow } from '../../theme/shadows';
import { useSheetAnimation } from '../../hooks/useSheetAnimation';
import { useColors } from '../../stores/useThemeStore';

interface ManualLogSheetProps {
  visible: boolean;
  bookId: string;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * ManualLogSheet — 手动补录阅读时间弹窗 (v2.0 + 深色模式)
 *
 * 温暖简约风格：
 * - 1px 边框输入框
 * - Pill 形状快速时长选择
 * - 软阴影保存按钮
 */
export default function ManualLogSheet({
  visible,
  bookId,
  onClose,
  onSaved,
}: ManualLogSheetProps) {
  const t = useColors();
  const addManualLog = useReadingStore((s) => s.addManualLog);
  const addNote = useNoteStore((s) => s.addNote);

  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [pageNumber, setPageNumber] = useState('');
  const [chapter, setChapter] = useState('');
  const [note, setNote] = useState('');
  const [markFinished, setMarkFinished] = useState(false);
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const { sheetStyle, backdropStyle } = useSheetAnimation(visible);

  const quickDurations = [
    { label: '15分钟', ms: 15 * 60 * 1000 },
    { label: '30分钟', ms: 30 * 60 * 1000 },
    { label: '45分钟', ms: 45 * 60 * 1000 },
    { label: '1小时', ms: 60 * 60 * 1000 },
    { label: '1.5小时', ms: 90 * 60 * 1000 },
    { label: '2小时', ms: 120 * 60 * 1000 },
  ];

  const handleSave = useCallback(async () => {
    const h = parseInt(hours, 10) || 0;
    const m = parseInt(minutes, 10) || 0;
    const totalMs = (h * 60 + m) * 60 * 1000;
    if (totalMs <= 0) return;

    const pn = parseInt(pageNumber, 10);

    setSaving(true);
    const finalPage = isNaN(pn) ? undefined : pn;
    await addManualLog(
      bookId, totalMs, note || undefined,
      undefined, finalPage, chapter || undefined, markFinished,
      undefined, logDate || undefined,
    );
    // 同步笔记到书籍详情页阅读笔记 Tab
    if (note.trim()) {
      try { await addNote({ book_id: bookId, content: note.trim(), page_number: finalPage }); } catch {}
    }
    setSaving(false);

    setHours('');
    setMinutes('');
    setPageNumber('');
    setChapter('');
    setNote('');
    setMarkFinished(false);
    onSaved();
    onClose();
  }, [hours, minutes, pageNumber, chapter, note, markFinished, bookId, addManualLog, addNote, logDate, onSaved, onClose]);

  const handleQuickSelect = useCallback((ms: number) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    setHours(h > 0 ? String(h) : '');
    setMinutes(m > 0 ? String(m) : '');
  }, []);

  const totalMs = ((parseInt(hours, 10) || 0) * 60 + (parseInt(minutes, 10) || 0)) * 60 * 1000;
  const canSave = totalMs > 0 && !saving;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[styles.sheet, sheetStyle]}>
          <View style={[styles.sheetBody, { backgroundColor: t.paper.primary, borderColor: t.outline.standard }]}>
            {/* 标题栏 */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: t.ink.primary }]}>手动记录阅读时间</Text>
              <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                <Text style={[styles.closeBtn, { color: t.ink.tertiary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* 日期（可选） */}
            <Text style={[styles.label, { color: t.ink.secondary }]}>阅读日期（可选，默认今天）</Text>
            <TextInput
              style={[styles.timeInput, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary, height: 44, width: '100%' }]}
              value={logDate}
              onChangeText={setLogDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={t.ink.tertiary}
              maxLength={10}
            />

            {/* 时长输入 */}
            <Text style={[styles.label, { color: t.ink.secondary, marginTop: spacing.md }]}>阅读时长</Text>
            <View style={styles.timeInputRow}>
              <View style={styles.timeInputGroup}>
                <TextInput
                  style={[styles.timeInput, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary }]}
                  value={hours}
                  onChangeText={setHours}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={t.ink.tertiary}
                  maxLength={3}
                />
                <Text style={[styles.timeUnit, { color: t.ink.secondary }]}>小时</Text>
              </View>
              <View style={styles.timeInputGroup}>
                <TextInput
                  style={[styles.timeInput, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary }]}
                  value={minutes}
                  onChangeText={setMinutes}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={t.ink.tertiary}
                  maxLength={2}
                />
                <Text style={[styles.timeUnit, { color: t.ink.secondary }]}>分钟</Text>
              </View>
            </View>

            {/* 快速选择 */}
            <View style={styles.quickRow}>
              {quickDurations.map((qd) => (
                <TouchableOpacity
                  key={qd.label}
                  style={[styles.quickChip, { borderColor: t.outline.standard, backgroundColor: t.paper.white }]}
                  onPress={() => handleQuickSelect(qd.ms)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.quickChipText, { color: t.ink.secondary }]}>{qd.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 页数输入 */}
            <Text style={[styles.label, { marginTop: spacing.md, color: t.ink.secondary }]}>读到的页数（可选）</Text>
            <View style={styles.pageRow}>
              <TextInput
                style={[styles.pageInput, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary }]}
                value={pageNumber}
                onChangeText={setPageNumber}
                keyboardType="number-pad"
                placeholder="页数"
                placeholderTextColor={t.ink.tertiary}
                maxLength={5}
              />
              <Text style={[styles.pageUnit, { color: t.ink.secondary }]}>页</Text>
            </View>

            {/* 章节输入 */}
            <Text style={[styles.label, { color: t.ink.secondary }]}>当前章节（可选）</Text>
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
              <Ionicons name="book-outline" size={18} color={markFinished ? t.accent.green : t.ink.secondary} />
              <Text
                style={[
                  styles.finishedText,
                  { color: markFinished ? t.accent.green : t.ink.secondary },
                ]}
              >
                {markFinished ? '已标记为读完 ✓' : '标记为已读完'}
              </Text>
            </TouchableOpacity>

            {/* 备注 */}
            <Text style={[styles.label, { marginTop: spacing.md, color: t.ink.secondary }]}>备注（可选）</Text>
            <TextInput
              style={[styles.noteInput, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary }]}
              value={note}
              onChangeText={setNote}
              placeholder="例如：Kindle 上读了第三章..."
              placeholderTextColor={t.ink.tertiary}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />

            {/* 保存按钮 */}
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: t.ink.primary, opacity: canSave ? 1 : 0.4 }]}
              onPress={handleSave}
              disabled={!canSave}
              activeOpacity={0.8}
            >
              <Text style={[styles.saveText, { color: t.ink.inverse }]}>
                {saving ? '保存中...' : `记录 ${formatMs(totalMs)}`}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function formatMs(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return '';
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

  label: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  timeInputRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  timeInputGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timeInput: {
    flex: 1,
    height: 56,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  timeUnit: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    width: 36,
  },

  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  quickChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  quickChipText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    fontWeight: '700',
  },

  noteInput: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    minHeight: 60,
  },

  // 页数输入
  pageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pageInput: {
    flex: 1,
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
    textAlignVertical: 'center',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 18,
    fontWeight: '800',
  },
  pageUnit: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    width: 28,
  },

  // 章节输入
  chapterInput: {
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    marginBottom: spacing.md,
  },

  // 标记已读完
  finishedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
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
    marginTop: spacing.lg,
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
