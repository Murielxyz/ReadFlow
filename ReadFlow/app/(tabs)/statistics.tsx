import { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Image, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import { spacing, radii } from '../../src/theme';
import { softShadow } from '../../src/theme/shadows';
import { formatDuration } from '../../src/utils/format';
import { useColors } from '../../src/stores/useThemeStore';
import { useBookStore } from '../../src/stores/useBookStore';
import { getDatabase } from '../../src/db/database';
import StatCards from '../../src/components/statistics/StatCards';
import TimeFilter from '../../src/components/statistics/TimeFilter';
import type { TimePeriod } from '../../src/components/statistics/TimeFilter';
import MiniCalendar, { CalendarDay } from '../../src/components/statistics/MiniCalendar';
import type { Book } from '../../src/models';

type TabKey = 'week' | 'month' | 'year' | 'total';

function getWeekNumber(d: Date): number {
  const firstDay = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - firstDay.getTime()) / 86400000);
  return Math.ceil((days + firstDay.getDay() + 1) / 7);
}
/** 本地日期格式化（YYYY-MM-DD），避免 UTC 时差导致查询不一致 */
function fmtLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekDateRange(year: number, week: number): { start: string; end: string } {
  const jan1 = new Date(year, 0, 1);
  const offset = (week - 1) * 7 - jan1.getDay() + 1;
  const start = new Date(year, 0, 1 + offset);
  const end = new Date(start); end.setDate(end.getDate() + 6);
  return { start: fmtLocal(start), end: fmtLocal(end) };
}

