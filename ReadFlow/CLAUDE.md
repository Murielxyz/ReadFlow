# ReadFlow 项目 CLAUDE.md

> 这是 Claude Code 的项目指引文件。每次工作时，Claude 会读取此文件以了解项目上下文。

---

## 📂 项目概述

ReadFlow 是一个"以书为中心"的阅读记录 App，使用 React Native + Expo 构建，优先安卓平台。

**核心概念**：一本书 = 一个阅读中心，所有阅读行为（电子书/纸质书/外部平台）统一管理。

**当前版本**: v2.3 — 28 阶段完整实现：温暖简约风格 + 全功能阅读记录

---

## 🎨 设计风格

**温暖简约（Warm Minimalist）** — 纯白背景，极轻阴影，细线边框，大量留白。

| 属性 | 值 |
|------|-----|
| 页面背景 | `#FFFFFF` (paper.primary) |
| 卡片背景 | `#F6F6F8` (paper.white) |
| 卡片边框 | `1px solid #E5E0DB` |
| 卡片圆角 | `16px` (radii.lg) |
| 主文字 | `#1A1512` (ink.primary) |
| 次文字 | `#8A7A6E` (ink.secondary) |
| 强调色 | 蓝 `#4A90D9` / 紫 `#7C6BFF` / 黄 `#F5A623` / 绿 `#50C878` / 粉 `#FF6B8A` |
| 阴影 | 极轻（opacity 0.04-0.06） |
| 间距 | 4px 网格基准 |

**禁止**：渐变、毛玻璃（glassmorphism）、厚重 Material Design 阴影、2px 黑边框

---

## 📋 标准文档索引

在开始任何开发任务前，请先查阅相关标准文档：

| 文档 | 路径 | 内容 |
|------|------|------|
| 产品需求 | [docs/requirements.md](docs/requirements.md) | 功能需求、8 页面清单、导入流程 |
| 技术栈 | [docs/tech-stack.md](docs/tech-stack.md) | 选型原因、版本、Skills + Stitch MCP |
| 设计规范 | [docs/design-spec.md](docs/design-spec.md) | 色彩、间距、圆角、字体、阴影、组件规范 |
| 架构设计 | [docs/architecture.md](docs/architecture.md) | 4 Tab 路由、分层架构、数据流 |
| 执行步骤 | [docs/implementation-plan.md](docs/implementation-plan.md) | v1.0 (8阶段) + v2.0 (3阶段) 任务清单 |

---

## 🧩 Skills（6 个专用 AI Skill）

| Skill | 文件 | 用途 |
|-------|------|------|
| 设计守卫 | `.claude/skills/design-guard.md` | 每次变更后检查设计合规性 |
| 详情页生成器 | `.claude/skills/detail-page-generator.md` | 按规范生成书籍详情页布局 |
| 页面结构标准化 | `.claude/skills/page-structure-standardizer.md` | 确保页面统一排版层级 |
| Stitch 还原 | `.claude/skills/stitch-restoration.md` | Tailwind → RN StyleSheet 1:1 还原 |
| 版本发布 | `.claude/skills/version-release.md` | 自动化版本更新 + 发布检查 |
| 冲突仲裁 | `.claude/skills/conflict-arbitrator.md` | 设计/需求冲突按优先级链仲裁 |

---

## 🗂 项目结构

