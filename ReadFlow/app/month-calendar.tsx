import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Modal, Share, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import ViewShot from 'react-native-view-shot';
import { spacing, radii } from '../src/theme';
import { softShadow } from '../src/theme/shadows';
import { getDatabase } from '../src/db/database';
import { useColors } from '../src/stores/useThemeStore';
import { safeGoBack } from '../src/utils/navigation';
import type { Book } from '../src/models';

type DateFilterMode = 'reading' | 'record' | 'finished';

interface DayInfo {
  day: number; date: string; books: (Book & { durationMs: number })[]; mins: number;
}

export default function MonthCalendarScreen() {
  const t = useColors();
  const { year: yr, month: mo } = useLocalSearchParams<{ year?: string; month?: string }>();
  const year = parseInt(yr || String(new Date().getFullYear()), 10);
  const month = parseInt(mo || String(new Date().getMonth() + 1), 10);

  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<DayInfo[]>([]);
  const [filterMode, setFilterMode] = useState<DateFilterMode>('record');
  const [stackMode, setStackMode] = useState<'grid' | 'stack'>('grid');
  const [filterVisible, setFilterVisible] = useState(false);
  const [selYear, setSelYear] = useState(year);
  const [selMonth, setSelMonth] = useState(month);
  const viewShotRef = useRef<any>(null);

  const handleShare = useCallback(async () => {
    try {
      if (viewShotRef.current?.capture) {
        const uri = await viewShotRef.current.capture();
        await Share.share({ title: `${selYear}年${selMonth}月阅读日历`, url: uri });
      }
    } catch (e: any) {
      if (e?.message !== 'User did not share') Alert.alert('分享失败', '请重试');
    }
  }, [year, month]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const db = await getDatabase();
      const [sessAll, manAll, allBooks] = await Promise.all([
        db.getAllAsync<{ book_id: string; start_time: string; duration_ms: number }>('SELECT book_id, start_time, duration_ms FROM reading_sessions'),
        db.getAllAsync<{ book_id: string; logged_at: string; duration_ms: number }>('SELECT book_id, logged_at, duration_ms FROM manual_logs'),
        db.getAllAsync<Book>('SELECT * FROM books'),
      ]);
      const bookMap = new Map(allBooks.map(b => [b.id, b]));
      const prefix = `${selYear}-${String(selMonth).padStart(2, '0')}`;
      const daysInMonth = new Date(selYear, selMonth, 0).getDate();
      const dayInfos: DayInfo[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const date = `${prefix}-${String(d).padStart(2, '0')}`;

        // 按 filterMode 收集当天的书籍
        const dayBooks = new Map<string, { book: Book; durationMs: number; reason: string }>();
        const addBook = (bookId: string, ms: number, reason: string) => {
          const book = bookMap.get(bookId);
          if (!book) return;
          if (!dayBooks.has(bookId)) dayBooks.set(bookId, { book, durationMs: 0, reason });
          const entry = dayBooks.get(bookId)!;
          entry.durationMs += ms;
        };

        if (filterMode === 'record') {
          for (const s of sessAll) if (s.start_time.startsWith(date)) addBook(s.book_id, s.duration_ms || 0, 'record');
          for (const m of manAll) if (m.logged_at.startsWith(date)) addBook(m.book_id, m.duration_ms || 0, 'record');
        } else if (filterMode === 'reading') {
          // 开始阅读日期 = 该书籍第一次被记录的日期
          for (const s of sessAll) { const sd = s.start_time.slice(0, 10); if (sd === date) addBook(s.book_id, s.duration_ms || 0, 'reading'); }
          for (const m of manAll) { const md = m.logged_at.slice(0, 10); if (md === date) addBook(m.book_id, m.duration_ms || 0, 'reading'); }
        } else if (filterMode === 'finished') {
          for (const b of allBooks) { if (b.status === 'finished' && b.finished_date?.startsWith(date)) addBook(b.id, 0, 'finished'); }
        }

        const books = [...dayBooks.values()].map(e => ({ ...e.book, durationMs: e.durationMs }));
        const mins = books.reduce((s, b) => s + Math.floor(b.durationMs / 60000), 0);
        dayInfos.push({ day: d, date, books, mins });
      }
      setDays(dayInfos);
    } catch (e) { console.error('month-calendar error:', e); }
    finally { setLoading(false); }
  }, [selYear, selMonth, filterMode]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const firstDay = new Date(selYear, selMonth - 1, 1).getDay();
  const weeks: (DayInfo | null)[][] = [];
  let week: (DayInfo | null)[] = [];
  for (let i = 0; i < firstDay; i++) week.push(null);
  for (const d of days) { week.push(d); if (week.length === 7) { weeks.push(week); week = []; } }
  if (week.length > 0) { while (week.length < 7) week.push(null); weeks.push(week); }

  const maxMins = Math.max(...days.map(d => d.mins), 1);

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: t.paper.primary }]}><ActivityIndicator size="large" color={t.accent.primary} /></View>;
  }

  return (
    <View style={[styles.root, { backgroundColor: t.paper.primary }]}>
      <View style={[styles.navBar, { borderBottomColor: t.outline.standard }]}>
        <TouchableOpacity onPress={() => safeGoBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={t.ink.primary} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: t.ink.primary }]}>读书日历</Text>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <TouchableOpacity onPress={() => setFilterVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="filter-outline" size={20} color={t.ink.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="share-outline" size={20} color={t.ink.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Month selector */}
      <View style={[styles.monthNav, { borderBottomColor: t.outline.standard }]}>
        <TouchableOpacity onPress={() => { if (selMonth===1) { setSelMonth(12); setSelYear(selYear-1); } else setSelMonth(selMonth-1); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={18} color={t.ink.primary} />
        </TouchableOpacity>
        <Text style={[styles.monthNavText, { color: t.ink.primary }]}>{selYear}年{selMonth}月</Text>
        <TouchableOpacity onPress={() => { if (selMonth===12) { setSelMonth(1); setSelYear(selYear+1); } else setSelMonth(selMonth+1); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-forward" size={18} color={t.ink.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }} style={{ backgroundColor: t.paper.primary }}>
        {/* Calendar card */}
        <View style={[styles.calCard, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}>
        {/* Weekday headers */}
        <View style={styles.wkRow}>
          {['日','一','二','三','四','五','六'].map((w, i) => (
            <Text key={i} style={[styles.wkHeader, { color: t.ink.tertiary }]}>{w}</Text>
          ))}
        </View>
        {/* Calendar grid */}
        {weeks.map((wk, wi) => (
          <View key={wi} style={styles.wkRow}>
            {wk.map((cell, ci) => {
              if (!cell) return <View key={ci} style={styles.dayCell} />;
              const hasBooks = cell.books.length > 0;
              const intensity = cell.mins > 0 ? Math.min(1, cell.mins / maxMins) : 0;
              return (
                <View key={ci} style={[styles.dayCell, { backgroundColor: hasBooks ? `${t.accent.purple}${Math.round(intensity*50+10).toString(16).padStart(2,'0')}` : 'transparent', borderRadius: 6 }]}>
                  <Text style={[styles.dayNum, { color: hasBooks && intensity > 0.7 ? '#fff' : t.ink.tertiary }]}>{cell.day}</Text>
                  {hasBooks && (
                    stackMode === 'grid' ? (
                      <View style={styles.gridCovers}>
                        {cell.books.slice(0, 4).map((b, bi) => (
                          b.cover_url ? <Image key={bi} source={{ uri: b.cover_url }} style={styles.miniCover} /> :
                          <View key={bi} style={[styles.miniCoverPh, { backgroundColor: t.accent.purple + '22' }]}><Text style={styles.miniCoverTxt}>{b.title[0]}</Text></View>
                        ))}
                      </View>
                    ) : (
                      <View style={styles.stackCovers}>
                        {cell.books.slice(0, 3).reverse().map((b, bi) => (
                          b.cover_url ? <Image key={bi} source={{ uri: b.cover_url }} style={[styles.stackCover, { marginLeft: bi > 0 ? -16 : 0, zIndex: bi }]} /> :
                          <View key={bi} style={[styles.stackCover, styles.miniCoverPh, { marginLeft: bi > 0 ? -16 : 0, zIndex: bi, backgroundColor: t.accent.purple + '22' }]}><Text style={styles.miniCoverTxt}>{b.title[0]}</Text></View>
                        ))}
                      </View>
                    )
                  )}
                </View>
              );
            })}
          </View>
        ))}
        </View>
        </ViewShot>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Filter modal */}
      <Modal visible={filterVisible} transparent animationType="fade">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={() => setFilterVisible(false)} />
        <View style={[styles.filterSheet, { backgroundColor: t.paper.primary, borderColor: t.outline.standard }]}>
          <Text style={[styles.filterTitle, { color: t.ink.primary }]}>筛选</Text>
          <Text style={[styles.filterLabel, { color: t.ink.secondary }]}>日期展示形式</Text>
          {(['record', 'reading', 'finished'] as DateFilterMode[]).map(m => (
            <TouchableOpacity key={m} style={[styles.filterOption, { borderBottomColor: t.outline.standard }]} onPress={() => { setFilterMode(m); setFilterVisible(false); }} activeOpacity={0.7}>
              <Text style={[styles.filterOptText, { color: filterMode === m ? t.accent.primary : t.ink.primary }]}>
                {m === 'record' ? '记录日期' : m === 'reading' ? '开始阅读-完成阅读' : '完成日期'}
              </Text>
              {filterMode === m && <Ionicons name="checkmark" size={18} color={t.accent.primary} />}
            </TouchableOpacity>
          ))}
          <Text style={[styles.filterLabel, { color: t.ink.secondary, marginTop: spacing.lg }]}>多本书显示</Text>
          {(['grid', 'stack'] as const).map(m => (
            <TouchableOpacity key={m} style={[styles.filterOption, { borderBottomColor: t.outline.standard }]} onPress={() => { setStackMode(m); setFilterVisible(false); }} activeOpacity={0.7}>
              <Text style={[styles.filterOptText, { color: stackMode === m ? t.accent.primary : t.ink.primary }]}>
                {m === 'grid' ? '网格排列' : '堆栈排列'}
              </Text>
              {stackMode === m && <Ionicons name="checkmark" size={18} color={t.accent.primary} />}
            </TouchableOpacity>
          ))}
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
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  monthNavText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, fontWeight: '700' },
  calCard: { borderRadius: radii.xl, borderWidth: 1, padding: spacing.md, marginTop: spacing.md, ...softShadow },
  wkRow: { flexDirection: 'row' },
  wkHeader: { flex: 1, textAlign: 'center', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, fontWeight: '600', marginBottom: spacing.sm, paddingVertical: spacing.xs, backgroundColor: 'rgba(124,107,255,0.08)', borderRadius: 4 },
  dayCell: { flex: 1, aspectRatio: 1, padding: 2, overflow: 'hidden' },
  dayNum: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10, fontWeight: '500', position: 'absolute', top: 1, left: 3, zIndex: 2 },
  gridCovers: { flex: 1, width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, flexDirection: 'row', flexWrap: 'wrap' },
  miniCover: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, borderRadius: 4, resizeMode: 'cover' },
  miniCoverPh: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  miniCoverTxt: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, fontWeight: '700', color: '#7C6BFF' },
  stackCovers: { flex: 1, width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 },
  stackCover: { width: '100%', height: '100%', borderRadius: 4, position: 'absolute', top: 0, left: 0, resizeMode: 'cover' },
  filterSheet: { borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, borderWidth: 1, padding: spacing.xl, paddingBottom: spacing.xxl, position: 'absolute', bottom: 0, left: 0, right: 0, ...softShadow },
  filterTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 17, fontWeight: '800', marginBottom: spacing.lg },
  filterLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, fontWeight: '600', marginBottom: spacing.sm },
  filterOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  filterOptText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, fontWeight: '500' },
});
