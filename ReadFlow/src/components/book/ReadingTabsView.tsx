import { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useReadingStore } from '../../stores/useReadingStore';
import { useNoteStore } from '../../stores/useNoteStore';
import { useHighlightStore } from '../../stores/useHighlightStore';
import AddAnnotationSheet from './AddAnnotationSheet';
import { formatDuration, formatDateFull } from '../../utils/format';
import type { TimelineEntry } from '../../models';
import type { Highlight } from '../../models/highlight';
import type { Note } from '../../models/note';
import { spacing, radii } from '../../theme';
import { softShadow } from '../../theme/shadows';
import { useColors } from '../../stores/useThemeStore';

type TabKey = 'stats' | 'timeline' | 'readingNotes';

/** 标注编辑类型（用于弹窗预填） */
type EditingAnnotation = {
  id: string;
  annotationType: 'note' | 'highlight';
  book_id: string;
  content: string;
  color: string | null;
  note: string | null;
  page_number: number | null;
  chapter: string | null;
  created_at: string;
  updated_at: string;
};

/** 合并的阅读笔记条目 */
type ReadingNoteEntry = {
  id: string;
  type: 'highlight' | 'note';
  content: string;
  color?: string;
  note?: string | null;
  pageNumber?: number | null;
  chapter?: string | null;
  createdAt: string;
};

interface ReadingTabsViewProps {
  bookId: string;
}

