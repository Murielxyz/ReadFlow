import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radii } from '../../theme';
import { softShadow } from '../../theme/shadows';
import { formatDuration } from '../../utils/format';
import { useColors } from '../../stores/useThemeStore';

interface StatCardsProps {
  completedBooks: number;
  totalMs: number;
  readingDays: number;
  notesCount: number;
}

export default function StatCards({ completedBooks, totalMs, readingDays, notesCount }: StatCardsProps) {
  const t = useColors();
  const items = [
    { icon: 'checkmark-circle-outline' as const, value: `${completedBooks} 本`, label: '已读完', color: t.accent.primary },
    { icon: 'time-outline' as const, value: formatDuration(totalMs), label: '阅读时长', color: t.accent.primary },
    { icon: 'calendar-outline' as const, value: `${readingDays} 天`, label: '阅读天数', color: t.accent.primary },
    { icon: 'bulb-outline' as const, value: `${notesCount} 条`, label: '笔记数', color: t.accent.primary },
  ];

  return (
    <View style={styles.grid}>
      {items.map((item, i) => (
        <View key={i} style={[styles.card, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}>
          <View style={[styles.iconWrap, { backgroundColor: t.accent.primaryBg }]}>
            <Ionicons name={item.icon} size={18} color={item.color} />
          </View>
          <Text style={[styles.value, { color: t.ink.primary }]}>{item.value}</Text>
          <Text style={[styles.label, { color: t.ink.tertiary }]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: { width: '47%', flexGrow: 1, borderRadius: radii.lg, borderWidth: 1, padding: spacing.md, gap: 4, ...softShadow },
  iconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  value: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, fontWeight: '800' },
  label: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, fontWeight: '500' },
});
