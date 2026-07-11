---
name: detail-page-generator
description: 详情页生成器 — 按照设计规范自动生成书籍详情页布局
enabled: true
priority: high
---

# 详情页生成器 Skill

## 目的

按照 ReadFlow 设计规范，自动生成或更新书籍详情页 (`app/book/[id].tsx`)，确保布局、样式、交互符合温暖简约风格。

## 触发时机

- 创建新的详情页时
- 更新 `app/book/[id].tsx` 时
- 修改书籍详情页的模块布局时

## 详情页布局模板

### 模块清单（从上到下）

```
┌─────────────────────────────┐
│ 1. Hero 区                  │
│    封面图 / 首字占位         │
│    书名 (h1, 24px Bold)     │
│    作者 (body, 14px)        │
│    星级评分 (可交互)         │
│    状态切换 Chips           │
├─────────────────────────────┤
│ 2. 继续阅读卡片（如有来源）   │
│    来源类型图标 + 书名       │
│    进度条 + 百分比           │
│    打开阅读按钮              │
├─────────────────────────────┤
│ 3. 快速操作按钮 (2列 Grid)   │
│    [开始计时] [手动记录]     │
├─────────────────────────────┤
│ 4. 阅读统计卡片             │
│    总时长 / 次数 / 最近阅读  │
├─────────────────────────────┤
│ 5. 简介 (展开/收起)         │
├─────────────────────────────┤
│ 6. 阅读来源                 │
│    来源列表 + 添加按钮       │
│    空状态骨架               │
├─────────────────────────────┤
│ 7. 标签 (Pill Chips)        │
│    标签列表 + 编辑按钮       │
├─────────────────────────────┤
│ 8. 所属书单                 │
│    书单列表 + 编辑按钮       │
├─────────────────────────────┤
│ 9. 阅读时间线               │
│    垂直时间线 + 节点         │
└─────────────────────────────┘
```

## 组件规范

### 卡片容器

```typescript
// 温暖简约卡片样式
card: {
  backgroundColor: paper.white,   // #F6F6F8
  borderRadius: radii.lg,         // 16px
  borderWidth: 1,
  borderColor: outline.standard,  // #E5E0DB
  padding: spacing.lg,            // 16px
  ...softShadow,
}
```

### 状态 Chips

```typescript
// Pill 形状，激活态实心，非激活态空心
statusChip: {
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.sm,
  borderRadius: radii.full,
  borderWidth: 1,
  borderColor: outline.standard,  // 非激活态
  // 激活态: backgroundColor: ink.primary, borderColor: ink.primary
}
```

### 快速操作按钮

```typescript
// 圆角卡片按钮，带图标 + 文字
actionBtn: {
  backgroundColor: paper.white,
  borderRadius: radii.lg,
  borderWidth: 1,
  borderColor: outline.standard,
  padding: spacing.lg,
  alignItems: 'center',
  ...softShadow,
}
```

### 区块标题

```typescript
sectionTitle: {
  fontFamily: 'PlusJakartaSans_800ExtraBold',
  fontSize: 18,
  fontWeight: '800',
  color: ink.primary,  // #1A1512
}
```

## 交互规范

- 评分：点击星级 → 更新评分 → 震动反馈 (light)
- 状态切换：点击 Chip → 即时切换
- 计时按钮：根据当前状态变化（开始/停止/已暂停）
- 手动记录：弹出 ManualLogSheet（弹簧动画）
- 添加来源：弹出 AddSourceSheet（弹簧动画）
- 标签/书单：弹出对应 Picker（弹簧动画）

## 数据流

```
useBookStore → book（基本信息）
useReadingStore → stats（统计数据）
useSourceStore → sources（阅读来源）
useTagStore → bookTags（标签）
useCollectionStore → bookCollections（书单）
useTimerStore → 计时状态
```

## 输出格式

生成完整的 `app/book/[id].tsx` 文件，包含：
1. 所有 import
2. 组件函数 + 状态管理
3. 完整的 StyleSheet.create() 样式
4. 类型注释
