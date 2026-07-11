---
name: stitch-restoration
description: Stitch 设计稿还原 — 将 Stitch 导出的 HTML/CSS 设计稿 1:1 还原为 RN 组件
enabled: true
priority: medium
---

# Stitch 设计稿还原 Skill

## 目的

将 Stitch（Figma → HTML）导出的设计文件，精准还原为 React Native 组件代码，确保像素级一致性。

## 触发时机

- 从 `design/code.html` 还原新页面时
- 还原 Stitch 设计稿中的组件模块时
- 用户要求对照设计稿修正样式时

## 工作流程

### 第一步：读取设计稿

```
1. 读取 design/code.html — 参考布局 + Tailwind 类名
2. 读取 design/DESIGN.md — 色彩 + 字体 + 间距定义
3. 读取 docs/design-spec.md — ReadFlow 实际设计规范（最高优先级）
```

### 第二步：Tailwind → RN StyleSheet 转换

| Tailwind Class | RN Style |
|---------------|----------|
| `bg-white` | `backgroundColor: paper.primary` → 检查是否为页面背景 |
| `bg-white` (卡片内) | `backgroundColor: paper.white` (#F6F6F8) |
| `rounded-xl` | `borderRadius: radii.lg` (16px) |
| `rounded-full` | `borderRadius: radii.full` (9999) |
| `px-md` / `px-4` | `paddingHorizontal: spacing.lg` (16px) |
| `py-3` | `paddingVertical: spacing.md` (12px) |
| `space-y-6` | `gap: spacing.xl` (24px) |
| `gap-4` | `gap: spacing.lg` (16px) |
| `gap-3` | `gap: spacing.md` (12px) |
| `border` | `borderWidth: 1, borderColor: outline.standard` |
| `font-bold` | `fontWeight: '700'` |
| `text-xl` | `fontSize: 20` |
| `text-base` | `fontSize: 16` |
| `text-sm` | `fontSize: 14` |
| `text-xs` | `fontSize: 12` |

### 第三步：特殊处理

#### 硬阴影 → 软阴影

Stitch 导出的 `code.html` 可能使用 Neo-Brutalist 的 `hard-shadow` 类。
还原时需要替换为温暖简约的 `softShadow`：

```
❌ hard-shadow (4px offset, solid #1F1F1F)
✅ softShadow (shadowOpacity: 0.04, offset: 0/1, radius: 2)
```

#### 2px 边框 → 1px 边框

```
❌ border: 2px solid #1F1F1F
✅ borderWidth: 1, borderColor: '#E5E0DB'
```

#### 深色边框按钮 → Pill 按钮

```
❌ border: 1px solid #1F1F1F + 硬阴影按钮
✅ 强调色背景 + borderRadius: radii.full + 白色文字
```

#### 颜色映射

| Stitch 色 | ReadFlow Token |
|-----------|---------------|
| `#FAF7F2` (background) | 忽略，使用 `#FFFFFF` |
| `#FFFFFF` (surface) | `paper.white` (`#F6F6F8`) |
| `#1F1F1F` (on-surface) | `ink.primary` (`#1A1512`) |
| `#474553` (on-surface-variant) | `ink.secondary` (`#8A7A6E`) |
| `#A98CE8` (primary) | 忽略，使用 5 色 accent 系统 |
| `#8ED2A0` (secondary) | `accent.green` |
| `#F6C667` (tertiary) | `accent.yellow` |

### 第四步：验证

1. 确认所有颜色映射正确
2. 确认阴影/边框已替换为温暖简约
3. 确认间距使用 4px 网格
4. 运行 TypeScript 检查

## 优先级规则

```
用户最新设计规范 (docs/design-spec.md)
    >
Stitch DESIGN.md
    >
code.html
```

当设计来源冲突时，用户规范始终最高优先级。

## 输出格式

生成完整的 React Native 组件代码，保留 Stitch 设计稿的布局结构和内容层次。
