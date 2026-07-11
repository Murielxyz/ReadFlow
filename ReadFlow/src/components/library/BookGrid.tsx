import { FlatList, StyleSheet, View } from 'react-native';
import { spacing } from '../../theme';
import type { Book } from '../../models';
import BookCard from './BookCard';
import BookListItem from './BookListItem';
import EmptyState from '../common/EmptyState';

interface BookGridProps {
  books: Book[];
  viewMode: 'grid' | 'list';
  onRefresh?: () => void;
  refreshing?: boolean;
}

/**
 * 书本展示容器
 */
export default function BookGrid({ books, viewMode, onRefresh, refreshing }: BookGridProps) {
  if (books.length === 0) {
    return (
      <EmptyState
        icon="library-outline"
        title="书架空空"
        description="点击右上角 + 添加你的第一本书"
      />
    );
  }

  if (viewMode === 'list') {
    return (
      <FlatList
        data={books}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <BookListItem book={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />
    );
  }

  return (
    <FlatList
      data={books}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <BookCard book={item} />}
      numColumns={2}
      columnWrapperStyle={styles.gridRow}
      contentContainerStyle={styles.gridContent}
      showsVerticalScrollIndicator={false}
      onRefresh={onRefresh}
      refreshing={refreshing}
    />
  );
}

const styles = StyleSheet.create({
  gridRow: {
    gap: spacing.md,
  },
  gridContent: {
    padding: spacing.lg,
  },
  listContent: {
    padding: spacing.lg,
  },
});
