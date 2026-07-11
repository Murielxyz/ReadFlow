import { useState, useCallback, useEffect } from 'react';
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
import { spacing, radii } from '../../theme';
import { softShadow } from '../../theme/shadows';
import { useSheetAnimation } from '../../hooks/useSheetAnimation';
import { useHighlightStore } from '../../stores/useHighlightStore';
import { useColors } from '../../stores/useThemeStore';
import type { Highlight } from '../../models';

/** 高亮颜色选项 */
const HIGHLIGHT_COLORS = [
  { color: '#F5A623', label: '黄' },
  { color: '#50C878', label: '绿' },
  { color: '#4A90D9', label: '蓝' },
  { color: '#FF6B8A', label: '粉' },
] as const;

interface AddHighlightSheetProps {
  visible: boolean;
  bookId: string;
  /** 编辑模式：传入已有高亮；不传则为新建模式 */
  editHighlight?: Highlight | null;
  /** 预填高亮文字（Reader 选中文字时使用） */
  prefillContent?: string;
  /** 预填章节名（Reader 选中文字时使用） */
  prefillChapter?: string;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * AddHighlightSheet — 添加/编辑高亮底部弹窗
 *
 * 温暖简约风格，复用 useSheetAnimation。
 * 与 AddNoteSheet 的区别：多了颜色选择器 + 可选 note 字段。
 */
export default function AddHighlightSheet({
  visible,
  bookId,
  editHighlight,
  prefillContent,
  prefillChapter,
  onClose,
  onSaved,
}: AddHighlightSheetProps) {
  const t = useColors();
  const addHighlight = useHighlightStore((s) => s.addHighlight);
  const updateHighlight = useHighlightStore((s) => s.updateHighlight);

  const [content, setContent] = useState('');
  const [color, setColor] = useState<string>(HIGHLIGHT_COLORS[0].color);
  const [note, setNote] = useState('');
  const [pageNumber, setPageNumber] = useState('');
  const [chapter, setChapter] = useState('');
  const [saving, setSaving] = useState(false);

  const { sheetStyle, backdropStyle } = useSheetAnimation(visible);
  const isEditing = !!editHighlight;

  // visible / editHighlight / prefill 变化时重置表单
  useEffect(() => {
    if (visible) {
      if (editHighlight) {
        setContent(editHighlight.content);
        setColor(editHighlight.color ?? HIGHLIGHT_COLORS[0].color);
        setNote(editHighlight.note ?? '');
        setPageNumber(editHighlight.page_number != null ? String(editHighlight.page_number) : '');
        setChapter(editHighlight.chapter ?? '');
      } else {
        setContent(prefillContent ?? '');
        setColor(HIGHLIGHT_COLORS[0].color);
        setNote('');
        setPageNumber('');
        setChapter(prefillChapter ?? '');
      }
    }
  }, [visible, editHighlight?.id, prefillContent, prefillChapter]);

  const handleClose = useCallback(() => {
    setSaving(false);
    onClose();
  }, [onClose]);

  const canSave = content.trim().length > 0 && !saving;

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const pn = parseInt(pageNumber, 10);
      if (isEditing && editHighlight) {
        await updateHighlight(editHighlight.id, {
          content: content.trim(),
          color,
          note: note.trim() || null,
          page_number: isNaN(pn) ? null : pn,
          chapter: chapter.trim() || null,
        });
      } else {
        await addHighlight({
          book_id: bookId,
          content: content.trim(),
          color,
          note: note.trim() || undefined,
          page_number: isNaN(pn) ? undefined : pn,
          chapter: chapter.trim() || undefined,
        });
      }
      onSaved();
      handleClose();
    } catch (e) {
      console.error('Save highlight error:', e);
    } finally {
      setSaving(false);
    }
  }, [canSave, isEditing, editHighlight, content, color, note, pageNumber, chapter, bookId, addHighlight, updateHighlight, onSaved, handleClose]);

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
              <Text style={[styles.title, { color: t.ink.primary }]}>
                {isEditing ? '编辑高亮' : '添加高亮'}
              </Text>
              <TouchableOpacity onPress={handleClose} activeOpacity={0.7}>
                <Text style={[styles.closeBtn, { color: t.ink.tertiary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* 高亮内容 */}
            <Text style={[styles.label, { color: t.ink.secondary }]}>📝 高亮文字</Text>
            <TextInput
              style={[styles.contentInput, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary }]}
              value={content}
              onChangeText={setContent}
              placeholder="输入高亮文字..."
              placeholderTextColor={t.ink.tertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus={!isEditing}
            />

            {/* 颜色选择器 */}
            <Text style={[styles.label, { color: t.ink.secondary }]}>🎨 颜色</Text>
            <View style={styles.colorRow}>
              {HIGHLIGHT_COLORS.map((c) => (
                <TouchableOpacity
                  key={c.color}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: c.color },
                    color === c.color && styles.colorCircleSelected,
                  ]}
                  onPress={() => setColor(c.color)}
                  activeOpacity={0.7}
                >
                  {color === c.color && (
                    <Text style={styles.colorCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* 附加笔记 */}
            <Text style={[styles.label, { color: t.ink.secondary }]}>💭 附加笔记（可选）</Text>
            <TextInput
              style={[styles.noteInput, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary }]}
              value={note}
              onChangeText={setNote}
              placeholder="对这段高亮的想法..."
              placeholderTextColor={t.ink.tertiary}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />

            {/* 页码 + 章节 */}
            <View style={styles.metaRow}>
              <View style={styles.metaField}>
                <Text style={[styles.label, { color: t.ink.secondary }]}>📄 页码（可选）</Text>
                <TextInput
                  style={[styles.metaInput, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary }]}
                  value={pageNumber}
                  onChangeText={setPageNumber}
                  keyboardType="number-pad"
                  placeholder="页数"
                  placeholderTextColor={t.ink.tertiary}
                  maxLength={5}
                />
              </View>
              <View style={styles.metaField}>
                <Text style={[styles.label, { color: t.ink.secondary }]}>📖 章节（可选）</Text>
                <TextInput
                  style={[styles.metaInput, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary }]}
                  value={chapter}
                  onChangeText={setChapter}
                  placeholder="章节"
                  placeholderTextColor={t.ink.tertiary}
                  maxLength={100}
                />
              </View>
            </View>

            {/* 保存按钮 */}
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: t.ink.primary, opacity: canSave ? 1 : 0.4 }]}
              onPress={handleSave}
              disabled={!canSave}
              activeOpacity={0.8}
            >
              <Text style={[styles.saveText, { color: t.ink.inverse }]}>
                {saving ? '保存中...' : isEditing ? '更新高亮' : '保存高亮'}
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

  label: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },

  // 高亮文字输入
  contentInput: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    minHeight: 100,
    marginBottom: spacing.md,
    lineHeight: 22,
  },

  // 颜色选择
  colorRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.6,
  },
  colorCircleSelected: {
    opacity: 1,
    borderWidth: 2,
    borderColor: '#1A1512',
  },
  colorCheck: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // 附加笔记
  noteInput: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    minHeight: 60,
    marginBottom: spacing.md,
    lineHeight: 20,
  },

  // 页码+章节 并排
  metaRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  metaField: {
    flex: 1,
  },
  metaInput: {
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
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
