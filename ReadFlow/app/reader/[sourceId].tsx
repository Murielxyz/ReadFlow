import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '../../src/utils/navigation';
import { getDatabase } from '../../src/db/database';
import { useReadingStore } from '../../src/stores/useReadingStore';
import { useHighlightStore } from '../../src/stores/useHighlightStore';
import { useNoteStore } from '../../src/stores/useNoteStore';
import { MobileDocumentEngine } from '@papyrus-sdk/engine-native';
import { Viewer } from '@papyrus-sdk/ui-react-native';
import { papyrusEvents } from '@papyrus-sdk/core';
import { PapyrusEventType } from '@papyrus-sdk/types';
import type { DocumentType, Annotation } from '@papyrus-sdk/types';
import type { ReadingSource } from '../../src/models';
import { spacing } from '../../src/theme';
import { useColors } from '../../src/stores/useThemeStore';

/** 根据文件名推断文档类型 */
function detectDocumentType(fileName?: string | null): DocumentType {
  if (!fileName) return 'epub';
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':  return 'pdf';
    case 'txt':  return 'text';
    case 'epub':
    default:     return 'epub';
  }
}

/**
 * 阅读器 — Papyrus SDK 驱动
 *
 * - 自动识别 EPUB / PDF / TXT 格式
 * - Viewer 内置字体大小、主题、翻页、目录、搜索、标注
 * - PAGE_CHANGED 事件实时更新 reading_sources.current_page
 * - 退出时 >10s 自动记录阅读时长
 */
