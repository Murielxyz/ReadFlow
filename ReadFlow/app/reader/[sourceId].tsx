import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '../../src/utils/navigation';
import { getDatabase } from '../../src/db/database';
import { useReadingStore } from '../../src/stores/useReadingStore';
import { getEpubReaderHTML } from '../../src/services/readerHTML';
import type { ReadingSource } from '../../src/models';
import { spacing } from '../../src/theme';
import { useColors } from '../../src/stores/useThemeStore';

const FileSystemLegacy = require('expo-file-system/legacy');

/**
 * 阅读器 — WebView + epub.js 驱动
 *
 * - EPUB: 读取文件 base64 → 注入 HTML(epub.js CDN) → WebView 渲染
 * - PDF: WebView 直接加载 file:// URI（iOS 原生渲染 / Android PDF.js）
 * - 纸质/外部平台: 占位页面
 * - postMessage 双向通信：进度 / 高亮 / 目录
 */
export default function ReaderScreen() {
  const { sourceId } = useLocalSearchParams<{ sourceId: string }>();
  const t = useColors();
  const addManualLog = useReadingStore((s) => s.addManualLog);

  const [source, setSource] = useState<ReadingSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [isEpub, setIsEpub] = useState(false);
  const [isPdf, setIsPdf] = useState(false);

  const startTimeRef = useRef(Date.now());
  const webViewRef = useRef<any>(null);
  const fontSizeRef = useRef(100);
  const themeRef = useRef<'light' | 'sepia' | 'dark'>('light');

  // 加载来源 & 准备 HTML
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await getDatabase();
        const row = await db.getFirstAsync<ReadingSource>(
          'SELECT * FROM reading_sources WHERE id = ?', [sourceId],
        );
        if (cancelled) return;
        if (!row) { setError('未找到阅读来源'); setLoading(false); return; }
        if (!row.file_uri) { setError('该来源没有关联的文件'); setLoading(false); return; }
        setSource(row);

        const ext = (row.file_name || '').split('.').pop()?.toLowerCase();

        if (ext === 'pdf') {
          setIsPdf(true);
        } else {
          // EPUB / MOBI / TXT → 读取为 base64 → Data URI
          setIsEpub(true);
          const base64 = await FileSystemLegacy.readAsStringAsync(row.file_uri, {
            encoding: FileSystemLegacy.EncodingType.Base64,
          });
          const dataUri = `data:application/epub+zip;base64,${base64}`;
          const html = getEpubReaderHTML(dataUri);
          if (!cancelled) setHtmlContent(html);
        }

        if (!cancelled) setLoading(false);
      } catch (e: any) {
        if (!cancelled) { setError(e.message || '加载失败'); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [sourceId]);

  // WebView 消息处理
  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'location' && source) {
        // 实时更新进度
        const pct = Math.round((data.percentage || 0) * 100);
        getDatabase().then(db =>
          db.runAsync('UPDATE reading_sources SET current_page = ? WHERE id = ?', [pct, source.id])
        );
      } else if (data.type === 'highlight' && source) {
        // 文字选中 → 暂存到全局（由书籍详情页接收）
        (globalThis as any).__pendingHighlight = {
          bookId: source.book_id,
          content: data.content,
          chapter: data.chapter || '',
        };
      }
    } catch {}
  }, [source]);

  // 退出 → 记录时长
  const handleExit = useCallback(() => {
    const totalMs = Date.now() - startTimeRef.current;
    if (totalMs >= 10000 && source) {
      addManualLog(
        source.book_id, totalMs, undefined, source.label,
        undefined, undefined, false, source.id,
      ).catch((e: any) => console.warn('Reader log save failed:', e));
    }
    safeGoBack();
  }, [source, addManualLog]);

  // 字体缩放
  const handleFontSize = useCallback((delta: number) => {
    fontSizeRef.current = Math.max(80, Math.min(200, fontSizeRef.current + delta));
    webViewRef.current?.injectJavaScript(`readerSetFontSize(${fontSizeRef.current});true;`);
  }, []);

  // 主题切换
  const handleTheme = useCallback(() => {
    const themes: ('light' | 'sepia' | 'dark')[] = ['light', 'sepia', 'dark'];
    const idx = themes.indexOf(themeRef.current);
    themeRef.current = themes[(idx + 1) % 3];
    webViewRef.current?.injectJavaScript(`readerSetTheme('${themeRef.current}');true;`);
  }, []);

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
  if (error || !source) {
    return (
      <View style={[styles.centered, { backgroundColor: t.paper.primary }]}>
        <Text style={styles.errorIcon}>📖</Text>
        <Text style={[styles.errorText, { color: t.ink.primary }]}>{error || '来源不存在'}</Text>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: t.ink.primary }]} onPress={() => safeGoBack()} activeOpacity={0.8}>
          <Text style={[styles.backBtnText, { color: t.ink.inverse }]}>返回</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ===== 纸质书/外部平台 — 占位页 =====
  if (!isEpub && !isPdf) {
    return (
      <View style={[styles.root, { backgroundColor: t.paper.primary }]}>
        <View style={[styles.topBar, { borderBottomColor: t.outline.standard }]}>
          <TouchableOpacity onPress={handleExit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.backText, { color: t.accent.primary }]}>← 返回</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: t.ink.primary }]} numberOfLines={1}>{source.label}</Text>
          <View style={{ width: 48 }} />
        </View>
        <View style={styles.centered}>
          <Ionicons name="book-outline" size={64} color={t.ink.tertiary} />
          <Text style={[styles.statusText, { color: t.ink.tertiary }]}>计时器已启动</Text>
          <Text style={[styles.statusHint, { color: t.ink.tertiary }]}>返回时自动记录阅读时长</Text>
        </View>
      </View>
    );
  }

  // ===== 阅读器 =====
  return (
    <View style={[styles.root, { backgroundColor: t.paper.primary }]}>
      {/* 顶部控制栏 */}
      <View style={[styles.topBar, { borderBottomColor: t.outline.standard }]}>
        <TouchableOpacity onPress={handleExit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.backText, { color: t.accent.primary }]}>← 返回</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: t.ink.primary }]} numberOfLines={1}>{source.label}</Text>
        <View style={{ width: 48 }} />
      </View>

      {/* PDF: WebView 直接加载 */}
      {isPdf && (
        <WebView
          source={{ uri: source.file_uri! }}
          style={styles.viewer}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
        />
      )}

      {/* EPUB: WebView + epub.js HTML */}
      {isEpub && (
        <>
          <WebView
            ref={webViewRef}
            source={{ html: htmlContent }}
            style={styles.viewer}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            onMessage={handleMessage}
            allowFileAccess
            mixedContentMode="always"
          />
          {/* 底部控制栏 */}
          <View style={[styles.bottomBar, { borderTopColor: t.outline.standard }]}>
            <TouchableOpacity style={styles.ctrlBtn} onPress={() => webViewRef.current?.injectJavaScript('readerPrev();true;')} activeOpacity={0.6}>
              <Ionicons name="chevron-back" size={22} color={t.ink.primary} />
              <Text style={[styles.ctrlLabel, { color: t.ink.tertiary }]}>上一页</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctrlBtn} onPress={() => handleFontSize(-10)} activeOpacity={0.6}>
              <Text style={[styles.ctrlLabel, { color: t.ink.tertiary }]}>A⁻</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctrlBtn} onPress={handleTheme} activeOpacity={0.6}>
              <Text style={[styles.ctrlLabel, { color: t.ink.tertiary }]}>
                {themeRef.current === 'light' ? '☀️' : themeRef.current === 'sepia' ? '📜' : '🌙'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctrlBtn} onPress={() => handleFontSize(10)} activeOpacity={0.6}>
              <Text style={[styles.ctrlLabel, { color: t.ink.tertiary }]}>A⁺</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctrlBtn} onPress={() => webViewRef.current?.injectJavaScript('readerNext();true;')} activeOpacity={0.6}>
              <Ionicons name="chevron-forward" size={22} color={t.ink.primary} />
              <Text style={[styles.ctrlLabel, { color: t.ink.tertiary }]}>下一页</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  viewer: { flex: 1 },

  // 顶部栏
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, fontWeight: '600' },
  title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, fontWeight: '700', flex: 1, textAlign: 'center', marginHorizontal: spacing.sm },

  // 底部栏
  bottomBar: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#FFFFFF',
  },
  ctrlBtn: { alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  ctrlLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, fontWeight: '600', marginTop: 2 },

  // 状态页面
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  statusText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, marginTop: spacing.md },
  statusHint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, marginTop: spacing.sm },
  errorIcon: { fontSize: 56, marginBottom: spacing.md },
  errorText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, fontWeight: '700', marginBottom: spacing.lg, textAlign: 'center' },
  backBtn: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: 50 },
  backBtnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, fontWeight: '700' },
});
