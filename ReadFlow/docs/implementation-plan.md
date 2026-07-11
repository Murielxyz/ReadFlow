# ReadFlow 执行步骤

> 版本: v2.3 | 更新: 2026-07-05

---

## 阶段总览

| 阶段 | 内容 | 优先级 | 状态 |
|------|------|--------|------|
| 1 | 项目搭建 + 基础架构 | 🔴 必须 | ✅ 完成 |
| 2 | 书架 + 添加书本 | 🔴 必须 | ✅ 完成 |
| 3 | 书籍详情页 | 🔴 必须 | ✅ 完成 |
| 4 | 计时系统 | 🔴 必须 | ✅ 完成 |
| 5 | 阅读来源 + 文件导入 | 🟡 重要 | ✅ 完成 |
| 6 | 阅读器 | 🟡 重要 | ✅ 完成 |
| 7 | 标签 + 书单 | 🟢 增强 | ✅ 完成 |
| 8 | 打磨（动画/震动/暗色模式） | 🟢 增强 | ✅ 完成 |
| **9** | **v2.0 设计重构：温暖简约风格** | 🔴 必须 | ✅ 完成 |
| 10 | Statistics 页面 + 数据可视化 | 🟡 重要 | ✅ 完成 |
| 11 | 旧页面风格迁移 + 组件统一 | 🟡 重要 | ✅ 完成 |
| 12 | Today 页面接入真实数据 | 🟡 重要 | ✅ 完成 |
| 13 | Discover 页面接入真实搜索 (OpenLibrary) | 🟡 重要 | ✅ 完成 |
| 14 | Library 真实数据 + Profile 功能完善 | 🟡 重要 | ✅ 完成 |
| 15 | 统计增强 + 备份恢复 + 阅读进度 | 🟡 重要 | ✅ 完成 |
| **16** | **3 核心页面增强：Library / Discover / Statistics** | 🔴 必须 | ✅ 完成 |
| **17** | **阅读计时增强：后台计时 + 停止弹窗 + 页数/章节** | 🔴 必须 | ✅ 完成 |
| **18** | **笔记系统（Notes）** | 🟡 重要 | ✅ 完成 |
| **19** | **每日阅读提醒（Daily Reading Reminders）** | 🟡 重要 | ✅ 完成 |
| **20** | **设置持久化与应用打磨（Settings Persistence & Polish）** | 🟡 重要 | ✅ 完成 |
| **21** | **高亮系统（Highlights System）** | 🟡 重要 | ✅ 完成 |
| **22** | **Bug 修复 & 版本号更新（Bug Fixes & Polish）** | 🔴 必须 | ✅ 完成 |
| **23** | **书单导航 + 统计修复 + 死代码清理（Collection Nav & Polish）** | 🔴 必须 | ✅ 完成 |
| **24** | **Profile 占位符修复 + 用户个性化（Profile Polish）** | 🔴 必须 | ✅ 完成 |
| **25** | **Reader 文字选中高亮（Text-Selection Highlighting）** | 🟡 重要 | ✅ 完成 |
| **26** | **备份/恢复补全（Backup/Restore Completion）** | 🔴 必须 | ✅ 完成 |
| **27** | **书单创建跨平台 + 编辑（Collection Create/Edit Cross-Platform）** | 🔴 必须 | ✅ 完成 |
| **28** | **书单详情页（Collection Detail Page）** | 🟡 重要 | ✅ 完成 |

---

## 阶段 1-8：v1.0 Neo-Brutalist 版本 ✅

v1.0 所有 8 个阶段已完成。实现了完整的 Neo-Brutalist 风格（硬阴影 + 2px 黑边框）阅读记录 App，包括书架管理、计时系统、阅读器、标签/书单系统、暗色模式。

---

## 阶段 9：v2.0 设计重构 — 温暖简约风格 🔄

### 目标
将 App 从 Neo-Brutalist 风格全面迁移到温暖简约风格。

