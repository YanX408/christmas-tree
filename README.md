# 🎄 Christmas Memories Tree

一个基于 React Three Fiber 的 3D 交互式圣诞树记忆展示项目，通过 AI 手势识别技术，让您的珍贵回忆在魔法般的 3D 空间中呈现。

## ✨ 项目特色

- **3D 交互体验**：使用 Three.js 和 React Three Fiber 构建的沉浸式 3D 场景
- **AI 手势控制**：集成 MediaPipe 手势识别，支持多种手势交互
- **双重视图模式**：
  - **CHAOS 模式**：记忆碎片散落在空间中
  - **TREE 模式**：记忆按时间轴排列成圣诞树形状
- **丰富的视觉效果**：水晶装饰、粒子特效、后处理效果
- **响应式设计**：适配不同屏幕尺寸

## 🎮 手势交互速览

单手：
- **食指指向**：移动指针；悬停 1s 点击照片。
- **Victory 长按（FORMED）**：灯光脉冲 + 旋转加速；（CHAOS）随机展示一张照片。
- **拇指点赞 + 左右快速摆动（FORMED）**：切换装饰/灯光主题。
- **五指张开（CHAOS）**：单手缩放；照片打开时左右划可换照片。
- **Shaka（拇指+小指）**：平移树的位置（未开照片时）。
- **握拳**：树形态下调节旋转（持续旋转会逐渐衰减）。

双手：
- **双手距离变化**：缩放场景。
- **双手五指**：同上，缩放更灵敏。

点击/关闭：
- 悬停 1s 触发点击；照片打开后再悬停可关闭。
- 拇指点赞可关闭当前照片（不强制切换到 CHAOS）。

## 🚀 安装与运行

环境要求：Node.js 16+，现代浏览器（支持 WebGL/WebRTC）。

```bash
# 安装依赖
npm install

# 开发预览
npm run dev   # 访问 http://localhost:5173

# 生产构建
npm run build

# 构建预览
npm run preview
```

## 📁 项目结构

```
christmas-tree/
├── src/
│   ├── App.tsx                      # 主应用组件
│   ├── types.ts                     # TypeScript 类型定义
│   ├── components/
│   │   ├── Experience.tsx           # 3D 场景主组件
│   │   ├── TreeSystem.tsx           # 圣诞树系统（粒子、照片球体）
│   │   ├── CrystalOrnaments.tsx     # 水晶装饰组件
│   │   ├── GestureInput.tsx         # 手势识别输入
│   │   └── TechEffects.tsx          # 科技感视觉特效
│   └── index.css                    # 全局样式
├── public/
│   └── photos/                      # 照片存放目录（被 .gitignore 排除）
├── metadata.json                    # 项目元数据
└── package.json                     # 项目配置
```

## 🎨 技术栈

### 核心框架
- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具

### 3D 渲染
- **Three.js** - 3D 图形库
- **@react-three/fiber** - React Three.js 渲染器
- **@react-three/drei** - Three.js 实用工具集
- **@react-three/postprocessing** - 后处理效果

### AI 与交互
- **@mediapipe/tasks-vision** - 手势识别
- **@use-gesture/react** - 手势处理
- **framer-motion** - 动画库

### 样式
- **Tailwind CSS 4** - 实用优先的 CSS 框架

## 📸 添加照片

1. 将照片放入 `public/photos/` 目录
2. 照片命名格式：`YYYY_MM_序号.jpg`（例如：`2024_12_1.jpg`）
3. 照片会自动按时间排序并在树上显示

> 注意：`public/photos/` 目录下的照片不会被提交到 Git 仓库

## 🎯 使用说明

1. **首次访问**：浏览器会请求摄像头权限，允许后即可使用手势控制
2. **探索模式**：在 CHAOS 模式下，照片散落在空间中，使用手势旋转和缩放来探索
3. **时间轴模式**：切换到 TREE 模式，照片会按时间顺序排列成圣诞树形状
4. **查看照片**：用手掌指针悬停在照片上 1 秒即可查看大图
5. **关闭照片**：在照片大图上悬停 1 秒即可关闭

## 🛠️ 自定义配置

### 修改照片路径

在 `src/components/TreeSystem.tsx` 中修改 `photoData` 数组。

### 调整手势灵敏度

在 `src/components/GestureInput.tsx` 中调整相关参数。

### 修改视觉效果

在 `src/components/Experience.tsx` 中调整后处理效果参数。

## 🎁 功能亮点

- 实时手势识别，无需触摸屏幕
- 流畅的 3D 动画和过渡效果
- 水晶般的粒子特效
- 梦幻的光标跟随系统
- 科技感的 UI 界面
- 时间轴式的记忆展示

## 📝 开发日志

- ✅ 基础 3D 场景搭建
- ✅ 手势识别集成
- ✅ 双手控制实现
- ✅ 单手缩放控制
- ✅ 时间轴功能
- ✅ 视觉特效优化

## 📄 许可证

MIT License

## 🙏 致谢

感谢以下开源项目：
- React Three Fiber
- Three.js
- MediaPipe
- Framer Motion
- Tailwind CSS
