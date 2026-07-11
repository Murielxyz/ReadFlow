import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { spacing, radii } from '../../theme';
import { softShadow } from '../../theme/shadows';
import { extractEpubMetadata } from '../../services/extractMetadata';
import { importFileCache } from '../../../app/add-book';
import { useColors } from '../../stores/useThemeStore';

// ---- 支持的文件类型 ----
const SUPPORTED_TYPES = [
  'application/epub+zip',
  'application/pdf',
  'application/x-mobipocket-ebook',
  'text/plain',
  'application/vnd.comicbook+zip',
  'application/x-cbr',
];

/**
 * 从文件名中提取可能的书名
 */
function extractTitleFromFilename(name: string): string {
  let cleaned = name.replace(/\.(epub|pdf|mobi|txt|cbz|cbr)$/i, '');
  cleaned = cleaned.replace(/[_-]/g, ' ');
  cleaned = cleaned.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned || name;
}

interface ImportModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * ImportModal — 导入本地书籍 (v3.1 简化版)
 *
 * 流程：选文件 → EPUB提取元数据/提取文件名 → 跳转 add-book 表单 → 关闭
 * 不再进行在线匹配搜索。
 */
export default function ImportModal({ visible, onClose }: ImportModalProps) {
  const t = useColors();
  const router = useRouter();
  const [extracting, setExtracting] = useState(false);

  const resetAndClose = useCallback(() => {
    setExtracting(false);
    onClose();
  }, [onClose]);

  const pickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: SUPPORTED_TYPES,
        copyToCacheDirectory: true,
      });
      if (result.canceled) {
        resetAndClose();
        return;
      }

      const file = result.assets[0];
      const isEpub = file.name?.toLowerCase().endsWith('.epub');
      const titleFromName = extractTitleFromFilename(file.name);

      setExtracting(true);

      let prefillTitle = titleFromName;
      let prefillAuthor = '';
      let prefillDesc = '';
      let prefillCoverUrl = '';

      // EPUB: 尝试提取元数据
      if (isEpub) {
        try {
          const metadata = await extractEpubMetadata(file.uri);
          if (metadata) {
            prefillTitle = metadata.title || titleFromName;
            prefillAuthor = metadata.author || '';
            prefillDesc = metadata.description || '';
            prefillCoverUrl = metadata.coverDataUri || '';
          }
        } catch { /* fall through */ }
      }

      // 将文件 URI 写入模块缓存（绕过 URLSearchParams 对 blob URI 的编码问题）
      importFileCache.uri = file.uri;
      importFileCache.name = file.name;

      // 构建 URL 参数（文件数据走缓存，不经过 URL）
      const params = new URLSearchParams();
      if (prefillTitle) params.set('prefillTitle', prefillTitle);
      if (prefillAuthor) params.set('prefillAuthor', prefillAuthor);
      if (prefillDesc) params.set('prefillDescription', prefillDesc);
      if (prefillCoverUrl) params.set('prefillCoverUrl', prefillCoverUrl);
      // 文件名通过 URL 传递（短字符串，无编码问题）
      if (file.name) params.set('importFileName', file.name);

      resetAndClose();

      resetAndClose();
      setTimeout(() => {
        router.push(`/add-book?${params.toString()}`);
      }, 300);
    } catch (e: any) {
      setExtracting(false);
      Alert.alert('导入失败', e?.message ?? '无法打开文件选择器');
    }
  }, [resetAndClose, router]);

  // Auto-pick file when modal opens
  if (visible && !extracting) {
    setTimeout(() => pickFile(), 200);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={resetAndClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={resetAndClose}>
        <View style={[styles.sheet, { backgroundColor: t.paper.primary, borderColor: t.outline.standard }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: t.ink.primary }]}>📥 导入本地书</Text>
            <TouchableOpacity onPress={resetAndClose} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={t.ink.tertiary} />
            </TouchableOpacity>
          </View>

          {extracting ? (
            <View style={styles.centerStage}>
              <ActivityIndicator size="large" color={t.accent.primary} />
              <Text style={[styles.stageText, { color: t.ink.tertiary }]}>正在读取文件信息...</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.pickBtn, { backgroundColor: t.accent.primaryBg, borderColor: t.accent.primary }]}
              onPress={pickFile}
              activeOpacity={0.7}
            >
              <Ionicons name="document-outline" size={24} color={t.accent.primary} />
              <Text style={[styles.pickBtnText, { color: t.accent.primary }]}>选择文件</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  sheet: {
    width: '100%',
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.lg,
    ...softShadow,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 18,
    fontWeight: '800',
  },
  centerStage: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  stageText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  pickBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    fontWeight: '700',
  },
});
