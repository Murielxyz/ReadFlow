import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { radii, spacing } from '../../theme';
import { softShadow } from '../../theme/shadows';
import { useColors } from '../../stores/useThemeStore';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: object;
}

/**
 * Card — 温暖简约风格 (v2.0 + 深色模式)
 * - 白色卡片 + 1px 细线边框
 * - 极轻软阴影
 * - 可点击时带轻微反馈
 */
export default function Card({ children, onPress, style }: CardProps) {
  const t = useColors();

  const content = (
    <View style={[styles.card, { backgroundColor: t.paper.white, borderColor: t.outline.standard }, style]}>
      {children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    ...softShadow,
  },
});
