import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Animated,
} from 'react-native';
import { useTagStore } from '../../stores/useTagStore';
import { spacing, radii } from '../../theme';
import { softShadow } from '../../theme/shadows';
import { useSheetAnimation } from '../../hooks/useSheetAnimation';
import { useColors } from '../../stores/useThemeStore';

interface TagPickerProps {
  visible: boolean;
  bookId: string;
  onClose: () => void;
}

/**
 * TagPicker — 标签选择器弹窗 (v2.0 + 深色模式)
 */
export default function TagPicker({ visible, bookId, onClose }: TagPickerProps) {
  const t = useColors();
  const allTags = useTagStore((s) => s.allTags);
  const bookTags = useTagStore((s) => s.bookTags);
  const fetchAllTags = useTagStore((s) => s.fetchAllTags);
  const fetchBookTags = useTagStore((s) => s.fetchBookTags);
  const createTag = useTagStore((s) => s.createTag);
  const assignTag = useTagStore((s) => s.assignTag);
  const removeTag = useTagStore((s) => s.removeTag);

  const [newTagName, setNewTagName] = useState('');
  const bookTagIds = new Set(bookTags.map((t) => t.id));
  const { sheetStyle, backdropStyle } = useSheetAnimation(visible);

  useEffect(() => {
    if (visible) {
      fetchAllTags();
      fetchBookTags(bookId);
    }
  }, [visible, bookId]);

  const handleToggle = useCallback(
    (tagId: string) => {
      if (bookTagIds.has(tagId)) {
        removeTag(bookId, tagId);
      } else {
        assignTag(bookId, tagId);
      }
    },
    [bookId, bookTagIds, assignTag, removeTag]
  );

  const handleCreate = useCallback(async () => {
    const name = newTagName.trim();
    if (!name) return;
    const tag = await createTag(name);
    assignTag(bookId, tag.id);
    setNewTagName('');
  }, [newTagName, bookId, createTag, assignTag]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[styles.sheet, sheetStyle]}>
          <View style={[styles.sheetBody, { backgroundColor: t.paper.primary, borderColor: t.outline.standard }]}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: t.ink.primary }]}>选择标签</Text>
              <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                <Text style={[styles.closeBtn, { color: t.ink.tertiary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.tagList}
              contentContainerStyle={styles.tagListContent}
              showsVerticalScrollIndicator={false}
            >
              {allTags.map((tag) => {
                const isSelected = bookTagIds.has(tag.id);
                return (
                  <TouchableOpacity
                    key={tag.id}
                    style={[
                      styles.tagChip,
                      {
                        backgroundColor: isSelected ? t.ink.primary : t.paper.white,
                        borderColor: isSelected ? t.ink.primary : t.outline.standard,
                      },
                    ]}
                    onPress={() => handleToggle(tag.id)}
                    activeOpacity={0.7}
                  >
                    {tag.color && !isSelected && (
                      <View style={[styles.tagDot, { backgroundColor: tag.color }]} />
                    )}
                    <Text
                      style={[
                        styles.tagText,
                        { color: isSelected ? t.ink.inverse : t.ink.primary },
                      ]}
                    >
                      {tag.name}
                    </Text>
                    {tag.is_system === 1 && (
                      <Text
                        style={[
                          styles.sysTag,
                          { color: isSelected ? t.ink.inverse + '80' : t.ink.tertiary },
                        ]}
                      >
                        预设
                      </Text>
                    )}
                    {isSelected && <Text style={[styles.checkMark, { color: t.accent.green }]}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={[styles.createRow, { borderTopColor: t.outline.standard }]}>
              <TextInput
                style={[styles.createInput, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary }]}
                value={newTagName}
                onChangeText={setNewTagName}
                placeholder="新标签名称..."
                placeholderTextColor={t.ink.tertiary}
                maxLength={20}
                onSubmitEditing={handleCreate}
              />
              <TouchableOpacity
                style={[
                  styles.createBtn,
                  {
                    backgroundColor: newTagName.trim() ? t.ink.primary : t.paper.white,
                    borderColor: t.outline.standard,
                    opacity: newTagName.trim() ? 1 : 0.5,
                  },
                ]}
                onPress={handleCreate}
                disabled={!newTagName.trim()}
                activeOpacity={0.7}
              >
                <Text style={[styles.createBtnText, { color: t.ink.primary }]}>创建</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
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
    maxHeight: 420,
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

  tagList: { maxHeight: 260 },
  tagListContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  tagDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tagText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    fontWeight: '700',
  },
  sysTag: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 10,
  },
  checkMark: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 2,
  },

  createRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  createInput: {
    flex: 1,
    height: 42,
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
  },
  createBtn: {
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    fontWeight: '700',
  },
});
