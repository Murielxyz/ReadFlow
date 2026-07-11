import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '../src/utils/navigation';
import { useBookStore } from '../src/stores/useBookStore';

/**
 * 导入文件数据缓存 — 绕过 URLSearchParams 对 blob URI 的编码问题。
 * ImportModal 在导航前写入，add-book 在保存时读取。
 *
 * 注意：使用 getter/setter 确保跨模块读取时的引用一致性。
 * 在开发阶段 Fast Refresh 可能导致缓存丢失，生产构建不受影响。
 */
let _importFileCache: { uri?: string; name?: string } = {};
export const importFileCache = {
  get uri() { return _importFileCache.uri; },
  set uri(v: string | undefined) { _importFileCache.uri = v; },
  get name() { return _importFileCache.name; },
  set name(v: string | undefined) { _importFileCache.name = v; },
};
import { useTagStore } from '../src/stores/useTagStore';
import { useCollectionStore } from '../src/stores/useCollectionStore';
import { useSourceStore } from '../src/stores/useSourceStore';
import { searchDescriptionCache } from './search';
import CollectionPicker from '../src/components/book/CollectionPicker';
import Rating from '../src/components/common/Rating';
import { radii, spacing } from '../src/theme';
import { softShadow } from '../src/theme/shadows';
import { useColors } from '../src/stores/useThemeStore';
import { BOOK_STATUS_OPTIONS } from '../src/utils/constants';
import type { BookStatus, Tag } from '../src/models';
import type { BookCategory } from '../src/models/book';
import { BOOK_CATEGORY_LABELS } from '../src/models/book';

/** 书籍类型芯片 */
type BookFormat = 'ebook' | 'physical' | 'audiobook';
const BOOK_FORMAT_OPTIONS: { label: string; value: BookFormat; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: '电子书', value: 'ebook', icon: 'tablet-portrait-outline' },
  { label: '纸质书', value: 'physical', icon: 'book-outline' },
  { label: '有声书', value: 'audiobook', icon: 'headset-outline' },
];

/**
 * 添加/编辑书本 — 温暖简约风格 (v3.0)
 * 支持 editBookId 参数进入编辑模式
 * 支持 prefill* 参数从搜索预填
 * 编辑模式新增：封面图片选择（本机）、出版社、标签、书单管理、评分、书籍类型
 */
