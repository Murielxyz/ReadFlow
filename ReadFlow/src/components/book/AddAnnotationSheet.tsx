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
import { Ionicons } from '@expo/vector-icons';
import { spacing, radii } from '../../theme';
import { softShadow } from '../../theme/shadows';
import { useSheetAnimation } from '../../hooks/useSheetAnimation';
import { useNoteStore } from '../../stores/useNoteStore';
import { useHighlightStore } from '../../stores/useHighlightStore';
import { useColors } from '../../stores/useThemeStore';

/** 标注编辑类型（与 ReadingTabsView 保持一致） */
type EditingAnnotation = {
  id: string;
  annotationType: 'note' | 'highlight';
  book_id: string;
  content: string;
  color: string | null;
  note: string | null;
  page_number: number | null;
  chapter: string | null;
  created_at: string;
  updated_at: string;
};

/** 高亮颜色选项 */
const HIGHLIGHT_COLORS = [
  { color: '#F5A623', label: '黄' },
  { color: '#50C878', label: '绿' },
  { color: '#4A90D9', label: '蓝' },
  { color: '#FF6B8A', label: '粉' },
] as const;

interface AddAnnotationSheetProps {
  visible: boolean;
  bookId: string;
  /** 编辑模式：传入已有标注；不传则为新建模式 */
  editAnnotation?: EditingAnnotation | null;
  /** 预填高亮文字（Reader 选中文字时使用） */
  prefillContent?: string;
  /** 预填章节名（Reader 选中文字时使用） */
  prefillChapter?: string;
  /** 标注模式：'highlight' 仅高亮 / 'note' 仅想法 / 不传则兼容旧行为 */
  mode?: 'highlight' | 'note';
  onClose: () => void;
  onSaved: () => void;
}

/**
 * AddAnnotationSheet — 统一添加/编辑笔记与高亮底部弹窗 (v3.2)
 *
 * 支持 mode prop 分离高亮与想法表单：
 * - mode='highlight': 仅显示原文引用 + 颜色 + 页码 + 章节
 * - mode='note':      仅显示想法/笔记 + 页码 + 章节
 * - mode 未设置:       显示所有字段（兼容旧调用方）
 */
