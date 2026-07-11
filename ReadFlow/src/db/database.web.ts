/**
 * Web 端内存数据库
 *
 * expo-sqlite 在 Web 端依赖 .wasm 文件，Metro 默认不支持打包此格式。
 * 因此在 Web 端提供一个完整的内存数据库实现，数据在同一会话内持久化。
 * 真机 (iOS/Android) 会使用 database.ts 中的真实 SQLite 实现。
 *
 * 支持的 SQL 子集：
 * - CREATE TABLE IF NOT EXISTS / CREATE INDEX (no-op)
 * - INSERT INTO / INSERT OR REPLACE INTO
 * - SELECT (含 WHERE / ORDER BY / MAX / COUNT)
 * - UPDATE ... SET ... WHERE
 * - DELETE FROM ... WHERE
 * - PRAGMA (no-op)
 */

// ============================================================
// 类型定义
// ============================================================

interface ColumnDef {
  name: string;
  type: string;
  primaryKey?: boolean;
}

interface TableDef {
  name: string;
  columns: ColumnDef[];
  rows: Record<string, any>[];
}

// ============================================================
// 内存存储
// ============================================================

const tables = new Map<string, TableDef>();

/** 自增 row ID */
let _nextRowId = 1;

// ============================================================
// SQL 解析引擎
// ============================================================

function getTable(name: string): TableDef {
  const t = tables.get(name);
  if (!t) throw new Error(`Table not found: ${name}`);
  return t;
}

/** 替换 SQL 中的 ? 占位符（处理字符串字面量内的 ? 不算占位符） */
function bindParams(sql: string, params: any[]): string {
  if (!params || params.length === 0) return sql;
  let paramIdx = 0;
  let result = '';
  let inString = false;
  let stringChar = '';
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (inString) {
      result += ch;
      if (ch === stringChar && sql[i - 1] !== '\\') {
        inString = false;
      }
    } else if (ch === "'" || ch === '"') {
      inString = true;
      stringChar = ch;
      result += ch;
    } else if (ch === '?') {
      const val = params[paramIdx++];
      result += quoteValue(val);
    } else {
      result += ch;
    }
  }
  return result;
}

function quoteValue(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  return `'${String(val).replace(/'/g, "''")}'`;
}

function parseCreateTable(sql: string): { name: string; columns: ColumnDef[] } | null {
  const m = sql.match(
    /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)\s*\(([\s\S]+)\)/i
  );
  if (!m) return null;
  const name = m[1];
  const body = m[2];
  const columns: ColumnDef[] = [];
  // 按逗号分割（处理嵌套括号）
  const parts = splitByCommaTopLevel(body);
  for (const part of parts) {
    const trimmed = part.trim();
    // 跳过约束定义（PRIMARY KEY / FOREIGN KEY / INDEX）
    if (
      /^(PRIMARY|FOREIGN|UNIQUE|CHECK|INDEX|CREATE)/i.test(trimmed) ||
      trimmed.startsWith('CREATE')
    ) {
      continue;
    }
    const colMatch = trimmed.match(
      /^(\w+)\s+(\w+)(?:\s+PRIMARY\s+KEY)?/i
    );
    if (colMatch) {
      columns.push({
        name: colMatch[1],
        type: colMatch[2],
        primaryKey: /PRIMARY\s+KEY/i.test(trimmed),
      });
    }
  }
  return { name, columns };
}

function splitByCommaTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '(') {
      depth++;
      current += ch;
    } else if (ch === ')') {
      depth--;
      current += ch;
    } else if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

function execCreateTable(sql: string): void {
  // 处理多语句（分号分隔）
  const stmts = sql.split(';').filter((s) => s.trim());
  for (const stmt of stmts) {
    const trimmed = stmt.trim();
    if (!trimmed) continue;

    // CREATE INDEX — 忽略
    if (/CREATE\s+INDEX/i.test(trimmed)) continue;

    // CREATE TABLE
    const parsed = parseCreateTable(trimmed);
    if (parsed && !tables.has(parsed.name)) {
      tables.set(parsed.name, {
        name: parsed.name,
        columns: parsed.columns,
        rows: [],
      });
    }
  }
}

