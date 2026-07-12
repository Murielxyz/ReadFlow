import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radii } from '../../theme';
import { softShadow } from '../../theme/shadows';
import { formatDuration } from '../../utils/format';
import { useColors } from '../../stores/useThemeStore';
import type { Book } from '../../models';

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  day: number;
  books: (Book & { durationMs: number })[];
}

interface MiniCalendarProps {
  type: 'week' | 'month';
  days: CalendarDay[];
  year: number;
  month: number; // 1-12
  weekDays?: string[]; // for week: Mon-Sun labels
  onDayPress?: (day: CalendarDay) => void;
  onBookPress?: (book: Book) => void;
}

const DAY_HEADERS = ['日', '一', '二', '三', '四', '五', '六'];

export default function MiniCalendar({ type, days, year, month, weekDays, onDayPress, onBookPress }: MiniCalendarProps) {
  const t = useColors();

  if (type === 'week') {
    return (
      <View style={[styles.calCard, { backgroundColor: '#FAFAF8', borderColor: t.outline.standard }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.weekRow}>
        {(weekDays || ['一', '二', '三', '四', '五', '六', '日']).map((label, i) => {
          const dayData = days[i];
          return (
            <View key={i} style={[styles.weekCell, { borderColor: t.outline.standard }]}>
              <Text style={[styles.weekLabel, { color: t.ink.tertiary }]}>{label}</Text>
              {dayData ? (
                <>
                  {dayData.books.length > 0 ? (
                    <View style={styles.weekCoverWrap}>
                      {/* 堆叠效果：第2本往后偏移 */}
                      {dayData.books.slice(0, 3).reverse().map((b, bi) => {
                        const isStack = dayData.books.length > 1;
                        const offset = isStack ? (dayData.books.length - 1 - bi) * 3 : 0;
                        return b.cover_url ? (
                          <Image key={bi} source={{ uri: b.cover_url }} style={[styles.weekCover, { top: offset, left: offset }]} />
                        ) : (
                          <View key={bi} style={[styles.weekCoverPlaceholder, { backgroundColor: t.accent.purple + '22', top: offset, left: offset }]}>
                            <Ionicons name="book" size={16} color={t.accent.purple} />
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                  <Text style={[styles.weekDay, { color: dayData.books.length > 0 ? '#1A1512' : t.ink.tertiary, fontSize: dayData.books.length > 0 ? 12 : 11, fontWeight: dayData.books.length > 0 ? '800' : '700' }]}>{dayData.books.length > 0 ? formatDuration(dayData.books[0].durationMs) : dayData.day}</Text>
                </>
              ) : (
                <Text style={[styles.weekDay, { color: t.ink.tertiary }]}>-</Text>
              )}
            </View>
          );
        })}
      </View>
      </ScrollView>
      </View>
    );
  }

  // Month view
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const dayMap = new Map(days.map((d) => [d.date, d]));

  const cells: (CalendarDay | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push(dayMap.get(key) || { date: key, day: d, books: [] });
  }

  return (
    <View style={[styles.calCard, { backgroundColor: '#FAFAF8', borderColor: t.outline.standard }]}>
      <View style={styles.monthHeader}>
        {DAY_HEADERS.map((h) => (
          <Text key={h} style={[styles.dayHeader, { color: t.ink.tertiary }]}>{h}</Text>
        ))}
      </View>
      <View style={styles.monthGrid}>
        {cells.map((cell, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.monthCell, { backgroundColor: cell?.books.length ? t.accent.primaryBg : t.paper.white, borderColor: t.outline.standard }]}
            onPress={() => cell && onDayPress?.(cell)}
            activeOpacity={0.7}
          >
            {cell && (
              <View style={{ flex: 1, width: '100%', height: '100%' }}>
                {cell.books.length > 0 && cell.books.slice(0, 3).reverse().map((b, bi) => {
                  const isStack = cell.books.length > 1;
                  const offset = isStack ? (cell.books.length - 1 - bi) * 2 : 0;
                  return b.cover_url ? (
                    <Image key={bi} source={{ uri: b.cover_url }} style={[styles.monthCover, { top: offset, left: offset }]} />
                  ) : (
                    <View key={bi} style={[styles.monthCoverPlaceholder, { backgroundColor: t.accent.purple + '22', top: offset, left: offset }]}>
                      <Ionicons name="book" size={12} color={t.accent.purple} />
                    </View>
                  );
                })}
                <Text style={[styles.monthDay, { color: cell.books.length > 0 ? '#fff' : t.ink.tertiary }]}>{cell.day}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  calCard: { borderRadius: radii.lg, borderWidth: 1, padding: spacing.sm, marginHorizontal: 0 },
  // Week
  weekRow: { flexDirection: 'row', gap: 4 },
  weekCell: { width: 90, borderRadius: radii.md, borderWidth: 1, padding: 0, alignItems: 'center', aspectRatio: 0.65, backgroundColor: '#FAFAF8', overflow: 'hidden' },
  weekLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 9, fontWeight: '600', backgroundColor: 'rgba(124,107,255,0.08)', paddingVertical: 1, paddingHorizontal: 4, borderRadius: 4, position: 'absolute', top: 2, zIndex: 2 },
  weekDay: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, fontWeight: '700', position: 'absolute', bottom: 2, zIndex: 2 },
  weekCoverWrap: { flex: 1, width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 },
  weekCover: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, resizeMode: 'cover' },
  weekCoverPlaceholder: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  weekCoverDuration: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 7, position: 'absolute', bottom: 16, zIndex: 2 },

  // Month
  monthHeader: { flexDirection: 'row' },
  dayHeader: { width: '14.28%', textAlign: 'center', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, fontWeight: '600', paddingVertical: spacing.xs, backgroundColor: 'rgba(124,107,255,0.08)', borderRadius: 4 },
  monthCalCard: { borderRadius: radii.lg, borderWidth: 1, padding: spacing.sm },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs },
  monthCell: { width: '14.28%', aspectRatio: 0.8, borderWidth: StyleSheet.hairlineWidth, padding: 0, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  monthDay: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 8, fontWeight: '600', position: 'absolute', top: 1, left: 2, zIndex: 2 },
  monthCover: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, resizeMode: 'cover' },
  monthCoverPlaceholder: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
});
