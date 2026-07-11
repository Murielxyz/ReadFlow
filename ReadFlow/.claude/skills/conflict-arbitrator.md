---
name: conflict-arbitrator
description: 冲突仲裁 — 当多个设计来源或需求冲突时，按优先级链仲裁并提供决策建议
enabled: true
priority: high
---

# 冲突仲裁 Skill

## 目的

当 ReadFlow 项目中多个设计来源或需求文档产生冲突时，按照事先约定的优先级链进行仲裁，给出明确的决策建议。

## 触发时机

- 多个设计来源的颜色/间距/样式值不一致时
- PRD 需求与技术实现可行性冲突时
- 用户新需求与已有设计规范冲突时
- DESIGN.md vs design-spec.md vs code.html 内容矛盾时

## 优先级链

```
第一级（最高）: 用户当前会话明确指令
    ↓
第二级: docs/requirements.md（产品需求 PRD）
    ↓
第三级: docs/design-spec.md（设计规范）
    ↓
第四级: docs/architecture.md（架构设计）
    ↓
第五级: CLAUDE.md（项目指引）
    ↓
第六级（参考）: design/DESIGN.md + design/code.html（Stitch 导出）
```

## 仲裁流程

### 第一步：识别冲突

列出冲突的具体内容，标注来源：

```
冲突项: 页面背景色
- 来源 A (design/code.html): #FAF7F2
- 来源 B (docs/design-spec.md): #FFFFFF
- 来源 C (用户指令): #FFFFFF
```

### 第二步：按优先级链排序

```
第1级: 用户指令 → #FFFFFF ✅
第6级: Stitch → #FAF7F2
→ 仲裁结果: 采用用户指令的 #FFFFFF
```

### 第三步：给出建议

```
建议:
1. 立即采用: 用户指令中的 #FFFFFF
2. 同步更新: docs/design-spec.md（确保一致性）
3. 标记忽略: design/code.html 中的 background 值
4. 提醒用户: 如后续 Stitch 同步，此值可能被覆盖
```

### 第四步：同步相关文档

冲突解决后，确保所有相关文档同步更新：
- 更新 docs/design-spec.md
- 更新 src/theme/colors.ts
- 必要时更新 design/DESIGN.md

## 常见冲突场景

### 场景 1：Stitch 导出 vs 用户指定

```
冲突: code.html 的颜色 vs 用户指令的颜色
仲裁: 用户指令 > 所有设计文件
行动: 更新 design-spec.md + colors.ts
```

### 场景 2：PRD 需求 vs 技术限制

```
冲突: PRD 要求的功能 vs Expo SDK 限制
仲裁: 优先寻找替代方案，如无可行方案则与用户确认
行动: 记录到 CLAUDE.md 注意事项
```

### 场景 3：旧代码风格 vs 新设计规范

```
冲突: 现有页面的 Neo-Brutalist 样式 vs 温暖简约规范
仲裁: 新规范优先，但需渐进迁移
行动: 添加到 implementation-plan.md 待办
```

### 场景 4：Tab 数量/名称不一致

```
冲突: 代码 4 Tab vs PRD 5 Tab
仲裁: PRD（docs/requirements.md）> 现有代码
行动: 更新代码以匹配 PRD
```

## 输出格式

```
## 冲突仲裁报告

### 冲突描述
<简述冲突内容>

### 来源分析
| 优先级 | 来源 | 值 |
|--------|------|-----|
| 1 (最高) | 用户指令 | xxx |
| 3 | design-spec.md | yyy |
| 6 (参考) | code.html | zzz |

### 仲裁结果
→ 采用: <值> (来源: xxx)

### 行动项
1. [ ] 更新 xxx 文件
2. [ ] 同步 yyy 文档
3. [ ] 标记 zzz 为参考

### 提醒用户
<需要用户确认的事项，如果有>
```
