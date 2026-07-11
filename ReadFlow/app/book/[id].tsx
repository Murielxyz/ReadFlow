import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { safeGoBack } from '../../src/utils/navigation';
import { useBookStore } from '../../src/stores/useBookStore';
import { useTimerStore } from '../../src/stores/useTimerStore';
import { useReadingStore } from '../../src/stores/useReadingStore';
import { useSourceStore } from '../../src/stores/useSourceStore';
import { useTagStore } from '../../src/stores/useTagStore';
import { useNoteStore } from '../../src/stores/useNoteStore';
import { useHighlightStore } from '../../src/stores/useHighlightStore';
import { getDatabase } from '../../src/db/database';
import BookCover from '../../src/components/book/BookCover';
import Rating from '../../src/components/common/Rating';
import TimerModal from '../../src/components/reader/TimerModal';
import ManualLogSheet from '../../src/components/reader/ManualLogSheet';
import StopTimerSheet from '../../src/components/reader/StopTimerSheet';
import ReadingTabsView from '../../src/components/book/ReadingTabsView';
import SourceCard from '../../src/components/book/SourceCard';
import AddSourceSheet from '../../src/components/book/AddSourceSheet';
import { formatDuration } from '../../src/utils/format';
import { spacing, radii } from '../../src/theme';
import { softShadow } from '../../src/theme/shadows';
import { useColors } from '../../src/stores/useThemeStore';
import { BOOK_STATUS_OPTIONS } from '../../src/utils/constants';
import type { BookStatus } from '../../src/models';

const MAX_DESC_LINES = 3;

/**
 * 书籍详情页 — 温暖简约风格 (v2.0 + 深色模式)
 *
 * 始终展示完整模块结构，无数据时显示 "暂无" 文案。
 *
 * 模块：
 * - Hero：封面 + 书名 + 评分 + 状态
 * - 快速操作：阅读 / 计时 / 记录（3项）
 * - 统计卡片：实时数据
 * - 简介（展开/收起）
 * - 阅读来源管理
 * - 标签 + 书单
 * - 笔记 + 高亮
 * - 阅读时间线
 */
