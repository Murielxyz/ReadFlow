import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { radii, spacing } from '../../theme';
import { softShadow } from '../../theme/shadows';
import { STATUS_LABELS, STATUS_COLORS } from '../../utils/constants';
import type { Book } from '../../models';
import BookCover from '../book/BookCover';
import { useColors } from '../../stores/useThemeStore';

interface BookListItemProps {
  book: Book;
}

/**
 * 书架列表行 — 温暖简约风格 (v2.0 + 深色模式)
 */
export default function BookListItem({ book }: BookListItemProps) {
  const t = useColors();
  const statusLabel = STATUS_LABELS[book.status];
  const statusColor = STATUS_COLORS[book.status];

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.8}
      onPress={() => router.push(`/book/${book.id}`)}
    >
      {/* 主体 */}
      <View style={[styles.inner, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}>
        <BookCover
          uri={book.cover_url}
          title={book.title}
          accentColor={book.accent_color}
          size="sm"
        />

        <View style={styles.info}>
          <Text style={[styles.title, { color: t.ink.primary }]} numberOfLines={1}>
            {book.title}
          </Text>
          {book.author && (
            <Text style={[styles.author, { color: t.ink.secondary }]} numberOfLines={1}>
              {book.author}
            </Text>
          )}

          <View style={styles.meta}>
            {book.rating !== null && (
              <Text style={[styles.rating, { color: t.ink.secondary }]}>
                {'★'.repeat(book.rating)}{'☆'.repeat(5 - book.rating)}
              </Text>
            )}
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusColor + '18', borderColor: statusColor + '40' },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {statusLabel}
              </Text>
            </View>
          </View>
        </View>

        <Text style={[styles.chevron, { color: t.ink.tertiary }]}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: spacing.md,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    ...softShadow,
  },
  info: {
    flex: 1,
    marginLeft: spacing.md,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    fontWeight: '700',
  },
  author: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    marginTop: 2,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: spacing.sm,
  },
  rating: {
    fontSize: 11,
    letterSpacing: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    fontWeight: '700',
  },
  chevron: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    fontWeight: '700',
    marginLeft: spacing.sm,
  },
});