```
ReadFlow/
├── app/
│   ├── _layout.tsx               # 根布局（字体 + DB 初始化）
│   ├── (tabs)/
│   │   ├── _layout.tsx           # 底部 4 Tab 导航
│   │   ├── today.tsx             # Tab 1: Today
│   │   ├── library.tsx           # Tab 2: Library
│   │   ├── statistics.tsx        # Tab 3: Statistics
│   │   └── profile.tsx           # Tab 4: Profile
│   ├── book/[id].tsx             # 书籍详情页
│   ├── reader/[bookId].tsx       # 阅读器（全屏）
│   └── add-book.tsx              # 添加书本（Modal）
│
├── src/
│   ├── components/
│   │   ├── common/               # Button, Card, Badge, Rating, EmptyState
│   │   ├── today/                # Today 页组件
│   │   ├── library/              # BookCard, BookGrid, BookFilters, BookListItem
│   │   ├── discover/             # Discover 页组件
│   │   ├── book/                 # BookCover, ReadingTimeline, SourceCard 等
│   │   ├── reader/               # TimerFloating, ManualLogSheet
│   │   └── profile/              # Profile 页组件
│   ├── models/                   # TypeScript 类型定义
│   ├── stores/                   # Zustand 状态管理 (7 stores)
│   ├── db/                       # SQLite 数据库
│   ├── theme/                    # colors, spacing, radii, typography, shadows
│   ├── constants/                # theme.ts (设计令牌) + index.ts (状态常量)
│   ├── data/                     # mockData.ts (Mock 数据)
│   └── utils/                    # id, format, haptics
│
├── design/                       # Stitch 设计文件
│   ├── DESIGN.md                 # Neo-Graphite 参考（已过时）
│   └── code.html                 # 参考布局 HTML
│
├── docs/                         # 开发文档 (5 份)
├── .claude/skills/               # AI Skill 定义 (6 个)
├── assets/                       # 图片、字体等资源
└── CLAUDE.md                     # 本文件
```

---

## 🏗 导航结构（4 Tab）

```
Today | Library | Statistics | Profile
```

| Tab | 图标 (active/outline) | 页面 |
|-----|----------------------|------|
| Today | `today` / `today-outline` | 问候 + 继续阅读 + 统计 + 目标 + 时间线 + 名言 |
| Library | `library` / `library-outline` | 搜索 + 筛选 + 2列网格 + 在线搜索 + 导入 |
| Statistics | `stats-chart` / `stats-chart-outline` | 总览 + 热力图 + 趋势 + 已读完 |
| Profile | `person` / `person-outline` | 用户信息 + 设置 + 暗色模式 |

---

## 🔧 开发日志

每次开发结束后，在 [dev-logs/](dev-logs/) 目录写入 `YYYY-MM-DD.md`，格式参考 [dev-logs/2026-07-01.md](dev-logs/2026-07-01.md)。

---

## 🏗 工作原则

1. **先读 Skill** — 涉及设计/页面/发布的工作，先查阅对应 Skill
2. **每次只做一个小阶段** — 完成一个子任务，验证通过，再做下一个
3. **不确定就问** — 涉及功能取舍、UI 细节、技术选择时，先问用户
4. **保持代码整洁** — 遵循已有的文件结构、命名和代码风格
5. **写完后验证** — `npx tsc --noEmit` 确保零错误
6. **更新文档** — 完成阶段后更新 `docs/implementation-plan.md` 勾选状态
7. **写开发日志** — 每天结束写入 `dev-logs/`
8. **提前提醒用户** — 涉及需要用户手动操作（API Key、图标、签名等）的环节时，至少提前 2-3 步告知。详见 [用户手动操作提醒原则](docs/implementation-plan.md#⚠️-用户手动操作提醒原则)

---

## ⚠️ 注意事项

- 本项目使用 Expo SDK **57**（非 v52），查阅文档时注意版本：https://docs.expo.dev/versions/v57.0.0/
- npm 网络偶发不稳定（ECONNRESET），失败后重试即可
- 用户是完全零基础的小白，解释技术概念时请用通俗语言
- 文档优先级：用户指令 > PRD (requirements.md) > 设计规范 (design-spec.md) > 架构 (architecture.md) > CLAUDE.md > Stitch 导出 (DESIGN.md / code.html)
- `design/code.html` 中的颜色是 Neo-Brutalist 遗留，不适用于当前的温暖简约风格
- 向后兼容别名（`accent.lavender`, `accent.gold`, `accent.sage`）已保留在 colors.ts 中但不再使用，新代码请用 `accent.purple/yellow/green`
- 所有页面和组件已全部迁移到温暖简约风格（v2.0）。Neo-Brutalist 样式已完全清除。
- `src/data/mockData.ts` 仅保留每日名言，其余 Mock 数据已全部替换
- 4 个 Tab 页面已全部接入真实数据：Today / Library / Statistics / Profile
