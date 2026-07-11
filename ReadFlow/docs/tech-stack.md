# ReadFlow 技术栈说明

> 版本: v2.0 | 更新: 2026-07-03

---

## 总览

| 类型 | 选择 | 版本 |
|------|------|------|
| 框架 | React Native (via Expo) | Expo SDK 57 |
| 语言 | TypeScript | ~6.0 |
| 路由 | Expo Router (文件路由) | ~4.0 |
| 状态管理 | Zustand | ^5.0 |
| 数据库 | expo-sqlite | ~57.0 |
| UI 图标 | @expo/vector-icons (Ionicons) | 内置 |
| 图片缓存 | expo-image | ~57.0 |
| 文件选择 | expo-document-picker | ~57.0 |
| 文件系统 | expo-file-system | ~57.0 |
| 震动反馈 | expo-haptics | ~57.0 |
| 电子书阅读 | react-native-webview + epub.js / PDF.js | WebView 13.x |
| 设备 API | expo-constants, expo-linking, expo-status-bar | ~57.0 |
| 安全区域 | react-native-safe-area-context | ~5.7 |
| 屏幕管理 | react-native-screens | ~4.25 |
| 字体 | @expo-google-fonts/plus-jakarta-sans | latest |

## 开发工具链

| 工具 | 用途 |
|------|------|
| Stitch MCP | 设计稿同步（Figma → 设计规范） |
| Claude Code Skills | AI 辅助开发（6 个专用 Skill） |
| npx tsc --noEmit | TypeScript 类型检查 |

## 为什么这样选？

### React Native + Expo（而非 Flutter）
- TypeScript 学习资料最多，社区最大
- Expo 托管环境，不需要配置原生代码
- 手机装 Expo Go 扫码即预览，所见即所得

### Expo Router（而非 React Navigation 手动配置）
- 文件即路由：`app/book/[id].tsx` 自动映射到 `/book/:id`
- 减少样板代码，降低初学者心智负担

### Zustand（而非 Redux / Context）
- 零 Provider 包裹，直接 `useStore()` 使用
- 极简 API：`set()` 和 `get()` 就够用
- 自动按需重渲染，性能好

### expo-sqlite（而非 AsyncStorage / WatermelonDB）
- 关系型数据天然适合书本-标签-书单的关联查询
- 同步 API（SDK 57），写法简单
- 离线可用，零网络依赖

### WebView + epub.js / PDF.js（而非原生阅读器）
- 避免原生模块链接，Expo Go 可直接预览
- epub.js 是成熟的浏览器端 EPUB 渲染库
- 通过 postMessage 与 RN 通信

### @expo/vector-icons (Ionicons)
- Expo 内置，无需额外安装
- Ionicons 图标集覆盖 Tab 导航、操作按钮等所有场景
- 支持 filled 和 outline 两种风格，适配激活/未激活状态

### Stitch MCP
- 从 Figma/Stitch 设计稿导出设计规范
- 自动生成 `design/code.html` 参考布局
- 确保代码实现与设计稿一致

### Claude Code Skills
- 按领域拆分 6 个专用 Skill（设计守卫、详情页生成器、页面结构标准化、Stitch 还原、版本发布、冲突仲裁）
- 每个 Skill 包含专属系统提示词，保证 AI 输出一致性

## 项目启动命令

```bash
cd ReadFlow
npm start          # 启动 Expo 开发服务器
npm run android    # 安卓模拟器
npm run ios        # iOS 模拟器
npx tsc --noEmit   # TypeScript 编译检查
```