function execInsert(sql: string): {
  lastInsertRowId: number;
  changes: number;
} {
  // INSERT [OR REPLACE|OR IGNORE] INTO table (col1, col2, ...) VALUES (v1, v2, ...)
  const m = sql.match(
    /INSERT\s+(?:OR\s+(?:REPLACE|IGNORE)\s+)?INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i
  );
  if (!m) throw new Error(`Cannot parse INSERT: ${sql}`);
  const tableName = m[1];
  const colNames = m[2].split(',').map((s) => s.trim());
  const rawValues = m[3];
  const colValues = splitByCommaTopLevel(rawValues).map((s) => {
    const t = s.trim();
    if (t === 'NULL') return null;
    if (t.startsWith("'") && t.endsWith("'")) {
      return t.slice(1, -1).replace(/''/g, "'");
    }
    const n = Number(t);
    return isNaN(n) ? t : n;
  });

  const table = getTable(tableName);

  // 处理 INSERT OR REPLACE（按主键 upsert）
  const isReplace = /OR\s+REPLACE/i.test(sql);
  // 处理 INSERT OR IGNORE（主键冲突时跳过）
  const isIgnore = /OR\s+IGNORE/i.test(sql);

  if (isReplace || isIgnore) {
    // REPLACE: 按主键查找（通常是第一列）
    if (isReplace) {
      const pkCol = table.columns.find((c) => c.primaryKey)?.name ?? table.columns[0]?.name;
      const pkIdx = colNames.indexOf(pkCol);
      if (pkIdx >= 0) {
        const pkVal = colValues[pkIdx];
        const existingIdx = table.rows.findIndex((r) => r[pkCol] === pkVal);
        if (existingIdx >= 0) {
          const row = { ...table.rows[existingIdx] };
          for (let i = 0; i < colNames.length; i++) {
            row[colNames[i]] = colValues[i];
          }
          table.rows[existingIdx] = row;
          return { lastInsertRowId: 0, changes: 1 };
        }
      }
    }

    // IGNORE: 检查是否已存在完全相同的行（所有插入列的值都匹配）
    if (isIgnore) {
      const exists = table.rows.some((r) =>
        colNames.every((col) => r[col] === colValues[colNames.indexOf(col)])
      );
      if (exists) {
        return { lastInsertRowId: 0, changes: 0 };
      }
    }
  }

  const row: Record<string, any> = {};
  for (const col of table.columns) {
    row[col.name] = null;
  }
  for (let i = 0; i < colNames.length; i++) {
    row[colNames[i]] = colValues[i];
  }

  const rowId = _nextRowId++;
  table.rows.push(row);
  return { lastInsertRowId: rowId, changes: 1 };
}

