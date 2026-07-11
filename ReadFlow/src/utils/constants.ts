import type { BookStatus } from '../models/book';

/** 书本状态选项 */
export const BOOK_STATUS_OPTIONS: { label: string; value: BookStatus }[] = [
  { label: '待读', value: 'to_read' },
  { label: '阅读中', value: 'reading' },
  { label: '已完成', value: 'finished' },
  { label: '弃读', value: 'abandoned' },
];

/** 状态展示文字 */
export const STATUS_LABELS: Record<BookStatus, string> = {
  to_read: '待读',
  reading: '阅读中',
  finished: '已完成',
  abandoned: '弃读',
};

/** 状态对应颜色（温暖简约色板） */
export const STATUS_COLORS: Record<BookStatus, string> = {
  reading: '#4A90D9',    // 蓝
  to_read: '#A39E99',    // 中灰
  finished: '#50C878',   // 绿
  abandoned: '#D4A0A0',  // 暗粉灰
};

/** 默认封面 */
export const DEFAULT_COVER = '';
