/**
 * ReadFlow 数据库表结构
 *
 * 所有建表语句都使用 IF NOT EXISTS，保证幂等安全
 */

// 版本记录表（用于数据库迁移）
export const CREATE_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS _migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

// 书本表
export const CREATE_BOOKS_TABLE = `
  CREATE TABLE IF NOT EXISTS books (
    id            TEXT PRIMARY KEY,
    title         TEXT NOT NULL,
    author        TEXT,
    description   TEXT,
    cover_url     TEXT,
    isbn          TEXT,
    page_count    INTEGER,
    status        TEXT NOT NULL DEFAULT 'to_read',
    rating        INTEGER,
    accent_color  TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

// 阅读来源表
export const CREATE_READING_SOURCES_TABLE = `
  CREATE TABLE IF NOT EXISTS reading_sources (
    id            TEXT PRIMARY KEY,
    book_id       TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    type          TEXT NOT NULL,
    label         TEXT NOT NULL,
    file_uri      TEXT,
    file_name     TEXT,
    current_page  REAL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_sources_book ON reading_sources(book_id);
`;

// 阅读记录表（计时产生的记录）
export const CREATE_READING_SESSIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS reading_sessions (
    id            TEXT PRIMARY KEY,
    book_id       TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    source_id     TEXT REFERENCES reading_sources(id) ON DELETE SET NULL,
    start_time    TEXT NOT NULL,
    end_time      TEXT,
    duration_ms   INTEGER,
    source_label  TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_book ON reading_sessions(book_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_time ON reading_sessions(start_time);
`;

// 手动补录表
export const CREATE_MANUAL_LOGS_TABLE = `
  CREATE TABLE IF NOT EXISTS manual_logs (
    id            TEXT PRIMARY KEY,
    book_id       TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    source_id     TEXT REFERENCES reading_sources(id) ON DELETE SET NULL,
    duration_ms   INTEGER NOT NULL,
    logged_at     TEXT NOT NULL DEFAULT (datetime('now')),
    note          TEXT,
    source_label  TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_manuallogs_book ON manual_logs(book_id);
`;

// 标签表
export const CREATE_TAGS_TABLE = `
  CREATE TABLE IF NOT EXISTS tags (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL UNIQUE,
    color         TEXT,
    is_system     INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

// 书本-标签关联表
export const CREATE_BOOK_TAGS_TABLE = `
  CREATE TABLE IF NOT EXISTS book_tags (
    book_id       TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    tag_id        TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (book_id, tag_id)
  );
`;

// 书单表
export const CREATE_COLLECTIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS collections (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    description   TEXT,
    color         TEXT,
    sort_order    INTEGER DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

// 书单-书本关联表
export const CREATE_BOOK_COLLECTIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS book_collections (
    book_id       TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    added_at      TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (book_id, collection_id)
  );
`;

// v2 迁移：阅读会话和手动记录增加页数/章节/读完标记
export const MIGRATION_V2_ADD_PAGE_CHAPTER = `
  ALTER TABLE reading_sessions ADD COLUMN page_number INTEGER;
  ALTER TABLE reading_sessions ADD COLUMN chapter TEXT;
  ALTER TABLE reading_sessions ADD COLUMN completed_book INTEGER DEFAULT 0;
  ALTER TABLE manual_logs ADD COLUMN page_number INTEGER;
  ALTER TABLE manual_logs ADD COLUMN chapter TEXT;
  ALTER TABLE manual_logs ADD COLUMN completed_book INTEGER DEFAULT 0;
`;

// v4 迁移：笔记表
export const MIGRATION_V4_ADD_NOTES = `
  CREATE TABLE IF NOT EXISTS notes (
    id            TEXT PRIMARY KEY,
    book_id       TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    content       TEXT NOT NULL,
    page_number   INTEGER,
    chapter       TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_notes_book ON notes(book_id);
`;

// v3 迁移：书籍增加读完日期、分类；新增年度目标表
export const MIGRATION_V3_BOOK_META_AND_GOALS = `
  ALTER TABLE books ADD COLUMN finished_date TEXT;
  ALTER TABLE books ADD COLUMN category TEXT;
  CREATE TABLE IF NOT EXISTS reading_goals (
    year          INTEGER PRIMARY KEY,
    target_books  INTEGER NOT NULL DEFAULT 50,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

// v5 迁移：用户设置表（key-value，持久化提醒等设置）
export const MIGRATION_V5_ADD_USER_SETTINGS = `
  CREATE TABLE IF NOT EXISTS user_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

// v6 迁移：高亮表
export const MIGRATION_V6_ADD_HIGHLIGHTS = `
  CREATE TABLE IF NOT EXISTS highlights (
    id            TEXT PRIMARY KEY,
    book_id       TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    content       TEXT NOT NULL,
    color         TEXT NOT NULL DEFAULT '#F5A623',
    note          TEXT,
    page_number   INTEGER,
    chapter       TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_highlights_book ON highlights(book_id);
`;

// v7 迁移：出版社字段
export const MIGRATION_V7_ADD_PUBLISHER = `
  ALTER TABLE books ADD COLUMN publisher TEXT;
`;

// 按顺序排列的所有建表语句
export const ALL_MIGRATIONS = [
  CREATE_MIGRATIONS_TABLE,
  CREATE_BOOKS_TABLE,
  CREATE_READING_SOURCES_TABLE,
  CREATE_READING_SESSIONS_TABLE,
  CREATE_MANUAL_LOGS_TABLE,
  CREATE_TAGS_TABLE,
  CREATE_BOOK_TAGS_TABLE,
  CREATE_COLLECTIONS_TABLE,
  CREATE_BOOK_COLLECTIONS_TABLE,
  MIGRATION_V2_ADD_PAGE_CHAPTER,
  MIGRATION_V3_BOOK_META_AND_GOALS,
  MIGRATION_V4_ADD_NOTES,
  MIGRATION_V5_ADD_USER_SETTINGS,
  MIGRATION_V6_ADD_HIGHLIGHTS,
  MIGRATION_V7_ADD_PUBLISHER,
];
