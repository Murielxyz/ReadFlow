import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radii } from '../src/theme';
import { softShadow } from '../src/theme/shadows';
import { getDatabase } from '../src/db/database';
import { useColors } from '../src/stores/useThemeStore';
import { safeGoBack } from '../src/utils/navigation';

type TabKey = 'month' | 'year';

interface DayData { date: string; minutes: number; }
interface MonthData { month: number; label: string; totalMs: number; days: number; dayData: DayData[]; }

export default function CalendarHeatmapScreen() {
  const t = useColors();
  const now = new Date();
  const [activeTab, setActiveTab] = useState<TabKey>('month');
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [dayData, setDayData] = useState<DayData[]>([]);
  const [monthData, setMonthData] = useState<MonthData[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const db = await getDatabase();
      // Get all reading records
      const [sessions, manualLogs] = await Promise.all([
        db.getAllAsync<{ start_time: string; duration_ms: number }>('SELECT start_time, duration_ms FROM reading_sessions WHERE duration_ms > 0'),
        db.getAllAsync<{ logged_at: string; duration_ms: number }>('SELECT logged_at, duration_ms FROM manual_logs WHERE duration_ms > 0'),
      ]);

      // Build day-level heatmap
      const dayMap = new Map<string, number>();
      for (const s of sessions) {
        const key = s.start_time.slice(0, 10);
        dayMap.set(key, (dayMap.get(key) || 0) + Math.floor((s.duration_ms || 0) / 60000));
      }
      for (const m of manualLogs) {
        const key = m.logged_at.slice(0, 10);
        dayMap.set(key, (dayMap.get(key) || 0) + Math.floor((m.duration_ms || 0) / 60000));
      }

      const days: DayData[] = [];
      for (const [date, minutes] of dayMap) {
        days.push({ date, minutes });
      }
      days.sort((a, b) => a.date.localeCompare(b.date));
      setDayData(days);

      // Build month-level data
      const monthMap = new Map<string, { totalMs: number; days: Set<string>; dayData: DayData[] }>();
      for (const d of days) {
        const mKey = d.date.slice(0, 7);
        if (!monthMap.has(mKey)) {
          monthMap.set(mKey, { totalMs: 0, days: new Set(), dayData: [] });
        }
        const md = monthMap.get(mKey)!;
        md.totalMs += d.minutes * 60000;
        md.days.add(d.date);
        md.dayData.push(d);
      }

      const months: MonthData[] = [];
      for (const [key, md] of monthMap) {
        const [y, m] = key.split('-').map(Number);
        months.push({
          month: m,
          label: `${m}月`,
          totalMs: md.totalMs,
          days: md.days.size,
          dayData: md.dayData,
        });
      }
      months.sort((a, b) => b.month - a.month);
      setMonthData(months);
    } catch (e) {
      console.error('Calendar heatmap error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter for current view
  const currentMonthDays = dayData.filter(d => d.date.startsWith(`${selYear}-${String(selMonth).padStart(2, '0')}`));
  const yearMonths = monthData.filter(m => {
    // Group by year from dayData
    return dayData.some(d => d.date.startsWith(`${selYear}-`));
  });
  const yearMonthList: MonthData[] = [];
  for (let m = 1; m <= 12; m++) {
    const key = `${selYear}-${String(m).padStart(2, '0')}`;
    const existing = monthData.find(md => {
      return md.dayData.some(d => d.date.startsWith(key));
    });
    if (existing) {
      yearMonthList.push({ ...existing, month: m, label: `${m}月` });
    } else {
      yearMonthList.push({ month: m, label: `${m}月`, totalMs: 0, days: 0, dayData: [] });
    }
  }

  const maxDayMins = Math.max(...currentMonthDays.map(d => d.minutes), 1);

  // Calendar grid for month view
  const renderMonthCalendar = () => {
    const year = selYear;
    const month = selMonth;
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const weeks: (number | null)[][] = [];
    let week: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) week.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      week.push(d);
      if (week.length === 7) { weeks.push(week); week = []; }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }

    const dayLabelMap = ['日', '一', '二', '三', '四', '五', '六'];
    const monthMs = currentMonthDays.reduce((s, d) => s + d.minutes * 60000, 0);
    const monthDays = new Set(currentMonthDays.map(d => d.date)).size;

    return (
      <View>
        <View style={styles.monthSummary}>
          <Text style={[styles.monthSummaryText, { color: t.ink.secondary }]}>
            {selYear}年{selMonth}月 · 阅读 {monthDays} 天 · {' '}
            {monthMs >= 3600000 ? `${Math.floor(monthMs/3600000)}h${Math.floor((monthMs%3600000)/60000)}m` : `${Math.floor(monthMs/60000)}m`}
          </Text>
        </View>
        <View style={styles.weekdayRow}>
          {dayLabelMap.map((l, i) => (
            <Text key={i} style={[styles.weekdayText, { color: t.ink.tertiary }]}>{l}</Text>
          ))}
        </View>
        {weeks.map((wk, wi) => (
          <View key={wi} style={styles.weekRow}>
            {wk.map((day, di) => {
              if (day === null) return <View key={di} style={styles.dayCell} />;
              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dd = currentMonthDays.find(d => d.date === dateStr);
              const mins = dd?.minutes || 0;
              const intensity = mins > 0 ? Math.min(1, mins / maxDayMins) : 0;
              return (
                <View key={di} style={[styles.dayCell, { backgroundColor: mins > 0 ? `${t.accent.primary}${Math.round(intensity * 80 + 15).toString(16).padStart(2, '0')}` : 'transparent', borderRadius: 6 }]}>
                  <Text style={[styles.dayText, { color: mins > 0 && intensity > 0.5 ? '#fff' : t.ink.tertiary }]}>{day}</Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  // Year view: 3x4 grid with mini calendars
  const renderYearGrid = () => {
    const maxDayMinsAll = Math.max(...dayData.map(d => d.minutes), 1);
    return (
      <View style={styles.yearGrid}>
        {yearMonthList.map((m) => {
          const year = selYear;
          const month = m.month;
          const firstDay = new Date(year, month - 1, 1).getDay();
          const daysInMonth = new Date(year, month, 0).getDate();
          const hours = Math.floor(m.totalMs / 3600000);
          const mins = Math.floor((m.totalMs % 3600000) / 60000);
          const monthDays = dayData.filter(d => d.date.startsWith(`${year}-${String(month).padStart(2,'0')}`));
          const dayMap = new Map(monthDays.map(d => [d.date, d.minutes]));

          return (
            <TouchableOpacity
              key={m.month}
              style={[styles.yearMonthCell, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}
              onPress={() => { setSelMonth(m.month); setActiveTab('month'); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.yearMonthLabel, { color: t.ink.primary }]}>{m.label}</Text>
              {/* Mini calendar grid */}
              <View style={styles.miniCalGrid}>
                {['日','一','二','三','四','五','六'].map((w, wi) => (
                  <Text key={wi} style={styles.miniCalHeader}>{w}</Text>
                ))}
                {Array.from({ length: firstDay }, (_, i) => <View key={`e${i}`} style={styles.miniCalCell} />)}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const d = i + 1;
                  const key = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                  const minVal = dayMap.get(key) || 0;
                  const alpha = minVal > 0 ? Math.round(Math.min(1, minVal / maxDayMinsAll) * 70 + 20) : 0;
                  return (
                    <View key={d} style={[styles.miniCalCell, {
                      backgroundColor: minVal > 0 ? `${t.accent.primary}${alpha.toString(16).padStart(2,'0')}` : 'transparent',
                      borderRadius: 4,
                    }]}>
                      <Text style={[styles.miniCalDay, { color: minVal > 0 && alpha > 80 ? '#fff' : t.ink.tertiary }]}>{d}</Text>
                    </View>
                  );
                })}
              </View>
              <Text style={[styles.yearMonthStats, { color: t.ink.tertiary }]}>
                {m.totalMs > 0 ? (hours > 0 ? `${hours}h${mins}m` : `${mins}m`) + ` · ${m.days}天` : '无记录'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: t.paper.primary }]}><ActivityIndicator size="large" color={t.accent.primary} /></View>;
  }

  return (
    <View style={[styles.root, { backgroundColor: t.paper.primary }]}>
      {/* Nav */}
      <View style={[styles.navBar, { borderBottomColor: t.outline.standard }]}>
        <TouchableOpacity onPress={() => safeGoBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={t.ink.primary} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: t.ink.primary }]}>阅读热力图</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tab switch */}
      <View style={[styles.tabBar, { borderBottomColor: t.outline.standard }]}>
        {(['month', 'year'] as TabKey[]).map((k) => (
          <TouchableOpacity key={k} style={[styles.tab, activeTab === k && { borderBottomColor: t.accent.primary }]} onPress={() => setActiveTab(k)} activeOpacity={0.7}>
            <Text style={[styles.tabText, { color: activeTab === k ? t.accent.primary : t.ink.tertiary }]}>{k === 'month' ? '月视图' : '年视图'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {activeTab === 'month' && (
          <>
            {/* Month nav */}
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={() => { if (selMonth === 1) { setSelMonth(12); setSelYear(selYear - 1); } else setSelMonth(selMonth - 1); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="chevron-back" size={20} color={t.ink.primary} />
              </TouchableOpacity>
              <Text style={[styles.monthNavTitle, { color: t.ink.primary }]}>{selYear}年{selMonth}月</Text>
              <TouchableOpacity onPress={() => { if (selMonth === 12) { setSelMonth(1); setSelYear(selYear + 1); } else setSelMonth(selMonth + 1); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="chevron-forward" size={20} color={t.ink.primary} />
              </TouchableOpacity>
            </View>
            {renderMonthCalendar()}
          </>
        )}

        {activeTab === 'year' && (
          <>
            {/* Year nav */}
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={() => setSelYear(selYear - 1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="chevron-back" size={20} color={t.ink.primary} />
              </TouchableOpacity>
              <Text style={[styles.monthNavTitle, { color: t.ink.primary }]}>{selYear}年</Text>
              <TouchableOpacity onPress={() => setSelYear(selYear + 1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="chevron-forward" size={20} color={t.ink.primary} />
              </TouchableOpacity>
            </View>
            {renderYearGrid()}
          </>
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
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, fontWeight: '600' },
  scroll: { padding: spacing.lg },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  monthNavTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, fontWeight: '700' },
  monthSummary: { marginBottom: spacing.md, alignItems: 'center' },
  monthSummaryText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, fontWeight: '500' },
  weekdayRow: { flexDirection: 'row', marginBottom: spacing.sm },
  weekdayText: { flex: 1, textAlign: 'center', fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, fontWeight: '500' },
  weekRow: { flexDirection: 'row' },
  dayCell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', margin: 2 },
  dayText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, fontWeight: '500' },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  yearMonthCell: { width: '47%', borderRadius: radii.lg, borderWidth: 1, alignItems: 'center', padding: spacing.sm, paddingVertical: spacing.md, ...softShadow },
  yearMonthLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, fontWeight: '700', marginBottom: spacing.xs },
  yearMonthStats: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10, fontWeight: '500', marginTop: spacing.xs },
  miniCalGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%' },
  miniCalHeader: { width: '14.28%', textAlign: 'center', fontFamily: 'PlusJakartaSans_500Medium', fontSize: 7, fontWeight: '500', color: '#8A7A6E', marginBottom: 1 },
  miniCalCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  miniCalDay: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 8, fontWeight: '500' },
});
