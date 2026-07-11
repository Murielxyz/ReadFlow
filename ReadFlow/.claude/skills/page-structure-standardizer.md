---
name: page-structure-standardizer
description: 页面结构标准化 — 确保所有页面遵循统一的内容结构和排版规范
enabled: true
priority: medium
---

# 页面结构标准化 Skill

## 目的

确保 ReadFlow 所有页面遵循统一的布局框架和排版规范，保持视觉一致性。

## 触发时机

- 创建新页面时
- 审查现有页面结构时
- 重构页面布局时

## 标准页面结构

### Tab 页面模板

```typescript
export default function XxxScreen() {
  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 页面标题 */}
        <Text style={styles.pageTitle}>页面名</Text>
        <Text style={styles.pageSubtitle}>副标题描述</Text>

        {/* 内容区块 */}
        {/* ... */}

        {/* 底部留白 */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}
```

### 标准样式模板

```typescript
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: paper.primary,    // #FFFFFF
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,      // 16px 页面边距
    paddingTop: 60,                     // SafeArea + 状态栏
  },

  // ===== 页面标题 =====
  pageTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 30,
    fontWeight: '800',
    color: ink.primary,                // #1A1512
    letterSpacing: -0.6,
  },
  pageSubtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: ink.tertiary,               // #A39E99
    marginTop: 2,
    marginBottom: spacing.xl,           // 24px
  },

  // ===== 区块标题 =====
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 18,
    fontWeight: '800',
    color: ink.primary,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },

  // ===== 卡片 =====
  card: {
    backgroundColor: paper.white,      // #F6F6F8
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: outline.standard,     // #E5E0DB
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...softShadow,
  },
});
```

## 排版层级

| 层级 | 组件 | 规范 |
|------|------|------|
| 页面标题 | `pageTitle` | 30px / ExtraBold / #1A1512 |
| 副标题 | `pageSubtitle` | 14px / Regular / #A39E99 |
| 区块标题 | `sectionTitle` | 18px / ExtraBold / #1A1512 |
| 卡片标题 | `cardTitle` | 14-16px / Bold / #1A1512 |
| 正文 | `body` | 14px / Regular / #8A7A6E |
| 辅助文字 | `caption` | 12px / Medium / #A39E99 |

## 间距节奏

```
页面边距:      16px (spacing.lg)
区块之间:      24px (spacing.xl)
卡片之间:      12-16px (spacing.md-lg)
卡片内边距:    16px (spacing.lg)
标题与内容:    12-16px (spacing.md-lg)
底部留白:      32px+
```

## 空状态规范

```typescript
// 标准空状态组件
<View style={styles.emptyState}>
  <Text style={styles.emptyIcon}>📚</Text>
  <Text style={styles.emptyTitle}>标题</Text>
  <Text style={styles.emptyHint}>提示文字</Text>
</View>
```

## 检查流程

1. 确认页面使用了 `paper.primary` 作为根背景
2. 确认 `scrollContent` 的 `paddingHorizontal` 为 `spacing.lg`
3. 确认 `paddingTop` 考虑了 SafeArea（≥ 60px）
4. 确认所有卡片使用 `paper.white` (#F6F6F8) + `thinBorder` + `softShadow`
5. 确认标题层级正确（页面标题 / 区块标题 / 卡片标题）
6. 确认间距节奏一致（4px 网格基准）

## 输出格式

```
## 页面结构审查

### 文件: xxx.tsx
- ✅ 根背景正确 (#FFFFFF)
- ✅ 页面边距正确 (16px)
- ❌ 区块标题应为 18px ExtraBold，实际为 20px
- ❌ 缺少底部留白

### 修正建议
1. 修改 sectionTitle fontSize: 20 → 18
2. 在 ScrollView 末尾添加 <View style={{ height: 32 }} />
```