export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const books = useBookStore((s) => s.books);
  const updateBook = useBookStore((s) => s.updateBook);
  const fetchBooks = useBookStore((s) => s.fetchBooks);

  // Timer store
  const timerBookId = useTimerStore((s) => s.bookId);
  const timerRunning = useTimerStore((s) => s.segmentStart !== null && s.pausedAt === null);
  const timerPaused = useTimerStore((s) => s.pausedAt !== null);
  const startTimer = useTimerStore((s) => s.startTimer);
  const stopTimer = useTimerStore((s) => s.stopTimer);
  const stopSheet = useTimerStore((s) => s.stopSheet);
  const lastProgress = useTimerStore((s) => s.lastProgress);
  const dismissStopSheet = useTimerStore((s) => s.dismissStopSheet);
  const finalizeSession = useTimerStore((s) => s.finalizeSession);

  // Reading store
  const stats = useReadingStore((s) => s.stats);
  const fetchBookData = useReadingStore((s) => s.fetchBookData);
  const refreshStats = useReadingStore((s) => s.refreshStats);
  const addManualLog = useReadingStore((s) => s.addManualLog);

  // Notes & Highlights count
  const notes = useNoteStore((s) => s.notes);
  const highlights = useHighlightStore((s) => s.highlights);
  const fetchNotes = useNoteStore((s) => s.fetchNotes);
  const fetchHighlights = useHighlightStore((s) => s.fetchHighlights);
  const annotationCount = notes.length + highlights.length;

  // Source store
  const sources = useSourceStore((s) => s.sources);
  const sourceStats = useSourceStore((s) => s.sourceStats);
  const fetchSources = useSourceStore((s) => s.fetchSources);
  const fetchSourceStats = useSourceStore((s) => s.fetchSourceStats);

  // Tag store
  const bookTags = useTagStore((s) => s.bookTags);
  const fetchBookTags = useTagStore((s) => s.fetchBookTags);
  const createTag = useTagStore((s) => s.createTag);
  const assignTag = useTagStore((s) => s.assignTag);
  const removeTag = useTagStore((s) => s.removeTag);

  // Timeline for reading progress calculation
  const timeline = useReadingStore((s) => s.timeline);

  const book = books.find((b) => b.id === id);

  // 阅读进度：数字来源取 current_page 百分比，纸质书取最新 page_number / page_count
  const readingProgress = useMemo(() => {
    if (!book) return null;
    const digitalSources = sources.filter((s) => s.type === 'epub' || s.type === 'pdf');
    const maxProgress = Math.max(...digitalSources.map((s) => s.current_page), 0);
    if (maxProgress > 0) return Math.round(maxProgress);
    if (book.page_count && book.page_count > 0) {
      const latestWithPage = timeline.find((e) => e.page_number != null);
      if (latestWithPage?.page_number) {
        return Math.round((latestWithPage.page_number / book.page_count) * 100);
      }
    }
    return null;
  }, [sources, timeline, book]);

  // 已读页数
  const pagesRead = useMemo(() => {
    if (!book) return null;
    // 电子书：从 current_page 百分比换算
    const digitalSources = sources.filter((s) => s.type === 'epub' || s.type === 'pdf');
    const maxProgress = Math.max(...digitalSources.map((s) => s.current_page), 0);
    if (maxProgress > 0 && book.page_count && book.page_count > 0) {
      return Math.round((maxProgress / 100) * book.page_count);
    }
    // 纸质书/手动：取 timeline 最新 page_number
    const latestWithPage = timeline.find((e) => e.page_number != null);
    if (latestWithPage?.page_number) return latestWithPage.page_number;
    return null;
  }, [sources, timeline, book]);

  // Dynamic theme colors
  const t = useColors();

  // UI state
  const [descExpanded, setDescExpanded] = useState(false);
  const [manualLogVisible, setManualLogVisible] = useState(false);
  const [addSourceVisible, setAddSourceVisible] = useState(false);
  const [tagInputVisible, setTagInputVisible] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  // 阅读状态：直接反映当前书的 status，三个芯片均可高亮
  const activeStatus: BookStatus = book?.status ?? 'to_read';

  const isTimerForThisBook = timerBookId === id;
  const isTimerActive = timerRunning || timerPaused;

  useEffect(() => {
    if (!book) fetchBooks();
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchBookData(id);
      fetchSources(id);
      fetchSourceStats(id);
      fetchBookTags(id);
      fetchNotes(id);
      fetchHighlights(id);
    }
  }, [id]);

  // 从其他页面返回时刷新数据（如计时页保存后）
  useFocusEffect(useCallback(() => {
    if (id) {
      fetchBookData(id);
      fetchSources(id);
      fetchSourceStats(id);
      fetchNotes(id);
      fetchHighlights(id);
    }
  }, [id, fetchBookData, fetchSources, fetchSourceStats, fetchNotes, fetchHighlights]));

  // 简介是否需要展开按钮（字符 > 100 即显示）
  const descNeedsExpand = (book?.description?.length ?? 0) > 100;

  // ===== 操作回调 =====

  const handleRatingChange = useCallback(
    async (rating: number) => {
      if (!book) return;
      await updateBook(book.id, { rating });
      // 同步评分到时间轴
      await addManualLog(book.id, 0, `评分 ${rating}/5`);
      if (id) { refreshStats(id); fetchBookData(id); }
    },
    [book, updateBook, addManualLog, id, refreshStats, fetchBookData],
  );

  const handleStatusChange = useCallback(
    async (status: BookStatus) => {
      if (!book) return;
      if (book.status === status) return; // 相同状态不重复处理
      await updateBook(book.id, { status });
      // 同步到时间轴
      const STATUS_NOTE: Record<BookStatus, string> = {
        reading: '开始阅读',
        finished: '标记为已读完',
        to_read: '标记为待读',
        abandoned: '标记为弃读',
      };
      await addManualLog(book.id, 0, STATUS_NOTE[status]);
      if (id) { refreshStats(id); fetchBookData(id); }
    },
    [book, updateBook, addManualLog, id, refreshStats, fetchBookData],
  );

  const handleStopSheetSave = useCallback(
    async (data: { pageNumber?: number; chapter?: string; completedBook: boolean }) => {
      if (!stopSheet.sessionId) return;
      await finalizeSession(stopSheet.sessionId, data);
      if (id) {
        refreshStats(id);
        fetchBookData(id);
        fetchSourceStats(id);
        if (data.completedBook) fetchBooks();
      }
      dismissStopSheet();
    },
    [stopSheet.sessionId, finalizeSession, id, refreshStats, fetchBookData, fetchBooks, dismissStopSheet],
  );

  const handleManualLog = useCallback(() => { setManualLogVisible(true); }, []);

  const handleLogSaved = useCallback(() => {
    if (id) { refreshStats(id); fetchBookData(id); fetchSourceStats(id); }
  }, [id, refreshStats, fetchBookData, fetchSourceStats]);

  const handleCreateTag = useCallback(async () => {
    // 先保存当前值，防止 onBlur 先触发清空
    const name = newTagName.trim();
    if (!name || !book) return;
    setNewTagName('');
    setTagInputVisible(false);
    const tag = await createTag(name);
    await assignTag(book.id, tag.id);
  }, [newTagName, book, createTag, assignTag]);

  const handleRemoveTag = useCallback((tagId: string) => {
    if (!book) return;
    removeTag(book.id, tagId);
  }, [book, removeTag]);

  // ===== 未找到书本 =====
  if (!book) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: t.paper.primary }]}>
        <Ionicons name="book-outline" size={48} color={t.ink.tertiary} />
        <Text style={[styles.emptyTitle, { color: t.ink.primary }]}>
          未找到书籍
        </Text>
        <Text style={[styles.emptyHint, { color: t.ink.tertiary }]}>
          该书可能已被删除
        </Text>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: t.ink.primary }]}
          onPress={() => safeGoBack()}
          activeOpacity={0.8}
        >
          <Text style={[styles.backButtonText, { color: t.ink.inverse }]}>返回书架</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: t.paper.primary }]}>
      {/* ===== 顶部导航栏 ===== */}
      <View style={[styles.navBar, { backgroundColor: t.paper.primary, borderBottomColor: t.outline.standard }]}>
        <TouchableOpacity onPress={() => safeGoBack()} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={t.ink.primary} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: t.ink.primary }]} numberOfLines={1}>{book.title}</Text>
        <TouchableOpacity onPress={() => router.push(`/add-book?editBookId=${book.id}`)} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="create-outline" size={20} color={t.ink.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== Hero 区 ===== */}
        <View style={styles.heroSection}>
          <View style={styles.coverWrapper}>
            <BookCover
              uri={book.cover_url}
              title={book.title}
              accentColor={book.accent_color}
              size="lg"
            />
          </View>

          <Text style={[styles.bookTitle, { color: t.ink.primary }]} numberOfLines={3}>{book.title}</Text>
          {book.author ? (
            <Text style={[styles.bookAuthor, { color: t.ink.secondary }]}>{book.author}</Text>
          ) : (
            <Text style={[styles.bookAuthorPlaceholder, { color: t.ink.tertiary }]}>未知作者</Text>
          )}

          <View style={styles.ratingRow}>
            <Rating value={book.rating} onChange={handleRatingChange} size="lg" />
            <Text style={[styles.ratingLabel, { color: t.accent.yellow }]}>{book.rating ?? 0}/5</Text>
          </View>

          {/* 简介（居中展示，最大宽度限制） */}
          {book.description ? (
            <>
              <Text
                style={[styles.heroDesc, { color: t.ink.secondary }]}
                numberOfLines={descExpanded ? undefined : MAX_DESC_LINES}
              >
                {book.description}
              </Text>
              {descNeedsExpand && (
                <TouchableOpacity onPress={() => setDescExpanded(!descExpanded)} activeOpacity={0.7} style={{ marginTop: spacing.sm }}>
                  <Text style={[styles.expandButtonText, { color: t.accent.primary }]}>
                    {descExpanded ? '收起 ▲' : '展开 ▼'}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <Text style={[styles.heroDesc, { color: t.ink.tertiary, fontStyle: 'italic' }]}>暂无简介</Text>
          )}

          {/* 状态切换 Chips — 不同状态不同颜色，使用 activeStatus */}
          <View style={styles.statusChipRow}>
            {BOOK_STATUS_OPTIONS.map((option) => {
              const isActive = activeStatus === option.value;
              const statusColor =
                option.value === 'reading' ? t.status.reading :
                option.value === 'finished' ? t.status.finished :
                t.status.toRead;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.statusChip,
                    {
                      backgroundColor: isActive ? statusColor : t.paper.white,
                      borderColor: isActive ? statusColor : t.outline.standard,
                    },
                  ]}
                  onPress={() => handleStatusChange(option.value)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      { color: isActive ? '#FFFFFF' : t.ink.secondary },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 标签（内置于 Hero 区 — 在状态下） */}
          <View style={styles.heroTagsRow}>
            <Text style={[styles.heroTagsLabel, { color: t.ink.primary }]}>标签：</Text>
            {bookTags.map((tag) => (
              <View key={tag.id} style={[styles.heroTagChip, { borderColor: t.outline.standard, backgroundColor: t.paper.white }]}>
                {tag.color && <View style={[styles.tagDot, { backgroundColor: tag.color }]} />}
                <Text style={[styles.tagChipText, { color: t.ink.primary }]}>{tag.name}</Text>
                <TouchableOpacity onPress={() => handleRemoveTag(tag.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Ionicons name="close" size={12} color={t.ink.tertiary} />
                </TouchableOpacity>
              </View>
            ))}
            {tagInputVisible ? (
              <View style={[styles.heroTagChip, { borderColor: t.accent.primary, backgroundColor: t.paper.white }]}>
                <TextInput
                  style={[styles.tagInput, { color: t.ink.primary }]}
                  value={newTagName}
                  onChangeText={setNewTagName}
                  placeholder="标签名"
                  placeholderTextColor={t.ink.tertiary}
                  maxLength={20}
                  autoFocus
                  onSubmitEditing={handleCreateTag}
                  onBlur={() => setTagInputVisible(false)}
                />
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.heroTagChip, styles.heroTagAddChip, { borderColor: t.outline.standard, backgroundColor: t.paper.white }]}
                onPress={() => setTagInputVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={14} color={t.ink.secondary} />
              </TouchableOpacity>
            )}
          </View>

        </View>

        {/* ===== 阅读来源（置顶） ===== */}
        <View style={styles.sectionHeader}>
          <Ionicons name="folder-open-outline" size={18} color={t.accent.primary} />
          <Text style={[styles.sectionTitle, { color: t.ink.primary }]}>阅读来源</Text>
          <TouchableOpacity
            style={[styles.addSourceBtn, { borderColor: t.outline.standard, backgroundColor: t.paper.white }]}
            onPress={() => setAddSourceVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={14} color={t.ink.secondary} />
            <Text style={[styles.addSourceBtnText, { color: t.ink.secondary }]}> 添加</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addSourceBtn, { borderColor: t.outline.standard, backgroundColor: t.paper.white, marginLeft: spacing.sm }]}
            onPress={() => setManualLogVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={14} color={t.ink.secondary} />
            <Text style={[styles.addSourceBtnText, { color: t.ink.secondary }]}> 补录</Text>
          </TouchableOpacity>
        </View>

        {sources.length > 0 ? (
          <View style={styles.sourcesList}>
            {sources.map((source) => (
              <SourceCard
                key={source.id}
                source={source}
                bookId={book.id}
                sourceStats={sourceStats[source.id]}
                onTimerStart={(sourceId) => {
                  router.push(`/timer?bookId=${book.id}&sourceId=${sourceId || ''}&bookTitle=${encodeURIComponent(book.title)}`);
                }}
              />
            ))}
          </View>
        ) : (
          <View style={[styles.miniSkeleton, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}>
            <Ionicons name="folder-open-outline" size={24} color={t.ink.tertiary} style={{ marginBottom: spacing.sm }} />
            <Text style={[styles.miniSkeletonText, { color: t.ink.tertiary }]}>暂无阅读来源</Text>
            <Text style={[styles.miniSkeletonHint, { color: t.ink.tertiary }]}>点击右上角「+ 添加」开始记录阅读</Text>
          </View>
        )}

        {/* ===== 阅读数据 — 3 列统计卡片 ===== */}
        <View style={styles.sectionHeader}>
          <Ionicons name="stats-chart-outline" size={18} color={t.accent.primary} />
          <Text style={[styles.sectionTitle, { color: t.ink.primary }]}>阅读数据</Text>
        </View>
        <View style={[styles.statsCard, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}>
          <View style={styles.statsGrid3}>
            {/* 累计阅读时间 */}
            <View style={[styles.statItem3, { backgroundColor: t.paper.white }]}>
              <Text style={[styles.statValue3, { color: t.ink.primary }]}>
                {stats ? formatDuration(stats.totalMs) : '0h 0m'}
              </Text>
              <Text style={[styles.statLabel3, { color: t.ink.tertiary }]}>累计时长</Text>
            </View>
            {/* 阅读进度 */}
            <View style={[styles.statItem3, { backgroundColor: t.paper.white }]}>
              <Text style={[styles.statValue3, { color: t.ink.primary }]}>
                {readingProgress != null ? `${readingProgress}%` : '--'}
              </Text>
              <Text style={[styles.statLabel3, { color: t.ink.tertiary }]}>阅读进度</Text>
            </View>
            {/* 已读页数 */}
            <View style={[styles.statItem3, { backgroundColor: t.paper.white }]}>
              <Text style={[styles.statValue3, { color: t.ink.primary }]}>
                {pagesRead != null ? `${pagesRead} 页` : '--'}
              </Text>
              <Text style={[styles.statLabel3, { color: t.ink.tertiary }]}>已读页数</Text>
            </View>
            {/* 阅读笔记 */}
            <View style={[styles.statItem3, { backgroundColor: t.paper.white }]}>
              <Text style={[styles.statValue3, { color: t.ink.primary }]}>
                {annotationCount}
              </Text>
              <Text style={[styles.statLabel3, { color: t.ink.tertiary }]}>阅读笔记</Text>
            </View>
          </View>
        </View>

        <ReadingTabsView bookId={id!} />

        {/* 底部悬浮操作按钮 */}
        <View style={[styles.floatBtns, { borderTopColor: t.outline.standard }]}>
          <TouchableOpacity
            style={[styles.floatBtn, { borderColor: t.outline.standard, backgroundColor: t.paper.white }]}
            onPress={async () => {
              const shareText = `📖 ${book.title}\n${book.author ? `✍️ ${book.author}\n` : ''}📊 ${stats ? formatDuration(stats.totalMs) : '0m'} · ${annotationCount} 条笔记\n\n在 ReadFlow 中阅读`;
              try { await Share.share({ title: book.title, message: shareText }); } catch {}
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="share-outline" size={18} color={t.ink.secondary} />
            <Text style={[styles.floatBtnText, { color: t.ink.secondary }]}>分享</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.floatBtn, { borderColor: t.error.container, backgroundColor: t.error.container }]}
            onPress={() => {
              Alert.alert('重置数据', '将清空该书的所有阅读记录（包括计时、笔记、高亮），此操作不可撤销。', [
                { text: '取消', style: 'cancel' },
                { text: '确认重置', style: 'destructive', onPress: async () => {
                  try {
                    const db = await getDatabase();
                    await db.runAsync('DELETE FROM reading_sessions WHERE book_id = ?', [id]);
                    await db.runAsync('DELETE FROM manual_logs WHERE book_id = ?', [id]);
                    await db.runAsync('DELETE FROM notes WHERE book_id = ?', [id]);
                    await db.runAsync('DELETE FROM highlights WHERE book_id = ?', [id]);
                    await db.runAsync('UPDATE reading_sources SET current_page = 0 WHERE book_id = ?', [id]);
                    fetchBookData(id!);
                    fetchSources(id!);
                    fetchSourceStats(id!);
                    fetchNotes(id!);
                    fetchHighlights(id!);
                    Alert.alert('已重置', '该书的阅读记录已清空');
                  } catch (e) { Alert.alert('重置失败', '请重试'); }
                }},
              ]);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={18} color={t.accent.pink} />
            <Text style={[styles.floatBtnText, { color: t.accent.pink }]}>重置</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: isTimerForThisBook ? 80 : spacing.xxl }} />
      </ScrollView>

      {/* 弹窗组件 */}
      <TimerModal />
      <ManualLogSheet
        visible={manualLogVisible}
        bookId={book.id}
        onClose={() => setManualLogVisible(false)}
        onSaved={handleLogSaved}
      />
      <StopTimerSheet
        visible={stopSheet.visible}
        bookId={stopSheet.bookId}
        sourceId={stopSheet.sourceId}
        sessionId={stopSheet.sessionId}
        durationMs={stopSheet.durationMs}
        prefillPage={lastProgress.pageNumber}
        prefillChapter={lastProgress.chapter}
        onSave={handleStopSheetSave}
        onClose={dismissStopSheet}
      />
      <AddSourceSheet
        visible={addSourceVisible}
        bookId={book.id}
        onClose={() => setAddSourceVisible(false)}
        onAdded={(shouldStartTimer?: boolean) => {
          if (id) { fetchSources(id); fetchSourceStats(id); refreshStats(id); }
          if (shouldStartTimer && book) {
            startTimer(book.id, undefined, book.title);
          }
        }}
      />
    </View>
  );
}

// ============================================================
// 样式
// ============================================================

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: 56 + spacing.lg },

  // ===== 顶部导航栏 =====
  navBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    height: 56, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: 0,
    borderBottomWidth: 1,
  },
  navTitle: {
    flex: 1, textAlign: 'center',
    fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, fontWeight: '700',
    marginHorizontal: spacing.md,
  },

  // ===== 未找到状态 =====
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, fontWeight: '700', marginBottom: spacing.xs, marginTop: spacing.md },
  emptyHint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, marginBottom: spacing.xl },
  backButton: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radii.full },
  backButtonText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, fontWeight: '700' },

  // ===== Hero 区 =====
  heroSection: { alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.xl },
  coverWrapper: { marginBottom: spacing.lg },
  bookTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 30, fontWeight: '800', textAlign: 'center', lineHeight: 36, letterSpacing: -0.6, paddingHorizontal: spacing.sm },
  bookAuthor: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16, fontWeight: '600', textAlign: 'center', marginTop: spacing.sm },
  bookAuthorPlaceholder: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, textAlign: 'center', marginTop: spacing.sm, fontStyle: 'italic' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: spacing.sm },
  ratingLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, fontWeight: '700' },
  statusChipRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.full, borderWidth: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusChipText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, fontWeight: '700' },

  // ===== Hero 内置标签 =====
  heroTagsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, marginTop: spacing.lg, paddingHorizontal: spacing.xs },
  heroTagsLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, fontWeight: '600', marginRight: 2 },
  heroTagChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radii.full, borderWidth: 1 },
  heroTagAddChip: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 0 },
  tagInput: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, fontWeight: '600', minWidth: 60, padding: 0 },

  // ===== 区块标题 =====
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md, marginTop: spacing.xs },
  sectionTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, fontWeight: '800', flex: 1 },

  // ===== 3 列统计卡片 =====
  statsCard: { borderRadius: radii.lg, borderWidth: 1, padding: spacing.md, marginBottom: spacing.xl, ...softShadow },
  statsGrid3: { flexDirection: 'row', gap: spacing.sm },
  statItem3: { flex: 1, alignItems: 'center', borderRadius: radii.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xs },
  statValue3: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  statLabel3: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10, fontWeight: '500', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.3 },

  // ===== 底部悬浮操作按钮 =====
  floatBtns: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  floatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  floatBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
  },

  // ===== 简介卡片 =====
  descCard: { borderRadius: radii.lg, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.xl, ...softShadow },
  descText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, fontWeight: '400', lineHeight: 22.4 },
  expandButton: { marginTop: spacing.sm, alignSelf: 'flex-start' },
  expandButtonText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, fontWeight: '700' },

  // ===== 添加来源按钮 =====
  addSourceBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.full, borderWidth: 1 },
  addSourceBtnText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, fontWeight: '600' },

  // ===== 来源列表 =====
  sourcesList: { marginBottom: spacing.lg },

  // ===== 标注样式（ReadingTabsView 内部使用，保留以便兼容） =====
  noteCard: { borderRadius: radii.lg, borderWidth: 1, padding: spacing.lg, ...softShadow, overflow: 'hidden' },
  highlightColorBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: radii.lg, borderBottomLeftRadius: radii.lg },
  highlightNoteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, marginTop: spacing.sm, paddingLeft: spacing.xs },
  highlightNote: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, lineHeight: 19, flex: 1 },
  noteContent: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 21 },
  noteMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  noteMetaChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  noteMeta: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, fontWeight: '500' },
  noteFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1 },
  noteDate: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11 },
  noteActions: { flexDirection: 'row', gap: spacing.md },

  // ===== 时间线卡片 =====
  timelineCard: { borderRadius: radii.lg, borderWidth: 1, marginBottom: spacing.lg, ...softShadow },

  // ===== 标签/书单编辑按钮 =====
  editChipBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.full, borderWidth: 1 },
  editChipBtnText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, fontWeight: '600' },

  // ===== 标签显示 =====
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radii.full, borderWidth: 1 },
  tagDot: { width: 8, height: 8, borderRadius: 4 },
  collDot: { width: 8, height: 8, borderRadius: 4 },
  tagChipText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, fontWeight: '600' },

  // ===== 底部补录按钮 =====
  fabManualLog: { position: 'absolute', bottom: 24, left: 16, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radii.full, borderWidth: 1, ...softShadow, zIndex: 10 },
  fabManualLogText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, fontWeight: '700' },

  // ===== 轻量骨架 =====
  miniSkeleton: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg, paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, borderRadius: radii.md, borderWidth: 1 },
  miniSkeletonText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13 },
  miniSkeletonHint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11 },
  miniSkeletonLink: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, fontWeight: '700' },

  // ===== Hero 内置简介 =====
  heroDesc: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 22, marginTop: spacing.md, width: '88%', alignSelf: 'center', textAlign: 'center' },

  // ===== 标注类型标签 =====
  annotationTypeBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.full },
  annotationTypeText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, fontWeight: '700' },
});
