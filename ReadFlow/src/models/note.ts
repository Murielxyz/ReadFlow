/**
 * 阅读笔记
 */
export interface Note {
  id: string;
  book_id: string;
  content: string;
  page_number: number | null;
  chapter: string | null;
  created_at: string;
  updated_at: string;
}

/** 创建笔记的输入 */
export interface CreateNoteInput {
  book_id: string;
  content: string;
  page_number?: number;
  chapter?: string;
}

/** 更新笔记的输入 */
export interface UpdateNoteInput {
  content?: string;
  page_number?: number | null;
  chapter?: string | null;
}