export default function AddAnnotationSheet({
  visible,
  bookId,
  editAnnotation,
  prefillContent,
  prefillChapter,
  mode,
  onClose,
  onSaved,
}: AddAnnotationSheetProps) {
  const t = useColors();
  const addHighlight = useHighlightStore((s) => s.addHighlight);
  const updateHighlight = useHighlightStore((s) => s.updateHighlight);
  const addNote = useNoteStore((s) => s.addNote);
  const updateNote = useNoteStore((s) => s.updateNote);

  const [content, setContent] = useState('');
  const [color, setColor] = useState<string>(HIGHLIGHT_COLORS[0].color);
  const [note, setNote] = useState('');
  const [pageNumber, setPageNumber] = useState('');
  const [chapter, setChapter] = useState('');
  const [saving, setSaving] = useState(false);

  const { sheetStyle, backdropStyle } = useSheetAnimation(visible);
  const isEditing = !!editAnnotation;

  // 根据 mode 决定是否为纯高亮 / 纯想法模式
  const isHighlightMode = mode === 'highlight';
  const isNoteMode = mode === 'note';
  const isLegacyMode = !mode; // 兼容旧行为

  // visible / editAnnotation / prefill 变化时重置表单
  useEffect(() => {
    if (visible) {
      if (editAnnotation) {
        setContent(editAnnotation.content);
        setColor(editAnnotation.color ?? HIGHLIGHT_COLORS[0].color);
        setNote(editAnnotation.note ?? '');
        setPageNumber(editAnnotation.page_number != null ? String(editAnnotation.page_number) : '');
        setChapter(editAnnotation.chapter ?? '');
      } else {
        setContent(prefillContent ?? '');
        setColor(HIGHLIGHT_COLORS[0].color);
        setNote('');
        setPageNumber('');
        setChapter(prefillChapter ?? '');
      }
    }
  }, [visible, editAnnotation?.id, prefillContent, prefillChapter]);

  const handleClose = useCallback(() => {
    setSaving(false);
    onClose();
  }, [onClose]);

  const canSave = (() => {
    if (saving) return false;
    if (isHighlightMode) return content.trim().length > 0;
    if (isNoteMode) return note.trim().length > 0;
    // legacy: either content or note
    return content.trim().length > 0 || note.trim().length > 0;
  })();

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const pn = parseInt(pageNumber, 10);
      const pageNum = isNaN(pn) ? undefined : pn;
      const ch = chapter.trim() || undefined;

      if (isHighlightMode) {
        // 纯高亮模式 → 保存为 highlight（支持附加想法）
        const noteContent = note.trim() || undefined;
        if (isEditing && editAnnotation?.annotationType === 'highlight') {
          await updateHighlight(editAnnotation.id, {
            content: content.trim(),
            color,
            note: noteContent,
            page_number: pageNum as any,
            chapter: ch as any,
          });
        } else {
          await addHighlight({
            book_id: bookId,
            content: content.trim(),
            color,
            note: noteContent,
            page_number: pageNum,
            chapter: ch,
          });
        }
      } else if (isNoteMode) {
        // 纯想法模式 → 保存为 note
        // 若有原文引用，与想法合并：`> 原文引用\n\n想法内容`
        const quoteContent = content.trim();
        const noteContent = note.trim();
        const combinedContent = quoteContent
          ? `> ${quoteContent}\n\n${noteContent}`
          : noteContent;

        if (isEditing && editAnnotation?.annotationType === 'note') {
          await updateNote(editAnnotation.id, {
            content: combinedContent,
            page_number: pageNum as any,
            chapter: ch as any,
          });
        } else {
          await addNote({
            book_id: bookId,
            content: combinedContent,
            page_number: pageNum,
            chapter: ch,
          });
        }
      } else {
        // 兼容旧行为：有引用文字 → 高亮，仅想法 → 笔记
        if (content.trim().length > 0) {
          if (isEditing && editAnnotation?.annotationType === 'highlight') {
            await updateHighlight(editAnnotation.id, {
              content: content.trim(),
              color,
              note: note.trim() || null,
              page_number: pageNum as any,
              chapter: ch as any,
            });
          } else {
            await addHighlight({
              book_id: bookId,
              content: content.trim(),
              color,
              note: note.trim() || undefined,
              page_number: pageNum,
              chapter: ch,
            });
          }
        } else if (note.trim().length > 0) {
          if (isEditing && editAnnotation?.annotationType === 'note') {
            await updateNote(editAnnotation.id, {
              content: note.trim(),
              page_number: pageNum as any,
              chapter: ch as any,
            });
          } else {
            await addNote({
              book_id: bookId,
              content: note.trim(),
              page_number: pageNum,
              chapter: ch,
            });
          }
        }
      }

      onSaved();
      handleClose();
    } catch (e) {
      console.error('Save annotation error:', e);
    } finally {
      setSaving(false);
    }
  }, [canSave, isEditing, editAnnotation, content, color, note, pageNumber, chapter, bookId, isHighlightMode, isNoteMode, addHighlight, updateHighlight, addNote, updateNote, onSaved, handleClose]);

  // 标题文案
  const titleText = isEditing
    ? '编辑标注'
    : isHighlightMode
      ? '添加高亮'
      : isNoteMode
        ? '添加想法'
        : '添加标注';

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
                {titleText}
              </Text>
              <TouchableOpacity onPress={handleClose} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={t.ink.tertiary} />
              </TouchableOpacity>
            </View>

            {/* 原文引用（所有模式显示；高亮模式必填，想法模式可选） */}
            <Text style={[styles.label, { color: t.ink.secondary }]}>
              原文引用{isNoteMode ? '（可选）' : isHighlightMode ? '/高亮文字' : '/高亮文字'}
            </Text>
            <TextInput
              style={[styles.contentInput, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary }]}
              value={content}
              onChangeText={setContent}
              placeholder={isNoteMode ? '粘贴或输入原文引用...' : '选中或输入高亮文字...'}
              placeholderTextColor={t.ink.tertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus={!isEditing && !isNoteMode}
            />

            {/* 颜色选择器（仅高亮模式或兼容模式且有内容时显示） */}
            {(isHighlightMode || isLegacyMode) && content.trim().length > 0 && (
              <>
                <Text style={[styles.label, { color: t.ink.secondary }]}>颜色</Text>
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
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* 想法/笔记（所有模式显示） */}
            {(
              <>
                <Text style={[styles.label, { color: t.ink.secondary }]}>想法/笔记</Text>
                <TextInput
                  style={[styles.noteInput, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary }]}
                  value={note}
                  onChangeText={setNote}
                  placeholder="记录你的想法..."
                  placeholderTextColor={t.ink.tertiary}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  autoFocus={isNoteMode && !isEditing}
                />
              </>
            )}

            {/* 页码 + 章节 */}
            <View style={styles.metaRow}>
              <View style={styles.metaField}>
                <Text style={[styles.label, { color: t.ink.secondary }]}>页码（可选）</Text>
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
                <Text style={[styles.label, { color: t.ink.secondary }]}>章节（可选）</Text>
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
                {saving ? '保存中...' : isEditing ? '更新标注' : '保存标注'}
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
    minHeight: 90,
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

  // 附加笔记
  noteInput: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    minHeight: 70,
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