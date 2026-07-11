export interface Collection {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  sort_order: number;
  created_at: string;
}

/** 书单内书本数量（用于列表展示） */
export interface CollectionWithCount extends Collection {
  book_count: number;
}
