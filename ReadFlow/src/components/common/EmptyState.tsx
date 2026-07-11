import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radii } from '../../theme';
import { softShadow } from '../../theme/shadows';
import { useColors } from '../../stores/useThemeStore';

interface EmptyStateProps {
  /** Ionicons 图标名，默认 "library-outline" */
  icon?: keyof typeof Ionicons.glyphMap;
  /** 主标题 */
  title: string;
  /** 副标题 / 描述文字（兼容旧 API） */
  description?: string;
  /** 副标题（新增，与 description 等价） */
  subtitle?: string;
  /** 操作按钮文字（若提供，则显示温暖简约按钮） */
  actionLabel?: string;
  /** 操作按钮回调 */
  onAction?: () => void;
}

/**
 * EmptyState — 空状态插图组件 (v2.0 + 深色模式)
 *
 * 当列表/区域没有数据时展示。
 * Ionicons 图标 + 标题 + 描述 + 可选操作按钮。
 *
 * 使用示例：
 * <EmptyState icon="library-outline" title="还没有书" subtitle="添加第一本书" actionLabel="添加" onAction={...} />
 */
export default function EmptyState({
  icon = 'library-outline',
  title,
  description,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const t = useColors();
  const desc = subtitle || description;

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={56} color={t.ink.tertiary} />
      <View style={{ height: spacing.md }} />
      <Text style={[styles.title, { color: t.ink.primary }]}>{title}</Text>
      {desc && <Text style={[styles.desc, { color: t.ink.tertiary }]}>{desc}</Text>}
      {actionLabel && onAction && (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: t.ink.primary }]}
          onPress={onAction}
          activeOpacity={0.8}
        >
          <Text style={[styles.btnText, { color: t.ink.inverse }]}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  desc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: spacing.xl,
  },
  // 温暖简约操作按钮 — Pill 形状
  button: {
    marginTop: spacing.sm,
    borderRadius: radii.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    ...softShadow,
  },
  btnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    fontWeight: '700',
  },
});