### 子任务

- [x] 9.1 更新色彩系统 `src/theme/colors.ts`（温暖简约色板 + 兼容别名）
- [x] 9.2 更新阴影系统 `src/theme/shadows.ts`（极轻阴影 + 兼容别名）
- [x] 9.3 创建 Mock 数据 `src/data/mockData.ts`
- [x] 9.4 底部导航栏 4 Tab（Today / Library / Discover / Profile）
- [x] 9.5 Today 页面（问候语 + 英雄卡片 + 今日统计 + 时间线 + 目标 + 名言）
- [x] 9.6 Library 页面（搜索 + 筛选 + 2 列卡片网格）
- [x] 9.7 Discover 页面（搜索 + 推荐区域）
- [x] 9.8 Profile 页面（用户信息 + 设置列表 + 深色模式开关）
- [x] 9.9 创建 `constants/theme.ts` 设计令牌文件
- [x] 9.10 更新 5 份 docs/ 文档（PRD / 设计 / 架构 / 进度 / 技术栈）
- [x] 9.11 创建 `.claude/skills/` 6 个 Skill 文件
- [x] 9.12 更新 `CLAUDE.md`
- [x] 9.13 创建 Statistics 页面 + 更新 Tab 导航为 5 Tab
- [x] 9.14 改造 `app/book/[id].tsx`（Neo-Brutalist → 温暖简约）
- [x] 9.15 改造 `app/reader/[bookId].tsx`（Neo-Brutalist → 温暖简约）
- [x] 9.16 改造 `app/add-book.tsx`（Neo-Brutalist → 温暖简约）
- [x] 9.17 改造 `library/BookCard.tsx`（Neo-Brutalist → 温暖简约）
- [x] 9.18 改造 `library/BookListItem.tsx`（Neo-Brutalist → 温暖简约）
- [x] 9.19 TypeScript 编译验证通过（零错误）

---

## 阶段 10：Statistics 页面 + 数据可视化 ✅

### 目标
实现阅读统计页面，展示阅读数据和趋势。

### 子任务

- [x] 10.1 总览统计卡片（总时长/读完本数/本月时长/本周时长）
- [x] 10.2 阅读热力图（90 天）
- [x] 10.3 阅读趋势图表（周/月维度）— 占位，待后续图表库
- [x] 10.4 接入真实统计数据（useStatistics Hook + SQLite 聚合查询）

---

## 阶段 11：旧页面风格迁移 + 组件统一 ✅

### 目标
将剩余 Neo-Brutalist 页面和组件全部迁移到温暖简约风格。

### 子任务

- [x] 11.1 改造书籍详情页（book/[id].tsx）— 已在 Phase 9 完成
- [x] 11.2 改造阅读器页面（reader/[bookId].tsx）— 已在 Phase 9 完成
- [x] 11.3 改造添加书本页（add-book.tsx）— 已在 Phase 9 完成
- [x] 11.4 改造 BookCard 和 BookListItem 组件 — 已在 Phase 9 完成
- [x] 11.5 统一所有组件的设计风格 — 14 个组件 + readerHTML.ts
  - common: Badge, Card, EmptyState, Button, Rating
  - book: BookCover, SourceCard, ReadingTimeline, AddSourceSheet, TagPicker, CollectionPicker
  - reader: TimerFloating, ManualLogSheet
  - library: BookFilters
  - services: readerHTML.ts
- [x] 11.6 最终 TypeScript 编译验证（零错误 ✅）
- [x] 11.7 添加「用户手动操作提醒原则」到项目文档

---

## 阶段 12：Today 页面接入真实数据 ✅

### 目标
将 Today 页面从 Mock 数据迁移到 SQLite 真实数据。

### 子任务

