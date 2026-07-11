import * as SQLite from 'expo-sqlite';
import { ALL_MIGRATIONS } from './schema';

let db: SQLite.SQLiteDatabase | null = null;

/**
 * 获取数据库实例（单例）
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  db = await SQLite.openDatabaseAsync('readflow.db');

  // 开启外键约束
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // 执行数据库迁移
  await migrate(db);

  return db;
}

/**
 * 幂等迁移：按顺序执行建表语句，已经执行过的跳过
 */
async function migrate(database: SQLite.SQLiteDatabase): Promise<void> {
  // 确保迁移版本表存在
  await database.execAsync(ALL_MIGRATIONS[0]);

  // 查询当前版本
  const row = await database.getFirstAsync<{ version: number }>(
    'SELECT MAX(version) as version FROM _migrations'
  );
  const currentVersion = row?.version ?? 0;

  // 执行未应用的迁移
  for (let i = currentVersion; i < ALL_MIGRATIONS.length; i++) {
    await database.execAsync(ALL_MIGRATIONS[i]);
    await database.runAsync(
      'INSERT INTO _migrations (version) VALUES (?)',
      i + 1
    );
  }
}

/**
 * 关闭数据库连接
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
