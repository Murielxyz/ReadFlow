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
import { useCollectionStore } from '../../stores/useCollectionStore';
import { spacing, radii } from '../../theme';
import { softShadow } from '../../theme/shadows';
import { useSheetAnimation } from '../../hooks/useSheetAnimation';
import { useColors } from '../../stores/useThemeStore';

interface CollectionPickerProps {
  visible: boolean;
  bookId: string;
  onClose: () => void;
}

/**
 * CollectionPicker — 书单选择器弹窗 (v2.0 + 深色模式)
 */
export default function CollectionPicker({ visible, bookId, onClose }: CollectionPickerProps) {
  const t = useColors();
  const collections = useCollectionStore((s) => s.collections);
  const bookCollections = useCollectionStore((s) => s.bookCollections);
  const fetchCollections = useCollectionStore((s) => s.fetchCollections);
  const fetchBookCollections = useCollectionStore((s) => s.fetchBookCollections);
  const createCollection = useCollectionStore((s) => s.createCollection);
  const addBookToCollection = useCollectionStore((s) => s.addBookToCollection);
  const removeBookFromCollection = useCollectionStore((s) => s.removeBookFromCollection);

  const [newName, setNewName] = useState('');
  const bookCollIds = new Set(bookCollections.map((c) => c.id));
  const { sheetStyle, backdropStyle } = useSheetAnimation(visible);

  useEffect(() => {
    if (visible) {
      fetchCollections();
      fetchBookCollections(bookId);
    }
  }, [visible, bookId]);

  const handleToggle = useCallback(
    (collId: string) => {
      if (bookCollIds.has(collId)) {
        removeBookFromCollection(bookId, collId);
      } else {
        addBookToCollection(bookId, collId);
      }
    },
    [bookId, bookCollIds, addBookToCollection, removeBookFromCollection]
  );

  const handleCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    const coll = await createCollection(name);
    await addBookToCollection(bookId, coll.id);
    setNewName('');
    // 刷新书单列表 + 当前书的已选书单
    fetchCollections();
    fetchBookCollections(bookId);
  }, [newName, bookId, createCollection, addBookToCollection, fetchCollections, fetchBookCollections]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[styles.sheet, sheetStyle]}>
          <View style={[styles.sheetBody, { backgroundColor: t.paper.primary, borderColor: t.outline.standard }]}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: t.ink.primary }]}>选择书单</Text>
              <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                <Text style={[styles.closeBtn, { color: t.ink.tertiary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {collections.map((coll) => {
                const isSelected = bookCollIds.has(coll.id);
                return (
                  <TouchableOpacity
                    key={coll.id}
                    style={[
                      styles.collItem,
                      {
                        backgroundColor: isSelected ? t.accent.primaryBg : t.paper.white,
                        borderColor: isSelected ? t.accent.primary : t.outline.standard,
                      },
                    ]}
                    onPress={() => handleToggle(coll.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.collInfo}>
                      <Text style={[styles.collName, { color: t.ink.primary }]}>{coll.name}</Text>
                      <Text style={[styles.collCount, { color: t.ink.tertiary }]}>{coll.book_count} 本</Text>
                    </View>
                    {isSelected ? (
                      <View style={[styles.checkBadge, { backgroundColor: t.accent.primary }]}>
                        <Text style={[styles.checkText, { color: t.ink.inverse }]}>✓</Text>
                      </View>
                    ) : (
                      <View style={[styles.addBadge, { borderColor: t.outline.standard }]}>
                        <Text style={[styles.addText, { color: t.ink.secondary }]}>+</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}

              {collections.length === 0 && (
                <View style={styles.emptyWrap}>
                  <Text style={[styles.emptyText, { color: t.ink.tertiary }]}>暂无书单，创建一个吧</Text>
                </View>
              )}
            </ScrollView>

            <View style={[styles.createRow, { borderTopColor: t.outline.standard }]}>
              <TextInput
                style={[styles.createInput, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary }]}
                value={newName}
                onChangeText={setNewName}
                placeholder="新书单名称..."
                placeholderTextColor={t.ink.tertiary}
                maxLength={30}
                onSubmitEditing={handleCreate}
              />
              <TouchableOpacity
                style={[
                  styles.createBtn,
                  {
                    backgroundColor: newName.trim() ? t.ink.primary : t.paper.white,
                    borderColor: t.outline.standard,
                    opacity: newName.trim() ? 1 : 0.5,
                  },
                ]}
                onPress={handleCreate}
                disabled={!newName.trim()}
                activeOpacity={0.7}
              >
                <Text style={[styles.createBtnText, { color: newName.trim() ? t.ink.inverse : t.ink.primary }]}>创建</Text>
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

  list: { maxHeight: 260 },

  collItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  collInfo: { flex: 1 },
  collName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    fontWeight: '700',
  },
  collCount: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    marginTop: 2,
  },

  checkBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    fontWeight: '700',
  },
  addBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  addText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },

  emptyWrap: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
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