- [x] 12.1 创建 `useToday` Hook
  - 今日阅读时长 & 次数（从 `reading_sessions` + `manual_logs` 按 `date()` 聚合）
  - 连续阅读天数 streak（按天去重后往回数连续天数）
  - 最近阅读时间线（UNION 两张表 JOIN books 取最近 10 条）
  - 当前在读书籍总阅读时长
  - 每日阅读目标默认 30 分钟
- [x] 12.2 重写 `app/(tabs)/today.tsx`
  - 替换所有 Mock 引用为 `useToday()` + `useBookStore()`
  - 英雄卡片：真实在读书籍 + 总阅读时长 + 点击跳转详情页
  - 无在读书籍时显示引导卡片
  - 空状态：无任何藏书时显示引导添加
  - 加载态：ActivityIndicator
  - Tab 聚焦时自动刷新（`useFocusEffect`）
  - 时间线条目可点击跳转对应书籍详情
  - 每日名言保留 Mock（非数据驱动）
- [x] 12.3 TypeScript 编译验证（零错误 ✅）

---

## 阶段 13：Discover 页面接入真实搜索 ✅

### 目标
将 Discover 页面从 Mock 数据迁移到 OpenLibrary API 真实搜索。

### 子任务

- [x] 13.1 创建 `src/services/searchBooks.ts` — OpenLibrary 搜索服务
  - `searchBooks(query)` 调用 OpenLibrary Search API
  - 映射字段：title / author / coverUrl / publishYear / isbn / description
  - 封面 URL：`https://covers.openlibrary.org/b/id/<id>-M.jpg`
- [x] 13.2 重写 `app/(tabs)/discover.tsx`
  - 真实 API 搜索（按钮触发 + Enter 键）
  - 搜索中 / 错误 / 空结果 三态处理
  - 搜索结果可添加书本到书库（调用 `useBookStore.addBook()`）
  - 已添加检测：ISBN 匹配 或 书名完全匹配
  - 热门推荐：静态精选列表，点击自动搜索
  - Tab 聚焦时刷新书库列表
- [x] 13.3 TypeScript 编译验证（零错误 ✅）

---

## 阶段 14：Library 真实数据 + Profile 功能完善 ✅

### 目标
修复 Library 页面仍使用 Mock 数据的问题，完善 Profile 页面交互功能。

### 子任务

- [x] 14.1 Library 页面接入真实数据
  - 替换 `MOCK_BOOKS` → `useBookStore`
  - 书本卡片点击导航至 `book/[id]`
  - 加载态 + 空书库引导 + Tab 聚焦刷新
- [x] 14.2 创建 `useSettingsStore`（每日目标可配置）
- [x] 14.3 Profile 页面：每日目标可点击修改（Modal 选择器）
- [x] 14.4 Profile 页面：数据导出功能（Share API，JSON 格式）
- [x] 14.5 Today 页面：每日目标改用动态设置
- [x] 14.6 版本号统一更新至 v2.0.0
- [x] 14.7 TypeScript 编译验证（零错误 ✅）

---

## 阶段 15：统计增强 + 备份恢复 + 阅读进度 ✅

### 目标
实现统计趋势图表、数据备份恢复功能，以及 Today 页面阅读进度展示。

### 子任务

- [x] 15.1 统计趋势图（纯 RN 柱状图）
  - 添加 `weeklyTrend` / `monthlyTrend` 数据（从 heatmap 派生）
  - 实现 `TrendChart` 纯 RN 柱状图组件（不依赖外部图表库）
  - 周/月视图切换（Pill Toggle）
  - 今日高亮、数值标签、水平滚动（月视图 30 天）
  - 温暖简约风格配色
- [x] 15.2 数据备份 + 恢复
  - 备份：导出 JSON 写入本地文件系统（`expo-file-system` v57 `Paths.document` + `File` API）
  - 恢复：系统文件选择器选取 JSON → 解析 → 导入 SQLite
  - 去重：书籍按 title+author 匹配，会话/记录/来源用 `INSERT OR IGNORE`
  - Profile "数据管理" 新增"备份数据"和"恢复数据"按钮