function execSelect(sql: string): any[] {
  // 规范化空白字符，便于解析
  const s = sql.replace(/\s+/g, ' ').trim().replace(/;\s*$/, '');

  // 提取 SELECT 列 和 FROM 表名（支持表别名如 "collections c"）
  const m = s.match(/^SELECT\s+(.+?)\s+FROM\s+(\w+)/is);
  if (!m) throw new Error(`Cannot parse SELECT: ${sql}`);

  const selectExpr = m[1].trim();
  const tableName = m[2].trim();
  // FROM table 之后的所有内容
  const afterFrom = s.substring(m[0].length);

  // 扫描关键子句位置（用 \b 避免匹配到列名中的关键字）
  const whereIdx = afterFrom.search(/\bWHERE\s+/i);
  const groupByIdx = afterFrom.search(/\bGROUP\s+BY\s+/i);
  const orderByIdx = afterFrom.search(/\bORDER\s+BY\s+/i);

  // 提取 WHERE 子句（从 WHERE 到 GROUP BY / ORDER BY / 末尾）
  let whereClause: string | undefined;
  if (whereIdx >= 0) {
    let endIdx = afterFrom.length;
    if (groupByIdx > whereIdx && groupByIdx < endIdx) endIdx = groupByIdx;
    if (orderByIdx > whereIdx && orderByIdx < endIdx) endIdx = orderByIdx;
    whereClause = afterFrom.substring(whereIdx + 6, endIdx).trim();
  }

  // 提取 ORDER BY 子句
  let orderClause: string | undefined;
  if (orderByIdx >= 0) {
    orderClause = afterFrom.substring(orderByIdx + 9).trim();
  }

  const table = getTable(tableName);
  let rows = [...table.rows];

  // WHERE 子句
  if (whereClause) {
    rows = rows.filter((row) => evaluateWhere(row, whereClause));
  }

  // ORDER BY — 提取首个排序列和方向（多列排序取第一列）
  if (orderClause) {
    // 去掉末尾分号
    const cleanOrder = orderClause.replace(/;+$/, '').trim();
    // 提取第一个排序列：c.sort_order ASC, c.created_at DESC → c.sort_order
    const firstColMatch = cleanOrder.match(/^(\S+)/);
    if (firstColMatch) {
      const orderCol = firstColMatch[1];
      // 提取方向：查找列名后的 ASC 或 DESC（处理 "ASC," 中的逗号）
      const afterCol = cleanOrder.substring(orderCol.length).trimStart();
      const dirWord = afterCol.split(/[\s,]+/)[0]?.toUpperCase();
      const orderDir = dirWord === 'ASC' ? 1 : -1;
      rows.sort((a, b) => {
        const va = a[orderCol] ?? '';
        const vb = b[orderCol] ?? '';
        if (typeof va === 'number' && typeof vb === 'number') {
          return (va - vb) * orderDir;
        }
        return String(va).localeCompare(String(vb)) * orderDir;
      });
    }
  }

  // SELECT 表达式处理
  if (selectExpr === '*') {
    return rows;
  }

  // 处理 table.* — 展开为所有列（等同于 SELECT *）
  const tableStarMatch = selectExpr.match(/^(\w+)\.\*$/);
  if (tableStarMatch) {
    return rows;
  }

  // 混合表达式：可能有 table.* + 聚合函数，或普通列 + 聚合函数
  // 先尝试拆分为多个表达式，分别处理
  const exprParts = splitSelectExpressions(selectExpr);

  // 检查是否为纯聚合查询（所有部分都是聚合函数）
  const allAggregate = exprParts.every((p) => isAggregateExpr(p));

  if (allAggregate) {
    // 纯聚合查询 — 返回单行
    const result: Record<string, any> = {};
    for (const part of exprParts) {
      const aggResult = evaluateAggregate(part, rows);
      Object.assign(result, aggResult);
    }
    return [result];
  }

  // 混合或纯列选择 — 每行映射

  // 解析 JOIN 别名映射：alias → real_table_name（如 "bc" → "book_collections"）
  const aliasMap = parseJoinAliases(afterFrom, tableName);

  return rows.map((row) => {
    const result: Record<string, any> = {};
    for (const part of exprParts) {
      // 跳过 table.* 通配符（已在列处理中覆盖）
      if (/^\w+\.\*$/.test(part)) {
        // 展开该表的所有列
        Object.assign(result, row);
        continue;
      }
      // 聚合函数在混合模式下的处理（如 c.*, COUNT(...) as book_count）
      if (isAggregateExpr(part)) {
        // 检查是否为跨表聚合（如 COUNT(bc.book_id) — bc 是 JOIN 表的别名）
        const crossResult = evaluateCrossTableAggregate(part, row, aliasMap);
        if (crossResult) {
          Object.assign(result, crossResult);
        } else {
          Object.assign(result, evaluateAggregate(part, rows));
        }
        continue;
      }
      // 处理 "col as alias" 或 "table.col as alias"
      const asMatch = part.match(/^(\w+(?:\.\w+)?)\s+AS\s+(\w+)$/i);
      if (asMatch) {
        const colName = asMatch[1].includes('.') ? asMatch[1].split('.')[1] : asMatch[1];
        result[asMatch[2]] = row[colName] ?? null;
      } else if (/^\w+(?:\.\w+)?$/.test(part)) {
        // 简单列名 或 table.col
        const colName = part.includes('.') ? part.split('.')[1] : part;
        result[colName] = row[colName] ?? null;
      } else {
        // 无法识别的表达式，设为 null
        result[part] = null;
      }
    }
    return result;
  });
}

// ---- execSelect 辅助函数 ----

