import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { radii, spacing } from '../../src/theme';
import { softShadow } from '../../src/theme/shadows';
import { formatDuration } from '../../src/utils/format';
import { useToday } from '../../src/hooks/useToday';
import type { TodayTimelineEntry } from '../../src/hooks/useToday';
import { useColors } from '../../src/stores/useThemeStore';
import { getDailyQuote } from '../../src/data/mockData';
import { getDatabase } from '../../src/db/database';

/**
 * Today 页面 — 今日阅读概览 (v2.0 真实数据 + 温暖简约)
 *
 * 始终展示完整 UI 结构，无数据时显示零值 / "暂无" 文案，
 * 不做整页空状态替换。
 *
 * 模块：
 * 1. 时段问候语
 * 2. 继续阅读英雄卡片（封面 + 进度条 + 按钮）
 * 3. 今日数据 Bento 2×2 粉彩网格
 * 4. 今日目标进度条
 * 5. 最近阅读时间线（垂直线 + 彩色节点）
 * 6. 每日名言
 */
export default function TodayScreen() {
  const router = useRouter();
  const {
    todayMs,
    totalPages,
    booksReadToday,
    readingNotes,
    recentTimeline,
    currentBook,
    currentBookTotalMs,
    currentBookPageCurrent,
    currentBookPageTotal,
    hasAnyBooks,
    loading,
    refresh,
  } = useToday();

  const t = useColors();

  const quote = getDailyQuote();

  // 每日随机高亮
  const [dailyHighlight, setDailyHighlight] = useState<{ content: string; bookTitle: string; bookId: string } | null>(null);

  const fetchDailyHighlight = useCallback(async () => {
    try {
      const db = await getDatabase();
      // 从正在阅读的书里随机取一条高亮
      const readingBooks = await db.getAllAsync<{ id: string }>("SELECT id FROM books WHERE status = 'reading'");
      if (readingBooks.length === 0) { setDailyHighlight(null); return; }
      const bookIds = readingBooks.map(b => b.id);
      // 取这些书的所有高亮，随机选一条
      const allHighlights = await db.getAllAsync<{ content: string; book_id: string }>(
        `SELECT content, book_id FROM highlights WHERE book_id IN (${bookIds.map(() => '?').join(',')}) ORDER BY created_at DESC`,
        bookIds,
      );
      if (allHighlights.length === 0) { setDailyHighlight(null); return; }
      const pick = allHighlights[Math.floor(Math.random() * allHighlights.length)];
      const books = await db.getAllAsync<{ id: string; title: string }>('SELECT id, title FROM books');
      const book = books.find(b => b.id === pick.book_id);
      setDailyHighlight({ content: pick.content, bookTitle: book?.title || '未知书籍', bookId: pick.book_id });
    } catch { setDailyHighlight(null); }
  }, []);

  // 每次 Tab 获得焦点时刷新数据
  useFocusEffect(
    useCallback(() => {
      refresh();
      fetchDailyHighlight();
    }, [refresh, fetchDailyHighlight])
  );

  // 时段问候
  const hour = new Date().getHours();
  let greeting = '早上好';
  let greetingIcon: keyof typeof Ionicons.glyphMap = 'sunny-outline';
  if (hour >= 12 && hour < 18) {
    greeting = '下午好';
    greetingIcon = 'partly-sunny-outline';
  }
  if (hour >= 18) {
    greeting = '晚上好';
    greetingIcon = 'moon-outline';
  }

  // ===== 加载状态 =====
  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: t.paper.primary }]}>
        <ActivityIndicator size="large" color={t.accent.primary} />
        <Text style={[styles.loadingText, { color: t.ink.tertiary }]}>加载中...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: t.paper.primary }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== 问候语 ===== */}
        <View style={styles.greetingRow}>
          <Ionicons name={greetingIcon} size={26} color={t.accent.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: t.ink.primary }]}>{greeting}</Text>
            <Text style={[styles.greetingSub, { color: t.ink.tertiary }]}>今天想读点什么？</Text>
          </View>
        </View>

        {/* ===== 最后一次打开的书籍卡片 ===== */}
        {currentBook ? (
          <View style={[styles.heroCard, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}>
            {/* 标题行 */}
            <View style={styles.heroHeader}>
              <View style={[styles.heroIconCircle, { backgroundColor: (currentBook.accent_color ?? t.accent.primary) + '18' }]}>
                <Ionicons name="book" size={20} color={currentBook.accent_color ?? t.accent.primary} />
              </View>
              <Text style={[styles.heroLabel, { color: t.ink.secondary }]}>最近在读</Text>
            </View>

            {/* 书名 + 作者 */}
            <Text style={[styles.heroTitle, { color: t.ink.primary }]} numberOfLines={1}>
              {currentBook.title}
            </Text>
            <Text style={[styles.heroAuthor, { color: t.ink.secondary }]}>{currentBook.author ?? '未知作者'}</Text>

            {/* 阅读进度 + 累计时长 */}
            <View style={styles.heroStatsRow}>
              {currentBookPageTotal != null && currentBookPageTotal > 0 ? (
                <>
                  <Ionicons name="book-outline" size={14} color={t.ink.tertiary} />
                  <Text style={[styles.heroStatsText, { color: t.ink.tertiary }]}>
                    第 {Math.round(currentBookPageCurrent)}/{currentBookPageTotal} 页 · {Math.round((currentBookPageCurrent / currentBookPageTotal) * 100)}%
                  </Text>
                  <Text style={[styles.heroStatsDivider, { color: t.ink.tertiary }]}>·</Text>
                </>
              ) : null}
              <Ionicons name="time-outline" size={14} color={t.ink.tertiary} />
              <Text style={[styles.heroStatsText, { color: t.ink.tertiary }]}>
                累计 {formatDuration(currentBookTotalMs)}
              </Text>
            </View>

            {/* 继续阅读按钮 — 紫色 */}
            <TouchableOpacity
              style={[styles.heroBtn, { backgroundColor: t.accent.primary }]}
              activeOpacity={0.8}
              onPress={() => router.push(`/book/${currentBook.id}`)}
            >
              <Ionicons name="play" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.heroBtnText}>继续阅读</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* 无书籍 */
          <View style={[styles.heroCard, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}>
            <View style={styles.heroHeader}>
              <View style={[styles.heroIconCircle, { backgroundColor: t.accent.primaryBg }]}>
                <Ionicons name="library" size={20} color={t.accent.primary} />
              </View>
              <Text style={[styles.heroLabel, { color: t.ink.secondary }]}>
                {hasAnyBooks ? '准备好了吗？' : '暂无书籍'}
              </Text>
            </View>
            <Text style={[styles.heroTitle, { color: t.ink.primary }]}>
              {hasAnyBooks ? '选一本书开始阅读' : '添加你的第一本书'}
            </Text>
            <Text style={[styles.heroAuthor, { color: t.ink.secondary }]}>
              {hasAnyBooks ? '你的书库中有书等待开启，去挑选一本吧' : '开始记录你的阅读时光'}
            </Text>
            <TouchableOpacity
              style={[styles.heroBtn, { backgroundColor: t.accent.primary }]}
              activeOpacity={0.8}
              onPress={() => router.push('/(tabs)/library')}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.heroBtnText}>
                {hasAnyBooks ? '去书架看看' : '添加书籍'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ===== 今日数据 Bento 2×2 ===== */}
        <View style={styles.sectionTitleRow}>
          <Ionicons name="stats-chart-outline" size={18} color={t.accent.primary} />
          <Text style={[styles.sectionTitle, { color: t.ink.primary }]}>阅读数据</Text>
        </View>
        <View style={styles.bentoGrid}>
          {/* 阅读时长 — 强调色 */}
          <View style={[styles.bentoCard, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}>
            <View style={[styles.bentoIconCircle, { backgroundColor: t.accent.primaryBg }]}>
              <Ionicons name="time-outline" size={20} color={t.accent.primary} />
            </View>
            <Text style={[styles.bentoValue, { color: t.ink.primary }]}>{formatDuration(todayMs)}</Text>
            <Text style={[styles.bentoLabel, { color: t.ink.tertiary }]}>阅读时长</Text>
          </View>
          {/* 阅读页数 */}
          <View style={[styles.bentoCard, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}>
            <View style={[styles.bentoIconCircle, { backgroundColor: t.accent.primaryBg }]}>
              <Ionicons name="document-text-outline" size={20} color={t.accent.primary} />
            </View>
            <Text style={[styles.bentoValue, { color: t.ink.primary }]}>{totalPages} 页</Text>
            <Text style={[styles.bentoLabel, { color: t.ink.tertiary }]}>阅读页数</Text>
          </View>
          {/* 读过书籍 */}
          <View style={[styles.bentoCard, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}>
            <View style={[styles.bentoIconCircle, { backgroundColor: t.accent.primaryBg }]}>
              <Ionicons name="book-outline" size={20} color={t.accent.primary} />
            </View>
            <Text style={[styles.bentoValue, { color: t.ink.primary }]}>{booksReadToday} 本</Text>
            <Text style={[styles.bentoLabel, { color: t.ink.tertiary }]}>读过书籍</Text>
          </View>
          {/* 阅读笔记 */}
          <View style={[styles.bentoCard, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}>
            <View style={[styles.bentoIconCircle, { backgroundColor: t.accent.primaryBg }]}>
              <Ionicons name="bulb-outline" size={20} color={t.accent.primary} />
            </View>
            <Text style={[styles.bentoValue, { color: t.ink.primary }]}>{readingNotes}</Text>
            <Text style={[styles.bentoLabel, { color: t.ink.tertiary }]}>阅读笔记</Text>
          </View>
        </View>

        {/* ===== 阅读时间线 ===== */}
        <View style={styles.sectionTitleRow}>
          <Ionicons name="time-outline" size={18} color={t.accent.primary} />
          <Text style={[styles.sectionTitle, { color: t.ink.primary }]}>阅读时间线</Text>
        </View>
        <View style={[styles.timelineCard, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}>
          {recentTimeline.length > 0 ? (
            recentTimeline.map((item, index) => (
              <TimelineItem
                key={item.id}
                item={item}
                isLast={index === recentTimeline.length - 1}
                onPress={() => router.push(`/book/${item.bookId}`)}
                colors={t}
              />
            ))
          ) : (
            <View style={styles.timelineEmpty}>
              <Ionicons name="time-outline" size={24} color={t.ink.tertiary} />
              <Text style={[styles.timelineEmptyText, { color: t.ink.tertiary }]}>
                今天还没有阅读记录
              </Text>
              <Text style={[styles.timelineEmptyHint, { color: t.ink.tertiary }]}>
                开始计时或手动记录你的阅读
              </Text>
            </View>
          )}
        </View>

        {/* ===== 每日名言 ===== */}
        <View style={[styles.quoteCard, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}>
          <View style={styles.quoteIconRow}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={t.accent.primary} />
          </View>
          <Text style={[styles.quoteText, { color: t.ink.secondary }]}>"{quote.text}"</Text>
          <Text style={[styles.quoteAuthor, { color: t.ink.tertiary }]}>— {quote.author}</Text>
        </View>

        {/* ===== 每日阅读高亮 ===== */}
        <TouchableOpacity
          style={[styles.highlightCard, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}
          activeOpacity={dailyHighlight ? 0.8 : 1}
          onPress={() => dailyHighlight && router.push(`/book/${dailyHighlight.bookId}`)}
        >
          <View style={styles.highlightIconRow}>
            <Ionicons name="color-palette-outline" size={22} color={t.accent.primary} />
          </View>
          {dailyHighlight ? (
            <>
              <Text style={[styles.highlightLabel, { color: t.ink.tertiary }]}>今日高亮 · 《{dailyHighlight.bookTitle}》</Text>
              <Text style={[styles.highlightText, { color: t.ink.secondary }]} numberOfLines={3}>
                "{dailyHighlight.content}"
              </Text>
            </>
          ) : (
            <Text style={[styles.highlightText, { color: t.ink.tertiary }]}>今天还没有高亮，去阅读吧</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ============================================================
// 时间线条目子组件
// ============================================================

function TimelineItem({
  item,
  isLast,
  onPress,
  colors,
}: {
  item: TodayTimelineEntry;
  isLast: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const config = {
    session: { icon: 'timer-outline' as const, label: '阅读', dotColor: colors.accent.blue, dotBg: colors.accent.blueBg },
    manual:   { icon: 'create-outline' as const, label: '手动记录', dotColor: colors.accent.purple, dotBg: colors.accent.purpleBg },
    completed:{ icon: 'checkmark-circle-outline' as const, label: '读完', dotColor: colors.accent.green, dotBg: colors.accent.greenBg },
    added:    { icon: 'add-circle-outline' as const, label: '加入书架', dotColor: colors.accent.yellow, dotBg: colors.accent.yellowBg },
  }[item.type] ?? { icon: 'ellipse-outline' as const, label: '', dotColor: colors.ink.tertiary, dotBg: colors.paper.white };

  return (
    <TouchableOpacity
      style={styles.timelineItem}
      activeOpacity={0.7}
      onPress={onPress}
    >
      {/* 时间线节点 */}
      <View style={styles.timelineNodeCol}>
        <View style={[styles.timelineDotOuter, { backgroundColor: config.dotBg, borderColor: colors.outline.standard }]}>
          <Ionicons name={config.icon} size={14} color={config.dotColor} />
        </View>
        {!isLast && (
          <View style={[styles.timelineLine, { backgroundColor: colors.outline.standard }]} />
        )}
      </View>

      {/* 内容 */}
      <View style={styles.timelineContent}>
        <View style={styles.timelineHeader}>
          <Text style={[styles.timelineTime, { color: colors.ink.tertiary }]}>
            {(() => { const raw = item.startTime || ''; const t = raw.length >= 16 ? raw.slice(11, 16) : ''; if (t && /^\d{2}:\d{2}$/.test(t)) return `${t} · ${config.label}`; const d = new Date(raw); if (!isNaN(d.getTime())) { const h = d.getHours(), m = d.getMinutes(); return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} · ${config.label}`; } return config.label; })()}
          </Text>
          {item.durationMs > 0 && (
            <Text style={[styles.timelineDuration, { color: colors.ink.tertiary }]}>
              {formatDuration(item.durationMs)}
            </Text>
          )}
        </View>
        <Text style={[styles.timelineBookTitle, { color: colors.ink.primary }]} numberOfLines={1}>
          {item.bookTitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ============================================================
// 样式 — 静态结构（颜色在 JSX 中通过 useColors() 覆盖）
// ============================================================

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: 60,
  },

  // ===== 居中容器（仅加载状态） =====
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  loadingText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    marginTop: spacing.md,
  },

  // ===== 问候语 =====
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  greeting: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  greetingSub: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    marginTop: 2,
  },

  // ===== 英雄卡片 =====
  heroCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    ...softShadow,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  heroIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  heroAuthor: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    marginBottom: spacing.md,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  heroStatsText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
  },
  heroStatsDivider: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    marginHorizontal: 4,
  },
  heroBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.full,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ===== 区块标题 =====
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
  },

  // ===== Bento 2×2 粉彩网格 =====
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  bentoCard: {
    width: '47%',
    flexGrow: 1,
    maxWidth: '48%',
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  bentoValue: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 22,
    fontWeight: '800',
  },
  bentoLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    fontWeight: '500',
  },

  // ===== 时间线 =====
  timelineCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...softShadow,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  timelineNodeCol: {
    alignItems: 'center',
    width: 24,
  },
  timelineDotOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: spacing.lg,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  timelineTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timelineTime: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    fontWeight: '500',
  },
  timelineDuration: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    fontWeight: '700',
  },
  timelineBookTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
  },
  timelineEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  timelineEmptyText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    fontWeight: '600',
  },
  timelineEmptyHint: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
  },

  // ===== 名言 =====
  quoteCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xl,
    ...softShadow,
  },
  quoteIconRow: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  quoteText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 24,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  quoteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quoteAuthor: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },

  // ===== Bento 图标圆 =====
  bentoIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ===== 每日高亮 =====
  highlightCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...softShadow,
  },
  highlightIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  highlightLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  highlightText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    lineHeight: 22,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
