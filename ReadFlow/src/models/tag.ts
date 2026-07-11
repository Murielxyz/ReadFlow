export interface Tag {
  id: string;
  name: string;
  color: string | null;
  is_system: number; // 0 = 自定义, 1 = 系统预设
  created_at: string;
}