export default function AddBookScreen() {
  const {
    editBookId,
    prefillTitle, prefillAuthor, prefillPublisher,
    prefillDescription, prefillCoverUrl, prefillIsbn, prefillRating, prefillPageCount,
    importFileName,
  } = useLocalSearchParams<{
    editBookId?: string;
    prefillTitle?: string;
    prefillAuthor?: string;
    prefillPublisher?: string;
    prefillDescription?: string;
    prefillCoverUrl?: string;
    prefillIsbn?: string;
    prefillRating?: string;
    prefillPageCount?: string;
    importFileName?: string;
  }>();
  // 导入文件的 URI 从模块缓存读取（绕过 URL 编码问题）
  const importFileUri = importFileCache.uri;

  const addBook = useBookStore((s) => s.addBook);
  const updateBook = useBookStore((s) => s.updateBook);
  const books = useBookStore((s) => s.books);
  const addSource = useSourceStore((s) => s.addSource);

  // 编辑模式 ID：导入时自动创建书籍后填入，或从 URL 参数获取
  const [autoCreatedBookId, setAutoCreatedBookId] = useState<string | null>(null);
  const actualEditBookId = autoCreatedBookId || editBookId || null;

  const isEditing = !!actualEditBookId;
  const isImport = !isEditing && !!importFileUri;
  const isPrefill = !isEditing && !isImport && !!prefillTitle;

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [publisher, setPublisher] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<BookStatus>('to_read');
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [chapter, setChapter] = useState('');
  const [pageCount, setPageCount] = useState('');
  const [isbn, setIsbn] = useState('');
  const [saving, setSaving] = useState(false);

  // v3.0 新增：评分 & 书籍类型
  const [rating, setRating] = useState<number | null>(null);
  const [bookFormat, setBookFormat] = useState<BookFormat | null>(null);

  // 标签
  const { bookTags, fetchBookTags, createTag, assignTag, removeTag } = useTagStore();
  const [tagInputVisible, setTagInputVisible] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  // 书单
  const { bookCollections, fetchBookCollections, addBookToCollection, removeBookFromCollection, fetchCollections } = useCollectionStore();
  const [collPickerVisible, setCollPickerVisible] = useState(false);

  const colors = useColors();

  // 导入模式：立即创建书籍 + 来源，进入编辑模式（标签 & 书单立即可用）
  const [importReady, setImportReady] = useState(false);
  useEffect(() => {
    if (!isImport || importReady || !importFileUri) return;
    let cancelled = false;
    (async () => {
      const titleFromName = importFileName?.replace(/\.(epub|pdf|mobi|txt|cbz|cbr)$/i, '') || '未命名书籍';
      const sourceType = importFileName?.toLowerCase().endsWith('.pdf') ? 'pdf' as const : 'epub' as const;
      try {
        // 创建书籍（使用从文件名提取的标题）
        const created = await addBook({
          title: prefillTitle || titleFromName,
          author: prefillAuthor || undefined,
          publisher: prefillPublisher || undefined,
          description: prefillDescription || undefined,
          status: 'to_read',
          cover_url: prefillCoverUrl || undefined,
        });
        // 创建阅读来源
        await addSource(created.id, sourceType, prefillTitle || titleFromName, importFileUri, importFileName || undefined);
        // 清除缓存
        importFileCache.uri = undefined;
importFileCache.name = undefined;
        if (!cancelled) {
          setAutoCreatedBookId(created.id);
          setImportReady(true);
        }
      } catch (e) {
        console.warn('Auto-create book for import failed:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [isImport, importReady, importFileUri]);

  // 搜索预填模式：立即创建书籍，直接进入编辑模式（标签 & 书单立即可用）
  const [prefillReady, setPrefillReady] = useState(false);
  useEffect(() => {
    if (!isPrefill || prefillReady || !prefillTitle) return;
    let cancelled = false;
    (async () => {
      try {
        const created = await addBook({
          title: prefillTitle || '未命名书籍',
          author: prefillAuthor || undefined,
          publisher: prefillPublisher || undefined,
          description: searchDescriptionCache.text || undefined,
          page_count: prefillPageCount ? parseInt(prefillPageCount, 10) || undefined : undefined,
          status: 'to_read',
          cover_url: prefillCoverUrl || undefined,
          isbn: prefillIsbn || undefined,
        });
        // 清除缓存
        delete searchDescriptionCache.text;
        if (!cancelled) {
          setAutoCreatedBookId(created.id);
          setPrefillReady(true);
        }
      } catch (e) {
        console.warn('Auto-create book for prefill failed:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [isPrefill, prefillReady, prefillTitle]);

  // 预填元数据（编辑模式 / 搜索预填 / 导入预填）
  useEffect(() => {
    if (isEditing && actualEditBookId) {
      const book = books.find((b) => b.id === actualEditBookId);
      if (book) {
        setTitle(book.title);
        setAuthor(book.author ?? '');
        setPublisher(book.publisher ?? '');
        setDescription(book.description ?? '');
        setStatus(book.status);
        setCoverUri(book.cover_url ?? null);
        setRating(book.rating ?? null);
        setChapter('');
        setPageCount(book.page_count != null ? String(book.page_count) : '');
        if (book.category === 'audiobook') setBookFormat('audiobook');
        else if (book.isbn) setBookFormat('ebook');
        else if (actualEditBookId === autoCreatedBookId) setBookFormat('ebook'); // 导入的本地电子书
        else setBookFormat('physical');
        fetchBookTags(actualEditBookId);
        fetchBookCollections(actualEditBookId);
      }
    } else if (isPrefill || isImport) {
      setTitle(prefillTitle ?? '');
      setAuthor(prefillAuthor ?? '');
      setPublisher(prefillPublisher ?? '');
      setDescription(prefillDescription ?? '');
      setCoverUri(prefillCoverUrl ?? null);
      setRating(prefillRating ? Number(prefillRating) : null);
      // 回填 ISBN（从搜索页传入）
      if (prefillIsbn) setIsbn(prefillIsbn);
      setBookFormat('ebook');
    }
  }, [isEditing, actualEditBookId, isPrefill, isImport, prefillTitle, prefillAuthor, prefillPublisher, prefillDescription, prefillCoverUrl, prefillIsbn, prefillRating, books]);

  const canSave = title.trim().length > 0;

  // ---- 封面选择 ----
  const handlePickCover = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('需要权限', '请在设置中允许访问相册');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [2, 3],
      quality: 0.8,
    });
    if (!result.canceled) {
      setCoverUri(result.assets[0].uri);
    }
  }, []);

  // ---- 保存 ----
  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const pageNum = parseInt(pageCount, 10);
      const bookData: any = {
        title: title.trim(),
        author: author.trim() || undefined,
        publisher: publisher.trim() || undefined,
        description: description.trim() || undefined,
        status,
        cover_url: coverUri || undefined,
        isbn: isbn.trim() || undefined,
        page_count: isNaN(pageNum) ? undefined : pageNum,
        rating: rating ?? undefined,
        category: bookFormat === 'audiobook' ? 'audiobook' as BookCategory : undefined,
      };

      if (isEditing && actualEditBookId) {
        await updateBook(actualEditBookId, bookData);
        safeGoBack();
      } else if (isPrefill || isImport) {
        // 搜索预填 / 导入：创建后留在编辑模式（标签和书单立即可用）
        const created = await addBook(bookData);
        importFileCache.uri = undefined;
        importFileCache.name = undefined;
        setAutoCreatedBookId(created.id);
      } else {
        // 手动添加：创建后直接进入书籍详情页
        const created = await addBook(bookData);
        importFileCache.uri = undefined;
        importFileCache.name = undefined;
        router.replace(`/book/${created.id}`);
      }
    } catch (e) {
      Alert.alert('错误', '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  }

  // ---- 标签操作 ----
  const handleCreateTag = useCallback(async () => {
    // 先保存当前值，防止 onBlur 先触发清空
    const name = newTagName.trim();
    if (!name || !actualEditBookId) return;
    setNewTagName('');
    setTagInputVisible(false);
    const tag = await createTag(name);
    await assignTag(actualEditBookId, tag.id);
  }, [newTagName, actualEditBookId, createTag, assignTag]);

  const handleRemoveTag = useCallback(
    (tagId: string) => {
      if (!actualEditBookId) return;
      removeTag(actualEditBookId, tagId);
    },
    [actualEditBookId, removeTag],
  );

  // ---- 书单操作 ----
  const handleAddToCollection = useCallback(
    async (collectionId: string) => {
      if (!actualEditBookId) return;
      await addBookToCollection(actualEditBookId, collectionId);
      fetchBookCollections(actualEditBookId);
      fetchCollections(); // 同步书架书单 Tab
    },
    [actualEditBookId, addBookToCollection, fetchBookCollections, fetchCollections],
  );

  const handleRemoveFromCollection = useCallback(
    async (collectionId: string) => {
      if (!actualEditBookId) return;
      await removeBookFromCollection(actualEditBookId, collectionId);
      fetchBookCollections(actualEditBookId);
      fetchCollections(); // 同步书架书单 Tab
    },
    [actualEditBookId, removeBookFromCollection, fetchBookCollections, fetchCollections],
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.paper.primary }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* ===== 顶部导航栏 ===== */}
      <View style={[styles.navBar, { borderBottomColor: colors.outline.standard }]}>
        <TouchableOpacity onPress={() => safeGoBack()} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.navBack, { color: colors.ink.primary }]}>❮ 返回</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.ink.primary }]}>
          {isEditing ? '编辑书籍' : '书籍信息'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ===== 封面图片选择（小缩略图） ===== */}
      <Text style={[styles.label, { color: colors.ink.primary }]}>封面图片</Text>
      <TouchableOpacity
        style={[styles.coverPicker, { backgroundColor: colors.paper.white, borderColor: colors.outline.standard }]}
        onPress={handlePickCover}
        activeOpacity={0.7}
      >
        {coverUri ? (
          <Image source={{ uri: coverUri }} style={styles.coverPreview} resizeMode="cover" />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="camera-outline" size={24} color={colors.ink.tertiary} />
            <Text style={[styles.coverPlaceholderText, { color: colors.ink.tertiary }]}>点击选择</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* 书名 */}
      <Text style={[styles.label, { color: colors.ink.primary }]}>书名 *</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.paper.white, borderColor: colors.outline.standard, color: colors.ink.primary }]}
        placeholder="输入书名..."
        placeholderTextColor={colors.ink.tertiary}
        value={title}
        onChangeText={setTitle}
        autoFocus={!isEditing}
      />

      {/* 作者 */}
      <Text style={[styles.label, { color: colors.ink.primary }]}>作者</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.paper.white, borderColor: colors.outline.standard, color: colors.ink.primary }]}
        placeholder="输入作者..."
        placeholderTextColor={colors.ink.tertiary}
        value={author}
        onChangeText={setAuthor}
      />

      {/* 出版社 · ISBN 并排 */}
      <View style={styles.inlineRow}>
        <View style={styles.inlineField}>
          <Text style={[styles.label, { color: colors.ink.primary }]}>出版社</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.paper.white, borderColor: colors.outline.standard, color: colors.ink.primary }]}
            placeholder="出版社（可选）..."
            placeholderTextColor={colors.ink.tertiary}
            value={publisher}
            onChangeText={setPublisher}
          />
        </View>
        <View style={styles.inlineField}>
          <Text style={[styles.label, { color: colors.ink.primary }]}>ISBN</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.paper.white, borderColor: colors.outline.standard, color: colors.ink.primary }]}
            placeholder="ISBN（可选）..."
            placeholderTextColor={colors.ink.tertiary}
            value={isbn}
            onChangeText={setIsbn}
            keyboardType="number-pad"
          />
        </View>
      </View>

      {/* 简介 */}
      <Text style={[styles.label, { color: colors.ink.primary }]}>简介</Text>
      <TextInput
        style={[styles.input, styles.textArea, { backgroundColor: colors.paper.white, borderColor: colors.outline.standard, color: colors.ink.primary }]}
        placeholder="简单介绍一下这本书..."
        placeholderTextColor={colors.ink.tertiary}
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      {/* 章节 · 页数 并排 */}
      <View style={styles.inlineRow}>
        <View style={styles.inlineField}>
          <Text style={[styles.label, { color: colors.ink.primary }]}>章节</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.paper.white, borderColor: colors.outline.standard, color: colors.ink.primary }]}
            placeholder="例如：共12章"
            placeholderTextColor={colors.ink.tertiary}
            value={chapter}
            onChangeText={setChapter}
          />
        </View>
        <View style={styles.inlineField}>
          <Text style={[styles.label, { color: colors.ink.primary }]}>页数</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.paper.white, borderColor: colors.outline.standard, color: colors.ink.primary }]}
            placeholder="总页数..."
            placeholderTextColor={colors.ink.tertiary}
            value={pageCount}
            onChangeText={setPageCount}
            keyboardType="number-pad"
          />
        </View>
      </View>

      {/* 阅读状态 */}
      <Text style={[styles.label, { color: colors.ink.primary }]}>阅读状态</Text>
      <View style={styles.statusRow}>
        {BOOK_STATUS_OPTIONS.map((opt) => {
          const active = status === opt.value;
          const statusColor =
            opt.value === 'reading' ? colors.status.reading :
            opt.value === 'finished' ? colors.status.finished :
            colors.status.toRead;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.statusChip, {
                backgroundColor: active ? statusColor : colors.paper.white,
                borderColor: active ? statusColor : colors.outline.standard,
              }]}
              onPress={() => setStatus(opt.value)}
              activeOpacity={0.8}
            >
              <Text style={[styles.statusLabel, { color: active ? '#FFFFFF' : colors.ink.secondary }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 评分 */}
      <Text style={[styles.label, { color: colors.ink.primary, marginTop: spacing.lg }]}>评分</Text>
      <View style={styles.ratingRow}>
        <Rating value={rating} onChange={setRating} size="lg" />
        {rating !== null && (
          <TouchableOpacity onPress={() => setRating(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.clearRating, { color: colors.ink.tertiary }]}>清除</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 书籍类型 */}
      <Text style={[styles.label, { color: colors.ink.primary, marginTop: spacing.lg }]}>书籍类型</Text>
      <View style={styles.statusRow}>
        {BOOK_FORMAT_OPTIONS.map((opt) => {
          const active = bookFormat === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.statusChip, {
                backgroundColor: active ? colors.accent.purple : colors.paper.white,
                borderColor: active ? colors.accent.purple : colors.outline.standard,
              }]}
              onPress={() => setBookFormat(active ? null : opt.value)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={opt.icon}
                size={14}
                color={active ? '#FFFFFF' : colors.ink.secondary}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.statusLabel, { color: active ? '#FFFFFF' : colors.ink.secondary }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ===== 标签管理（仅编辑模式） ===== */}
      {isEditing && (
        <>
          <Text style={[styles.label, { color: colors.ink.primary, marginTop: spacing.lg }]}>标签</Text>
          <View style={styles.chipRow}>
            {bookTags.map((tag) => (
              <View key={tag.id} style={[styles.chip, { borderColor: colors.outline.standard, backgroundColor: colors.paper.white }]}>
                {tag.color && <View style={[styles.tagDot, { backgroundColor: tag.color }]} />}
                <Text style={[styles.chipText, { color: colors.ink.primary }]}>{tag.name}</Text>
                <TouchableOpacity onPress={() => handleRemoveTag(tag.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Ionicons name="close" size={12} color={colors.ink.tertiary} />
                </TouchableOpacity>
              </View>
            ))}
            {tagInputVisible ? (
              <View style={[styles.chip, { borderColor: colors.accent.purple, backgroundColor: colors.paper.white }]}>
                <TextInput
                  style={[styles.tagInput, { color: colors.ink.primary }]}
                  value={newTagName}
                  onChangeText={setNewTagName}
                  placeholder="标签名"
                  placeholderTextColor={colors.ink.tertiary}
                  maxLength={20}
                  autoFocus
                  onSubmitEditing={handleCreateTag}
                  onBlur={() => setTagInputVisible(false)}
                />
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.chip, styles.chipAdd, { borderColor: colors.outline.standard, backgroundColor: colors.paper.white }]}
                onPress={() => setTagInputVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={14} color={colors.ink.secondary} />
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      {/* ===== 书单管理（仅编辑模式） ===== */}
      {isEditing && (
        <>
          <Text style={[styles.label, { color: colors.ink.primary, marginTop: spacing.lg }]}>所属书单</Text>
          <View style={styles.chipRow}>
            {bookCollections.map((coll) => (
              <View key={coll.id} style={[styles.chip, { borderColor: colors.outline.standard, backgroundColor: colors.paper.white }]}>
                <View style={[styles.collDot, { backgroundColor: colors.accent.purple }]} />
                <Text style={[styles.chipText, { color: colors.ink.primary }]}>{coll.name}</Text>
                <TouchableOpacity onPress={() => handleRemoveFromCollection(coll.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Ionicons name="close" size={12} color={colors.ink.tertiary} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.chip, styles.chipAdd, { borderColor: colors.outline.standard, backgroundColor: colors.paper.white }]}
              onPress={() => setCollPickerVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={14} color={colors.ink.secondary} />
              <Text style={[styles.chipAddText, { color: colors.ink.secondary }]}>加入书单</Text>
            </TouchableOpacity>
          </View>

          <CollectionPicker
            visible={collPickerVisible}
            bookId={actualEditBookId!}
            onClose={() => {
              setCollPickerVisible(false);
              fetchBookCollections(actualEditBookId!);
              fetchCollections();
            }}
          />
        </>
      )}

      {/* 保存按钮（新建模式也显示） */}
      <TouchableOpacity
        style={[styles.saveButton, { backgroundColor: colors.ink.primary }, !canSave && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={!canSave || saving}
        activeOpacity={0.8}
      >
        <Text style={[styles.saveButtonText, { color: colors.ink.inverse }]}>
          {saving ? '保存中...' : isEditing ? '保存修改' : '创建书籍'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.xl, paddingTop: 56 + spacing.xl, paddingBottom: spacing.xxxl },

  // ---- 导航栏 ----
  navBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    height: 56,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
  },
  navBack: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, fontWeight: '600' },
  navTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, fontWeight: '700' },
  navSave: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, fontWeight: '700' },

  label: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, fontWeight: '700', marginBottom: spacing.sm, marginTop: spacing.lg },
  input: { borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15 },
  textArea: { minHeight: 100, paddingTop: spacing.md },

  // ---- 封面（小缩略图） ----
  coverPicker: { width: 80, height: 110, borderRadius: radii.md, borderWidth: 1, overflow: 'hidden', marginBottom: spacing.sm },
  coverPreview: { width: 80, height: 110 },
  coverPlaceholder: { width: 80, height: 110, alignItems: 'center', justifyContent: 'center', gap: 4 },
  coverPlaceholderText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10, textAlign: 'center' },

  // ---- 并排布局 ----
  inlineRow: { flexDirection: 'row', gap: spacing.md },
  inlineField: { flex: 1 },

  // ---- 状态 ----
  statusRow: { flexDirection: 'row', gap: spacing.md },
  statusChip: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderRadius: radii.full, borderWidth: 1, flexDirection: 'row', justifyContent: 'center' },
  statusLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, fontWeight: '700' },

  // ---- 评分 ----
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  clearRating: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, fontWeight: '600' },

  // ---- 标签 / 书单 chips ----
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.full, borderWidth: 1 },
  chipAdd: { borderStyle: 'dashed' },
  chipText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, fontWeight: '600' },
  chipAddText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, fontWeight: '600' },
  tagInput: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, fontWeight: '600', minWidth: 60, padding: 0 },
  tagDot: { width: 8, height: 8, borderRadius: 4 },
  collDot: { width: 8, height: 8, borderRadius: 4 },

  // ---- 保存按钮 ----
  saveButton: { marginTop: spacing.xxl, height: 52, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center', ...softShadow },
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, fontWeight: '700' },
});