/** 按逗号分割 SELECT 表达式（处理括号嵌套） */
function splitSelectExpressions(expr: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === '(') {
      depth++;
      current += ch;
    } else if (ch === ')') {
      depth--;
      current += ch;
    } else if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** 判断是否为聚合表达式 */
function isAggregateExpr(expr: string): boolean {
  return /^(?:MAX|MIN|COUNT|SUM|AVG|COALESCE)\s*\(/i.test(expr.trim());
}

/** 计算聚合表达式的结果（支持可选 AS alias） */
function evaluateAggregate(expr: string, rows: Record<string, any>[]): Record<string, any> {
  const trimmed = expr.trim();

  // 提取 AS alias（可选；无 alias 时用 _result 作临时键名）
  let alias = '_result';
  let coreExpr = trimmed;
  const asMatch = trimmed.match(/^(.*)\s+AS\s+(\w+)$/i);
  if (asMatch) {
    coreExpr = asMatch[1].trim();
    alias = asMatch[2];
  }

  // COUNT(*)
  if (/^COUNT\(\*\)$/i.test(coreExpr)) return { [alias]: rows.length };

  // COUNT(col)
  let m = coreExpr.match(/^COUNT\((\w+(?:\.\w+)?)\)$/i);
  if (m) {
    const col = m[1].includes('.') ? m[1].split('.')[1] : m[1];
    return { [alias]: rows.filter((r) => r[col] != null).length };
  }

  // MAX(col)
  m = coreExpr.match(/^MAX\((\w+(?:\.\w+)?)\)$/i);
  if (m) {
    const col = m[1].includes('.') ? m[1].split('.')[1] : m[1];
    if (rows.length === 0) return { [alias]: 0 };
    return { [alias]: Math.max(...rows.map((r) => r[col] ?? 0)) };
  }

  // SUM(col)
  m = coreExpr.match(/^SUM\((\w+(?:\.\w+)?)\)$/i);
  if (m) {
    const col = m[1].includes('.') ? m[1].split('.')[1] : m[1];
    return { [alias]: rows.reduce((acc, r) => acc + (Number(r[col]) || 0), 0) };
  }

  // COALESCE(innerExpr, default) — innerExpr 会被递归计算
  m = coreExpr.match(/^COALESCE\((.+),\s*(.+)\)$/i);
  if (m) {
    const innerResult = evaluateAggregate(m[1], rows);
    const innerVal = Object.values(innerResult)[0];
    const defaultVal = parseValue(m[2].trim());
    return { [alias]: innerVal ?? defaultVal };
  }

  // 无法识别的聚合，返回 0
  return { [alias]: 0 };
}

// ---- 跨表聚合支持（Web DB 不实现真正 JOIN，按需查找关联表） ----

/** 从 SQL 片段中解析 JOIN 别名映射：alias → real_table_name */
function parseJoinAliases(afterFrom: string, fromTable: string): Map<string, string> {
  const map = new Map<string, string>();
  // 匹配: LEFT JOIN table_name alias 或 INNER JOIN table_name alias
  const joinRe = /(?:LEFT|INNER|RIGHT)?\s*JOIN\s+(\w+)\s+(\w+)/gi;
  let m: RegExpExecArray | null;
  while ((m = joinRe.exec(afterFrom)) !== null) {
    map.set(m[2], m[1]); // alias → table_name
  }
  // FROM 表自身的别名（如 "collections c"）
  const fromAliasMatch = afterFrom.match(/^\s*(\w+)/);
  if (fromAliasMatch && fromAliasMatch[1].toLowerCase() !== 'left' && fromAliasMatch[1].toLowerCase() !== 'inner') {
    map.set(fromAliasMatch[1], fromTable);
  }
  return map;
}

/**
 * 对跨表聚合求值（如 COUNT(bc.book_id) AS book_count）
 * 返回 null 表示不是跨表聚合，应由 evaluateAggregate 处理
 */
function evaluateCrossTableAggregate(
  expr: string,
  currentRow: Record<string, any>,
  aliasMap: Map<string, string>,
): Record<string, any> | null {
  const trimmed = expr.trim();

  // 提取 AS alias
  let alias = '_result';
  let coreExpr = trimmed;
  const asMatch = trimmed.match(/^(.*)\s+AS\s+(\w+)$/i);
  if (asMatch) {
    coreExpr = asMatch[1].trim();
    alias = asMatch[2];
  }

  // 匹配 COUNT(table_alias.col) 或 COUNT(table_alias.*)
  const countMatch = coreExpr.match(/^COUNT\((\w+)\.(\w+|\*)\)$/i);
  if (!countMatch) return null;

  const refAlias = countMatch[1]; // e.g., "bc"
  const refTable = aliasMap.get(refAlias);
  if (!refTable || !tables.has(refTable)) return null;

  const refRows = tables.get(refTable)!.rows;

  // 找到 JOIN 条件中的关联列（从 currentRow 中找外键）
  // 对于 book_collections，collection_id 是关联键
  // 启发式：用 currentRow.id 匹配 refRow 中的 *_id 列
  const fromId = currentRow['id'];
  if (fromId == null) return null;

  // 在引用表中查找匹配的外键列（以 _id 结尾且值匹配的列名）
  // 例如 book_collections 中 collection_id 匹配 collections 的 id
  let count = 0;
  for (const refRow of refRows) {
    // 尝试所有可能的外键列
    const fkCols = Object.keys(refRow).filter((k) => k.endsWith('_id'));
    for (const fkCol of fkCols) {
      if (refRow[fkCol] === fromId) {
        count++;
        break; // 每行只计数一次
      }
    }
  }

  return { [alias]: count };
}

function evaluateWhere(row: Record<string, any>, where: string): boolean {
  // 支持 =, !=, IS NULL, IS NOT NULL, IN (...), AND
  where = where.trim();

  // 处理 AND 连接
  if (/\s+AND\s+/i.test(where)) {
    const parts = where.split(/\s+AND\s+/i);
    return parts.every((p) => evaluateWhere(row, p));
  }

  // IS NOT NULL
  const isNotNullMatch = where.match(/^(\w+)\s+IS\s+NOT\s+NULL$/i);
  if (isNotNullMatch) {
    return row[isNotNullMatch[1]] != null;
  }

  // IS NULL
  const isNullMatch = where.match(/^(\w+)\s+IS\s+NULL$/i);
  if (isNullMatch) {
    return row[isNullMatch[1]] == null;
  }

  // IN (...) — 简化处理：col IN (val1, val2, ...)
  const inMatch = where.match(/^(\w+)\s+IN\s+\((.+)\)$/i);
  if (inMatch) {
    const col = inMatch[1];
    const vals = inMatch[2].split(',').map((s) => {
      const t = s.trim();
      if (t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1);
      return t;
    });
    return vals.includes(String(row[col]));
  }

  // !=
  const neqMatch = where.match(/^(\w+)\s*!=\s*(.+)$/);
  if (neqMatch) {
    const col = neqMatch[1];
    const val = parseValue(neqMatch[2]);
    return row[col] != val;
  }

  // =
  const eqMatch = where.match(/^(\w+)\s*=\s*(.+)$/);
  if (eqMatch) {
    const col = eqMatch[1];
    const val = parseValue(eqMatch[2]);
    return row[col] == val || String(row[col]) === String(val);
  }

  // LIKE
  const likeMatch = where.match(/^(\w+)\s+LIKE\s+(.+)$/i);
  if (likeMatch) {
    const col = likeMatch[1];
    const val = parseValue(likeMatch[2]);
    const pattern = String(val).replace(/%/g, '.*').replace(/_/g, '.');
    return new RegExp(pattern, 'i').test(String(row[col] ?? ''));
  }

  console.warn('[WebDB] Unhandled WHERE clause:', where);
  return true;
}

function parseValue(raw: string): any {
  raw = raw.trim();
  if (raw === 'NULL') return null;
  if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) {
    return raw.slice(1, -1).replace(/''/g, "'");
  }
  const n = Number(raw);
  return isNaN(n) ? raw : n;
}