export default function ReaderScreen() {
  const { sourceId } = useLocalSearchParams<{ sourceId: string }>();
  const t = useColors();
  const addManualLog = useReadingStore((s) => s.addManualLog);
  const addHighlight = useHighlightStore((s) => s.addHighlight);
  const updateHighlight = useHighlightStore((s) => s.updateHighlight);
  const deleteHighlight = useHighlightStore((s) => s.deleteHighlight);
  const addNote = useNoteStore((s) => s.addNote);

  // Papyrus annotation ID → ReadFlow DB ID 映射（用于更新/删除）
  const annotationMap = useRef(new Map<string, { dbId: string; type: 'highlight' | 'note' }>());

  const [source, setSource] = useState<ReadingSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);

  const engineRef = useRef<MobileDocumentEngine | null>(null);
  const startTimeRef = useRef(Date.now());

  // 加载来源数据 & 初始化 engine
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await getDatabase();
        const row = await db.getFirstAsync<ReadingSource>(
          'SELECT * FROM reading_sources WHERE id = ?',
          [sourceId],
        );
        if (cancelled) return;
        if (!row) {
          setError('未找到阅读来源');
          setLoading(false);
          return;
        }
        if (!row.file_uri) {
          setError('该来源没有关联的文件');
          setLoading(false);
          return;
        }
        setSource(row);

        // 创建 engine 并加载文档
        const docType = detectDocumentType(row.file_name);
        const engine = new MobileDocumentEngine();
        engineRef.current = engine;
        await engine.load({ type: docType, source: { uri: row.file_uri } });
        setPageCount(engine.getPageCount());

        if (!cancelled) setLoading(false);
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || '加载失败');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [sourceId]);

  // 监听 PAGE_CHANGED → 实时更新进度
  useEffect(() => {
    if (!source) return;
    const unsub = papyrusEvents.on(PapyrusEventType.PAGE_CHANGED, (payload) => {
      const pct = pageCount > 0 ? Math.round((payload.pageNumber / pageCount) * 100) : 0;
      getDatabase().then((db) =>
        db.runAsync(
          'UPDATE reading_sources SET current_page = ? WHERE id = ?',
          [pct, source.id],
        ).catch((e) => console.warn('Reader progress save failed:', e)),
      );
    });
    return unsub;
  }, [pageCount, source?.id]);

  // 监听 ANNOTATION_CREATED → 同步到 ReadFlow DB（高亮/笔记）
  useEffect(() => {
    if (!source) return;
    const bookId = source.book_id;

    const subCreated = papyrusEvents.on(PapyrusEventType.ANNOTATION_CREATED, async (payload: { annotation: Annotation }) => {
      const a = payload.annotation;
      try {
        // 高亮/下划线/波浪线 → 存为 highlight
        if (a.type === 'highlight' || a.type === 'underline' || a.type === 'squiggly') {
          const hl = await addHighlight({
            book_id: bookId,
            content: a.content || '',
            color: a.type === 'highlight' ? '#F5A623' : a.type === 'underline' ? '#4A90D9' : '#50C878',
            page_number: a.pageIndex + 1,
          });
          annotationMap.current.set(a.id, { dbId: hl.id, type: 'highlight' });
        }
        // 文字/评论 → 存为 note
        else if (a.type === 'text' || a.type === 'comment') {
          const note = await addNote({
            book_id: bookId,
            content: a.content || '',
            page_number: a.pageIndex + 1,
          });
          annotationMap.current.set(a.id, { dbId: note.id, type: 'note' });
        }
      } catch (e) { console.warn('Annotation sync error:', e); }
    });

    const subUpdated = papyrusEvents.on(PapyrusEventType.ANNOTATION_UPDATED, async (payload: { annotation: Annotation }) => {
      const a = payload.annotation;
      const mapped = annotationMap.current.get(a.id);
      if (!mapped) return;
      try {
        if (mapped.type === 'highlight') {
          await updateHighlight(mapped.dbId, {
            content: a.content || undefined,
            page_number: a.pageIndex + 1,
          });
        }
      } catch (e) { console.warn('Annotation update error:', e); }
    });

    const subDeleted = papyrusEvents.on(PapyrusEventType.ANNOTATION_DELETED, async (payload: { annotationId: string }) => {
      const mapped = annotationMap.current.get(payload.annotationId);
      if (!mapped) return;
      try {
        if (mapped.type === 'highlight') {
          await deleteHighlight(mapped.dbId);
        }
        annotationMap.current.delete(payload.annotationId);
      } catch (e) { console.warn('Annotation delete error:', e); }
    });

    return () => { subCreated(); subUpdated(); subDeleted(); };
  }, [source?.book_id, addHighlight, updateHighlight, deleteHighlight, addNote]);

  // 退出 → 记录时长（关联到阅读来源 + 当前进度页）
  const handleExit = useCallback(() => {
    const totalMs = Date.now() - startTimeRef.current;
    if (totalMs >= 10000 && source) {
      const currentPage = pageCount > 0 ? Math.round((source.current_page / 100) * pageCount) : undefined;
      addManualLog(
        source.book_id, totalMs, undefined, source.label,
        currentPage, undefined, false, source.id,
      ).catch((e) => console.warn('Reader reading log save failed:', e));
    }
    safeGoBack();
  }, [source, addManualLog, pageCount]);

  // ===== 加载中 =====
  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: t.paper.primary }]}>
        <ActivityIndicator size="large" color={t.accent.primary} />
        <Text style={[styles.statusText, { color: t.ink.tertiary }]}>加载中...</Text>
      </View>
    );
  }

  // ===== 错误 =====
  if (error || !source || !engineRef.current) {
    return (
      <View style={[styles.centered, { backgroundColor: t.paper.primary }]}>
        <Text style={styles.errorIcon}>📖</Text>
        <Text style={[styles.errorText, { color: t.ink.primary }]}>{error || '来源不存在'}</Text>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: t.ink.primary }]}
          onPress={() => safeGoBack()}
          activeOpacity={0.8}
        >
          <Text style={[styles.backBtnText, { color: t.ink.inverse }]}>返回</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ===== 阅读器 =====
  return (
    <View style={[styles.root, { backgroundColor: t.paper.primary }]}>
      {/* 顶部返回栏 */}
      <View style={[styles.topBar, { backgroundColor: t.paper.primary, borderBottomColor: t.outline.standard }]}>
        <TouchableOpacity onPress={handleExit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.backText, { color: t.accent.primary }]}>← 返回</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: t.ink.primary }]} numberOfLines={1}>
          {source.label}
        </Text>
        <View style={{ width: 48 }} />
      </View>

      {/* Papyrus Viewer */}
      <View style={styles.viewerContainer}>
        <Viewer engine={engineRef.current} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  viewerContainer: { flex: 1 },

  // 顶部栏
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    fontWeight: '600',
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },

  // 状态页面
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  statusText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    marginTop: spacing.md,
  },
  errorIcon: { fontSize: 56, marginBottom: spacing.md },
  errorText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  backBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 50,
  },
  backBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    fontWeight: '700',
  },
});
