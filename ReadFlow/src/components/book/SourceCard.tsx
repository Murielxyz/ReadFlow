import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSourceStore, type SourceStats } from '../../stores/useSourceStore';
import { deleteSourceFile } from '../../services/importService';
import { formatDuration } from '../../utils/format';
import type { ReadingSource } from '../../models';
import { spacing, radii } from '../../theme';
import { softShadow } from '../../theme/shadows';
import { useColors } from '../../stores/useThemeStore';

interface SourceCardProps {
  source: ReadingSource;
  bookId: string;
  sourceStats?: SourceStats;
  onTimerStart: (sourceId?: string) => void;
  onDeleted?: () => void;
}

/**
 * SourceCard — 单个阅读来源卡片 (v3.0)
 *
 * 温暖简约风格，按来源类型展示不同信息和操作按钮：
 * - epub/pdf (有文件): 文件名 · 进度 · 开始阅读（紫色）
 * - epub/pdf (无文件): 标签 · 进度 · 无文件（灰色）
 * - physical: 已记录次数 · 累计时长 · 开始计时（绿色）
 * - external: 已记录次数 · 累计时长 · 开始计时（蓝色）
 */
export default function SourceCard({ source, bookId, sourceStats, onTimerStart, onDeleted }: SourceCardProps) {
  const t = useColors();
  const deleteSource = useSourceStore((s) => s.deleteSource);

  const isDigital = source.type === 'epub' || source.type === 'pdf';
  const hasFile = !!source.file_uri;
  const isReadable = isDigital && hasFile;

  const stats = sourceStats ?? { sessionCount: 0, totalMs: 0 };

  // 按钮配置
  const getButtonConfig = () => {
    if (isDigital && hasFile) {
      return {
        label: source.current_page > 0 ? '继续阅读' : '开始阅读',
        color: t.accent.primary,
        onPress: () => router.push(`/reader/${source.id}`),
        disabled: false,
      };
    }
    if (isDigital && !hasFile) {
      return {
        label: '无文件',
        color: t.ink.tertiary,
        onPress: undefined,
        disabled: true,
      };
    }
    if (source.type === 'physical') {
      return {
        label: '开始计时',
        color: t.accent.green,
        onPress: () => onTimerStart(source.id),
        disabled: false,
      };
    }
    // external
    return {
      label: '开始计时',
      color: t.accent.blue,
      onPress: () => onTimerStart(source.id),
      disabled: false,
    };
  };

  const btn = getButtonConfig();

  const handleDelete = () => {
    Alert.alert(
      '删除来源',
      `确定要删除"${source.label}"吗？${hasFile ? '文件也将被删除。' : ''}`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            if (source.file_uri) await deleteSourceFile(source.file_uri);
            deleteSource(source.id);
            onDeleted?.();
          },
        },
      ],
    );
  };

  // 图标
  const getIcon = () => {
    if (source.type === 'pdf') return { name: 'document-text' as const, color: t.accent.primary };
    if (source.type === 'epub') return { name: 'book' as const, color: t.accent.primary };
    if (source.type === 'physical') return { name: 'book-outline' as const, color: t.accent.green };
    return { name: 'globe-outline' as const, color: t.accent.blue };
  };
  const icon = getIcon();

  return (
    <View style={[styles.card, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}>
      {/* 左侧：图标 */}
      <View style={[styles.iconWrap, { backgroundColor: icon.color + '18' }]}>
        <Ionicons name={icon.name} size={22} color={icon.color} />
      </View>

      {/* 中间：信息 */}
      <View style={styles.info}>
        <Text style={[styles.label, { color: t.ink.primary }]} numberOfLines={1}>
          {source.label}
        </Text>
        {isDigital && hasFile && source.file_name && (
          <Text style={[styles.metaText, { color: t.ink.tertiary }]} numberOfLines={1}>
            {source.file_name}
          </Text>
        )}
        {isDigital && (
          <Text style={[styles.metaText, { color: t.ink.secondary }]}>
            进度 {Math.round(source.current_page)}%
          </Text>
        )}
        {!isDigital && stats.sessionCount > 0 && (
          <Text style={[styles.metaText, { color: t.ink.secondary }]}>
            已记录 {stats.sessionCount} 次 · 累计 {formatDuration(stats.totalMs)}
          </Text>
        )}
      </View>

      {/* 右侧：按钮 + 删除 */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: btn.color, opacity: btn.disabled ? 0.3 : 1 }]}
          onPress={btn.onPress}
          disabled={btn.disabled}
          activeOpacity={0.7}
        >
          <Text style={styles.actionBtnText}>{btn.label}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} activeOpacity={0.6} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name="trash-outline" size={14} color={t.ink.tertiary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 3,
  },
  label: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    fontWeight: '700',
  },
  metaText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
  },
  actions: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  actionBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    minWidth: 72,
    alignItems: 'center',
  },
  actionBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
