import { View, Text, Image, StyleSheet } from 'react-native';
import { radii } from '../../theme';
import { softShadow } from '../../theme/shadows';
import { useColors } from '../../stores/useThemeStore';

interface BookCoverProps {
  uri: string | null;
  title: string;
  accentColor: string | null;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = { sm: 56, md: 96, lg: 180 };
const RADIUS_MAP = { sm: radii.xs, md: radii.sm, lg: radii.lg };

/**
 * 书本封面组件 — 温暖简约风格 (v2.0 + 深色模式)
 * - 1px 细线边框 + 软阴影
 * - 无封面时显示首字 + 柔和底色
 */
export default function BookCover({ uri, title, accentColor, size = 'md' }: BookCoverProps) {
  const t = useColors();
  const dim = SIZE_MAP[size];
  const r = RADIUS_MAP[size];

  // 有封面图
  if (uri) {
    return (
      <View style={[styles.inner, { width: dim, height: dim * 1.5, borderRadius: r, borderColor: t.outline.standard }]}>
        <Image
          source={{ uri }}
          style={[styles.image, { borderRadius: r - 2 }]}
          resizeMode="cover"
        />
      </View>
    );
  }

  // 占位封面：首字 + 强调色背景
  const initial = title.charAt(0) || '?';
  const bgColor = (accentColor || t.accent.primary) + '18';

  return (
    <View
      style={[
        styles.inner,
        {
          width: dim,
          height: dim * 1.5,
          borderRadius: r,
          backgroundColor: bgColor,
          borderColor: t.outline.standard,
        },
      ]}
    >
      <Text
        style={[
          styles.initial,
          {
            fontSize: dim * 0.35,
            color: accentColor || t.ink.primary,
          },
        ]}
      >
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  inner: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...softShadow,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  initial: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontWeight: '800',
  },
});
