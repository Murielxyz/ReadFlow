# ReadFlow 架构设计

> 版本: v2.3 | 更新: 2026-07-09

---

## 分层架构

```
┌─────────────────────────────────────────┐
│  UI 层 (app/ + components/)             │  ← 用户可见的界面
├─────────────────────────────────────────┤
│  状态管理层 (stores/)                    │  ← Zustand，各领域独立
├─────────────────────────────────────────┤
│  业务逻辑层 (services/)                  │  ← 跨 Store 的复杂操作
├─────────────────────────────────────────┤
│  数据层 (db/)                            │  ← SQLite，表结构 + 迁移
└─────────────────────────────────────────┘
```

## 层间通信规则

1. **UI → Store**：组件通过 `useXxxStore()` Hook 读写状态
2. **Store → DB**：Store 内部直接调用 `getDatabase()`，组件不碰数据库
3. **跨 Store**：组件协调多个 Store，Store 之间不互相导入

```
✅ 正确: Component 调用 bookStore.addBook() + tagStore.addTag()
❌ 错误: useReadingStore 内部 import useBookStore
```

## 路由设计

```
_layout.tsx (根布局)
├── (tabs)/_layout.tsx (底部 4 Tab)
│   ├── today.tsx          → Today（今日阅读概览）
│   ├── library.tsx        → Library（书库 + 在线搜索）
│   ├── statistics.tsx     → Statistics（阅读统计）
│   └── profile.tsx        → Profile（个人设置）
├── book/[id].tsx          → 书籍详情（压栈）
├── reader/[bookId].tsx    → 阅读器（全屏 Modal）
├── add-book.tsx           → 添加书本（Modal）
├── search.tsx             → 独立搜索页
├── timer.tsx              → 全屏计时器
├── my-reading.tsx         → 我的阅读（统计详情）
├── collection-manage.tsx  → 书单管理
└── collection/[id].tsx    → 书单详情页
```

### 路由命名规则

- Tab 页：`app/(tabs)/<name>.tsx`，在 `_layout.tsx` 中通过 `<Tabs.Screen name="<name>">` 注册
- 动态路由：`app/book/[id].tsx` → `/book/:id`
- 全屏 Modal：`presentation: 'fullScreenModal'`

## 目录结构

```
src/
├── components/
│   ├── common/               # 通用 UI 组件 (Button, Card, Badge, Rating, EmptyState)
│   ├── today/                # Today 页专属组件
│   ├── library/              # Library 页专属组件 (BookCard, BookGrid, BookFilters, CreateCollectionSheet 等)
│   ├── book/                 # 书籍详情页专属组件 (BookCover, ReadingTimeline, SourceCard 等)
│   ├── reader/               # 阅读器专属组件 (TimerFloating, ManualLogSheet, StopTimerSheet)
│   ├── statistics/           # Statistics 页专属组件 (StatCards, MiniCalendar, TimeFilter)
│   └── profile/              # Profile 页专属组件
│
├── models/                   # TypeScript 类型定义 (book, tag, collection, reading-session, reading-source, note, highlight)
├── services/                 # 跨 Store 业务逻辑 (importService, readerHTML, searchBooks, notificationService)
├── stores/                   # Zustand 状态管理 (7+ stores)
├── db/                       # 数据库 (database.ts, schema.ts, seeds.ts)
├── hooks/                    # 自定义 Hook (useToday, useStatistics)
├── theme/                    # 主题 (colors, spacing, radii, typography, shadows)
├── constants/                # 常量 (状态选项、默认值)
├── data/                     # 数据 (mockData.ts — 仅保留每日名言)
└── utils/                    # 工具函数 (id, format, haptics, navigation)
```

## 数据库 ER 图（简化）

```
books ──┬── reading_sources ──┬── reading_sessions
        │                     └── manual_logs
        ├── book_tags ── tags
        └── book_collections ── collections
```

## 关键设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| ID 生成 | nanoid (21字符) | URL 友好，无需加密级随机 |
| 计时持久化 | 开始时写一行 end_time=NULL，结束时 UPDATE | 1秒 tick 一次不写库 |
| 数据冗余 | sessions 表存 source_label | 时间线无需 JOIN |
| 乐观更新 | 先改 Store → 再写 DB → 失败回滚 | UI 即时响应 |
| 阅读器隔离 | WebView 只收 sourceId，不碰 DB | 阅读器可独立替换 |
| 颜色策略 | 静态导入 + 动态叠加 | StyleSheet.create 用静态默认值，inline style 用 useColors() 动态色 |
| 设计风格 | 温暖简约 | 纯白背景 #FFFFFF，卡片 #F6F6F8，1px #E5E0DB 边框，极轻阴影 |