- [x] 15.3 Today 页面阅读进度
  - `useToday` Hook 新增 `currentBookPageCurrent` / `currentBookPageTotal` 字段
  - 从 `reading_sources.current_page` 聚合已读页数
  - 英雄卡片展示：第 X/Y 页 · 累计 N 小时
  - 无 page_count 的书籍仅显示时长
- [x] 15.4 TypeScript 编译验证（零错误 ✅）

---

## 阶段 16：3 核心页面增强 ✅

### 目标
重写 Library、Discover、Statistics 三个核心页面，优化交互、筛选、搜索和可视化。

### 子任务

- [x] 16.1 Library 页面重写（书架/书单双 Tab、筛选面板、排序面板、导入弹窗、长按菜单）
- [x] 16.2 Discover 页面重写（搜索、推荐、手动添加、最近加入书架）
- [x] 16.3 Statistics 页面重写（周/月/年/总 4 Tab、5 统计卡片、日历热力图、目标管理）
- [x] 16.4 新增 `ImportModal`、`ManualAddModal` 组件
- [x] 16.5 新增 `useStatistics` Hook 全面扩展（年度/月度/周度）
- [x] 16.6 TypeScript 编译验证（零错误 ✅）

---

## 阶段 17：阅读计时增强 ✅

### 目标
后台计时补偿 + 停止弹窗（页数/章节/读完标记）+ 手动记录增强。

### 子任务

- [x] 17.1 数据库迁移 v2：reading_sessions & manual_logs 加 page_number/chapter/completed_book
- [x] 17.2 AppState 后台计时补偿（backgroundedAt 机制）
- [x] 17.3 StopTimerSheet 停止计时弹窗（页数/章节/读完标记）
- [x] 17.4 ManualLogSheet 增强：页数/章节/读完 toggle
- [x] 17.5 TimerFloating + stopTimer 两阶段流程改造
- [x] 17.6 "继续阅读" vs "开始阅读" 动态文案 + Reader 进度预填
- [x] 17.7 ReadingTimeline 展示页数/读完标签
- [x] 17.8 TypeScript 编译验证（零错误 ✅）

---

## 阶段 18：笔记系统 ✅

### 目标
为 ReadFlow 添加阅读笔记功能，支持添加/编辑/删除笔记，统计数据接入真实笔记数量。

### 子任务

- [x] 18.1 数据库迁移 v4：notes 表（book_id FK CASCADE + 索引）
- [x] 18.2 Note 模型 + useNoteStore（CRUD + 乐观更新）
- [x] 18.3 AddNoteSheet 组件（底部弹窗，新建/编辑双模式）
- [x] 18.4 书籍详情页集成笔记区（书单与时间线之间）
- [x] 18.5 useStatistics 接入真实笔记数量
- [x] 18.6 TypeScript 编译验证（零错误 ✅）

---

## 阶段 19：每日阅读提醒 ✅

### 目标
为 ReadFlow 添加每日阅读提醒功能，用户设置提醒时间后 App 每天定时推送通知。

### 子任务

- [x] 19.1 安装 expo-notifications + 配置 app.json（插件 + Android 通知频道）
- [x] 19.2 数据库迁移 v5：user_settings 表（key-value 持久化存储）
- [x] 19.3 扩展 useSettingsStore（reminderEnabled / reminderTime / loadSettings / 持久化到 SQLite）
- [x] 19.4 创建 notificationService（权限请求 / 调度 / 取消 / 更新）
- [x] 19.5 Profile 页面新增"每日阅读提醒"设置行 + 时间选择 Modal
- [x] 19.6 应用启动时恢复提醒调度（_layout.tsx）
- [x] 19.7 TypeScript 编译验证（零错误 ✅）

---

## 阶段 20：设置持久化与应用打磨 ✅

