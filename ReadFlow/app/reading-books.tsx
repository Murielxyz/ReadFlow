import { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router, useLocalSearchParams } from 'expo-router';
import { spacing, radii } from '../src/theme';
import { softShadow } from '../src/theme/shadows';
import { formatDuration } from '../src/utils/format';
import { useColors } from '../src/stores/useThemeStore';
import { getDatabase } from '../src/db/database';
import { safeGoBack } from '../src/utils/navigation';
import type { Book } from '../src/models';

export default function ReadingBooksScreen() {
  const t = useColors();
  const { period, year, month, week } = useLocalSearchParams<{ period?: string; year?: string; month?: string; week?: string }>();

  const [loading, setLoading] = useState(true);
  const [bookData, setBookData] = useState<(Book & { durationMs: number })[]>([]);

  const periodLabel = (() => {
    if (!period || !year) return '阅读书籍';
    const y = parseInt(year, 10);
    if (period === 'week' && week) return `${y}年第${week}周`;
    if (period === 'month' && month) return `${y}年${month}月`;
    if (period === 'year') return `${y}年`;
    return '阅读书籍';
  })();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const db = await getDatabase();
      let start: string, end: string;
      const y = year ? parseInt(year, 10) : new Date().getFullYear();

      if (period === 'week' && week) {
        const w = parseInt(week, 10);
        const jan1 = new Date(y, 0, 1);
        const offset = (w - 1) * 7 - jan1.getDay() + 1;
        const s = new Date(y, 0, 1 + offset);
        const e = new Date(s); e.setDate(e.getDate() + 7);
        start = `${s.getFullYear()}-${String(s.getMonth()+1).padStart(2,'0')}-${String(s.getDate()).padStart(2,'0')}`;
        end = `${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,'0')}-${String(e.getDate()).padStart(2,'0')}`;
      } else if (period === 'month' && month) {
        const m = parseInt(month, 10);
        start = `${y}-${String(m).padStart(2, '0')}-01`;
        const d = new Date(y, m, 0).getDate();
        end = `${y}-${String(m).padStart(2, '0')}-${d}`;
      } else if (period === 'year') {
        start = `${y}-01-01`;
        end = `${y + 1}-01-01`;
      } else {
        start = '2000-01-01';
        end = '2099-12-31';
      }

      // 全量查询 + JS 中按时间过滤 + book_id 汇总
      const [rbSessAll, rbManAll, allBooks] = await Promise.all([
        db.getAllAsync<{ book_id: string; duration_ms: number; start_time: string }>('SELECT book_id, duration_ms, start_time FROM reading_sessions'),
        db.getAllAsync<{ book_id: string; duration_ms: number; logged_at: string }>('SELECT book_id, duration_ms, logged_at FROM manual_logs'),
        db.getAllAsync<Book>('SELECT * FROM books ORDER BY updated_at DESC'),
      ]);
      const rbSess = rbSessAll.filter(r => (r.start_time||'') >= start && (r.start_time||'') <= end);
      const rbMan = rbManAll.filter(r => (r.logged_at||'') >= start && (r.logged_at||'') <= end);
      const durMap = new Map<string, number>();
      for (const r of rbSess) durMap.set(r.book_id, (durMap.get(r.book_id)||0) + (r.duration_ms||0));
      for (const r of rbMan) durMap.set(r.book_id, (durMap.get(r.book_id)||0) + (r.duration_ms||0));
      const rows = allBooks.filter(b => durMap.has(b.id)).map(b => ({ ...b, durationMs: durMap.get(b.id)||0 })).sort((a,b) => b.durationMs - a.durationMs);
      setBookData(rows);
    } catch (e) { console.error('reading-books error:', e); }
    finally { setLoading(false); }
  }, [period, year, month, week]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: t.paper.primary }]}><ActivityIndicator size="large" color={t.accent.primary} /></View>;
  }

  return (
    <View style={[styles.root, { backgroundColor: t.paper.primary }]}>
      <View style={[styles.navBar, { borderBottomColor: t.outline.standard }]}>
        <TouchableOpacity onPress={() => safeGoBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={t.ink.primary} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: t.ink.primary }]}>{periodLabel} · 阅读书籍</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {bookData.length === 0 ? (
          <Text style={[styles.emptyText, { color: t.ink.tertiary }]}>暂无阅读记录</Text>
        ) : (
          bookData.map((book) => (
            <TouchableOpacity key={book.id} style={[styles.bookCard, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]} onPress={() => router.push(`/book/${book.id}`)} activeOpacity={0.6}>
              {book.cover_url ? (
                <Image source={{ uri: book.cover_url }} style={styles.cover} />
              ) : (
                <View style={[styles.coverPh, { backgroundColor: t.accent.purple + '22' }]}>
                  <Ionicons name="book" size={20} color={t.accent.primary} />
                </View>
              )}
              <View style={styles.bookInfo}>
                <Text style={[styles.bookTitle, { color: t.ink.primary }]} numberOfLines={1}>{book.title}</Text>
                <Text style={[styles.bookMeta, { color: t.ink.tertiary }]}>
                  {book.author ?? '未知作者'} · {formatDuration(book.durationMs)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={t.ink.tertiary} />
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  navTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, fontWeight: '700' },
  scroll: { padding: spacing.lg },
  bookCard: { flexDirection: 'row', alignItems: 'center', borderRadius: radii.lg, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.md, ...softShadow },
  cover: { width: 40, height: 56, borderRadius: 4 },
  coverPh: { width: 40, height: 56, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  bookInfo: { flex: 1 },
  bookTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  bookMeta: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12 },
  emptyText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, textAlign: 'center', paddingVertical: spacing.xl },
});
