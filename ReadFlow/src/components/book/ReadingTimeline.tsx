import { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useReadingStore } from '../../stores/useReadingStore';
import { formatDuration, formatDateFull } from '../../utils/format';
import type { TimelineEntry } from '../../models';
import {
  spacing,
  radii,
} from '../../theme';
import { softShadow } from '../../theme/shadows';
import { useColors } from '../../stores/useThemeStore';

/**
 * ReadingTimeline — 阅读时间线 (v2.0 + 深色模式)
 *
 * 展示某本书的全部阅读活动（计时会话 + 手动补录），
 * 按时间倒序排列。每组同一天的活动显示日期标题。
 *
 * 温暖简约风格：Pill 时长标签 + 1px 分割线
 */
export default function ReadingTimeline() {
  const t = useColors();
  const timeline = useReadingStore((s) => s.timeline);
  const loading = useReadingStore((s) => s.loading);
  const deleteSession = useReadingStore((s) => s.deleteSession);
  const deleteManualLog = useReadingStore((s) => s.deleteManualLog);

  const handleDelete = useCallback(
    (entry: TimelineEntry) => {
      Alert.alert(
        '删除记录',
        `确定要删除这条${entry.type === 'session' ? '阅读' : '手动'}记录吗？`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '删除',
            style: 'destructive',
            onPress: () => {
              if (entry.type === 'session') {
                deleteSession(entry.id);
              } else {
                deleteManualLog(entry.id);
              }
            },
          },
        ]
      );
    },
    [deleteSession, deleteManualLog]
  );

  if (loading) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={[styles.loadingText, { color: t.ink.tertiary }]}>加载中...</Text>
      </View>
    );
  }

  if (timeline.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyIcon}>🕐</Text>
        <Text style={[styles.emptyTitle, { color: t.ink.tertiary }]}>暂无阅读记录</Text>
        <Text style={[styles.emptyHint, { color: t.ink.tertiary }]}>开始计时或手动添加记录</Text>
      </View>
    );
  }

  // 按日期分组
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

  return (
    <View>
      {groups.map((group) => (
        <View key={group.date} style={styles.group}>
          {/* 日期标题 */}
          <View style={styles.dateHeader}>
            <Text style={[styles.dateText, { color: t.ink.secondary }]}>{formatDateFull(group.date)}</Text>
            <View style={[styles.dateLine, { backgroundColor: t.outline.standard }]} />
          </View>

          {/* 该日期的条目 */}
          {group.entries.map((entry, idx) => (
            <View
              key={entry.id}
              style={[
                styles.entryCard,
                idx === group.entries.length - 1 && { marginBottom: 0 },
              ]}
            >
              {/* 时间线竖线 */}
              <View style={styles.timelineTrack}>
                <View
                  style={[
                    styles.timelineDot,
                    {
                      backgroundColor:
                        entry.type === 'session'
                          ? t.accent.primary
                          : t.accent.yellow,
                    },
                  ]}
                />
                {idx < group.entries.length - 1 && (
                  <View style={[styles.timelineLine, { backgroundColor: t.outline.standard }]} />
                )}
              </View>

              {/* 条目内容 */}
              <View style={[styles.entryContent, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}>
                <View style={styles.entryHeader}>
                  <View
                    style={[
                      styles.typeBadge,
                      {
                        backgroundColor:
                          entry.type === 'session'
                            ? t.accent.primaryBg
                            : t.accent.yellowBg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeBadgeText,
                        {
                          color:
                            entry.type === 'session'
                              ? t.accent.primary
                              : t.accent.yellow,
                        },
                      ]}
                    >
                      {entry.type === 'session' ? '计时' : '手动'}
                    </Text>
                  </View>

                  {entry.duration_ms !== null && (
                    <Text style={[styles.durationText, { color: t.ink.primary }]}>
                      {formatDuration(entry.duration_ms)}
                    </Text>
                  )}

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(entry)}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.deleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                </View>

                {entry.source_label && (
                  <Text style={[styles.sourceLabel, { color: t.ink.tertiary }]}>{entry.source_label}</Text>
                )}

                <Text style={[styles.timeRange, { color: t.ink.tertiary }]}>
                  {formatTime(entry.start_time)}
                  {entry.end_time ? ` — ${formatTime(entry.end_time)}` : ''}
                </Text>

                {/* 页数 / 章节 */}
                {(entry.page_number != null || entry.chapter) && (
                  <View style={styles.progressRow}>
                    {entry.page_number != null && (
                      <Text style={[styles.progressText, { color: t.ink.secondary }]}>
                        第 {entry.page_number} 页
                      </Text>
                    )}
                    {entry.chapter && (
                      <Text style={[styles.progressText, { color: t.ink.secondary }]}>
                        {entry.chapter}
                      </Text>
                    )}
                  </View>
                )}

                {/* 读完标记 */}
                {entry.completed_book === 1 && (
                  <View style={[styles.completedBadge, { backgroundColor: t.accent.greenBg }]}>
                    <Text style={[styles.completedBadgeText, { color: t.accent.green }]}>📚 读完</Text>
                  </View>
                )}

                {entry.note && (
                  <Text style={[styles.noteText, { color: t.ink.secondary }]}>{entry.note}</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

const styles = StyleSheet.create({
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  emptyHint: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
  },
  loadingText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
  },

  group: {
    marginBottom: spacing.lg,
  },

  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  dateText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    fontWeight: '700',
  },
  dateLine: {
    flex: 1,
    height: 1,
  },

  entryCard: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },

  timelineTrack: {
    width: 24,
    alignItems: 'center',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
  },

  entryContent: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    ...softShadow,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  typeBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    fontWeight: '700',
  },
  durationText: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
  },
  deleteBtn: {
    padding: 2,
  },
  deleteBtnText: {
    fontSize: 12,
  },
  sourceLabel: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    marginTop: spacing.xs,
  },
  timeRange: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    marginTop: 2,
  },
  noteText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  progressRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  progressText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    fontWeight: '500',
  },
  completedBadge: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  completedBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    fontWeight: '700',
  },
});