function execDelete(sql: string): { lastInsertRowId: number; changes: number } {
  const m = sql.match(/DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?\s*;?$/is);
  if (!m) throw new Error(`Cannot parse DELETE: ${sql}`);

  const tableName = m[1];
  const whereClause = m[2]?.trim();

  const table = getTable(tableName);

  if (!whereClause) {
    const count = table.rows.length;
    table.rows = [];
    return { lastInsertRowId: 0, changes: count };
  }

  const before = table.rows.length;
  table.rows = table.rows.filter((row) => !evaluateWhere(row, whereClause));
  return { lastInsertRowId: 0, changes: before - table.rows.length };
}

function execUpdate(sql: string): { lastInsertRowId: number; changes: number } {
  // UPDATE table SET col=val, col=val, ... WHERE col=val
  const m = sql.match(
    /UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+?))?\s*;?$/is
  );
  if (!m) throw new Error(`Cannot parse UPDATE: ${sql}`);

  const tableName = m[1];
  const setClause = m[2].trim();
  const whereClause = m[3]?.trim();

  const table = getTable(tableName);

  // 解析 SET 子句
  const setPairs: [string, any][] = [];
  const setParts = splitByCommaTopLevel(setClause);
  for (const part of setParts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx < 0) continue;
    const col = part.substring(0, eqIdx).trim();
    const val = parseValue(part.substring(eqIdx + 1).trim());
    setPairs.push([col, val]);
  }

  let changes = 0;
  for (const row of table.rows) {
    if (!whereClause || evaluateWhere(row, whereClause)) {
      for (const [col, val] of setPairs) {
        row[col] = val;
      }
      changes++;
    }
  }
  return { lastInsertRowId: 0, changes };
}

