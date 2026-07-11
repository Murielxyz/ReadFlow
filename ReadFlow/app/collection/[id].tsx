import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { safeGoBack } from '../../src/utils/navigation';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radii } from '../../src/theme';
import { softShadow } from '../../src/theme/shadows';
import { useCollectionStore } from '../../src/stores/useCollectionStore';
import { useColors } from '../../src/stores/useThemeStore';
import CreateCollectionSheet from '../../src/components/library/CreateCollectionSheet';
import type { Book } from '../../src/models/book';

/**
 * 书单详情页
 *
 * 展示书单信息 + 包含的书籍列表。
 * 支持编辑书单名称/描述/颜色、删除书单、查看书籍详情。
 */
export default function CollectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useColors();

  const collections = useCollectionStore((s) => s.collections);
  const collectionBooks = useCollectionStore((s) => s.collectionBooks);
  const fetchCollections = useCollectionStore((s) => s.fetchCollections);
  const fetchBooksInCollection = useCollectionStore((s) => s.fetchBooksInCollection);
  const deleteCollection = useCollectionStore((s) => s.deleteCollection);
  const removeBookFromCollection = useCollectionStore((s) => s.removeBookFromCollection);

  const [editSheetVisible, setEditSheetVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [manageMode, setManageMode] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());

  const collection = collections.find((c) => c.id === id);

  // 每次进入页面时刷新数据
  useFocusEffect(useCallback(() => {
    if (id) {
      fetchCollections();
      fetchBooksInCollection(id);
    }
  }, [id, fetchCollections, fetchBooksInCollection]));

  // 删除书单
  const handleDelete = useCallback(() => {
    if (!collection) return;
    Alert.alert(collection.name, '确定要删除这个书单吗？\n\n书单中的书籍不会被删除。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await deleteCollection(collection.id);
          safeGoBack();
        },
      },
    ]);
  }, [collection, deleteCollection]);

  // 未找到书单
  if (!collection) {
    return (
      <View style={[styles.centered, { backgroundColor: t.paper.primary }]}>
        <Text style={styles.emptyIcon}>📚</Text>
        <Text style={[styles.emptyTitle, { color: t.ink.primary }]}>书单不存在</Text>
        <Text style={[styles.emptyHint, { color: t.ink.tertiary }]}>该书单可能已被删除</Text>
        <TouchableOpacity
          style={[styles.emptyBtn, { backgroundColor: t.ink.primary }]}
          onPress={() => safeGoBack()}
          activeOpacity={0.8}
        >
          <Text style={[styles.emptyBtnText, { color: t.ink.inverse }]}>返回书架</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const bookCount = collection.book_count ?? collectionBooks.length;

  return (
    <View style={[styles.root, { backgroundColor: t.paper.primary }]}>
      {/* ===== 顶部导航栏 ===== */}
      <View style={[styles.navBar, { backgroundColor: t.paper.primary, borderBottomColor: t.outline.standard }]}>
        <TouchableOpacity onPress={() => safeGoBack()} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={t.ink.primary} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: t.ink.primary }]} numberOfLines={1}>{collection.name}</Text>
        <TouchableOpacity
          onPress={() => setMenuVisible(!menuVisible)}
          activeOpacity={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color={t.ink.primary} />
        </TouchableOpacity>
      </View>

      {/* ⋯ 下拉菜单 */}
      {menuVisible && (
        <>
          <TouchableOpacity style={styles.menuBackdrop} activeOpacity={1} onPress={() => setMenuVisible(false)} />
          <View style={[styles.menuDropdown, { backgroundColor: t.paper.primary, borderColor: t.outline.standard }]}>
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: t.outline.standard }]}
              onPress={() => { setMenuVisible(false); setEditSheetVisible(true); }}
              activeOpacity={0.6}
            >
              <Ionicons name="create-outline" size={18} color={t.ink.secondary} />
              <Text style={[styles.menuItemText, { color: t.ink.primary }]}>编辑书单</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: t.outline.standard }]}
              onPress={() => { setMenuVisible(false); setManageMode(true); setSelectedBooks(new Set()); }}
              activeOpacity={0.6}
            >
              <Ionicons name="list-outline" size={18} color={t.ink.secondary} />
              <Text style={[styles.menuItemText, { color: t.ink.primary }]}>管理书籍</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: t.outline.standard }]}
              onPress={() => {
                setMenuVisible(false);
                if (manageMode) {
                  // 退出管理、全选
                  setManageMode(false);
                  setSelectedBooks(new Set());
                } else {
                  // 选中全部
                  setManageMode(true);
                  setSelectedBooks(new Set(collectionBooks.map((b) => b.id)));
                }
              }}
              activeOpacity={0.6}
            >
              <Ionicons name="checkbox-outline" size={18} color={t.ink.secondary} />
              <Text style={[styles.menuItemText, { color: t.ink.primary }]}>
                {manageMode ? '取消管理' : '全选书籍'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => { handleDelete(); setMenuVisible(false); }} activeOpacity={0.6}>
              <Ionicons name="trash-outline" size={18} color={t.accent.pink} />
              <Text style={[styles.menuItemText, { color: t.accent.pink }]}>删除书单</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 头部卡片（无操作按钮 — 已移至 ⋯ 菜单） */}
        <View style={[styles.headerCard, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <View style={[styles.colorBar, { backgroundColor: collection.color ?? '#DFDEFE' }]} />
              <View style={styles.headerInfo}>
                <Text style={[styles.collectionName, { color: t.ink.primary }]}>{collection.name}</Text>
                {collection.description ? (
                  <Text style={[styles.collectionDesc, { color: t.ink.tertiary }]}>{collection.description}</Text>
                ) : null}
                <Text style={[styles.bookCount, { color: t.ink.secondary }]}>
                  {bookCount} 本书
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 管理模式下显示提示 */}
        {manageMode && (
          <View style={[styles.manageHint, { backgroundColor: t.accent.primaryBg }]}>
            <Text style={[styles.manageHintText, { color: t.accent.primary }]}>
              点击书籍选择，可将其从书单中移除
            </Text>
          </View>
        )}

        {/* 书籍列表标题 */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: t.ink.primary }]}>书单书籍</Text>
        </View>

        {/* 书籍网格 */}
        {collectionBooks.length > 0 ? (
          <View style={styles.bookGrid}>
            {collectionBooks.map((book: Book) => {
              const isSelected = selectedBooks.has(book.id);
              return (
              <TouchableOpacity
                key={book.id}
                style={[
                  styles.bookCard,
                  { backgroundColor: t.paper.white, borderColor: manageMode && isSelected ? t.accent.primary : t.outline.standard },
                  manageMode && isSelected && { borderWidth: 2 },
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  if (manageMode) {
                    setSelectedBooks((prev) => {
                      const next = new Set(prev);
                      if (next.has(book.id)) next.delete(book.id);
                      else next.add(book.id);
                      return next;
                    });
                  } else {
                    router.push({ pathname: '/book/[id]', params: { id: book.id } });
                  }
                }}
              >
                {/* 管理模式下显示复选框 */}
                {manageMode && (
                  <View style={[styles.bookCheck, { borderColor: t.outline.standard, backgroundColor: isSelected ? t.accent.primary : t.paper.white }]}>
                    {isSelected && <Ionicons name="checkmark" size={12} color={t.ink.inverse} />}
                  </View>
                )}
                {/* 封面占位 */}
                <View style={[styles.bookCover, { backgroundColor: t.accent.purple + '22' }]}>
                  <Text style={styles.bookCoverText}>
                    {book.title.charAt(0)}
                  </Text>
                </View>
                <View style={styles.bookInfo}>
                  <Text style={[styles.bookTitle, { color: t.ink.primary }]} numberOfLines={2}>
                    {book.title}
                  </Text>
                  {book.author ? (
                    <Text style={[styles.bookAuthor, { color: t.ink.tertiary }]} numberOfLines={1}>
                      {book.author}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          /* 空状态 */
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📖</Text>
            <Text style={[styles.emptyStateTitle, { color: t.ink.primary }]}>还没有添加书籍</Text>
            <Text style={[styles.emptyStateHint, { color: t.ink.tertiary }]}>
              在书籍详情页可以将书加入这个书单
            </Text>
            <TouchableOpacity
              style={[styles.browseBtn, { backgroundColor: t.accent.primary }]}
              onPress={() => router.replace('/(tabs)/library')}
              activeOpacity={0.8}
            >
              <Text style={styles.browseBtnText}>去书架看看</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* 管理书籍底部栏 */}
      {manageMode && selectedBooks.size > 0 && (
        <View style={[styles.manageBar, { backgroundColor: t.paper.white, borderTopColor: t.outline.standard }]}>
          <Text style={[styles.manageBarLabel, { color: t.ink.primary }]}>
            已选 {selectedBooks.size} 本书
          </Text>
          <TouchableOpacity
            style={[styles.manageBarBtn, { backgroundColor: t.accent.pink }]}
            onPress={() => {
              const count = selectedBooks.size;
              Alert.alert('移出书单', `确定要将选中的 ${count} 本书从「${collection.name}」中移出吗？\n\n书籍本身不会被删除。`, [
                { text: '取消', style: 'cancel' },
                {
                  text: '移出',
                  style: 'destructive',
                  onPress: async () => {
                    for (const bookId of selectedBooks) {
                      await removeBookFromCollection(bookId, collection.id);
                    }
                    setSelectedBooks(new Set());
                    setManageMode(false);
                    fetchCollections();
                    fetchBooksInCollection(collection.id);
                  },
                },
              ]);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="remove-circle-outline" size={16} color={t.ink.inverse} />
            <Text style={[styles.manageBarBtnText, { color: t.ink.inverse }]}> 移出书单</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 编辑书单弹窗 */}
      <CreateCollectionSheet
        visible={editSheetVisible}
        editCollection={collection}
        onClose={() => setEditSheetVisible(false)}
        onSaved={() => {
          setEditSheetVisible(false);
          fetchCollections();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },

  // 导航栏
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  navTitle: { flex: 1, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, fontWeight: '700', textAlign: 'center', marginHorizontal: spacing.md },
  // ⋯ 下拉菜单
  menuBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 },
  menuDropdown: { position: 'absolute', top: 52, right: spacing.md, width: 180, borderRadius: radii.lg, borderWidth: 1, zIndex: 2, ...softShadow },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  menuItemText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, fontWeight: '600' },

  // 错误/空状态
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyIcon: { fontSize: 56, marginBottom: spacing.md },
  emptyTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, fontWeight: '700', marginBottom: spacing.xs },
  emptyHint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, marginBottom: spacing.xl, textAlign: 'center' },
  emptyBtn: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radii.full },
  emptyBtnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, fontWeight: '700' },

  // 管理书籍
  manageHint: { marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md },
  manageHintText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  bookCheck: { position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  manageBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 1 },
  manageBarLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, fontWeight: '600' },
  manageBarBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.full },
  manageBarBtnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, fontWeight: '700' },

  // 头部卡片
  headerCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...softShadow,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  colorBar: {
    width: 4,
    borderRadius: 2,
    marginRight: spacing.md,
    alignSelf: 'stretch',
  },
  headerInfo: {
    flex: 1,
  },
  collectionName: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  collectionDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  bookCount: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    fontWeight: '600',
    marginTop: spacing.sm,
  },

  // 操作按钮
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'transparent',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
  },
  actionBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    fontWeight: '700',
  },

  // 分区标题
  sectionHeader: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 18,
    fontWeight: '800',
  },

  // 书籍网格
  bookGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  bookCard: {
    width: '47%',
    flexGrow: 1,
    flexBasis: '47%',
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...softShadow,
  },
  bookCover: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookCoverText: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    opacity: 0.6,
  },
  bookInfo: {
    padding: spacing.md,
  },
  bookTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  bookAuthor: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    marginTop: 2,
  },

  // 空状态
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyStateTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  emptyStateHint: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    marginBottom: spacing.xl,
    textAlign: 'center',
    lineHeight: 20,
  },
  browseBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.full,
  },
  browseBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
