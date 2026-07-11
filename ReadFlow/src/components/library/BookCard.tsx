import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { radii, spacing } from '../../theme';
import { softShadow } from '../../theme/shadows';
import { STATUS_LABELS, STATUS_COLORS } from '../../utils/constants';
import type { Book } from '../../models';
import BookCover from '../book/BookCover';
import { useColors } from '../../stores/useThemeStore';

interface BookCardProps {
  book: Book;
}

/**
 * 书架网格卡片 — 温暖简约风格 (v2.0 + 深色模式)
 */
export default function BookCard({ book }: BookCardProps) {
  const t = useColors();
  const statusLabel = STATUS_LABELS[book.status];
  const statusColor = STATUS_COLORS[book.status];

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => router.push(`/book/${book.id}`)}
    >
      {/* 卡片主体 */}
      <View style={[styles.inner, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}>
        <BookCover
          uri={book.cover_url}
          title={book.title}
          accentColor={book.accent_color}
          size="md"
        />

        <View style={styles.info}>
          <Text style={[styles.title, { color: t.ink.primary }]} numberOfLines={2}>
            {book.title}
          </Text>
          {book.author && (
            <Text style={[styles.author, { color: t.ink.secondary }]} numberOfLines={1}>
              {book.author}
            </Text>
          )}

          {/* 评分 */}
          {book.rating !== null && (
            <Text style={[styles.rating, { color: t.accent.yellow }]}>
              {'★'.repeat(book.rating)}{'☆'.repeat(5 - book.rating)}
            </Text>
          )}

          {/* 状态 Badge */}
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusColor + '18', borderColor: statusColor + '40' },
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {statusLabel}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    maxWidth: '48%',
    marginBottom: spacing.lg,
  },
  inner: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...softShadow,
  },
  info: {
    padding: spacing.md,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  author: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
  rating: {
    fontSize: 11,
    marginTop: 4,
    letterSpacing: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    fontWeight: '700',
  },
});
