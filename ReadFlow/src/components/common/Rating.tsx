import { TouchableOpacity, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { hapticMedium } from '../../utils/haptics';
import { useColors } from '../../stores/useThemeStore';

interface RatingProps {
  value: number | null; // 0-5, null = 未评分, 支持 .5 半星
  onChange?: (rating: number) => void;
  size?: 'sm' | 'md' | 'lg';
  readonly?: boolean;
}

const STAR_SIZES = { sm: 14, md: 22, lg: 30 };

/**
 * 星级评分组件 — 温暖简约风格 (v3.0 + 半星)
 *
 * 支持 0.5 步进半星评分：
 * - 点击左半部分 → 半星 (e.g. 3.5)
 * - 点击右半部分 → 全星 (e.g. 4)
 * - 使用 Ionicons: star / star-half / star-outline
 */
export default function Rating({
  value,
  onChange,
  size = 'md',
  readonly = false,
}: RatingProps) {
  const t = useColors();
  const starSize = STAR_SIZES[size];

  const handleStarPress = (star: number, event: GestureResponderEvent) => {
    const touchX = event.nativeEvent.locationX;
    // 点击位置在左半部分 → 半星，右半部分 → 全星
    const isLeftHalf = touchX < starSize / 2;
    const rating = isLeftHalf ? star - 0.5 : star;
    hapticMedium();
    onChange?.(rating);
  };

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => {
        const fullFilled = value !== null && star <= value;
        const halfFilled = value !== null && !fullFilled && star - 0.5 <= value;

        const iconName = fullFilled ? 'star' : halfFilled ? 'star-half' : 'star-outline';
        const iconColor = fullFilled || halfFilled ? t.accent.yellow : t.ink.tertiary;

        if (readonly) {
          return (
            <Ionicons
              key={star}
              name={iconName}
              size={starSize}
              color={iconColor}
              style={styles.starIcon}
            />
          );
        }

        return (
          <TouchableOpacity
            key={star}
            onPress={(event) => handleStarPress(star, event)}
            activeOpacity={0.6}
          >
            <Ionicons
              name={iconName}
              size={starSize}
              color={iconColor}
              style={styles.starIcon}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starIcon: {
    marginRight: 1,
  },
});