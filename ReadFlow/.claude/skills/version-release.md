---
name: version-release
description: 版本发布助手 — 自动化版本更新、发布前检查和变更日志生成
enabled: true
priority: medium
---

# 版本发布 Skill

## 目的

自动化 ReadFlow 项目的版本发布流程，确保发布前检查完整、文档同步更新。

## 触发时机

- 用户要求发布新版本时
- 完成一个开发阶段后
- 合并重大功能分支后

## 发布流程

### 第一步：发布前检查

```
□ npx tsc --noEmit → 零 TypeScript 错误
□ 所有 docs/ 文档版本号已更新
□ docs/implementation-plan.md 进度已勾选
□ dev-logs/ 已写入本次阶段总结
□ CLAUDE.md 项目指引无需更新
□ 设计审查通过（调用 design-guard Skill）
```

### 第二步：更新版本号

涉及的文件：

| 文件 | 更新内容 |
|------|---------|
| `docs/requirements.md` | 版本号 + 日期 |
| `docs/design-spec.md` | 版本号 + 日期 |
| `docs/architecture.md` | 版本号 + 日期 |
| `docs/implementation-plan.md` | 版本号 + 日期 + 进度勾选 |
| `docs/tech-stack.md` | 版本号 + 日期 |
| `app/(tabs)/profile.tsx` | 关于页版本号 |
| `app.json` (如存在) | `expo.version` |

### 第三步：生成变更日志

在 `dev-logs/` 写入新文件：

```markdown
# vX.Y.Z — YYYY-MM-DD

## 新增
- ...

## 变更
- ...

## 修复
- ...

## 设计
- ...

## 技术
- ...
```

### 第四步：Git 提交

```
git add -A
git commit -m "release: vX.Y.Z — <简要描述>"
```

## 版本号规则

```
vX.Y.Z

X: 重大功能版本（新 Tab、新核心功能）
Y: 功能增强（新页面模块、新组件）
Z: 修复和打磨（Bug 修复、样式微调）
```

## 当前版本历史

| 版本 | 日期 | 内容 |
|------|------|------|
| v1.0 | 2026-07-01 | Neo-Brutalist 初版，8 阶段全部完成 |
| v2.0 | 2026-07-03 | 温暖简约风格重构（进行中） |

## 输出格式

```
## 发布前检查结果

### 通过
- ✅ TypeScript 编译零错误
- ✅ 文档版本号已同步 (vX.Y.Z)
- ✅ 实施计划已更新
- ✅ 设计审查通过

### 待处理
- ⚠️ ...

### 变更摘要
<bullet list of changes>

### 下一步
执行 git commit 发布 vX.Y.Z
```
