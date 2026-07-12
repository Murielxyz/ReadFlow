import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, TextInput, StyleSheet, TouchableOpacity, Text, ScrollView, ActivityIndicator, Modal, Alert, Platform, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { radii, spacing } from '../../src/theme';
import { softShadow } from '../../src/theme/shadows';
import { useColors } from '../../src/stores/useThemeStore';
import { useBookStore } from '../../src/stores/useBookStore';
import { useCollectionStore } from '../../src/stores/useCollectionStore';
import { useTagStore } from '../../src/stores/useTagStore';
import { useSourceStore } from '../../src/stores/useSourceStore';
import { getDatabase } from '../../src/db/database';
import ImportModal from '../../src/components/library/ImportModal';
import AddBookMenuSheet from '../../src/components/library/AddBookMenuSheet';
import BookMenuSheet from '../../src/components/library/BookMenuSheet';
import BookListItem from '../../src/components/library/BookListItem';
import { BOOK_STATUS_OPTIONS, STATUS_LABELS } from '../../src/utils/constants';
import type { BookStatus } from '../../src/models';

type BookFormatFilter = 'all' | 'ebook' | 'physical' | 'audiobook';
type SortMode = 'recent' | 'title' | 'author' | 'added' | 'progress';
type ViewMode = 'grid' | 'list';

