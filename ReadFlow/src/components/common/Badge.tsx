import { View, Text, StyleSheet } from 'react-native';
import { radii, spacing } from '../../theme';
import { useColors } from '../../stores/useThemeStore';

interface BadgeProps {
  label: string;
  color?: string;
  bgColor?: string;
  size?: 'sm' | 'md';
}

/**
 * Badge / Tag — 温暖简约风格 (v2.0 + 深色模式)
 * - Pill 形状（全圆角）
 * - 1px 细线边框 + 浅色背景
 * - 加粗小字
 */
export default function Badge({
  label,
  color,
  bgColor,
  size = 'md',
}: BadgeProps) {
  const t = useColors();
  const resolvedColor = color ?? t.ink.primary;
  const resolvedBgColor = bgColor ?? t.accent.primaryBg;
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: resolvedBgColor,
          paddingHorizontal: isSmall ? spacing.sm : spacing.md,
          paddingVertical: isSmall ? 2 : 4,
          borderRadius: radii.full,
          borderColor: resolvedColor + '40',
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: resolvedColor,
            fontSize: isSmall ? 10 : 12,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  text: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
  },
});