### 目标
修复用户偏好（每日目标、主题模式）重启后丢失的 Bug，激活 Profile 页评分/反馈按钮，清理死代码。

### 子任务

- [x] 20.1 持久化每日阅读目标（setDailyGoal 写入 user_settings，loadSettings 读取 daily_goal）
- [x] 20.2 持久化主题模式（useThemeStore 新增 loadTheme + toggle/setMode 写入 SQLite，_layout.tsx 启动加载）
- [x] 20.3 激活 Profile "给我们评分"和"反馈与帮助"按钮（Linking.openURL + Alert 降级）
- [x] 20.4 清理死代码（mockData.ts 删除未使用 exports，删除 BookFilters.tsx）
- [x] 20.5 TypeScript 编译验证（零错误 ✅）

---

## 阶段 21：高亮系统 ✅

### 目标
为 ReadFlow 添加阅读高亮功能，支持添加/编辑/删除高亮标记（含颜色选择 + 附加笔记），统计数据接入真实高亮数量。

### 子任务

- [x] 21.1 创建 Highlight 数据模型（`src/models/highlight.ts`）
- [x] 21.2 数据库迁移 v6：highlights 表（content / color / note / page_number / chapter）
- [x] 21.3 创建 useHighlightStore（CRUD + 乐观更新 + 失败回滚）
- [x] 21.4 创建 AddHighlightSheet 组件（颜色选择器 4 色 + 可选 note 字段 + 页码/章节）
- [x] 21.5 书籍详情页集成高亮区（笔记下方 / 时间线上方，颜色指示条卡片）
- [x] 21.6 Statistics 接入真实 highlightsCount + TypeScript 编译验证（零错误 ✅）

---

## 阶段 22：Bug 修复 & 版本号更新 ✅

### 目标
修复 Library 标签筛选不生效的 Bug，修复长按菜单「加入书单」静默失败 Bug，更新全局版本号 v2.0.0 → v2.2。

### 子任务

- [x] 22.1 标签筛选修复
  - useTagStore 新增 `bookTagMap`（Map<bookId, Set<tagId>>）+ `fetchAllBookTagIds()` 方法
  - assignTag / removeTag / deleteTag 同步更新 bookTagMap
  - library.tsx 加载 bookTagMap + processedBooks 中应用 OR 逻辑标签筛选
  - 修复长按菜单「加入书单」Bug（contextBookId 被提前清空导致静默失败）
- [x] 22.2 版本号更新
  - profile.tsx 4 处 v2.0.0 → v2.2
  - app.json version 1.0.0 → 2.2
- [x] 22.3 TypeScript 编译验证（零错误 ✅）

---

## 阶段 23：书单导航 + 统计修复 + 死代码清理 ✅

### 目标
修复书单卡片无法点击、统计标签计数不准、useBookStore 死代码清理。

### 子任务

- [x] 23.1 书单卡片可点击
  - useCollectionStore 新增 `bookCollectionMap` + `fetchAllBookCollectionIds()` + CRUD 联动
  - library.tsx 新增 `filterCollectionId` 状态 + processedBooks 书单筛选
  - 书单卡片 `onPress`：设置筛选 + 切换到书架 Tab
  - 筛选激活时显示紫色提示条（书单名 + 关闭按钮）
- [x] 23.2 统计标签修复：book/[id].tsx 标签/书单 计数改为 `bookTags.length + bookCollections.length`
- [x] 23.3 死代码清理：useBookStore 移除未使用的 `filters` / `setFilters` / `viewMode` / `setViewMode` / `getFilteredBooks`（40+ 行）
- [x] 23.4 TypeScript 编译验证（零错误 ✅）

---

## 开发规范

1. **每完成一个子任务** → 更新本文档勾选状态
2. **每完成一个阶段** → 在 dev-logs/ 下写阶段总结
3. **每天结束** → 更新 dev-logs/YYYY-MM-DD.md
4. **遇到问题** → 记录到 dev-logs/ 并在 CLAUDE.md 中更新注意事项