export default function LibraryScreen() {
  const router = useRouter();
  const t = useColors();

  // ---- Stores ----
  const books = useBookStore((s) => s.books);
  const fetchBooks = useBookStore((s) => s.fetchBooks);
  const updateBook = useBookStore((s) => s.updateBook);
  const deleteBook = useBookStore((s) => s.deleteBook);
  const loading = useBookStore((s) => s.loading);

  const collections = useCollectionStore((s) => s.collections);
  const fetchCollections = useCollectionStore((s) => s.fetchCollections);
  const fetchAllBookCollectionIds = useCollectionStore((s) => s.fetchAllBookCollectionIds);
  const bookCollectionMap = useCollectionStore((s) => s.bookCollectionMap);

  const allTags = useTagStore((s) => s.allTags);
  const fetchAllTags = useTagStore((s) => s.fetchAllTags);
  const fetchAllBookTagIds = useTagStore((s) => s.fetchAllBookTagIds);
  const bookTagMap = useTagStore((s) => s.bookTagMap);

  // ---- State ----
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);
  const [sortVisible, setSortVisible] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [gridColumns] = useState(3);
  const [importVisible, setImportVisible] = useState(false);
  const [contextBookId, setContextBookId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [navMenuVisible, setNavMenuVisible] = useState(false);
  const [navMenuPos, setNavMenuPos] = useState({ x: 0, y: 0 });
  const [addMenuVisible, setAddMenuVisible] = useState(false);

  // 筛选 & 排序
  const [filterStatus, setFilterStatus] = useState<BookStatus | 'all'>('all');
  const [filterFormat, setFilterFormat] = useState<BookFormatFilter>('all');
  const [filterTagIds, setFilterTagIds] = useState<Set<string>>(new Set());
  const [filterCollectionId, setFilterCollectionId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('recent');

  // 批量选择
  const [bookBatchMode, setBookBatchMode] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());

  // ---- Hidden collections ----
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const loadHidden = useCallback(async () => {
    try {
      const db = await getDatabase();
      const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM user_settings WHERE key = 'hidden_collections'");
      if (row && row.value) { try { setHiddenIds(new Set(JSON.parse(row.value))); } catch {} }
    } catch {}
  }, []);

  // ---- Data loading ----
  useFocusEffect(useCallback(() => {
    fetchBooks();
    fetchCollections();
    fetchAllTags();
    fetchAllBookTagIds();
    fetchAllBookCollectionIds();
    loadHidden();
  }, [fetchBooks, fetchCollections, fetchAllTags, fetchAllBookTagIds, fetchAllBookCollectionIds, loadHidden]));

  const contextBook = contextBookId ? books.find((b) => b.id === contextBookId) : null;

  // ---- 本地书的 book_id 集合（惰性查询） ----
  const [localIds, setLocalIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (activeTab !== 'local' || localIds.size > 0) return;
    (async () => {
      try {
        const db = await getDatabase();
        const rows = await db.getAllAsync<{ book_id: string }>(
          'SELECT DISTINCT book_id FROM reading_sources WHERE file_uri IS NOT NULL',
        );
        setLocalIds(new Set(rows.map(r => r.book_id)));
      } catch {}
    })();
  }, [activeTab]);

  // ---- Active tab filtering ----
  const tabBooks = useMemo(() => {
    if (activeTab === 'all') return books;
    if (activeTab === 'local') return books.filter((b) => localIds.has(b.id));
    return books.filter((b) => bookCollectionMap.get(b.id)?.has(activeTab));
  }, [books, activeTab, bookCollectionMap, localIds]);

  // ---- Sort & filter ----
  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filterStatus !== 'all') c++;
    if (filterFormat !== 'all') c++;
    if (filterTagIds.size > 0) c++;
    if (filterCollectionId) c++;
    return c;
  }, [filterStatus, filterFormat, filterTagIds, filterCollectionId]);

  const processedBooks = useMemo(() => {
    let result = [...tabBooks];
    if (filterStatus !== 'all') result = result.filter((b) => b.status === filterStatus);
    if (filterFormat !== 'all') {
      result = result.filter((b) => {
        if (filterFormat === 'audiobook') return b.category === 'audiobook';
        if (filterFormat === 'ebook') return !!b.isbn || (b.category !== 'audiobook' && !!(b as any).isbn);
        return !b.isbn && b.category !== 'audiobook';
      });
    }
    if (filterTagIds.size > 0) result = result.filter((b) => { const ids = bookTagMap.get(b.id); return ids && [...filterTagIds].some((tid) => ids.has(tid)); });
    if (filterCollectionId) result = result.filter((b) => bookCollectionMap.get(b.id)?.has(filterCollectionId));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((b) => b.title.toLowerCase().includes(q) || (b.author && b.author.toLowerCase().includes(q)));
    }
    result.sort((a, b) => {
      switch (sortMode) {
        case 'title': return a.title.localeCompare(b.title);
        case 'author': return (a.author || '').localeCompare(b.author || '');
        case 'added': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'progress': return (b.page_count || 0) - (a.page_count || 0);
        default: return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });
    return result;
  }, [tabBooks, filterStatus, filterFormat, filterTagIds, bookTagMap, filterCollectionId, bookCollectionMap, searchQuery, sortMode]);

  // ---- Book press ----
  const handleBookPress = useCallback(async (book: (typeof books)[number]) => {
    try {
      await useSourceStore.getState().fetchSources(book.id);
      const sources = useSourceStore.getState().sources;
      const localSource = sources.find((s) => (s.type === 'epub' || s.type === 'pdf') && (s.file_uri || s.file_name));
      if (localSource) { router.push(`/reader/${localSource.id}`); return; }
    } catch { /* fall through */ }
    router.push(`/book/${book.id}`);
  }, [router]);

  const resetFilters = () => { setFilterStatus('all'); setFilterFormat('all'); setFilterTagIds(new Set()); setFilterCollectionId(null); };

  // ---- Tabs ----
  const tabs = useMemo(() => {
    const result: { key: string; label: string }[] = [
      { key: 'all', label: '全部' },
      { key: 'local', label: '本地' },
    ];
    for (const c of collections) {
      if (!hiddenIds.has(c.id)) result.push({ key: c.id, label: c.name });
    }
    return result;
  }, [collections, hiddenIds]);

  // ---- Loading ----
  if (loading && books.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: t.paper.primary }]}>
        <ActivityIndicator size="large" color={t.accent.primary} />
      </View>
    );
  }

  // ===== RENDER =====
  return (
    <View style={[styles.root, { backgroundColor: t.paper.primary }]}>
      {/* ===== 顶部导航栏 ===== */}
      <View style={[styles.topBar, { borderBottomColor: t.outline.standard }]}>
        <View style={styles.titleRow}>
          <Ionicons name="library" size={24} color={t.accent.primary} />
          <Text style={[styles.pageTitle, { color: t.ink.primary }]}>书架</Text>
        </View>
        <TouchableOpacity onPressIn={(e) => setNavMenuPos({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })} onPress={() => setNavMenuVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="ellipsis-horizontal" size={24} color={t.ink.primary} />
        </TouchableOpacity>
      </View>

      {/* ⋯ 导航菜单 Modal */}
      <Modal visible={navMenuVisible} transparent animationType="fade" onRequestClose={() => setNavMenuVisible(false)}>
        <TouchableOpacity style={styles.menuBackdrop} activeOpacity={1} onPress={() => setNavMenuVisible(false)} />
        <View style={[styles.navDropdown, { backgroundColor: t.paper.primary, borderColor: t.outline.standard, top: navMenuPos.y - 10, left: navMenuPos.x - 170 }]}>
          <TouchableOpacity style={[styles.navMenuItem, { borderBottomColor: t.outline.standard }]} onPress={() => { setNavMenuVisible(false); setAddMenuVisible(true); }} activeOpacity={0.6}>
            <Ionicons name="add-circle-outline" size={18} color={t.ink.secondary} />
            <Text style={[styles.navMenuItemText, { color: t.ink.primary }]}>导入书籍</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.navMenuItem, { borderBottomColor: t.outline.standard }]} onPress={() => { setNavMenuVisible(false); router.push('/collection-manage'); }} activeOpacity={0.6}>
            <Ionicons name="folder-outline" size={18} color={t.ink.secondary} />
            <Text style={[styles.navMenuItemText, { color: t.ink.primary }]}>书单管理</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navMenuItem} onPress={() => { setNavMenuVisible(false); setBookBatchMode(true); setSelectedBooks(new Set()); }} activeOpacity={0.6}>
            <Ionicons name="checkbox-outline" size={18} color={t.ink.secondary} />
            <Text style={[styles.navMenuItemText, { color: t.ink.primary }]}>批量操作</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ===== Tab 栏（横滚） ===== */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabScrollContent}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabBtn, isActive && { borderBottomColor: t.accent.primary, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabBtnText, { color: isActive ? t.accent.primary : t.ink.tertiary }]} numberOfLines={1}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ===== 工具栏 ===== */}
      <View style={[styles.toolbar, { borderBottomColor: t.outline.standard }]}>
        <View style={[styles.searchBar, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}>
          <Ionicons name="search" size={14} color={t.ink.tertiary} />
          <TextInput style={[styles.searchInput, { color: t.ink.primary }]} placeholder="搜索书籍..." placeholderTextColor={t.ink.tertiary} value={searchQuery} onChangeText={setSearchQuery} />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}><Ionicons name="close-circle" size={14} color={t.ink.tertiary} /></TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={[styles.toolBtn, activeFilterCount > 0 && { backgroundColor: t.accent.primaryBg }]} onPress={() => setFilterVisible(true)} activeOpacity={0.6}>
          <Ionicons name="filter-outline" size={18} color={activeFilterCount > 0 ? t.accent.primary : t.ink.secondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={() => setSortVisible(true)} activeOpacity={0.6}>
          <Ionicons name="swap-vertical-outline" size={18} color={t.ink.secondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} activeOpacity={0.6}>
          <Ionicons name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'} size={18} color={t.ink.secondary} />
        </TouchableOpacity>
      </View>

      {/* ===== 内容区 ===== */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {processedBooks.length > 0 ? (
          viewMode === 'grid' ? (
            // 网格视图
            <View style={[styles.bookGrid, { gap: gridColumns === 2 ? spacing.md : spacing.sm, backgroundColor: '#FAFAF8', borderRadius: radii.lg, padding: spacing.sm }]}>
              {processedBooks.map((book) => {
                const isSelected = selectedBooks.has(book.id);
                const cardWidth = gridColumns === 2 ? '47%' : '30%';
                return (
                <View key={book.id} style={[styles.bookCard, { backgroundColor: t.paper.white, borderColor: bookBatchMode && isSelected ? t.accent.primary : t.outline.standard, width: cardWidth, maxWidth: cardWidth }, bookBatchMode && isSelected && { borderWidth: 2 }]}>
                  {bookBatchMode && (
                    <TouchableOpacity style={[styles.batchCheck, { borderColor: t.outline.standard, backgroundColor: isSelected ? t.accent.primary : t.paper.white }]} onPress={() => setSelectedBooks((p) => { const n = new Set(p); if (n.has(book.id)) n.delete(book.id); else n.add(book.id); return n; })} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      {isSelected && <Ionicons name="checkmark" size={12} color={t.ink.inverse} />}
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity activeOpacity={bookBatchMode ? 1 : 0.8} onPress={() => { if (bookBatchMode) { setSelectedBooks((p) => { const n = new Set(p); if (n.has(book.id)) n.delete(book.id); else n.add(book.id); return n; }); } else { handleBookPress(book); } }} onLongPress={bookBatchMode ? undefined : () => router.push(`/book/${book.id}`)} delayLongPress={500} style={{ flex: 1 }}>
                    {book.cover_url ? (
                      <Image source={{ uri: book.cover_url }} style={styles.coverImg} resizeMode="contain" />
                    ) : (
                      <View style={[styles.coverPlaceholder, { backgroundColor: (book.accent_color || t.accent.purple) + '22' }]}>
                        <Ionicons name="book" size={32} color={(book.accent_color || t.accent.purple) + '60'} style={{ marginBottom: 8 }} />
                        <Text style={[styles.coverTitle, { color: book.accent_color || t.accent.purple, fontSize: 12 }]} numberOfLines={2}>{book.title}</Text>
                      </View>
                    )}
                    <View style={styles.cardInfo}>
                      <Text style={[styles.cardTitle, { color: t.ink.primary }]} numberOfLines={2}>{book.title}</Text>
                      <Text style={[styles.cardAuthor, { color: t.ink.tertiary }]} numberOfLines={1}>{book.author || '未知作者'}</Text>
                      <Text style={[styles.cardStatus, { color: book.status === 'reading' ? t.status.reading : book.status === 'finished' ? t.status.finished : book.status === 'abandoned' ? t.status.abandoned : t.ink.tertiary }]}>{STATUS_LABELS[book.status]}</Text>
                    </View>
                  </TouchableOpacity>
                  {!bookBatchMode && (
                    <TouchableOpacity style={styles.moreBtn} onPressIn={(e) => { setMenuPosition({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY }); }} onPress={() => setContextBookId(book.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="ellipsis-horizontal" size={14} color={t.ink.tertiary} />
                    </TouchableOpacity>
                  )}
                </View>
              )})}
            </View>
          ) : (
            // 列表视图
            <View>
              {processedBooks.map((book) => (
                <BookListItem key={book.id} book={book} />
              ))}
            </View>
          )
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="library-outline" size={48} color={t.ink.tertiary} />
            <Text style={[styles.emptyTitle, { color: t.ink.primary }]}>暂无书籍</Text>
            <Text style={[styles.emptyHint, { color: t.ink.tertiary }]}>点击右上角 ⋯ 导入你的第一本书</Text>
          </View>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* 书籍批量操作栏 */}
      {bookBatchMode && selectedBooks.size > 0 && (
        <View style={[styles.batchBar, { backgroundColor: t.paper.white, borderTopColor: t.outline.standard }]}>
          <Text style={[styles.batchLabel, { color: t.ink.primary }]}>已选 {selectedBooks.size} 本</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity style={[styles.batchBtn, { backgroundColor: t.outline.standard }]} onPress={() => { setBookBatchMode(false); setSelectedBooks(new Set()); }} activeOpacity={0.7}>
              <Text style={[styles.batchBtnText, { color: t.ink.secondary }]}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.batchBtn, { backgroundColor: t.accent.pink }]} onPress={() => { Alert.alert('批量删除', `确定要删除选中的 ${selectedBooks.size} 本书吗？`, [{ text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive', onPress: () => { selectedBooks.forEach((id) => deleteBook(id)); setSelectedBooks(new Set()); setBookBatchMode(false); } }]); }} activeOpacity={0.8}>
              <Ionicons name="trash-outline" size={14} color={t.ink.inverse} />
              <Text style={[styles.batchBtnText, { color: t.ink.inverse }]}> 删除</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ===== 筛选面板 Modal ===== */}
      <Modal visible={filterVisible} transparent animationType="fade" onRequestClose={() => setFilterVisible(false)}>
        <TouchableOpacity style={styles.menuBackdrop} activeOpacity={1} onPress={() => setFilterVisible(false)} />
        <View style={[styles.filterPanel, { backgroundColor: t.paper.primary, borderColor: t.outline.standard }]}>
          <View style={styles.panelHeader}>
            <Text style={[styles.panelTitle, { color: t.ink.primary }]}>筛选</Text>
            <TouchableOpacity onPress={resetFilters}><Text style={[styles.resetText, { color: t.accent.primary }]}>重置</Text></TouchableOpacity>
          </View>
          <Text style={[styles.filterLabel, { color: t.ink.secondary }]}>阅读状态</Text>
          <View style={styles.chipRow}>
            {[{ label: '全部', value: 'all' } as const, ...BOOK_STATUS_OPTIONS].map((opt) => {
              const active = filterStatus === opt.value;
              return (
                <TouchableOpacity key={opt.value} style={[styles.filterChip, { borderColor: active ? t.accent.primary : t.outline.standard, backgroundColor: active ? t.accent.primaryBg : 'transparent' }]} onPress={() => setFilterStatus(opt.value as BookStatus | 'all')} activeOpacity={0.7}>
                  <Text style={[styles.filterChipText, { color: active ? t.accent.primary : t.ink.secondary }]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.filterLabel, { color: t.ink.secondary }]}>书籍类型</Text>
          <View style={styles.chipRow}>
            {[{ label: '全部', value: 'all' }, { label: '电子书', value: 'ebook' }, { label: '纸质书', value: 'physical' }, { label: '有声书', value: 'audiobook' }].map((opt) => {
              const active = filterFormat === opt.value;
              return (
                <TouchableOpacity key={opt.value} style={[styles.filterChip, { borderColor: active ? t.accent.primary : t.outline.standard, backgroundColor: active ? t.accent.primaryBg : 'transparent' }]} onPress={() => setFilterFormat(opt.value as BookFormatFilter)} activeOpacity={0.7}>
                  <Text style={[styles.filterChipText, { color: active ? t.accent.primary : t.ink.secondary }]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {allTags.length > 0 && (
            <>
              <Text style={[styles.filterLabel, { color: t.ink.secondary }]}>标签</Text>
              <View style={styles.chipRow}>
                {allTags.map((tag) => {
                  const active = filterTagIds.has(tag.id);
                  return (
                    <TouchableOpacity key={tag.id} style={[styles.filterChip, { borderColor: active ? t.accent.primary : t.outline.standard, backgroundColor: active ? t.accent.primaryBg : 'transparent' }]} onPress={() => { const next = new Set(filterTagIds); if (next.has(tag.id)) next.delete(tag.id); else next.add(tag.id); setFilterTagIds(next); }} activeOpacity={0.7}>
                      <View style={[styles.tagDot, { backgroundColor: tag.color || t.accent.primary }]} />
                      <Text style={[styles.filterChipText, { color: active ? t.accent.primary : t.ink.secondary }]}>{tag.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* ===== 排序面板 Modal ===== */}
      <Modal visible={sortVisible} transparent animationType="fade" onRequestClose={() => setSortVisible(false)}>
        <TouchableOpacity style={styles.menuBackdrop} activeOpacity={1} onPress={() => setSortVisible(false)} />
        <View style={[styles.sortPanel, { backgroundColor: t.paper.primary, borderColor: t.outline.standard }]}>
          <Text style={[styles.panelTitle, { color: t.ink.primary, marginBottom: spacing.md }]}>排序</Text>
          {[
            { key: 'recent' as const, label: '最近阅读' },
            { key: 'title' as const, label: '书名' },
            { key: 'author' as const, label: '作者' },
            { key: 'added' as const, label: '添加时间' },
            { key: 'progress' as const, label: '阅读进度' },
          ].map((opt) => (
            <TouchableOpacity key={opt.key} style={[styles.sortItem, { borderBottomColor: t.outline.standard }]} onPress={() => { setSortMode(opt.key); setSortVisible(false); }} activeOpacity={0.6}>
              <Text style={[styles.sortItemText, { color: sortMode === opt.key ? t.accent.primary : t.ink.primary }]}>{opt.label}</Text>
              {sortMode === opt.key && <Ionicons name="checkmark" size={18} color={t.accent.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      {/* ===== 弹窗组件 ===== */}
      <BookMenuSheet visible={contextBookId !== null} book={contextBook ?? null} onClose={() => setContextBookId(null)} anchorX={menuPosition.x} anchorY={menuPosition.y} onMultiSelect={() => { setBookBatchMode(true); setSelectedBooks(new Set()); }} />
      <ImportModal visible={importVisible} onClose={() => setImportVisible(false)} />
      <AddBookMenuSheet visible={addMenuVisible} onClose={() => setAddMenuVisible(false)} onSearch={() => { setAddMenuVisible(false); setTimeout(() => router.push('/search'), 200); }} onImport={() => { setAddMenuVisible(false); setImportVisible(true); }} onManual={() => { setAddMenuVisible(false); setTimeout(() => router.push('/add-book'), 200); }} />

      {/* 悬浮加号按钮 */}
      {!bookBatchMode && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: t.accent.purple }]}
          onPress={() => setAddMenuVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ===== Styles =====
const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Top bar
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pageTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 24, fontWeight: '800' },

  // Nav menu dropdown
  menuBackdrop: { flex: 1 },
  navDropdown: { position: 'absolute', width: 180, borderRadius: radii.lg, borderWidth: 1, ...softShadow },
  navMenuItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  navMenuItemText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, fontWeight: '600' },

  // Tabs
  tabScroll: { maxHeight: 42, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'transparent' },
  tabScrollContent: { paddingHorizontal: spacing.md, gap: 4, alignItems: 'center' },
  tabBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, fontWeight: '600', maxWidth: 100 },

  // Toolbar
  toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radii.full, borderWidth: 1, paddingHorizontal: spacing.md, height: 34 },
  searchInput: { flex: 1, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, paddingVertical: 0 },
  toolBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  // Content
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.md, paddingTop: spacing.md },

  // FAB
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  // Book grid
  bookGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  bookCard: { borderRadius: radii.md, borderWidth: 1, marginBottom: spacing.sm, ...softShadow },
  coverImg: { aspectRatio: 0.7, width: '100%', borderTopLeftRadius: radii.md, borderTopRightRadius: radii.md },
  coverPlaceholder: { aspectRatio: 0.7, width: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs },
  coverTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 9, fontWeight: '700', textAlign: 'center', lineHeight: 12 },
  cardInfo: { padding: spacing.xs },
  cardTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, fontWeight: '700', lineHeight: 17 },
  cardAuthor: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, marginTop: 2 },
  cardStatus: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, fontWeight: '600', marginTop: 2 },
  batchCheck: { position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  moreBtn: { position: 'absolute', right: 2, bottom: 2, padding: 4, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 10, zIndex: 10 },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, fontWeight: '700', marginTop: spacing.md },
  emptyHint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, marginTop: spacing.xs },

  // Batch bar
  batchBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 1 },
  batchLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, fontWeight: '600' },
  batchBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.full },
  batchBtnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, fontWeight: '700' },

  // Filter/Sort panels (top-right dropdown)
  filterPanel: { position: 'absolute', top: 180, right: spacing.lg, left: spacing.lg, borderRadius: radii.xl, borderWidth: 1, padding: spacing.lg, ...softShadow, maxHeight: 360 },
  sortPanel: { position: 'absolute', top: 180, right: spacing.lg, width: 220, borderRadius: radii.xl, borderWidth: 1, padding: spacing.lg, ...softShadow },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  panelTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, fontWeight: '800' },
  resetText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, fontWeight: '700' },
  filterLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.full, borderWidth: 1 },
  filterChipText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, fontWeight: '600' },
  tagDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },

  // Sort items
  sortItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  sortItemText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, fontWeight: '600' },
});
