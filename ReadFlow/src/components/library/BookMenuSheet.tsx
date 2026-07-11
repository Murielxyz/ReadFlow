import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { radii, spacing } from '../../theme';
import { softShadow } from '../../theme/shadows';
import { useColors } from '../../stores/useThemeStore';
import { useBookStore } from '../../stores/useBookStore';
import { useCollectionStore } from '../../stores/useCollectionStore';
import { BOOK_STATUS_OPTIONS } from '../../utils/constants';
import type { Book, BookStatus } from '../../models';
import type { CollectionWithCount } from '../../models';

/**
 * BookMenuSheet — 书卡上下文菜单（居中弹出 v3.2）
 *
 * - 居中弹出小卡片，不是底部弹出
 * - "加入书单" 在同一面板内展开书单列表
 * - 书单列表底部有 "创建新书单" 入口
 * - 创建新书单：内嵌输入框，创建后立即出现在列表中
 */
interface BookMenuSheetProps {
  visible: boolean;
  book: Book | null;
  onClose: () => void;
  anchorX?: number;
  anchorY?: number;
  onMultiSelect?: () => void;
}

export default function BookMenuSheet({
  visible,
  book,
  onClose,
  anchorX = 0,
  anchorY = 0,
  onMultiSelect,
}: BookMenuSheetProps) {
  const router = useRouter();
  const t = useColors();
  const updateBook = useBookStore((s) => s.updateBook);
  const deleteBook = useBookStore((s) => s.deleteBook);

  // 书单相关
  const collections = useCollectionStore((s) => s.collections);
  const bookCollections = useCollectionStore((s) => s.bookCollections);
  const fetchCollections = useCollectionStore((s) => s.fetchCollections);
  const fetchBookCollections = useCollectionStore((s) => s.fetchBookCollections);
  const addBookToCollection = useCollectionStore((s) => s.addBookToCollection);
  const removeBookFromCollection = useCollectionStore((s) => s.removeBookFromCollection);
  const createCollection = useCollectionStore((s) => s.createCollection);

  // 展开的子面板: null = 主菜单, 'collection' = 书单列表, 'create' = 创建新书单
  const [subPanel, setSubPanel] = useState<null | 'collection' | 'create' | 'status'>(null);
  const [newCollName, setNewCollName] = useState('');
  const [savingColl, setSavingColl] = useState(false);
  // 待保存的选中书单集合（本地状态，点击"保存"后统一提交）
  const [pendingSelection, setPendingSelection] = useState<Set<string>>(new Set());

  // 书单面板打开时，将已选书单同步到 pendingSelection
  const openCollectionPanel = useCallback(() => {
    setPendingSelection(new Set(bookCollections.map((c) => c.id)));
    setSubPanel('collection');
  }, [bookCollections]);

  // 打开/关闭时重置状态
  useEffect(() => {
    if (visible && book) {
      setSubPanel(null);
      setNewCollName('');
      setSavingColl(false);
      fetchCollections();
      fetchBookCollections(book.id);
    }
    // visible 变 false 时（关闭菜单）重置所有状态
    return () => {
      if (!visible) {
        setSubPanel(null);
        setNewCollName('');
        setSavingColl(false);
      }
    };
  }, [visible, book?.id]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // 本地切换选中状态（不写 DB）
  const handleTogglePending = useCallback(
    (collId: string) => {
      setPendingSelection((prev) => {
        const next = new Set(prev);
        if (next.has(collId)) {
          next.delete(collId);
        } else {
          next.add(collId);
        }
        return next;
      });
    },
    [],
  );

  // 保存：计算 diff 并批量提交
  const handleSaveCollections = useCallback(async () => {
    if (!book) return;
    const prevIds = new Set(bookCollections.map((c) => c.id));
    const nextIds = pendingSelection;

    // 需要添加的
    const toAdd = [...nextIds].filter((id) => !prevIds.has(id));
    // 需要移除的
    const toRemove = [...prevIds].filter((id) => !nextIds.has(id));

    try {
      for (const collId of toAdd) {
        await addBookToCollection(book.id, collId);
      }
      for (const collId of toRemove) {
        await removeBookFromCollection(book.id, collId);
      }
      await fetchBookCollections(book.id);
      await fetchCollections();
      setSubPanel(null); // 返回主菜单
    } catch (e) {
      console.warn('Save collections error:', e);
    }
  }, [book?.id, pendingSelection, bookCollections, addBookToCollection, removeBookFromCollection, fetchBookCollections, fetchCollections]);

  // 创建新书单：只加入 pendingSelection，不立即提交 DB
  const handleCreateCollection = useCallback(async () => {
    if (!book) return;
    const name = newCollName.trim();
    if (!name) return;
    setSavingColl(true);
    try {
      const coll = await createCollection(name);
      await fetchCollections();
      setNewCollName('');
      // 新书单自动加入待选集合
      setPendingSelection((prev) => new Set([...prev, coll.id]));
      setSubPanel('collection');
    } catch (e) {
      console.warn('Create collection error:', e);
    } finally {
      setSavingColl(false);
    }
  }, [newCollName, book?.id, createCollection, fetchCollections]);

  if (!book) return null;

  // ---- 以下为非 Hook 函数，book 保证非 null ----

  const handleStatusChange = async (status: BookStatus) => {
    await updateBook(book.id, { status });
    handleClose();
  };

  const handleDelete = () => {
    Alert.alert(
      '确认移除',
      `确定要从书架中移除《${book.title}》吗？此操作不可撤销。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '移除',
          style: 'destructive',
          onPress: async () => {
            await deleteBook(book.id);
            handleClose();
          },
        },
      ],
    );
  };

  const handleEdit = () => {
    handleClose();
    setTimeout(() => router.push(`/add-book?editBookId=${book.id}`), 200);
  };

  const handleViewDetail = () => {
    handleClose();
    setTimeout(() => router.push(`/book/${book.id}`), 200);
  };

  // ===== 主菜单面板 =====
  const renderMainMenu = () => (
    <>
      {/* 标题 */}
      <View style={[styles.header, { borderBottomColor: t.outline.standard }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: t.ink.primary }]} numberOfLines={1}>
            {book.title}
          </Text>
          {book.author && (
            <Text style={[styles.subtitle, { color: t.ink.tertiary }]} numberOfLines={1}>
              {book.author}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={20} color={t.ink.tertiary} />
        </TouchableOpacity>
      </View>

      {/* 查看详情 */}
      <TouchableOpacity style={[styles.item, { borderBottomColor: t.outline.standard }]} onPress={handleViewDetail} activeOpacity={0.6}>
        <Ionicons name="information-circle-outline" size={20} color={t.ink.secondary} />
        <Text style={[styles.itemText, { color: t.ink.primary }]}>查看详情</Text>
        <Ionicons name="chevron-forward" size={16} color={t.ink.tertiary} />
      </TouchableOpacity>

      {/* 编辑信息 */}
      <TouchableOpacity style={[styles.item, { borderBottomColor: t.outline.standard }]} onPress={handleEdit} activeOpacity={0.6}>
        <Ionicons name="create-outline" size={20} color={t.ink.secondary} />
        <Text style={[styles.itemText, { color: t.ink.primary }]}>编辑信息</Text>
        <Ionicons name="chevron-forward" size={16} color={t.ink.tertiary} />
      </TouchableOpacity>

      {/* 多选书籍 */}
      {onMultiSelect && (
        <TouchableOpacity
          style={[styles.item, { borderBottomColor: t.outline.standard }]}
          onPress={() => { handleClose(); setTimeout(() => onMultiSelect(), 200); }}
          activeOpacity={0.6}
        >
          <Ionicons name="checkbox-outline" size={20} color={t.ink.secondary} />
          <Text style={[styles.itemText, { color: t.ink.primary }]}>多选书籍</Text>
          <Ionicons name="chevron-forward" size={16} color={t.ink.tertiary} />
        </TouchableOpacity>
      )}

      {/* 加入书单 */}
      <TouchableOpacity
        style={[styles.item, { borderBottomColor: t.outline.standard }]}
        onPress={openCollectionPanel}
        activeOpacity={0.6}
      >
        <Ionicons name="folder-outline" size={20} color={t.ink.secondary} />
        <Text style={[styles.itemText, { color: t.ink.primary }]}>加入书单</Text>
        <Ionicons name="chevron-forward" size={16} color={t.ink.tertiary} />
      </TouchableOpacity>

      {/* 标记状态 — 二级子菜单 */}
      {subPanel === 'status' ? (
        <View style={[styles.subPanel, { borderBottomColor: t.outline.standard }]}>
          <TouchableOpacity style={[styles.subBack, { borderBottomColor: t.outline.standard }]} onPress={() => setSubPanel(null)} activeOpacity={0.6}>
            <Ionicons name="chevron-back" size={18} color={t.accent.primary} />
            <Text style={[styles.subBackText, { color: t.accent.primary }]}>返回</Text>
          </TouchableOpacity>
          {BOOK_STATUS_OPTIONS.map((opt) => {
            const active = book.status === opt.value;
            const chipColor = opt.value === 'reading' ? t.status.reading : opt.value === 'finished' ? t.status.finished : t.status.toRead;
            return (
              <TouchableOpacity key={opt.value} style={[styles.subItem, { borderBottomColor: t.outline.standard }]} onPress={() => { handleStatusChange(opt.value); setSubPanel(null); }} activeOpacity={0.6}>
                <Text style={[styles.subItemText, { color: active ? chipColor : t.ink.primary }]}>{opt.label}</Text>
                {active && <Ionicons name="checkmark" size={16} color={chipColor} />}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <TouchableOpacity style={[styles.item, { borderBottomColor: t.outline.standard }]} onPress={() => setSubPanel('status')} activeOpacity={0.6}>
          <Ionicons name="bookmark-outline" size={20} color={t.ink.secondary} />
          <Text style={[styles.itemText, { color: t.ink.primary }]}>标记为...</Text>
          <Ionicons name="chevron-forward" size={16} color={t.ink.tertiary} />
        </TouchableOpacity>
      )}

      {/* 移除 */}
      <TouchableOpacity
        style={[styles.item, styles.deleteItem]}
        onPress={handleDelete}
        activeOpacity={0.6}
      >
        <Ionicons name="trash-outline" size={20} color={t.accent.pink} />
        <Text style={[styles.itemText, { color: t.accent.pink }]}>移除</Text>
      </TouchableOpacity>
    </>
  );

  // ===== 书单列表面板 =====
  const selectionCount = pendingSelection.size;

  const renderCollectionPanel = () => (
    <>
      {/* 返回 + 标题 */}
      <View style={[styles.header, { borderBottomColor: t.outline.standard }]}>
        <TouchableOpacity
          onPress={() => setSubPanel(subPanel === 'create' ? 'collection' : null)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={20} color={t.ink.primary} />
        </TouchableOpacity>
        <Text style={[styles.panelTitle, { color: t.ink.primary }]}>
          {subPanel === 'create' ? '创建新书单' : `选择书单${selectionCount > 0 ? ` (${selectionCount})` : ''}`}
        </Text>
        <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={20} color={t.ink.tertiary} />
        </TouchableOpacity>
      </View>

      {/* 书单列表 */}
      <ScrollView style={styles.collList} showsVerticalScrollIndicator={false}>
        {collections.length > 0 ? (
          collections.map((coll: CollectionWithCount) => {
            const isSelected = pendingSelection.has(coll.id);
            return (
              <TouchableOpacity
                key={coll.id}
                style={[
                  styles.collItem,
                  {
                    backgroundColor: isSelected ? t.accent.primaryBg : 'transparent',
                    borderColor: isSelected ? t.accent.primary : t.outline.standard,
                  },
                ]}
                onPress={() => handleTogglePending(coll.id)}
                activeOpacity={0.7}
              >
                <View style={styles.collInfo}>
                  <Text style={[styles.collName, { color: t.ink.primary }]}>{coll.name}</Text>
                  <Text style={[styles.collCount, { color: t.ink.tertiary }]}>{coll.book_count} 本</Text>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={20} color={t.accent.primary} />
                )}
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyColl}>
            <Text style={[styles.emptyCollText, { color: t.ink.tertiary }]}>暂无书单，创建一个吧</Text>
          </View>
        )}
      </ScrollView>

      {/* 创建新书单 */}
      {subPanel === 'create' ? (
        <View style={[styles.createRow, { borderTopColor: t.outline.standard }]}>
          <TextInput
            style={[styles.createInput, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary }]}
            value={newCollName}
            onChangeText={setNewCollName}
            placeholder="新书单名称..."
            placeholderTextColor={t.ink.tertiary}
            maxLength={30}
            autoFocus
            onSubmitEditing={handleCreateCollection}
          />
          <TouchableOpacity
            style={[
              styles.createBtn,
              {
                backgroundColor: newCollName.trim() ? t.ink.primary : t.paper.white,
                borderColor: t.outline.standard,
                opacity: newCollName.trim() ? 1 : 0.5,
              },
            ]}
            onPress={handleCreateCollection}
            disabled={!newCollName.trim() || savingColl}
            activeOpacity={0.7}
          >
            <Text style={[styles.createBtnText, { color: newCollName.trim() ? t.ink.inverse : t.ink.primary }]}>
              {savingColl ? '...' : '创建'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* 保存按钮 */}
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: t.ink.primary, opacity: selectionCount > 0 ? 1 : 0.4 }]}
            onPress={handleSaveCollections}
            disabled={selectionCount === 0}
            activeOpacity={0.8}
          >
            <Text style={[styles.saveBtnText, { color: t.ink.inverse }]}>
              保存{selectionCount > 0 ? ` (${selectionCount} 个书单)` : ''}
            </Text>
          </TouchableOpacity>

          {/* 创建新书单入口 */}
          <TouchableOpacity
            style={[styles.createNewBtn, { borderTopColor: t.outline.standard }]}
            onPress={() => setSubPanel('create')}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={18} color={t.accent.primary} />
            <Text style={[styles.createNewText, { color: t.accent.primary }]}>创建新书单</Text>
          </TouchableOpacity>
        </>
      )}
    </>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose} statusBarTranslucent>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
      {/* 菜单卡片 — 三点按钮处下拉 */}
      <View style={[styles.sheet, {
        backgroundColor: t.paper.primary, borderColor: t.outline.standard,
        top: '50%',
        left: '50%',
        transform: [{ translateX: -140 }, { translateY: -200 }],
      }]}>
        {subPanel === 'collection' || subPanel === 'create' ? renderCollectionPanel() : renderMainMenu()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  sheet: {
    position: 'absolute',
    width: 280,
    borderRadius: radii.xl,
    borderWidth: 1,
    maxHeight: 480,
    ...softShadow,
  },

  // ---- 标题 ----
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  title: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
  panelTitle: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },

  // ---- 菜单项 ----
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  itemText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  deleteItem: {
    borderBottomWidth: 0,
  },

  // ---- 子面板 ----
  subPanel: { paddingVertical: spacing.sm },
  subBack: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  subBackText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, fontWeight: '600' },
  subItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  subItemText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, fontWeight: '600' },

  // ---- 状态 ----
  statusSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statusLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  statusChipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingLeft: spacing.xxl + spacing.md,
  },
  statusChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  statusChipText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    fontWeight: '600',
  },

  // ---- 书单列表 ----
  collList: {
    maxHeight: 240,
  },
  collItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
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
  emptyColl: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyCollText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
  },

  // ---- 创建新书单 ----
  createNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
  },
  createNewText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    fontWeight: '700',
  },

  // ---- 保存按钮 ----
  saveBtn: {
    marginHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  saveBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    fontWeight: '700',
  },
  createRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
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
