/**
 * 书本状态枚举
 */
export type BookStatus = 'to_read' | 'reading' | 'finished' | 'abandoned';

/**
 * 书本数据模型
 */
/** 书籍分类枚举 */
export type BookCategory = 'fiction' | 'scifi' | 'history' | 'philosophy' | 'literature' | 'art' | 'science' | 'audiobook' | 'other';

export const BOOK_CATEGORY_LABELS: Record<BookCategory, string> = {
  fiction: '小说',
  scifi: '科幻',
  history: '历史',
  philosophy: '哲学',
  literature: '文学',
  art: '艺术',
  science: '科学',
  audiobook: '有声书',
  other: '其他',
};

export interface Book {
  id: string;
  title: string;
  author: string | null;
  publisher: string | null;
  description: string | null;
  cover_url: string | null;
  isbn: string | null;
  page_count: number | null;
  status: BookStatus;
  rating: number | null; // 0-5, null = 未评分
  accent_color: string | null;
  category: BookCategory | null;
  finished_date: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 创建书本时的输入参数
 */
export interface CreateBookInput {
  title: string;
  author?: string;
  publisher?: string;
  description?: string;
  cover_url?: string;
  isbn?: string;
  page_count?: number;
  status?: BookStatus;
  rating?: number | null;
  category?: BookCategory;
}
