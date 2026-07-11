import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '../../theme';
import { useColors } from '../../stores/useThemeStore';

export interface TimePeriod {
  year: number;
  week?: number;  // ISO week number
  month?: number;  // 1-12
}

interface TimeFilterProps {
  tab: 'week' | 'month';
  period: TimePeriod;
  onChange: (period: TimePeriod) => void;
}

/** 获取 ISO 周次 */
function getWeekNumber(d: Date): number {
  const firstDay = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - firstDay.getTime()) / 86400000);
  return Math.ceil((days + firstDay.getDay() + 1) / 7);
}

/** 获取周一和周日日期 */
function getWeekRange(year: number, week: number): { start: Date; end: Date } {
  const jan1 = new Date(year, 0, 1);
  const daysOffset = (week - 1) * 7 - jan1.getDay() + 1;
  const start = new Date(year, 0, 1 + daysOffset);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start, end };
}

function fmtDate(d: Date): string { return `${d.getMonth() + 1}/${d.getDate()}`; }

export default function TimeFilter({ tab, period, onChange }: TimeFilterProps) {
  const t = useColors();

  const handlePrev = () => {
    if (tab === 'week') {
      const d = new Date(period.year, 0, 1 + (period.week! - 1) * 7);
      d.setDate(d.getDate() - 7);
      onChange({ year: d.getFullYear(), week: getWeekNumber(d) });
    } else {
      const m = (period.month ?? new Date().getMonth() + 1) - 1;
      if (m < 1) onChange({ year: period.year - 1, month: 12 });
      else onChange({ year: period.year, month: m });
    }
  };

  const handleNext = () => {
    if (tab === 'week') {
      const d = new Date(period.year, 0, 1 + (period.week! - 1) * 7);
      d.setDate(d.getDate() + 7);
      onChange({ year: d.getFullYear(), week: getWeekNumber(d) });
    } else {
      const m = (period.month ?? new Date().getMonth() + 1) + 1;
      if (m > 12) onChange({ year: period.year + 1, month: 1 });
      else onChange({ year: period.year, month: m });
    }
  };

  const range = tab === 'week' && period.week
    ? getWeekRange(period.year, period.week)
    : null;

  const label = tab === 'week'
    ? `${period.year}年 第${period.week}周${range ? `（${fmtDate(range.start)} - ${fmtDate(range.end)}）` : ''}`
    : `${period.year}年${period.month ?? new Date().getMonth() + 1}月`;

  return (
    <View style={styles.row}>
      <TouchableOpacity onPress={handlePrev} style={styles.arrow} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="chevron-back" size={20} color={t.ink.secondary} />
      </TouchableOpacity>
      <Text style={[styles.label, { color: t.ink.primary }]}>{label}</Text>
      <TouchableOpacity onPress={handleNext} style={styles.arrow} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="chevron-forward" size={20} color={t.ink.secondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, gap: spacing.md },
  arrow: { padding: spacing.xs },
  label: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, fontWeight: '700' },
});