export default function ReadingTabsView({ bookId }: ReadingTabsViewProps) {
  const t = useColors();
  const [activeTab, setActiveTab] = useState<TabKey>('timeline');

  const timeline = useReadingStore((s) => s.timeline);
  const loadingTimeline = useReadingStore((s) => s.loading);
  const deleteSession = useReadingStore((s) => s.deleteSession);
  const deleteManualLog = useReadingStore((s) => s.deleteManualLog);

  const notes = useNoteStore((s) => s.notes);
  const fetchNotes = useNoteStore((s) => s.fetchNotes);
  const deleteNote = useNoteStore((s) => s.deleteNote);

  const highlights = useHighlightStore((s) => s.highlights);
  const fetchHighlights = useHighlightStore((s) => s.fetchHighlights);
  const deleteHighlight = useHighlightStore((s) => s.deleteHighlight);

  const [annotationSheetVisible, setAnnotationSheetVisible] = useState(false);
  const [editingAnnotation, setEditingAnnotation] = useState<EditingAnnotation | null>(null);
  const [annotationMode, setAnnotationMode] = useState<'highlight' | 'note'>('highlight');

  useEffect(() => {
    if (bookId) {
      fetchNotes(bookId);
      fetchHighlights(bookId);
    }
  }, [bookId]);

  const handleDeleteTimeline = useCallback((entry: TimelineEntry) => {
    Alert.alert('删除记录', `确定要删除这条${entry.type === 'session' ? '阅读' : '手动'}记录吗？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => {
        if (entry.type === 'session') deleteSession(entry.id);
        else deleteManualLog(entry.id);
      }},
    ]);
  }, [deleteSession, deleteManualLog]);

  const handleDeleteAnnotation = useCallback((a: EditingAnnotation) => {
    Alert.alert('删除标注', '确定要删除这条标注吗？', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => {
        if (a.annotationType === 'highlight') deleteHighlight(a.id);
        else deleteNote(a.id);
      }},
    ]);
  }, [deleteHighlight, deleteNote]);

  const handleSaved = useCallback(() => {
    if (bookId) { fetchNotes(bookId); fetchHighlights(bookId); }
  }, [bookId, fetchNotes, fetchHighlights]);

  // 时间线按日分组
  const timelineGroups = useMemo(() => {
    const groups: { date: string; entries: TimelineEntry[] }[] = [];
    let currentDate = '';
    for (const entry of timeline) {
      const dateKey = entry.start_time.slice(0, 10);
      if (dateKey !== currentDate) {
        currentDate = dateKey;
        groups.push({ date: dateKey, entries: [entry] });
      } else {
        groups[groups.length - 1].entries.push(entry);
      }
    }
    return groups;
  }, [timeline]);

  // 合并高亮 + 想法 → 阅读笔记
  const readingNotes = useMemo(() => {
    const entries: ReadingNoteEntry[] = [
      ...highlights.map((hl: Highlight) => ({
        id: hl.id, type: 'highlight' as const,
        content: hl.content, color: hl.color, note: hl.note,
        pageNumber: hl.page_number, chapter: hl.chapter,
        createdAt: hl.created_at,
      })),
      ...notes.map((n: Note) => ({
        id: n.id, type: 'note' as const,
        content: n.content,
        pageNumber: n.page_number, chapter: n.chapter,
        createdAt: n.created_at,
      })),
    ];
    entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return entries;
  }, [highlights, notes]);

  // 阅读日历：收集该书所有阅读日期
  const readingDates = useMemo(() => {
    const dates = new Set<string>();
    for (const entry of timeline) {
      dates.add(entry.start_time.slice(0, 10));
    }
    return dates;
  }, [timeline]);

  // 当月日历数据
  const calendarData = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
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
    return { year, month, weeks, today: now.getDate() };
  }, [timeline]);

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'stats', label: '统计' },
    { key: 'timeline', label: '时间轴' },
    { key: 'readingNotes', label: `阅读笔记 (${readingNotes.length})` },
  ];

  const formatDateKey = (d: number) => {
    const { year, month } = calendarData;
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  return (
    <View style={[styles.root, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}>
      <View style={[styles.tabBar, { borderBottomColor: t.outline.standard }]}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabBtn, isActive && { borderBottomColor: t.accent.primary }]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabBtnText, { color: isActive ? t.accent.primary : t.ink.tertiary }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.tabContent}>
        {/* ===== 时间轴 ===== */}
        {activeTab === 'timeline' && (
          loadingTimeline ? (
            <Text style={[styles.emptyText, { color: t.ink.tertiary }]}>加载中...</Text>
          ) : timelineGroups.length === 0 ? (
            <Text style={[styles.emptyText, { color: t.ink.tertiary }]}>暂无阅读记录</Text>
          ) : (
            timelineGroups.map((group) => (
              <View key={group.date} style={styles.timelineGroup}>
                <View style={styles.dateHeader}>
                  <Text style={[styles.dateText, { color: t.ink.secondary }]}>{formatDateFull(group.date)}</Text>
                  <View style={[styles.dateLine, { backgroundColor: t.outline.standard }]} />
                </View>
                {group.entries.map((entry, idx) => {
                  const entryColor = getTimelineEntryColor(entry, t);
                  return (
                  <View key={entry.id} style={styles.timelineEntry}>
                    <View style={styles.timelineTrack}>
                      <View style={[styles.timelineDot, { backgroundColor: entryColor.dotColor }]} />
                      {idx < group.entries.length - 1 && (
                        <View style={[styles.timelineLine, { backgroundColor: t.outline.standard }]} />
                      )}
                    </View>
                    <View style={[styles.entryCard, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}>
                      <View style={styles.entryHeader}>
                        <View style={[styles.typeBadge, { backgroundColor: entryColor.badgeBg }]}>
                          <Text style={[styles.typeBadgeText, { color: entryColor.badgeText }]}>
                            {entry.type === 'session' ? '计时' : '手动'}
                          </Text>
                        </View>
                        {entry.duration_ms != null && entry.duration_ms > 0 && (
                          <Text style={[styles.durationText, { color: t.ink.primary }]}>{formatDuration(entry.duration_ms)}</Text>
                        )}
                        <TouchableOpacity onPress={() => handleDeleteTimeline(entry)} activeOpacity={0.6}>
                          <Ionicons name="trash-outline" size={14} color={t.ink.tertiary} />
                        </TouchableOpacity>
                      </View>
                      {entry.source_label && <Text style={[styles.sourceLabel, { color: t.ink.tertiary }]}>{entry.source_label}</Text>}
                      <Text style={[styles.timeRange, { color: t.ink.tertiary }]}>
                        {formatTime(entry.start_time)}{entry.end_time ? ` — ${formatTime(entry.end_time)}` : ''}
                      </Text>
                      {(entry.page_number != null || entry.chapter) && (
                        <View style={styles.progressRow}>
                          {entry.page_number != null && <Text style={[styles.progressText, { color: t.ink.secondary }]}>第 {entry.page_number} 页</Text>}
                          {entry.chapter && <Text style={[styles.progressText, { color: t.ink.secondary }]}>{entry.chapter}</Text>}
                        </View>
                      )}
                      {entry.note && <Text style={[styles.noteText, { color: t.ink.secondary }]}>{entry.note}</Text>}
                    </View>
                  </View>
                );
              })}
              </View>
            ))
          )
        )}

        {/* ===== 阅读笔记（高亮 + 想法合并） ===== */}
        {activeTab === 'readingNotes' && (
          <>
            {/* 添加按钮 — 固定在顶部，不随列表滚动 */}
            <TouchableOpacity
              style={[styles.addBtn, { borderColor: t.outline.standard, marginBottom: spacing.md }]}
              onPress={() => { setEditingAnnotation(null); setAnnotationMode(undefined as any); setAnnotationSheetVisible(true); }}
              activeOpacity={0.6}
            >
              <Ionicons name="add" size={16} color={t.ink.secondary} />
              <Text style={[styles.addBtnText, { color: t.ink.secondary }]}>添加书摘</Text>
            </TouchableOpacity>
            {readingNotes.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="bulb-outline" size={32} color={t.ink.tertiary} />
                <Text style={[styles.emptyText, { color: t.ink.tertiary, marginTop: spacing.sm }]}>暂无阅读笔记</Text>
              </View>
            ) : (
              readingNotes.map((entry) => (
                <View key={entry.id} style={[styles.annotationCard, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}>
                  {entry.type === 'highlight' && entry.color && (
                    <View style={[styles.highlightBar, { backgroundColor: entry.color }]} />
                  )}
                  <View style={styles.annotationHeader}>
                    <View style={[styles.annotationTypeBadge, {
                      backgroundColor: entry.type === 'highlight' ? t.accent.yellowBg : t.accent.greenBg,
                    }]}>
                      <Ionicons
                        name={entry.type === 'highlight' ? 'color-palette-outline' : 'bulb-outline'}
                        size={12}
                        color={entry.type === 'highlight' ? t.accent.yellow : t.accent.green}
                      />
                      <Text style={[styles.annotationTypeText, {
                        color: entry.type === 'highlight' ? t.accent.yellow : t.accent.green,
                      }]}>
                        {entry.type === 'highlight' ? '高亮' : '想法'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        const isHl = entry.type === 'highlight';
                        if (isHl) {
                          const hl = highlights.find((h: Highlight) => h.id === entry.id);
                          if (hl) {
                            setAnnotationMode('highlight');
                            setEditingAnnotation({
                              id: hl.id, book_id: bookId, annotationType: 'highlight',
                              content: hl.content, color: hl.color ?? '#F5A623',
                              note: hl.note ?? '', page_number: hl.page_number,
                              chapter: hl.chapter, created_at: hl.created_at, updated_at: hl.updated_at,
                            });
                            setAnnotationSheetVisible(true);
                          }
                        } else {
                          const n = notes.find((nt: Note) => nt.id === entry.id);
                          if (n) {
                            setAnnotationMode('note');
                            setEditingAnnotation({
                              id: n.id, book_id: bookId, annotationType: 'note',
                              content: n.content, color: '#50C878', note: null,
                              page_number: n.page_number, chapter: n.chapter,
                              created_at: n.created_at, updated_at: n.updated_at,
                            });
                            setAnnotationSheetVisible(true);
                          }
                        }
                      }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      activeOpacity={0.6}
                    >
                      <Ionicons name="create-outline" size={14} color={t.ink.tertiary} />
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.annotationContent, { color: t.ink.primary }]} numberOfLines={5}>{entry.content}</Text>
                  {entry.type === 'highlight' && entry.note && (
                    <View style={styles.highlightNoteRow}>
                      <Ionicons name="chatbubble-outline" size={12} color={t.ink.tertiary} />
                      <Text style={[styles.annotationNote, { color: t.ink.tertiary }]} numberOfLines={2}>{entry.note}</Text>
                    </View>
                  )}
                  <View style={styles.annotationFooter}>
                    {(entry.pageNumber != null || entry.chapter) && (
                      <Text style={[styles.annotationMeta, { color: t.ink.tertiary }]}>
                        {[entry.pageNumber ? `第${entry.pageNumber}页` : '', entry.chapter || ''].filter(Boolean).join(' · ') || ''}
                      </Text>
                    )}
                    <View style={{ flex: 1 }} />
                    <Text style={[styles.annotationDate, { color: t.ink.tertiary }]}>
                      {formatDateFull(entry.createdAt)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleDeleteAnnotation({
                        id: entry.id, book_id: bookId, annotationType: entry.type,
                        content: entry.content, color: entry.color ?? null, note: entry.note ?? null,
                        page_number: entry.pageNumber ?? null, chapter: entry.chapter ?? null,
                        created_at: entry.createdAt, updated_at: entry.createdAt,
                      })}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      style={{ marginLeft: spacing.sm }}
                      activeOpacity={0.6}
                    >
                      <Ionicons name="trash-outline" size={14} color={t.ink.tertiary} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* ===== 统计（含日历热力图） ===== */}
        {activeTab === 'stats' && (
          <View>
            {/* 阅读趋势 — 所有阅读日期的竖向柱状图 */}
            <Text style={[styles.sectionLabel, { color: t.ink.secondary }]}>阅读趋势</Text>
            {(() => {
              // 收集所有阅读日期及其时长
              const dateMap = new Map<string, number>();
              for (const e of timeline) {
                const key = e.start_time.slice(0, 10);
                dateMap.set(key, (dateMap.get(key) || 0) + (e.duration_ms || 0));
              }
              const allDates = [...dateMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
              const maxMs = Math.max(...allDates.map(([, ms]) => ms), 1);
              const displayDates = allDates.slice(-14); // 最多展示最近14天

              return displayDates.length > 0 ? (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.trendChart}>
                    <View style={styles.trendBars}>
                      {displayDates.map(([date, ms]) => {
                        const d = new Date(date);
                        const label = `${d.getMonth() + 1}/${d.getDate()}`;
                        const height = Math.max(6, (ms / maxMs) * 80);
                        return (
                          <View key={date} style={styles.trendBar}>
                            <Text style={[styles.trendBarValue, { color: t.ink.tertiary }]}>{formatDuration(ms)}</Text>
                            <View style={[styles.trendBarFill, { height, backgroundColor: t.accent.primary, opacity: ms > 0 ? 0.85 : 0.3 }]} />
                            <Text style={[styles.trendBarLabel, { color: t.ink.tertiary }]}>{label}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                  {allDates.length > 14 && (
                    <TouchableOpacity style={styles.viewMoreBtn} activeOpacity={0.6}>
                      <Text style={[styles.viewMoreText, { color: t.accent.primary }]}>
                        查看更多 · 共 {allDates.length} 天
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color={t.accent.primary} />
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <Text style={[styles.emptyText, { color: t.ink.tertiary }]}>暂无阅读数据</Text>
              );
            })()}

            {/* 共阅读天数 */}
            <Text style={[styles.readingDaysText, { color: t.ink.secondary }]}>
              本书共阅读 <Text style={{ color: t.accent.primary, fontWeight: '700' }}>{readingDates.size} 天</Text>
            </Text>
          </View>
        )}
      </View>

      <AddAnnotationSheet
        visible={annotationSheetVisible}
        bookId={bookId}
        editAnnotation={editingAnnotation}
        mode={annotationMode}
        prefillContent={editingAnnotation?.content}
        prefillChapter={editingAnnotation?.chapter ?? undefined}
        onClose={() => setAnnotationSheetVisible(false)}
        onSaved={handleSaved}
      />
    </View>
  );
}

// ===== 辅助函数 =====

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getTimelineEntryColor(entry: TimelineEntry, t: ReturnType<typeof useColors>) {
  if (entry.type === 'session') {
    return { dotColor: t.accent.blue, badgeBg: t.accent.blueBg, badgeText: t.accent.blue };
  }
  if (entry.note) {
    return { dotColor: t.accent.green, badgeBg: t.accent.greenBg, badgeText: t.accent.green };
  }
  if (entry.completed_book) {
    return { dotColor: t.accent.yellow, badgeBg: t.accent.yellowBg, badgeText: t.accent.yellow };
  }
  return { dotColor: t.accent.primary, badgeBg: t.accent.primaryBg, badgeText: t.accent.primary };
}

const styles = StyleSheet.create({
  root: { borderRadius: radii.lg, borderWidth: 1, marginTop: spacing.lg, ...softShadow },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, fontWeight: '600' },
  tabContent: { padding: spacing.md, minHeight: 120 },

  // 时间轴
  timelineGroup: { marginBottom: spacing.md },
  dateHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  dateText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, fontWeight: '600', marginRight: spacing.sm },
  dateLine: { flex: 1, height: 1 },
  timelineEntry: { flexDirection: 'row', gap: spacing.sm },
  timelineTrack: { alignItems: 'center', width: 20 },
  timelineDot: { width: 8, height: 8, borderRadius: 4 },
  timelineLine: { width: 2, flex: 1, marginTop: 4 },
  entryCard: { flex: 1, borderRadius: radii.md, borderWidth: 1, padding: spacing.sm, marginBottom: spacing.sm },
  entryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  typeBadgeText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, fontWeight: '600' },
  durationText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12 },
  sourceLabel: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, fontWeight: '500' },
  timeRange: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, marginTop: 2 },
  progressRow: { flexDirection: 'row', gap: spacing.md, marginTop: 4 },
  progressText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11 },
  noteText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, marginTop: 4, fontStyle: 'italic' },

  // 阅读笔记
  annotationCard: { borderRadius: radii.md, borderWidth: 1, padding: spacing.sm, marginBottom: spacing.sm },
  highlightBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderTopLeftRadius: radii.md, borderBottomLeftRadius: radii.md },
  annotationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  annotationTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  annotationTypeText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, fontWeight: '600' },
  annotationContent: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, lineHeight: 20, paddingLeft: 4 },
  highlightNoteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, paddingLeft: 4, marginTop: spacing.xs },
  annotationNote: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, flex: 1, lineHeight: 16 },
  annotationFooter: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, paddingLeft: 4 },
  annotationMeta: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10 },
  annotationDate: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10 },

  // 统计 — 阅读趋势
  sectionLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, fontWeight: '600', marginBottom: spacing.sm },
  trendChart: { maxHeight: 140, marginBottom: spacing.sm },
  trendBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingTop: 20, paddingBottom: 4 },
  trendBar: { alignItems: 'center', width: 36 },
  trendBarValue: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 8, marginBottom: 2 },
  trendBarFill: { width: 20, borderRadius: 4, minHeight: 4 },
  trendBarLabel: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 9, marginTop: 4 },
  viewMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: spacing.sm },
  viewMoreText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, fontWeight: '600' },
  readingDaysText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: spacing.sm },

  // 日历（保留样式以备后用）
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarDayHeader: { width: '14.28%', textAlign: 'center', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, fontWeight: '600', paddingVertical: spacing.xs },
  calendarCell: { width: '14.28%', aspectRatio: 1, padding: 2 },
  calendarDay: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  calendarDayText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13 },
  calendarDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },

  // 通用
  emptyText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, textAlign: 'center', paddingVertical: spacing.lg },
  emptyContainer: { alignItems: 'center', paddingVertical: spacing.xl },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderWidth: 1, borderRadius: radii.md, borderStyle: 'dashed' },
  addBtnText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, fontWeight: '600' },
});
