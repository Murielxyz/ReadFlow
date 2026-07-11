import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { radii, spacing } from '../../theme';
import { softShadow } from '../../theme/shadows';
import { hapticMedium } from '../../utils/haptics';
import { useColors } from '../../stores/useThemeStore';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  color?: string;
  loading?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Button — 温暖简约风格 (v2.0 + 深色模式)
 *
 * - Pill 全圆角
 * - primary: 实心 + 软阴影
 * - secondary: 1px 边框 + 透明背景
 * - ghost: 无背景无边框
 */
export default function Button({
  title,
  onPress,
  variant = 'primary',
  color,
  loading = false,
  disabled = false,
  size = 'md',
}: ButtonProps) {
  const t = useColors();
  const resolvedColor = color ?? t.ink.primary;
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';

  const heightMap = { sm: 36, md: 48, lg: 56 };
  const fontSizeMap = { sm: 12, md: 14, lg: 16 };
  const pxMap = { sm: spacing.md, md: spacing.lg, lg: spacing.lg };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          height: heightMap[size],
          paddingHorizontal: pxMap[size],
          backgroundColor: isPrimary ? resolvedColor : 'transparent',
          borderWidth: isGhost ? 0 : 1,
          borderColor: isPrimary ? 'transparent' : t.outline.standard,
          borderRadius: radii.full,
          opacity: disabled ? 0.5 : 1,
        },
        isPrimary && softShadow,
      ]}
      onPress={() => {
        hapticMedium();
        onPress();
      }}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      <Text
        style={[
          styles.text,
          {
            fontSize: fontSizeMap[size],
            color: isPrimary ? t.ink.inverse : t.ink.primary,
          },
        ]}
      >
        {loading ? '...' : title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
  },
});
