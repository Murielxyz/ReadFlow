/**
 * 阅读记录（计时产生）
 */
export interface ReadingSession {
  id: string;
  book_id: string;
  source_id: string | null;
  start_time: string;
  end_time: string | null;
  duration_ms: number | null;
  source_label: string | null;
  page_number: number | null;
  chapter: string | null;
  completed_book: number;
  created_at: string;
}

/**
 * 手动补录记录
 */
export interface ManualLog {
  id: string;
  book_id: string;
  source_id: string | null;
  duration_ms: number;
  logged_at: string;
  note: string | null;
  source_label: string | null;
  page_number: number | null;
  chapter: string | null;
  completed_book: number;
  created_at: string;
}

/**
 * 时间线条目（统一计时记录 + 手动补录）
 */
export interface TimelineEntry {
  id: string;
  type: 'session' | 'manual';
  book_id: string;
  source_label: string | null;
  start_time: string;
  end_time: string | null;
  duration_ms: number | null;
  note: string | null;
  page_number: number | null;
  chapter: string | null;
  completed_book: number;
}
