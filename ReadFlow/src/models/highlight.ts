/**
 * 阅读高亮
 */
export interface Highlight {
  id: string;
  book_id: string;
  /** 高亮的文字内容 */
  content: string;
  /** 高亮颜色（hex），默认 '#F5A623'（黄色） */
  color: string;
  /** 附加笔记（可选） */
  note: string | null;
  page_number: number | null;
  chapter: string | null;
  created_at: string;
  updated_at: string;
}

/** 创建高亮的输入 */
export interface CreateHighlightInput {
  book_id: string;
  content: string;
  color?: string;
  note?: string;
  page_number?: number;
  chapter?: string;
}

/** 更新高亮的输入 */
export interface UpdateHighlightInput {
  content?: string;
  color?: string;
  note?: string | null;
  page_number?: number | null;
  chapter?: string | null;
}
