---
name: design-guard
description: 设计守卫 — 确保每次代码变更不偏离温暖简约设计规范
enabled: true
priority: high
---

# 设计守卫 Skill

## 目的

在每次代码变更前/后自动检查设计一致性，确保不偏离 ReadFlow v2.0 温暖简约设计规范。

## 触发时机

- 创建新页面或组件时
- 修改现有组件的样式时
- 用户要求进行设计审查时

## 检查清单

### 色彩

| 规则 | 正确 ✅ | 错误 ❌ |
|------|---------|---------|
| 页面背景 | `paper.primary` (#FFFFFF) | #FDF8F0, #FAF7F2, 渐变 |
| 卡片背景 | `paper.white` (#F6F6F8) | #FFFFFF 纯白 |
| 卡片边框 | `thinBorder` (1px #E5E0DB) | 2px #1F1F1F |
| 主文字 | `ink.primary` (#1A1512) | #1C1B1A, #000000 |
| 次文字 | `ink.secondary` (#8A7A6E) | #6B6560, #77777E |
| 强调色 | 5 色 accent 系统 | 自定义颜色 |

### 阴影

| 规则 | 正确 ✅ | 错误 ❌ |
|------|---------|---------|
| 卡片阴影 | `softShadow` (opacity 0.04) | 硬阴影 4px 4px |
| 浮动元素 | `softShadowMd` (opacity 0.06) | elevation > 2 |
| 禁止 | — | `cardShadow` 模式（position absolute + backgroundColor） |

### 边框和圆角

| 规则 | 正确 ✅ | 错误 ❌ |
|------|---------|---------|
| 卡片圆角 | `radii.lg` (16px) | 8px, 4px |
| 按钮圆角 | `radii.full` (Pill) | `radii.sm` (8px) |
| 边框宽度 | `1px` | `2px` |
| 边框颜色 | `outline.standard` (#E5E0DB) | `ink.primary` (#1A1512) |

### 间距

| 规则 | 值 |
|------|-----|
| 页面边距 | `spacing.lg` (16px) |
| 卡片间距 | `spacing.md` (12px) 或 `spacing.lg` (16px) |
| 区块间距 | `spacing.xl` (24px) |
| 卡片内边距 | `spacing.lg` (16px) |

### 禁止项

- ❌ 渐变 (`linear-gradient`, `radial-gradient`)
- ❌ 毛玻璃 (`backdrop-filter: blur()`)
- ❌ 厚重阴影 (`shadowOpacity > 0.1`, `elevation > 2`)
- ❌ 2px 黑色边框（Neo-Brutalist 遗留）
- ❌ 硬阴影 position absolute 技巧

## 检查流程

1. 读取待检查的文件
2. 逐项对照检查清单
3. 发现违规 → 报告具体文件和行号 + 修复建议
4. 确认无违规或修复完成后 → 通过

## 输出格式

```
## 设计审查报告

### 文件: xxx.tsx
- ✅ 色彩合规
- ✅ 阴影合规
- ❌ 第 42 行: borderWidth: 2 → 应改为 borderWidth: 1
- ❌ 第 58 行: backgroundColor: '#FFFFFF' → 应改为 paper.white (#F6F6F8)

### 总结
通过: X 项 | 违规: Y 项 | 待修复: Z 项
```
