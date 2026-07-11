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
import { useNoteStore } from '../../stores/useNoteStore';
import { useColors } from '../../stores/useThemeStore';
import type { Note } from '../../models';

interface AddNoteSheetProps {
  visible: boolean;
  bookId: string;
  /** 编辑模式：传入已有笔记；不传则为新建模式 */
  editNote?: Note | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * AddNoteSheet — 添加/编辑笔记底部弹窗
 *
 * 温暖简约风格：1px 边框输入、圆角卡片、软阴影保存按钮。
 * 支持新建和编辑两种模式，切换时自动预填/清空。
 */
export default function AddNoteSheet({
  visible,
  bookId,
  editNote,
  onClose,
  onSaved,
}: AddNoteSheetProps) {
  const t = useColors();
  const addNote = useNoteStore((s) => s.addNote);
  const updateNote = useNoteStore((s) => s.updateNote);

  const [content, setContent] = useState('');
  const [pageNumber, setPageNumber] = useState('');
  const [chapter, setChapter] = useState('');
  const [saving, setSaving] = useState(false);

  const { sheetStyle, backdropStyle } = useSheetAnimation(visible);
  const isEditing = !!editNote;

  // visible / editNote 变化时重置表单
  useEffect(() => {
    if (visible) {
      if (editNote) {
        setContent(editNote.content);
        setPageNumber(editNote.page_number != null ? String(editNote.page_number) : '');
        setChapter(editNote.chapter ?? '');
      } else {
        setContent('');
        setPageNumber('');
        setChapter('');
      }
    }
  }, [visible, editNote?.id]);

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
      if (isEditing && editNote) {
        await updateNote(editNote.id, {
          content: content.trim(),
          page_number: isNaN(pn) ? null : pn,
          chapter: chapter.trim() || null,
        });
      } else {
        await addNote({
          book_id: bookId,
          content: content.trim(),
          page_number: isNaN(pn) ? undefined : pn,
          chapter: chapter.trim() || undefined,
        });
      }
      onSaved();
      handleClose();
    } catch (e) {
      console.error('Save note error:', e);
    } finally {
      setSaving(false);
    }
  }, [canSave, isEditing, editNote, content, pageNumber, chapter, bookId, addNote, updateNote, onSaved, handleClose]);

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
                {isEditing ? '编辑笔记' : '添加笔记'}
              </Text>
              <TouchableOpacity onPress={handleClose} activeOpacity={0.7}>
                <Text style={[styles.closeBtn, { color: t.ink.tertiary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* 笔记内容 */}
            <Text style={[styles.label, { color: t.ink.secondary }]}>💭 笔记内容</Text>
            <TextInput
              style={[styles.contentInput, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary }]}
              value={content}
              onChangeText={setContent}
              placeholder="记录你的想法..."
              placeholderTextColor={t.ink.tertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus={!isEditing}
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
                {saving ? '保存中...' : isEditing ? '更新笔记' : '保存笔记'}
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

  // 内容输入
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
