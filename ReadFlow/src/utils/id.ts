/**
 * 简易 ID 生成器（无需额外依赖）
 */

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function generateId(length = 21): string {
  let id = '';
  for (let i = 0; i < length; i++) {
    id += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return id;
}