function execSql(sql: string, params?: any[]): void {
  const bound = bindParams(sql, params ?? []);
  const stmts = bound.split(';').filter((s) => s.trim());
  for (const stmt of stmts) {
    const trimmed = stmt.trim();
    if (!trimmed) continue;
    if (/^PRAGMA/i.test(trimmed)) continue; // PRAGMA — no-op
    if (/CREATE\s+(TABLE|INDEX)/i.test(trimmed)) {
      execCreateTable(trimmed);
    } else {
      // ALTER TABLE — no-op on Web (schema is pre-created by migrations)
      if (/ALTER\s+TABLE/i.test(trimmed)) continue;
      throw new Error(`Unexpected statement in execAsync: ${trimmed.substring(0, 50)}`);
    }
  }
}

// ============================================================
// 数据库接口（与 expo-sqlite 兼容）
// ============================================================

const dbApi = {
  /**
   * 执行写操作（INSERT / UPDATE / DELETE）
   * 返回 { lastInsertRowId, changes }
   */
  runAsync(sql: string, ...params: any[]): Promise<{ lastInsertRowId: number; changes: number }> {
    try {
      const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      const bound = bindParams(sql, flatParams);
      const trimmed = bound.trim().replace(/;+$/, '');

      if (/^INSERT\s/i.test(trimmed)) {
        return Promise.resolve(execInsert(trimmed));
      }
      if (/^DELETE\s/i.test(trimmed)) {
        return Promise.resolve(execDelete(trimmed));
      }
      if (/^UPDATE\s/i.test(trimmed)) {
        return Promise.resolve(execUpdate(trimmed));
      }

      console.warn('[WebDB] Unhandled runAsync:', trimmed.substring(0, 80));
      return Promise.resolve({ lastInsertRowId: 0, changes: 0 });
    } catch (e: any) {
      console.error('[WebDB] runAsync error:', e.message, sql.substring(0, 80));
      return Promise.resolve({ lastInsertRowId: 0, changes: 0 });
    }
  },

  /**
   * 查询单行
   */
  getFirstAsync<T = any>(sql: string, ...params: any[]): Promise<T | null> {
    try {
      const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      const bound = bindParams(sql, flatParams);
      const rows = execSelect(bound);
      return Promise.resolve((rows[0] as T) ?? null);
    } catch (e: any) {
      console.error('[WebDB] getFirstAsync error:', e.message, sql.substring(0, 80));
      return Promise.resolve(null);
    }
  },

  /**
   * 查询所有行
   */
  getAllAsync<T = any>(sql: string, ...params: any[]): Promise<T[]> {
    try {
      const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      const bound = bindParams(sql, flatParams);
      const rows = execSelect(bound);
      return Promise.resolve(rows as T[]);
    } catch (e: any) {
      console.error('[WebDB] getAllAsync error:', e.message, sql.substring(0, 80));
      return Promise.resolve([]);
    }
  },

  /**
   * 执行 DDL（CREATE TABLE / PRAGMA / ALTER TABLE）
   */
  execAsync(sql: string): Promise<void> {
    try {
      execSql(sql);
    } catch (e: any) {
      console.error('[WebDB] execAsync error:', e.message, sql.substring(0, 80));
    }
    return Promise.resolve();
  },

  /**
   * 关闭数据库（Web 端为 no-op）
   */
  closeAsync(): Promise<void> {
    return Promise.resolve();
  },
};

