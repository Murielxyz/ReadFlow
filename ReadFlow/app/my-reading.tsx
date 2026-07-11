import { useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router, useLocalSearchParams } from 'expo-router';
import { spacing, radii } from '../src/theme';
import { softShadow } from '../src/theme/shadows';
import { formatDuration } from '../src/utils/format';
import { useColors } from '../src/stores/useThemeStore';
import { useBookStore } from '../src/stores/useBookStore';
import { useSourceStore } from '../src/stores/useSourceStore';
import { getDatabase } from '../src/db/database';
import { safeGoBack } from '../src/utils/navigation';
import type { Book } from '../src/models';

type StatusTab = 'all' | 'reading' | 'finished';

export default function MyReadingScreen() {
  const t = useColors();
  const { period, year, month, week } = useLocalSearchParams<{ period?: string; year?: string; month?: string; week?: string }>();
  const fetchBooks = useBookStore((s) => s.fetchBooks);
  const books = useBookStore((s) => s.books);

  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [loading, setLoading] = useState(true);
  const [bookData, setBookData] = useState<(Book & { durationMs: number; progress: number })[]>([]);

  // Build time range from params
  const timeRange = (() => {
    if (!period || !year) return null;
    const y = parseInt(year, 10);
    if (period === 'year') return { start: `${y}-01-01`, end: `${y+1}-01-01` };
    if (period === 'month' && month) {
      const m = parseInt(month, 10);
      const end = new Date(y, m, 0).getDate();
      return { start: `${y}-${String(m).padStart(2,'0')}-01`, end: `${y}-${String(m).padStart(2,'0')}-${String(end).padStart(2,'0')}` };
    }
    if (period === 'week' && week) {
      const w = parseInt(week, 10);
      const jan1 = new Date(y, 0, 1);
      const offset = (w - 1) * 7 - jan1.getDay() + 1;
      const start = new Date(y, 0, 1 + offset);
      const end = new Date(start); end.setDate(end.getDate() + 6);
      return { start: `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}`, end: `${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}` };
    }
    return null;
  })();

  // Build period label
  const periodLabel = (() => {
    if (!period || !year) return null;
    if (period === 'year') return `${year}年`;
    if (period === 'month' && month) return `${year}年${month}月`;
    if (period === 'week' && week) return `${year}年第${week}周`;
    return null;
  })();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const db = await getDatabase();
      const tr = timeRange;
      // 始终查询所有书籍 + 原始记录，JS 中计算时长（避免 GROUP BY/SUM 失败）
      // 全量查询 + JS 中按时间范围过滤（避免 substr 函数失败）
      const [allBooks2, sessAll2, manAll2] = await Promise.all([
        db.getAllAsync<Book>('SELECT * FROM books ORDER BY updated_at DESC'),
        db.getAllAsync<{ book_id: string; duration_ms: number; start_time: string }>('SELECT book_id, duration_ms, start_time FROM reading_sessions'),
        db.getAllAsync<{ book_id: string; duration_ms: number; logged_at: string }>('SELECT book_id, duration_ms, logged_at FROM manual_logs'),
      ]);
      const sessRows = tr ? sessAll2.filter(r => (r.start_time||'') >= tr.start && (r.start_time||'') <= tr.end) : sessAll2;
      const manRows = tr ? manAll2.filter(r => (r.logged_at||'') >= tr.start && (r.logged_at||'') <= tr.end) : manAll2;
      // JS 按 book_id 汇总时长
      const durMap2 = new Map<string, number>();
      for (const r of sessRows) durMap2.set(r.book_id, (durMap2.get(r.book_id)||0) + (r.duration_ms||0));
      for (const r of manRows) durMap2.set(r.book_id, (durMap2.get(r.book_id)||0) + (r.duration_ms||0));
      const rows = allBooks2.map(b => ({ ...b, durationMs: durMap2.get(b.id)||0, progressPct: 0 }));
      setBookData(rows.map((r) => ({
        ...r,
        progress: Math.round(r.progressPct),
      })));
    } catch (e) { console.error('my-reading error:', e); }
    finally { setLoading(false); }
  }, [timeRange?.start, timeRange?.end]);

  useFocusEffect(useCallback(() => { fetchBooks(); fetchData(); }, [fetchData, fetchBooks, timeRange?.start, timeRange?.end]));

  const [searchVisible, setSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const filtered = useMemo(() => {
    let result = bookData;
    // 排除待读且无计时记录的书
    result = result.filter((b) => !(b.status === 'to_read' && b.durationMs === 0));
    if (statusTab !== 'all') result = result.filter((b) => b.status === statusTab);
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      result = result.filter((b) => b.title.toLowerCase().includes(q) || (b.author ?? '').toLowerCase().includes(q));
    }
    // 按 id 去重（防止数据源中同一本书出现两次）
    const seen = new Set<string>();
    return result.filter((b) => { if (seen.has(b.id)) return false; seen.add(b.id); return true; });
  }, [bookData, statusTab, searchText]);

  // Group by year
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const b of filtered) {
      const d = (b.created_at || '').trim(); const year = /^\d{4}/.test(d) ? d.slice(0, 4) : '未知';
      if (!map.has(year)) map.set(year, []);
      map.get(year)!.push(b);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const [filterVisible, setFilterVisible] = useState(false);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<number | null>(null);
  const now2 = new Date();

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: t.paper.primary }]}><ActivityIndicator size="large" color={t.accent.primary} /></View>;
  }

  return (
    <View style={[styles.root, { backgroundColor: t.paper.primary }]}>
      <View style={[styles.navBar, { borderBottomColor: t.outline.standard }]}>
        <TouchableOpacity onPress={() => safeGoBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={t.ink.primary} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: t.ink.primary }]}>我的阅历</Text>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <TouchableOpacity onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={viewMode === 'list' ? 'grid-outline' : 'list-outline'} size={20} color={t.ink.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSearchVisible(!searchVisible)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="search-outline" size={22} color={t.ink.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Status tabs + year row */}
      <View style={[styles.statusBar, { borderBottomColor: t.outline.standard }]}>
        {(['all', 'reading', 'finished'] as StatusTab[]).map((k) => {
          const labels: Record<StatusTab, string> = { all: '全部', reading: '在读', finished: '已读' };
          const active = statusTab === k;
          return (
            <TouchableOpacity key={k} style={[styles.statusTab, active && { borderBottomColor: t.accent.primary }]} onPress={() => setStatusTab(k)} activeOpacity={0.7}>
              <Text style={[styles.statusTabText, { color: active ? t.accent.primary : t.ink.tertiary }]}>{labels[k]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {/* Year row */}
      <View style={[styles.yearRow, { borderBottomColor: t.outline.standard }]}>
        <Text style={[styles.yearTitle, { color: t.ink.primary }]}>
          {periodLabel ? periodLabel : `${new Date().getFullYear()}年`}（{filtered.length}本）
        </Text>
        <TouchableOpacity onPress={() => setFilterVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="filter-outline" size={18} color={t.ink.secondary} />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      {searchVisible && (
        <View style={[styles.searchBar, { backgroundColor: t.paper.white, borderBottomColor: t.outline.standard }]}>
          <Ionicons name="search-outline" size={16} color={t.ink.tertiary} />
          <TextInput
            style={[styles.searchInput, { color: t.ink.primary }]}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="搜索书名或作者..."
            placeholderTextColor={t.ink.tertiary}
            autoFocus
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons name="close-circle" size={16} color={t.ink.tertiary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <Text style={[styles.emptyText, { color: t.ink.tertiary }]}>还没有书籍</Text>
        ) : viewMode === 'list' ? (
          filtered.map((book) => (
            <TouchableOpacity key={book.id} style={[styles.bookCard, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]} onPress={() => router.push(`/book/${book.id}`)} activeOpacity={0.6}>
              {book.cover_url ? (
                <Image source={{ uri: book.cover_url }} style={styles.cover} />
              ) : (
                <View style={[styles.coverPh, { backgroundColor: t.accent.purple + '22' }]}>
                  <Ionicons name="book" size={20} color={t.accent.purple} />
                </View>
              )}
              <View style={styles.bookInfo}>
                <Text style={[styles.bookTitle, { color: t.ink.primary }]} numberOfLines={1}>{book.title}</Text>
                <Text style={[styles.bookMeta, { color: t.ink.tertiary }]}>
                  {(() => {
                    const dur = formatDuration(book.durationMs);
                    const validDate = (d: string | null | undefined): boolean => {
                      if (!d) return false;
                      const y = parseInt(d.slice(0,4), 10);
                      const m = parseInt(d.slice(5,7), 10);
                      return y >= 2000 && y <= 2100 && m >= 1 && m <= 12;
                    };
                    const fmt = (d: string, suffix: string) => {
                      const m = parseInt(d.slice(5,7), 10);
                      return `${d.slice(0,4)}年${m}月${suffix} · ${dur}`;
                    };
                    if (book.status==='finished' && validDate(book.finished_date)) return fmt(book.finished_date!, '读完');
                    if (validDate(book.created_at)) return fmt(book.created_at!, '开始阅读');
                    return dur;
                  })()}
                </Text>
                {(book.status === 'finished' || statusTab === 'finished') && book.rating != null && (
                  <View style={styles.ratingRow}>
                    {[1,2,3,4,5].map(i => (
                      <Ionicons key={i} name={i <= book.rating! ? 'star' : 'star-outline'} size={12} color={i <= book.rating! ? t.accent.yellow : t.ink.tertiary} />
                    ))}
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color={t.ink.tertiary} />
            </TouchableOpacity>
          ))
        ) : (
          /* Grid view: 3 columns */
          <View style={styles.gridContainer}>
            {filtered.map((book) => (
              <TouchableOpacity key={book.id} style={[styles.gridCard, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]} onPress={() => router.push(`/book/${book.id}`)} activeOpacity={0.6}>
                {book.cover_url ? (
                  <Image source={{ uri: book.cover_url }} style={styles.gridCover} />
                ) : (
                  <View style={[styles.gridCoverPh, { backgroundColor: t.accent.purple + '22' }]}>
                    <Ionicons name="book" size={24} color={t.accent.purple} />
                  </View>
                )}
                <Text style={[styles.gridTitle, { color: t.ink.primary }]} numberOfLines={1}>{book.title}</Text>
                <Text style={[styles.gridMeta, { color: t.ink.tertiary }]} numberOfLines={1}>
                  {(() => {
                    const validDate = (d: string | null | undefined): boolean => {
                      if (!d) return false;
                      const y = parseInt(d.slice(0,4), 10);
                      const m = parseInt(d.slice(5,7), 10);
                      return y >= 2000 && y <= 2100 && m >= 1 && m <= 12;
                    };
                    if (book.status==='finished' && validDate(book.finished_date)) return `${book.finished_date!.slice(0,4)}年${parseInt(book.finished_date!.slice(5,7))}月读完`;
                    if (validDate(book.created_at)) return `${book.created_at!.slice(0,4)}年${parseInt(book.created_at!.slice(5,7))}月开始`;
                    return '';
                  })()}
                </Text>
                <Text style={[styles.gridDur, { color: t.accent.primary }]}>{formatDuration(book.durationMs)}</Text>
                {(book.status === 'finished' || statusTab === 'finished') && book.rating != null && (
                  <View style={styles.gridRating}>
                    {[1,2,3,4,5].map(i => (
                      <Ionicons key={i} name={i <= book.rating! ? 'star' : 'star-outline'} size={10} color={i <= book.rating! ? t.accent.yellow : t.ink.tertiary} />
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 筛选弹窗 — 仅显示有阅读记录的年份 */}
      <Modal visible={filterVisible} transparent animationType="fade">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={() => setFilterVisible(false)} />
        <View style={[styles.filterSheet, { backgroundColor: t.paper.primary, borderColor: t.outline.standard }]}>
          <Text style={[styles.filterTitle, { color: t.ink.primary }]}>选择年份</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {/* 收集所有 bookData 中的年份 */}
            {(() => {
              const years = [...new Set(bookData.map(b => (b.created_at||'').slice(0,4)).filter(y => { const n = Number(y); return n >= 2000 && n <= 2100; }))].sort((a,b) => Number(b)-Number(a));
              return years.map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[styles.filterChip, { backgroundColor: filterYear === Number(y) ? t.accent.primary : t.paper.white, borderColor: filterYear === Number(y) ? t.accent.primary : t.outline.standard }]}
                  onPress={() => { setFilterYear(Number(y)); setFilterVisible(false); router.replace(`/my-reading?period=year&year=${y}`); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterChipText, { color: filterYear === Number(y) ? '#fff' : t.ink.primary }]}>{y}年</Text>
                </TouchableOpacity>
              ));
            })()}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  navTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, fontWeight: '700' },
  statusBar: { flexDirection: 'row', borderBottomWidth: 1 },
  statusTab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  statusTabText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, fontWeight: '600' },
  yearRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  yearTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, fontWeight: '700' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  searchInput: { flex: 1, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, paddingVertical: 4 },
  scroll: { padding: spacing.lg },
  yearHeader: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, fontWeight: '700', marginTop: spacing.lg, marginBottom: spacing.md },
  bookCard: { flexDirection: 'row', alignItems: 'center', borderRadius: radii.lg, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.md, ...softShadow },
  cover: { width: 44, height: 60, borderRadius: 4 },
  coverPh: { width: 44, height: 60, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  bookInfo: { flex: 1 },
  bookTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  bookProgress: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, fontWeight: '600', marginBottom: 2 },
  bookMeta: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11 },
  ratingRow: { flexDirection: 'row', marginTop: 4, gap: 1 },
  emptyText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, textAlign: 'center', paddingVertical: spacing.xl },
  // Grid view
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gridCard: { width: '31.5%', borderRadius: radii.lg, borderWidth: 1, padding: spacing.sm, alignItems: 'center', ...softShadow },
  gridCover: { width: '100%', aspectRatio: 0.7, borderRadius: radii.sm, marginBottom: spacing.sm },
  gridCoverPh: { width: '100%', aspectRatio: 0.7, borderRadius: radii.sm, marginBottom: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  gridTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 2 },
  gridMeta: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10, textAlign: 'center' },
  gridDur: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, fontWeight: '700', marginTop: 2 },
  gridRating: { flexDirection: 'row', marginTop: 2, gap: 1 },
  // Filter modal
  filterSheet: { borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, borderWidth: 1, padding: spacing.xl, paddingBottom: spacing.xxl, position: 'absolute', bottom: 0, left: 0, right: 0, ...softShadow },
  filterTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 17, fontWeight: '800', marginBottom: spacing.lg },
  filterLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, fontWeight: '600', marginBottom: spacing.sm, marginTop: spacing.md },
  filterScroll: { marginBottom: spacing.sm },
  filterChip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.full, borderWidth: 1, marginRight: spacing.sm },
  filterChipText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, fontWeight: '600' },
  filterApply: { marginTop: spacing.lg, height: 48, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  filterApplyText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, fontWeight: '700' },
});
