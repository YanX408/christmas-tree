# 照片管理功能使用说明

## 功能概述

在页面右下角提供了一个"照片管理"按钮，可以：
- 上传本地图片到 `public/photos/` 目录
- 查看已上传的照片列表
- 删除不需要的照片

## 安装依赖

首先需要安装后端服务器所需的依赖：

```bash
npm install express multer cors
```

## 启动服务

### 方式一：分别启动（推荐）

1. **启动前端开发服务器**：
```bash
npm run dev
```

2. **启动后端 API 服务器**（新开一个终端）：
```bash
npm run server
```

### 方式二：同时启动（需要安装 concurrently）

如果安装了 `concurrently`，可以同时启动前后端：

```bash
npm install -D concurrently
npm run dev:all
```

## 使用步骤

1. **启动后端服务器**：确保 `server.js` 正在运行（端口 3001）

2. **打开前端应用**：访问 `http://localhost:3000`

3. **点击右下角的"照片管理"按钮**

4. **上传照片**：
   - 点击"上传照片"按钮
   - 选择本地图片文件
   - 支持格式：JPEG, PNG, GIF, WebP
   - 最大文件大小：10MB
   - 上传成功后会自动添加到照片列表

5. **管理照片**：
   - 在照片列表中查看所有已上传的照片
   - 鼠标悬停在照片上会显示删除按钮
   - 点击删除按钮可以删除照片

## API 接口

后端服务器提供以下 API 接口：

- `GET /api/photos` - 获取照片列表
- `POST /api/photos/upload` - 上传照片
- `DELETE /api/photos/:filename` - 删除照片

## 注意事项

1. **服务器必须运行**：照片管理功能需要后端服务器运行在 `http://localhost:3001`

2. **文件自动命名**：上传的文件会自动添加时间戳，避免文件名冲突

3. **自动更新 photos.json**：上传和删除操作会自动更新 `public/photos/photos.json` 文件

4. **刷新页面**：上传或删除照片后，3D 场景中的照片可能需要刷新页面才能看到更新

## 故障排除

### 上传失败
- 检查后端服务器是否运行（`npm run server`）
- 检查文件格式和大小是否符合要求
- 查看浏览器控制台的错误信息

### 照片不显示
- 检查 `public/photos/` 目录是否有文件
- 检查 `photos.json` 文件是否正确
- 刷新页面重新加载照片列表

