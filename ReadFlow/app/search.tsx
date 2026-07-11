import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { safeGoBack } from '../src/utils/navigation';
import { spacing, radii } from '../src/theme';
import { softShadow } from '../src/theme/shadows';
import { searchBooks, type SearchResult } from '../src/services/searchBooks';
import { useColors } from '../src/stores/useThemeStore';

/** 搜索简介缓存（避免长文本 URL 参数损坏） */
export const searchDescriptionCache: { text?: string } = {};

/**
 * 独立搜索页面 — 搜索在线书籍 (v3.1)
 *
 * - 搜索输入框（自动聚焦）
 * - 搜索结果列表（缩略封面 + 书名 + 作者 + 年份）
 * - 始终显示"手动添加"入口
 */
export default function SearchScreen() {
  const t = useColors();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const doSearch = useCallback(async (q: string) => {
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      setHasSearched(false);
      setSearchError(null);
      return;
    }
    setSearching(true);
    setHasSearched(true);
    setSearchError(null);
    try {
      const data = await searchBooks(q.trim());
      setResults(data);
    } catch (e) {
      console.warn('Search error:', e);
      setResults([]);
      setSearchError('搜索服务暂不可用，请检查网络后重试');
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSelect = useCallback((result: SearchResult) => {
    const params = new URLSearchParams();
    params.set('prefillTitle', result.title);
    if (result.author) params.set('prefillAuthor', result.author);
    if (result.coverUrl) params.set('prefillCoverUrl', result.coverUrl);
    if (result.isbn) params.set('prefillIsbn', result.isbn);
    if (result.publisher) params.set('prefillPublisher', result.publisher);
    if (result.pageCount) params.set('prefillPageCount', String(result.pageCount));
    // 简介通过缓存传递（避免长文本导致 URL 参数损坏）
    if (result.description) {
      try { searchDescriptionCache.text = result.description; } catch {}
    }
    router.replace(`/add-book?${params.toString()}`);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: t.paper.primary }]}>
      {/* ===== 顶部导航栏 ===== */}
      <View style={[styles.navBar, { borderBottomColor: t.outline.standard }]}>
        <TouchableOpacity onPress={() => safeGoBack()} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={t.ink.primary} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: t.ink.primary }]}>搜索书籍</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* ===== 搜索输入框 ===== */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}>
          <Ionicons name="search" size={18} color={t.ink.tertiary} />
          <TextInput
            style={[styles.searchInput, { color: t.ink.primary }]}
            placeholder="搜索书名、作者或 ISBN..."
            placeholderTextColor={t.ink.tertiary}
            value={query}
            onChangeText={doSearch}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => doSearch('')}>
              <Ionicons name="close-circle" size={18} color={t.ink.tertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ===== 搜索结果 / 状态 ===== */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {searching ? (
          <View style={styles.centerStage}>
            <ActivityIndicator size="large" color={t.accent.primary} />
            <Text style={[styles.stageText, { color: t.ink.tertiary }]}>搜索中...</Text>
          </View>
        ) : hasSearched && results.length > 0 ? (
          <>
            <Text style={[styles.resultCount, { color: t.ink.secondary }]}>
              搜索结果 ({results.length})
            </Text>
            {results.map((result) => (
              <TouchableOpacity
                key={result.key}
                style={[styles.resultItem, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}
                activeOpacity={0.7}
                onPress={() => handleSelect(result)}
              >
                {/* 缩略封面 */}
                {result.coverUrl ? (
                  <Image source={{ uri: result.coverUrl }} style={styles.cover} resizeMode="cover" />
                ) : (
                  <View style={[styles.cover, styles.coverPlaceholder, { backgroundColor: t.paper.container }]}>
                    <Ionicons name="book-outline" size={20} color={t.ink.tertiary} />
                  </View>
                )}
                <View style={styles.resultInfo}>
                  <Text style={[styles.resultTitle, { color: t.ink.primary }]} numberOfLines={2}>
                    {result.title}
                  </Text>
                  <Text style={[styles.resultAuthor, { color: t.ink.tertiary }]} numberOfLines={1}>
                    {result.author ?? '未知作者'}
                    {result.publishYear ? ` (${result.publishYear})` : ''}
                  </Text>
                  {result.publisher && (
                    <Text style={[styles.resultPublisher, { color: t.ink.tertiary }]} numberOfLines={1}>
                      {result.publisher}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={t.ink.tertiary} />
              </TouchableOpacity>
            ))}
          </>
        ) : hasSearched && query.trim() ? (
          <View style={styles.centerStage}>
            <Ionicons name={searchError ? 'cloud-offline-outline' : 'search-outline'} size={48} color={t.ink.tertiary} />
            <Text style={[styles.emptyTitle, { color: t.ink.primary }]}>
              {searchError ? '搜索失败' : '未找到匹配的书籍'}
            </Text>
            <Text style={[styles.emptyHint, { color: t.ink.tertiary }]}>
              {searchError || '试试不同的关键词，或手动添加'}
            </Text>
          </View>
        ) : null}

        {/* 始终显示手动添加入口 */}
        <TouchableOpacity
          style={[styles.manualEntry, { borderColor: t.outline.standard }]}
          onPress={() => router.replace('/add-book')}
          activeOpacity={0.7}
        >
          <Ionicons name="create-outline" size={16} color={t.accent.primary} />
          <Text style={[styles.manualEntryText, { color: t.accent.primary }]}>
            没有找到？手动添加
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },

  // ---- 导航栏 ----
  navBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 50 : 8,
    borderBottomWidth: 1,
  },
  navTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    fontWeight: '700',
  },

  // ---- 搜索框 ----
  searchContainer: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.full,
    paddingHorizontal: spacing.lg,
    height: 48,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
  },

  // ---- 状态 ----
  centerStage: { alignItems: 'center', paddingVertical: spacing.xxxl },
  stageText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, marginTop: spacing.md },
  emptyTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, fontWeight: '700', marginTop: spacing.md },
  emptyHint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, marginTop: spacing.xs },

  // ---- 结果 ----
  resultCount: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, fontWeight: '600', marginBottom: spacing.sm },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
    gap: spacing.md,
    ...softShadow,
  },
  cover: { width: 44, height: 60, borderRadius: radii.sm },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  resultInfo: { flex: 1 },
  resultTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, fontWeight: '700' },
  resultAuthor: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, marginTop: 2 },
  resultPublisher: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, marginTop: 1 },

  // ---- 手动添加入口 ----
  manualEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    marginTop: spacing.md,
  },
  manualEntryText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    fontWeight: '700',
  },
});
