/**
 * 阅读来源类型
 */
export type ReadingSourceType = 'epub' | 'pdf' | 'physical' | 'external';

/**
 * 阅读来源数据模型
 */
export interface ReadingSource {
  id: string;
  book_id: string;
  type: ReadingSourceType;
  label: string;
  file_uri: string | null;
  file_name: string | null;
  current_page: number;
  created_at: string;
}