---

## ⚠️ 用户手动操作提醒原则

当开发进度接近需要用户手动操作的环节时，必须提前告知用户：

1. **提前告知**：在达到该环节前至少 2-3 步，主动提醒用户需要准备什么
2. **提供指引**：给出具体的操作步骤或参考链接
3. **等待确认**：用户完成后，让用户告知"已完成"，再继续下一步
4. **记录状态**：将"用户已确认完成"的记录写入开发日志或 CHANGELOG.md

### 需要提醒的场景清单

| 场景 | 提醒时机 | 需要用户准备的 |
| :--- | :--- | :--- |
| Discover 搜索 | 开始实现搜索功能前 | ~~Google Books API Key~~（已用 OpenLibrary，免费无需 Key） |
| Stitch MCP 配置 | 配置 MCP 前 | Stitch API Key |
| GitHub Actions | 配置自动化构建前 | GitHub Personal Access Token |
| App 图标 | 配置图标前 | 1024x1024 的图标图片（PNG） |
| 正式版 APK | 构建生产版本前 | Android Keystore（或让 EAS 自动生成） |
| 应用上架 | 准备发布前 | Apple/Google 开发者账号 |

### 提醒格式示例

> ⚠️ **用户操作提醒**
>
> 下一个环节需要你手动准备以下内容：
> - **内容**：[具体需要准备什么]
> - **用途**：[为什么需要]
> - **操作步骤**：[具体怎么做]
> - **参考链接**：[官方文档或教程]
>
> 准备好后，请告诉我"已完成"，我将继续下一步。

---

## 阶段 24：Profile 占位符修复 + 用户个性化 ✅

### 目标
修复 Profile 页面的硬编码占位符，支持用户编辑昵称和个性签名。

### 子任务

- [x] 24.1 `useSettingsStore` 新增 `userName` + `userBio` + `setUserName` + `setUserBio`（SQLite 持久化到 `user_settings` 表）
- [x] 24.2 用户卡片可点击 → 弹出编辑弹窗（昵称 TextInput + 个性签名 TextInput）
- [x] 24.3 头像字母随昵称动态变化
- [x] 24.4 `handleRateUs` 改为感谢弹窗（App 未上架，移除假 App Store 链接）
- [x] 24.5 `handleFeedback` 改为友好提示弹窗（移除假邮箱 `feedback@readflow.app`）
- [x] 24.6 TypeScript 编译验证通过（零错误）

### 改动文件清单

| # | 文件 | 操作 | 说明 |
|---|------|------|------|
| 1 | `src/stores/useSettingsStore.ts` | 修改 | 新增 `userName`/`userBio` 状态 + setter + `loadSettings` 持久化 |
| 2 | `app/(tabs)/profile.tsx` | 修改 | 用户卡片可点击 → 编辑弹窗 + rate/feedback 修复 |
| 3 | `docs/implementation-plan.md` | 修改 | Phase 24 记录 |

---

## 阶段 25：Reader 文字选中高亮（Text-Selection Highlighting）✅

### 目标
在 EPUB 阅读器中选中文字 → 浮动 🖍️ 按钮 → 一键填入高亮内容，不打断阅读流程。

### 子任务

- [x] 25.1 `AddHighlightSheet` 新增 `prefillContent` + `prefillChapter` props（向后兼容）
- [x] 25.2 EPUB 模板新增文字选中 JS：浮动高亮按钮 + `postMessage({ type: 'highlight', content, chapter })`
- [x] 25.3 Reader 页面处理 `highlight` 消息 + 嵌入 `AddHighlightSheet`
- [x] 25.4 TypeScript 编译验证通过（零错误）

### 技术要点

- **EPUB only**：PDF 使用 canvas 渲染，不支持文字选择
- **iframe 重建兼容**：`relocated` 事件中重新调用 `setupTextSelection()`，确保翻页后按钮依然可用
- **章节自动预填**：JS 端追踪 `currentChapter`，选中文字时一并发送