export default function StatisticsScreen() {
  const t = useColors();
  const books = useBookStore((s) => s.books);
  const fetchBooks = useBookStore((s) => s.fetchBooks);

  const [activeTab, setActiveTab] = useState<TabKey>('week');
  const now = new Date();
  const [weekPeriod, setWeekPeriod] = useState<TimePeriod>({ year: now.getFullYear(), week: getWeekNumber(now) });
  const [monthPeriod, setMonthPeriod] = useState<TimePeriod>({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ completedBooks: 0, totalMs: 0, readingDays: 0, notesCount: 0 });
  const [chartData, setChartData] = useState<{ label: string; value: number; count: number }[]>([]);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [topBooks, setTopBooks] = useState<(Book & { durationMs: number })[]>([]);
  const [yearlyGoal, setYearlyGoal] = useState(0);
  const [yearlyCompleted, setYearlyCompleted] = useState(0);
  const [yearlyChart, setYearlyChart] = useState<{ label: string; value: number; count: number }[]>([]);
  const [yearlyTop, setYearlyTop] = useState<(Book & { durationMs: number })[]>([]);
  const [totalChart, setTotalChart] = useState<{ label: string; value: number; count: number }[]>([]);
  const [totalTop, setTotalTop] = useState<(Book & { durationMs: number })[]>([]);
  const [heatmapDays, setHeatmapDays] = useState<{ date: string; mins: number }[]>([]);
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [calendarDayDetail, setCalendarDayDetail] = useState<CalendarDay | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const db = await getDatabase();
      let start: string, end: string;
      if (activeTab === 'week') {
        const r = getWeekDateRange(weekPeriod.year, weekPeriod.week!);
        start = r.start; end = r.end;
      } else if (activeTab === 'month') {
        const m = monthPeriod.month!;
        start = `${monthPeriod.year}-${String(m).padStart(2, '0')}-01`;
        end = `${monthPeriod.year}-${String(m).padStart(2, '0')}-${String(new Date(monthPeriod.year, m, 0).getDate()).padStart(2, '0')}`;
      } else if (activeTab === 'year') {
        start = `${selectedYear}-01-01`; end = `${selectedYear + 1}-01-01`;
      } else {
        start = '2000-01-01'; end = '2099-12-31';
      }

      // 一次获取全部原始数据，JS 中计算所有统计
      const [sessAll, manAll, notesAll, highlightsAll, allBooks] = await Promise.all([
        db.getAllAsync<{ start_time: string; duration_ms: number; book_id: string }>('SELECT start_time, duration_ms, book_id FROM reading_sessions'),
        db.getAllAsync<{ logged_at: string; duration_ms: number; book_id: string }>('SELECT logged_at, duration_ms, book_id FROM manual_logs'),
        db.getAllAsync<{ created_at: string }>('SELECT created_at FROM notes'),
        db.getAllAsync<{ created_at: string }>('SELECT created_at FROM highlights'),
        db.getAllAsync<Book>('SELECT * FROM books'),
      ]);

      // JS 过滤时间范围
      const inRange = (ts: string) => ts >= start && ts <= (end || '2099-12-31');
      const fSess = sessAll.filter(s => inRange(s.start_time));
      const fMan = manAll.filter(m => inRange(m.logged_at));
      const totalMs = fSess.reduce((s, r) => s + (r.duration_ms||0), 0) + fMan.reduce((s, r) => s + (r.duration_ms||0), 0);
      const daySet = new Set<string>();
      for (const s of fSess) daySet.add(s.start_time.slice(0, 10));
      for (const m of fMan) daySet.add(m.logged_at.slice(0, 10));
      const finishedCount = activeTab === 'total' ? allBooks.filter(b => b.status === 'finished').length : 0;

      // 笔记数按时间范围过滤（复用上方 inRange）
      const filteredNotes = notesAll.filter((n: any) => inRange(n.created_at || ''));
      const filteredHighlights = highlightsAll.filter((h: any) => inRange(h.created_at || ''));
      setStats({ completedBooks: finishedCount, totalMs, readingDays: daySet.size, notesCount: filteredNotes.length + filteredHighlights.length });

      // 365天热力图 — JS 构建（总 Tab 使用）
      const today2 = new Date();
      const yearStart2 = new Date(today2.getFullYear(), 0, 1);
      const hDays: { date: string; mins: number }[] = [];
      for (let i = 0; i < 365; i++) {
        const d = new Date(yearStart2);
        d.setDate(d.getDate() + i);
        if (d > today2) break;
        hDays.push({ date: fmtLocal(d), mins: 0 });
      }
      const hMap = new Map(hDays.map(d => [d.date, d]));
      for (const s of sessAll) { const key = s.start_time.slice(0,10); const v = hMap.get(key); if (v) v.mins += Math.floor((s.duration_ms||0)/60000); }
      for (const m of manAll) { const key = m.logged_at.slice(0,10); const v = hMap.get(key); if (v) v.mins += Math.floor((m.duration_ms||0)/60000); }
      setHeatmapDays(hDays);

      // Week/Month chart — JS 分组
      if (activeTab === 'week' || activeTab === 'month') {
        const cm = new Map<string, { val: number; books: Set<string> }>();
        for (const r of fSess) { const d = r.start_time.slice(0,10); const p = cm.get(d)||{val:0,books:new Set()}; cm.set(d,{val:p.val+(r.duration_ms||0),books:p.books.add(r.book_id)}); }
        for (const r of fMan) { const d = r.logged_at.slice(0,10); const p = cm.get(d)||{val:0,books:new Set()}; cm.set(d,{val:p.val+(r.duration_ms||0),books:p.books.add(r.book_id)}); }
        if (activeTab === 'week') {
          const r = getWeekDateRange(weekPeriod.year, weekPeriod.week!);
          const arr: typeof chartData = [];
          const labels = ['周一','周二','周三','周四','周五','周六','周日'];
          const d = new Date(r.start);
          for (let i=0;i<7;i++) { const k=fmtLocal(d); const v=cm.get(k); arr.push({label:labels[i],value:v?.val??0,count:v?.books?.size??0}); d.setDate(d.getDate()+1); }
          setChartData(arr);
        } else {
          const m = monthPeriod.month!; const dim = new Date(monthPeriod.year, m, 0).getDate();
          const arr: typeof chartData = [];
          for (let day=1;day<=dim;day++) { const k=`${monthPeriod.year}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`; const v=cm.get(k); const showLabel = day===1 || day%5===0 || day===dim; arr.push({label:showLabel?`${day}日`:'',value:v?.val??0,count:v?.books?.size??0}); }
          setChartData(arr);
        }
        // Calendar — 显示每天阅读的书籍（含封面），从 cm 中获取每天的 book IDs
        const calMap = new Map<string, (Book & { durationMs: number })[]>();
        for (const [day, info] of cm) {
          const dayBooks = allBooks.filter(b => info.books.has(b.id)).map(b => ({ ...b, durationMs: info.val }));
          calMap.set(day, dayBooks);
        }
        if (activeTab==='week') {
          const r = getWeekDateRange(weekPeriod.year, weekPeriod.week!);
          const arr: CalendarDay[] = [];
          const d = new Date(r.start);
          for (let i=0;i<7;i++) { const k=fmtLocal(d); arr.push({date:k,day:d.getDate(),books:calMap.get(k)||[]}); d.setDate(d.getDate()+1); }
          setCalendarDays(arr);
        } else {
          const m = monthPeriod.month!; const dim = new Date(monthPeriod.year, m, 0).getDate();
          const arr: CalendarDay[] = [];
          for (let day=1;day<=dim;day++) { const k=`${monthPeriod.year}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`; arr.push({date:k,day,books:calMap.get(k)||[]}); }
          setCalendarDays(arr);
        }
        // Top books in period
        const bm = new Map<string, number>();
        for (const r of fSess) bm.set(r.book_id,(bm.get(r.book_id)||0)+(r.duration_ms||0));
        for (const r of fMan) bm.set(r.book_id,(bm.get(r.book_id)||0)+(r.duration_ms||0));
        setTopBooks(allBooks.filter(b=>(bm.get(b.id)||0)>0).map(b=>({...b,durationMs:bm.get(b.id)||0})).sort((a,b)=>b.durationMs-a.durationMs).slice(0,5));
      }

      // Year tab
      if (activeTab === 'year') {
        const g = await db.getFirstAsync<{ target_books: number }>('SELECT target_books FROM reading_goals WHERE year = ?', [selectedYear]);
        setYearlyGoal(g?.target_books ?? 0);
        const yb = allBooks.filter(b => b.status==='finished' && b.finished_date && b.finished_date>=`${selectedYear}-01-01` && b.finished_date<`${selectedYear+1}-01-01`);
        setYearlyCompleted(yb.length);
        const yc: typeof yearlyChart = [];
        for (let m=1;m<=12;m++) {
          const pre = `${selectedYear}-${String(m).padStart(2,'0')}`;
          const ms = fSess.filter(s=>s.start_time.startsWith(pre)).reduce((s,r)=>s+(r.duration_ms||0),0) + fMan.filter(ml=>ml.logged_at.startsWith(pre)).reduce((s,r)=>s+(r.duration_ms||0),0);
          const bc = new Set([...fSess.filter(s=>s.start_time.startsWith(pre)).map(r=>r.book_id), ...fMan.filter(ml=>ml.logged_at.startsWith(pre)).map(r=>r.book_id)]).size;
          yc.push({label:`${m}月`,value:ms,count:bc});
        }
        setYearlyChart(yc);
        const yb2 = new Map<string,number>();
        for (const r of fSess) yb2.set(r.book_id,(yb2.get(r.book_id)||0)+(r.duration_ms||0));
        for (const r of fMan) yb2.set(r.book_id,(yb2.get(r.book_id)||0)+(r.duration_ms||0));
        setYearlyTop(allBooks.filter(b=>(yb2.get(b.id)||0)>0).map(b=>({...b,durationMs:yb2.get(b.id)||0})).sort((a,b)=>b.durationMs-a.durationMs).slice(0,10));
      }

      // Total tab
      if (activeTab === 'total') {
        const ab = allBooks.filter(b=>b.status==='finished');
        const yrMap = new Map<string,{val:number;books:Set<string>}>();
        for (const r of sessAll) { const y=r.start_time.slice(0,4); const p=yrMap.get(y)||{val:0,books:new Set()}; yrMap.set(y,{val:p.val+(r.duration_ms||0),books:p.books.add(r.book_id)}); }
        for (const r of manAll) { const y=r.logged_at.slice(0,4); const p=yrMap.get(y)||{val:0,books:new Set()}; yrMap.set(y,{val:p.val+(r.duration_ms||0),books:p.books.add(r.book_id)}); }
        setTotalChart([...yrMap.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([yr,p])=>({label:`${yr}年`,value:p.val,count:p.books.size})));
        const tb = new Map<string,number>();
        for (const r of sessAll) tb.set(r.book_id,(tb.get(r.book_id)||0)+(r.duration_ms||0));
        for (const r of manAll) tb.set(r.book_id,(tb.get(r.book_id)||0)+(r.duration_ms||0));
        setTotalTop(allBooks.filter(b=>(tb.get(b.id)||0)>0).map(b=>({...b,durationMs:tb.get(b.id)||0})).sort((a,b)=>b.durationMs-a.durationMs).slice(0,10));
        setStats(s=>({...s,completedBooks:ab.length}));
      }
    } catch (e) { console.error('stats error:', e); }
    finally { setLoading(false); }
  }, [activeTab, weekPeriod, monthPeriod, selectedYear]);

  useFocusEffect(useCallback(() => { fetchBooks(); fetchData(); }, [fetchData, fetchBooks]));

  const maxVal = Math.max(...chartData.map(d => d.value), 1);

  if (loading && books.length === 0) {
    return <View style={[styles.centered, { backgroundColor: t.paper.primary }]}><ActivityIndicator size="large" color={t.accent.primary} /></View>;
  }

  // Shared book item renderer
  const renderBookItem = (book: Book & { durationMs?: number }, i: number) => (
    <TouchableOpacity key={book.id} style={[styles.bookItem, { borderBottomColor: t.outline.standard }]} onPress={() => router.push(`/book/${book.id}`)} activeOpacity={0.6}>
      <Text style={[styles.rank, { color: i < 3 ? t.accent.primary : t.ink.tertiary }]}>{i + 1}</Text>
      {book.cover_url ? <Image source={{ uri: book.cover_url }} style={styles.bookCover} /> : <View style={[styles.bookCoverPh, { backgroundColor: t.accent.purple + '22' }]}><Ionicons name="book" size={14} color={t.accent.primary} /></View>}
      <View style={{ flex: 1 }}>
        <Text style={[styles.bookTitle, { color: t.ink.primary }]} numberOfLines={1}>{book.title}</Text>
        <Text style={[styles.bookMeta, { color: t.ink.tertiary }]}>{formatDuration((book as any).durationMs || 0)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.root, { backgroundColor: t.paper.primary }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.pageTitle, { color: t.ink.primary }]}>阅读统计</Text>
        <View style={[styles.tabBar, { borderBottomColor: t.outline.standard }]}>
          {(['week','month','year','total'] as TabKey[]).map(k => {
            const labels: Record<TabKey,string> = { week:'周', month:'月', year:'年', total:'总' };
            const active = activeTab === k;
            return <TouchableOpacity key={k} style={[styles.tab, active && { borderBottomColor: t.accent.primary }]} onPress={() => setActiveTab(k)} activeOpacity={0.7}>
              <Text style={[styles.tabText, { color: active ? t.accent.primary : t.ink.tertiary }]}>{labels[k]}</Text>
            </TouchableOpacity>;
          })}
        </View>
        {activeTab === 'week' && <TimeFilter tab="week" period={weekPeriod} onChange={setWeekPeriod} />}
        {activeTab === 'month' && <TimeFilter tab="month" period={monthPeriod} onChange={setMonthPeriod} />}
        {activeTab === 'year' && (
          <View style={styles.yearRow}>
            <TouchableOpacity onPress={() => setSelectedYear(y => y-1)} hitSlop={{ top:8, bottom:8, left:8, right:8 }}><Ionicons name="chevron-back" size={20} color={t.ink.secondary} /></TouchableOpacity>
            <Text style={[styles.yearText, { color: t.ink.primary }]}>{selectedYear}年</Text>
            <TouchableOpacity onPress={() => setSelectedYear(y => y+1)} hitSlop={{ top:8, bottom:8, left:8, right:8 }}><Ionicons name="chevron-forward" size={20} color={t.ink.secondary} /></TouchableOpacity>
          </View>
        )}
        <StatCards completedBooks={stats.completedBooks} totalMs={stats.totalMs} readingDays={stats.readingDays} notesCount={stats.notesCount} />
        <View style={[styles.divider, { backgroundColor: t.outline.standard }]} />

        {/* Week/Month shared content */}
        {(activeTab === 'week' || activeTab === 'month') && (<>
          <Text style={[styles.sectionTitle, { color: t.ink.primary }]}>阅读趋势</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={[styles.chartBars, { gap: activeTab === 'week' ? spacing.md : 4 }]}>
              {chartData.map((d, i) => (
                <View key={i} style={styles.chartBar}>
                  <Text style={[styles.chartBarVal, { color: t.ink.tertiary }]}>{d.value > 0 ? formatDuration(d.value) : ''}</Text>
                  <View style={[styles.chartBarFill, { height: Math.max(4, (d.value / maxVal) * 80), backgroundColor: d.value > 0 ? t.accent.primary : t.outline.standard }]} />
                  <Text style={[styles.chartBarLabel, { color: t.ink.tertiary }]}>{d.label}</Text>
                  {d.count > 0 && <Text style={[styles.chartBarCount, { color: t.accent.primary }]}>{d.count}本</Text>}
                </View>
              ))}
            </View>
          </ScrollView>
          <Text style={[styles.chartTotal, { color: t.ink.secondary }]}>{activeTab === 'week' ? '本周' : '本月'}阅读总时长：{formatDuration(stats.totalMs)}{activeTab === 'month' ? ` · 读完 ${stats.completedBooks} 本` : ''}</Text>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: t.ink.primary, marginTop: spacing.lg }]}>读书日历</Text>
            {activeTab === 'month' && (
              <TouchableOpacity onPress={() => router.push(`/month-calendar?year=${monthPeriod.year}&month=${monthPeriod.month}`)} activeOpacity={0.6} style={{ marginTop: spacing.lg }}>
                <Text style={[styles.viewAllText, { color: t.accent.primary }]}>查看全部</Text>
              </TouchableOpacity>
            )}
          </View>
          <MiniCalendar type={activeTab} days={calendarDays} year={activeTab === 'week' ? weekPeriod.year : monthPeriod.year} month={activeTab === 'week' ? (monthPeriod.month||1) : monthPeriod.month!} weekDays={activeTab === 'week' ? ['一','二','三','四','五','六','日'] : undefined} />
          <View style={[styles.sectionHeader, { marginTop: spacing.lg }]}>
            <Text style={[styles.sectionTitle, { color: t.ink.primary }]}>阅读书籍</Text>
            <TouchableOpacity onPress={() => router.push(`/reading-books?period=${activeTab}&year=${activeTab === 'week' ? weekPeriod.year : monthPeriod.year}${activeTab === 'week' ? `&week=${weekPeriod.week}` : `&month=${monthPeriod.month}`}`)} activeOpacity={0.6}>
              <Text style={[styles.viewAllText, { color: t.accent.primary }]}>查看全部</Text>
            </TouchableOpacity>
          </View>
          {topBooks.length === 0 ? <Text style={[styles.emptyText, { color: t.ink.tertiary }]}>暂无阅读记录</Text> : topBooks.map((b, i) => renderBookItem(b, i))}
        </>)}

        {/* Year tab */}
        {activeTab === 'year' && (<>
          <View style={[styles.goalCard, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}>
            <Text style={[styles.goalTitle, { color: t.ink.primary }]}>年度目标</Text>
            {yearlyGoal > 0 ? (<>
              <TouchableOpacity onPress={() => { setGoalInput(String(yearlyGoal)); setGoalModalVisible(true); }} activeOpacity={0.7}>
                <Text style={[styles.goalText, { color: t.ink.secondary }]}>目标：{yearlyGoal} 本 · 已读完：{yearlyCompleted} 本</Text>
                <View style={[styles.progressBar, { backgroundColor: t.outline.standard }]}><View style={[styles.progressFill, { backgroundColor: t.accent.primary, width: `${Math.min(100, Math.round((yearlyCompleted/yearlyGoal)*100))}%` }]} /></View>
                <Text style={[styles.progressPct, { color: t.accent.primary }]}>{Math.round((yearlyCompleted/yearlyGoal)*100)}%</Text>
                <Text style={[styles.goalEditHint, { color: t.ink.tertiary }]}>点击修改目标</Text>
              </TouchableOpacity>
            </>) : (
              <TouchableOpacity style={[styles.setGoalBtn, { backgroundColor: t.accent.primary }]} onPress={() => { setGoalInput('50'); setGoalModalVisible(true); }} activeOpacity={0.8}><Text style={[styles.setGoalBtnText, { color: t.ink.inverse }]}>设置年度目标</Text></TouchableOpacity>
            )}
          </View>
          <Text style={[styles.sectionTitle, { color: t.ink.primary, marginTop: spacing.lg }]}>阅读趋势</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chartBars}>
              {yearlyChart.map((d, i) => { const yM = Math.max(...yearlyChart.map(x => x.value), 1);
                return (<View key={i} style={styles.chartBar}>
                  <Text style={[styles.chartBarCount, { color: t.accent.primary }]}>{d.count > 0 ? `${d.count}本` : ''}</Text>
                  <Text style={[styles.chartBarVal, { color: t.ink.tertiary }]}>{d.value > 0 ? formatDuration(d.value) : ''}</Text>
                  <View style={[styles.chartBarFill, { height: Math.max(4, (d.value/yM)*80), backgroundColor: d.value > 0 ? t.accent.primary : t.outline.standard }]} />
                  <Text style={[styles.chartBarLabel, { color: t.ink.tertiary }]}>{d.label}</Text>
                </View>);
              })}
            </View>
          </ScrollView>
          <View style={[styles.sectionHeader, { marginTop: spacing.lg }]}>
            <Text style={[styles.sectionTitle, { color: t.ink.primary }]}>阅读书籍</Text>
            <TouchableOpacity onPress={() => router.push(`/reading-books?period=year&year=${selectedYear}`)} activeOpacity={0.6}>
              <Text style={[styles.viewAllText, { color: t.accent.primary }]}>查看全部</Text>
            </TouchableOpacity>
          </View>
          {yearlyTop.length === 0 ? <Text style={[styles.emptyText, { color: t.ink.tertiary }]}>暂无数据</Text> : yearlyTop.map((b, i) => renderBookItem(b, i))}
        </>)}

        {/* Total tab */}
        {activeTab === 'total' && (<>
          <Text style={[styles.sectionTitle, { color: t.ink.primary, marginTop: spacing.lg }]}>阅读趋势</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chartBars}>
              {totalChart.map((d, i) => { const tM = Math.max(...totalChart.map(x => x.value), 1);
                return (<View key={i} style={styles.chartBar}>
                  <Text style={[styles.chartBarCount, { color: t.accent.primary }]}>{d.count > 0 ? `${d.count}本` : ''}</Text>
                  <Text style={[styles.chartBarVal, { color: t.ink.tertiary }]}>{d.value > 0 ? formatDuration(d.value) : ''}</Text>
                  <View style={[styles.chartBarFill, { height: Math.max(4, (d.value/tM)*80), backgroundColor: d.value > 0 ? t.accent.primary : t.outline.standard }]} />
                  <Text style={[styles.chartBarLabel, { color: t.ink.tertiary }]}>{d.label}</Text>
                </View>);
              })}
            </View>
          </ScrollView>
          {/* 热力图 */}
          <View style={[styles.sectionHeader, { marginTop: spacing.lg }]}>
            <Text style={[styles.sectionTitle, { color: t.ink.primary }]}>热力图</Text>
            <TouchableOpacity onPress={() => router.push('/calendar-heatmap')} activeOpacity={0.6}>
              <Ionicons name="calendar-outline" size={20} color={t.accent.primary} />
            </TouchableOpacity>
          </View>
          {/* 365天热力图 */}
          {heatmapDays.length > 0 && (
            <TouchableOpacity style={[styles.heatmapCard, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]} onPress={() => router.push('/calendar-heatmap')} activeOpacity={0.7}>
              <View style={styles.heatmapHeader}>
                <Text style={[styles.heatmapTitle, { color: t.ink.primary }]}>{new Date().getFullYear()}年阅读热力图</Text>
              </View>
              {/* 按月分行 */}
              {(() => {
                const maxMins = Math.max(...heatmapDays.map(d => d.mins), 1);
                const months: { label: string; days: typeof heatmapDays }[] = [];
                let curMonth = '';
                for (const d of heatmapDays) {
                  const m = d.date.slice(0, 7);
                  if (m !== curMonth) { curMonth = m; months.push({ label: `${parseInt(d.date.slice(5,7))}月`, days: [] }); }
                  months[months.length - 1].days.push(d);
                }
                return months.map((mo, mi) => (
                  <View key={mi}>
                    <Text style={[styles.heatmapMonthLabel, { color: t.ink.tertiary }]}>{mo.label}</Text>
                    <View style={styles.heatmapRow}>
                      {mo.days.map((d, di) => {
                        const intensity = d.mins > 0 ? Math.min(1, d.mins / maxMins) : 0;
                        const alpha = d.mins > 0 ? Math.round(intensity * 80 + 15) : 8;
                        return <View key={di} style={[styles.heatmapCell, { backgroundColor: d.mins > 0 ? `${t.accent.primary}${alpha.toString(16).padStart(2,'0')}` : (t.outline?.standard || '#E5E0DB') + '30' }]} />;
                      })}
                    </View>
                  </View>
                ));
              })()}
              <Text style={[styles.heatmapHint, { color: t.ink.tertiary }]}>
                {heatmapDays.filter(d => d.mins > 0).length} 天阅读 · 累计 {(() => { const tm = heatmapDays.reduce((s,d) => s + d.mins, 0); return tm >= 60 ? `${Math.floor(tm/60)}h${tm%60}m` : `${tm}m`; })()} · 点击查看详情
              </Text>
            </TouchableOpacity>
          )}

          <View style={[styles.sectionHeader, { marginTop: spacing.lg }]}>
            <Text style={[styles.sectionTitle, { color: t.ink.primary }]}>我的阅历</Text>
            <TouchableOpacity onPress={() => router.push('/my-reading')} activeOpacity={0.6}>
              <Text style={[styles.viewAllText, { color: t.accent.primary }]}>查看全部</Text>
            </TouchableOpacity>
          </View>
          {totalTop.length === 0 ? <Text style={[styles.emptyText, { color: t.ink.tertiary }]}>暂无数据</Text> : totalTop.map((b, i) => renderBookItem(b, i))}
        </>)}

        <View style={{ height: 40 }} />
      </ScrollView>
      {/* 日历日详情弹窗 */}
      <Modal visible={!!calendarDayDetail} transparent animationType="fade" onRequestClose={() => setCalendarDayDetail(null)}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setCalendarDayDetail(null)} />
        <View style={[styles.dayModal, { backgroundColor: t.paper.primary, borderColor: t.outline.standard }]}>
          <View style={styles.dayModalHeader}>
            <Text style={[styles.dayModalTitle, { color: t.ink.primary }]}>
              {calendarDayDetail?.date} · {calendarDayDetail?.books.length || 0} 本书
            </Text>
            <TouchableOpacity onPress={() => setCalendarDayDetail(null)}><Ionicons name="close" size={20} color={t.ink.tertiary} /></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
            {calendarDayDetail?.books.map((b, i) => (
              <TouchableOpacity key={b.id} style={[styles.bookItem, { borderBottomColor: t.outline.standard }]} onPress={() => { setCalendarDayDetail(null); router.push(`/book/${b.id}`); }} activeOpacity={0.6}>
                <Text style={[styles.rank, { color: t.ink.tertiary }]}>{i + 1}</Text>
                {b.cover_url ? <Image source={{ uri: b.cover_url }} style={styles.bookCover} /> : <View style={[styles.bookCoverPh, { backgroundColor: t.accent.purple + '22' }]}><Ionicons name="book" size={14} color={t.accent.primary} /></View>}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bookTitle, { color: t.ink.primary }]} numberOfLines={1}>{b.title}</Text>
                  <Text style={[styles.bookMeta, { color: t.ink.tertiary }]}>{formatDuration((b as any).durationMs || 0)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={t.ink.tertiary} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={goalModalVisible} transparent animationType="fade">
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setGoalModalVisible(false)} />
        <View style={[styles.goalModal, { backgroundColor: t.paper.primary, borderColor: t.outline.standard }]}>
          <Text style={[styles.goalModalTitle, { color: t.ink.primary }]}>设置年度目标</Text>
          <TextInput style={[styles.goalInput, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary }]} value={goalInput} onChangeText={setGoalInput} keyboardType="number-pad" placeholder="输入目标书籍数量" placeholderTextColor={t.ink.tertiary} />
          <TouchableOpacity style={[styles.goalSaveBtn, { backgroundColor: t.accent.primary }]} onPress={async () => { const n = parseInt(goalInput,10); if (n > 0) { const db = await getDatabase(); await db.runAsync('INSERT OR REPLACE INTO reading_goals (year, target_books) VALUES (?, ?)', [selectedYear, n]); setYearlyGoal(n); } setGoalModalVisible(false); }} activeOpacity={0.8}>
            <Text style={[styles.goalSaveBtnText, { color: t.ink.inverse }]}>保存</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 }, centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: 56 },
  pageTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 24, fontWeight: '800', marginBottom: spacing.md },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: spacing.sm },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, fontWeight: '600' },
  divider: { height: 1, marginVertical: spacing.lg },
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, gap: spacing.md },
  yearText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, fontWeight: '700' },
  sectionTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, fontWeight: '800', marginBottom: spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  viewAllText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, fontWeight: '600' },
  heatmapCard: { borderRadius: radii.lg, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.md, backgroundColor: '#FAFAF8' },
  heatmapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  heatmapTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, fontWeight: '700' },
  heatmapMonthLabel: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10, fontWeight: '500', marginTop: 6, marginBottom: 2 },
  heatmapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginBottom: 2 },
  heatmapCell: { width: 12, height: 12, borderRadius: 2 },
  heatmapHint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, marginTop: spacing.sm, textAlign: 'center' },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 24 },
  chartBar: { alignItems: 'center', width: 40 },
  chartBarVal: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 8, marginBottom: 2 },
  chartBarFill: { width: 20, borderRadius: 4, minHeight: 4 },
  chartBarLabel: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 9, marginTop: 4 },
  chartBarCount: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 8, fontWeight: '600', marginTop: 1 },
  chartTotal: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: spacing.sm },
  bookItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  rank: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, fontWeight: '700', width: 24, textAlign: 'center' },
  bookCover: { width: 32, height: 44, borderRadius: 4 }, bookCoverPh: { width: 32, height: 44, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  bookTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, fontWeight: '700' },
  bookMeta: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, marginTop: 2 },
  emptyText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, textAlign: 'center', paddingVertical: spacing.lg },
  goalCard: { borderRadius: radii.lg, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.lg, ...softShadow },
  goalTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, fontWeight: '700', marginBottom: spacing.sm },
  goalText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, marginBottom: spacing.sm },
  goalEditHint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, marginTop: spacing.xs },
  progressBar: { height: 8, borderRadius: 4, marginBottom: spacing.xs, overflow: 'hidden' as const },
  progressFill: { height: '100%', borderRadius: 4 },
  progressPct: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, fontWeight: '600' },
  setGoalBtn: { paddingVertical: spacing.md, borderRadius: radii.full, alignItems: 'center' },
  setGoalBtnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, fontWeight: '700' },
  dayModal: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, borderWidth: 1, padding: spacing.lg, ...softShadow },
  dayModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  dayModalTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, fontWeight: '700' },
  goalModal: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, borderWidth: 1, padding: spacing.xl, ...softShadow },
  goalModalTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, fontWeight: '800', marginBottom: spacing.md },
  goalInput: { height: 48, borderRadius: radii.md, borderWidth: 1, paddingHorizontal: spacing.md, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16, fontWeight: '600', marginBottom: spacing.md },
  goalSaveBtn: { height: 48, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  goalSaveBtnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, fontWeight: '700' },
});