// ============================================================
// 数据库初始化（创建表结构 — 与 schema.ts 的 ALL_MIGRATIONS 同步）
// ============================================================

let db: typeof dbApi | null = null;
let initialized = false;

async function initSchema(): Promise<void> {
  if (initialized) return;

  // 版本记录表
  execCreateTable(
    `CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )`
  );

  // 书本表
  execCreateTable(
    `CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT,
      description TEXT,
      cover_url TEXT,
      isbn TEXT,
      page_count INTEGER,
      status TEXT NOT NULL,
      rating INTEGER,
      accent_color TEXT,
      category TEXT,
      finished_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  );

  // 阅读来源表
  execCreateTable(
    `CREATE TABLE IF NOT EXISTS reading_sources (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      file_uri TEXT,
      file_name TEXT,
      current_page REAL,
      created_at TEXT NOT NULL
    )`
  );

  // 阅读记录表
  execCreateTable(
    `CREATE TABLE IF NOT EXISTS reading_sessions (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      source_id TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration_ms INTEGER,
      source_label TEXT,
      page_number INTEGER,
      chapter TEXT,
      completed_book INTEGER,
      created_at TEXT NOT NULL
    )`
  );

  // 手动补录表
  execCreateTable(
    `CREATE TABLE IF NOT EXISTS manual_logs (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      source_id TEXT,
      duration_ms INTEGER NOT NULL,
      logged_at TEXT NOT NULL,
      note TEXT,
      source_label TEXT,
      page_number INTEGER,
      chapter TEXT,
      completed_book INTEGER,
      created_at TEXT NOT NULL
    )`
  );

  // 标签表
  execCreateTable(
    `CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT,
      is_system INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )`
  );

  // 书本-标签关联表
  execCreateTable(
    `CREATE TABLE IF NOT EXISTS book_tags (
      book_id TEXT NOT NULL,
      tag_id TEXT NOT NULL
    )`
  );

  // 书单表
  execCreateTable(
    `CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      sort_order INTEGER,
      created_at TEXT NOT NULL
    )`
  );

  // 书单-书本关联表
  execCreateTable(
    `CREATE TABLE IF NOT EXISTS book_collections (
      book_id TEXT NOT NULL,
      collection_id TEXT NOT NULL,
      added_at TEXT NOT NULL
    )`
  );

  // 笔记表
  execCreateTable(
    `CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      content TEXT NOT NULL,
      page_number INTEGER,
      chapter TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  );

  // 高亮表
  execCreateTable(
    `CREATE TABLE IF NOT EXISTS highlights (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      content TEXT NOT NULL,
      color TEXT NOT NULL,
      note TEXT,
      page_number INTEGER,
      chapter TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  );

  // 年度目标表
  execCreateTable(
    `CREATE TABLE IF NOT EXISTS reading_goals (
      year INTEGER PRIMARY KEY,
      target_books INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  );

  // 用户设置表
  execCreateTable(
    `CREATE TABLE IF NOT EXISTS user_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`
  );

  initialized = true;
  console.log('[WebDB] 内存数据库表结构初始化完成');
}

export async function getDatabase(): Promise<typeof dbApi> {
  if (db) return db;

  console.log('[Web] 使用内存数据库模式（数据在同一会话内持久化）');
  await initSchema();
  db = dbApi;
  return db;
}

export async function closeDatabase(): Promise<void> {
  db = null;
  initialized = false;
}