### 改动文件清单

| # | 文件 | 操作 | 说明 |
|---|------|------|------|
| 1 | `src/components/book/AddHighlightSheet.tsx` | 修改 | 新增 `prefillContent`/`prefillChapter` props |
| 2 | `src/services/readerHTML.ts` | 修改 | EPUB 模板新增 `setupTextSelection()` + 浮动按钮 |
| 3 | `app/reader/[bookId].tsx` | 修改 | 处理 `highlight` 消息 + 嵌入高亮弹窗 |
| 4 | `docs/implementation-plan.md` | 修改 | Phase 25 记录 |

---

## 阶段 26：备份/恢复补全 ✅

### 目标
修复导出/恢复功能的数据完整性问题。原仅 4/13 张表参与备份，且恢复 INSERT 列名全不匹配。

### 子任务

- [x] 26.1 修复 4 张表的恢复 INSERT 列名匹配 schema（books / reading_sessions / manual_logs / reading_sources）
- [x] 26.2 新增 8 张表的导出（tags / book_tags / collections / book_collections / reading_goals / notes / user_settings / highlights）
- [x] 26.3 新增 8 张表的恢复（含适当去重策略：INSERT OR IGNORE / INSERT OR REPLACE）
- [x] 26.4 版本号 v2.2 → v2.3

### 改动文件

| # | 文件 | 操作 | 说明 |
|---|------|------|------|
| 1 | `app/(tabs)/profile.tsx` | 修改 | handleExport/handleBackup 新增 8 张表导出；handleRestore 修复 4 条 INSERT + 新增 8 张表恢复 |

---

## 阶段 27：书单创建跨平台 + 编辑 ✅

### 目标
修复 Android 无法创建书单的 bug（Alert.prompt iOS-only），同时为书单详情页提供编辑能力。

### 子任务

- [x] 27.1 新建 `src/components/library/CreateCollectionSheet.tsx`（底部弹窗，支持创建 + 编辑模式）
- [x] 27.2 新增 `updateCollection` 方法到 `useCollectionStore`
- [x] 27.3 替换 `library.tsx` 中的 `Alert.prompt` 为 `CreateCollectionSheet`

### 改动文件

| # | 文件 | 操作 | 说明 |
|---|------|------|------|
| 1 | `src/components/library/CreateCollectionSheet.tsx` | **新建** | 创建/编辑书单底部弹窗 |
| 2 | `src/stores/useCollectionStore.ts` | 修改 | 新增 updateCollection 方法 |
| 3 | `app/(tabs)/library.tsx` | 修改 | Alert.prompt → CreateCollectionSheet |

---

## 阶段 28：书单详情页 ✅

### 目标
创建独立的书单详情页，替代原先的内联筛选方式。用户可以查看书单信息、编辑、删除、浏览书内书籍。

### 子任务

- [x] 28.1 新增 `fetchBooksInCollection` 方法到 `useCollectionStore`
- [x] 28.2 新建 `app/collection/[id].tsx` 详情页（头部卡片 + 操作按钮 + 书籍网格 + 空状态）
- [x] 28.3 注册 `collection/[id]` 路由到 `_layout.tsx` Stack
- [x] 28.4 更新 `library.tsx` 书单卡片点击从内联筛选改为 `router.push`

### 改动文件

| # | 文件 | 操作 | 说明 |
|---|------|------|------|
| 1 | `src/stores/useCollectionStore.ts` | 修改 | 新增 fetchBooksInCollection + collectionBooks 状态 |
| 2 | `app/collection/[id].tsx` | **新建** | 书单详情页 |
| 3 | `app/_layout.tsx` | 修改 | 注册 collection/[id] 路由 |
| 4 | `app/(tabs)/library.tsx` | 修改 | 书单卡片导航改为 router.push |
