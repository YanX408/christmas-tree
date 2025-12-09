# Docker 部署指南

本文档提供详细的 Docker 部署步骤，适用于已有 nginx 的服务器环境。

## 📋 前置要求

- Docker 和 Docker Compose 已安装
- 服务器上已有 nginx 运行
- 服务器有足够的磁盘空间（建议至少 2GB）

## 🚀 部署步骤

### 1. 准备服务器环境

```bash
# 登录到你的服务器
ssh user@your-server-ip

# 创建项目目录
mkdir -p /opt/christmas-tree
cd /opt/christmas-tree
```

### 2. 上传项目文件

**⚠️ 重要：不要直接使用 `scp -r .`，这会包含 `node_modules` 等大文件（可能几GB）！**

#### 方式一：使用上传脚本（最简单，推荐）

```bash
# 在本地项目目录执行
./upload-to-server.sh user@your-server-ip /opt/christmas-tree
```

脚本会自动排除 `node_modules`、`dist`、`.git` 等不需要的文件。

#### 方式二：使用 rsync（推荐，如果已安装）

```bash
# 在本地项目目录执行，排除不需要的文件
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude '*.log' \
  --exclude '.DS_Store' \
  --exclude '.vscode' \
  --exclude '.idea' \
  ./ user@your-server-ip:/opt/christmas-tree/
```

#### 方式二：使用 tar 打包（推荐）

```bash
# 在本地项目目录执行
# 创建打包文件，排除不需要的目录
tar --exclude='node_modules' \
    --exclude='dist' \
    --exclude='.git' \
    --exclude='.env*' \
    --exclude='*.log' \
    --exclude='.DS_Store' \
    --exclude='.vscode' \
    --exclude='.idea' \
    -czf christmas-tree.tar.gz .

# 上传打包文件
scp christmas-tree.tar.gz root@116.198.203.129:/opt/christmas-tree/

# 在服务器上解压
ssh user@your-server-ip
cd /opt/christmas-tree
tar -xzf christmas-tree.tar.gz
rm christmas-tree.tar.gz
```

#### 方式三：使用 git（最推荐）

```bash
# 在服务器上
cd /opt/christmas-tree
git clone your-repo-url .

# 或者如果已有仓库，直接 pull
git pull origin main
```

#### 方式四：使用 .gitignore 配合 scp（如果项目在 git 中）

```bash
# 先确保 .gitignore 已正确配置
# 然后使用 git archive（只打包 git 跟踪的文件）
git archive --format=tar.gz --output=christmas-tree.tar.gz HEAD

# 上传
scp christmas-tree.tar.gz user@your-server-ip:/opt/christmas-tree/

# 在服务器上解压
ssh user@your-server-ip
cd /opt/christmas-tree
tar -xzf christmas-tree.tar.gz
rm christmas-tree.tar.gz
```

**重要文件列表：**
- `Dockerfile`
- `Dockerfile.server`
- `docker-compose.yml`
- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `tsconfig.json`
- `server.js`
- `src/` 目录
- `public/` 目录
- `index.html`
- `index.tsx`
- `index.css`

### 3. 配置环境变量（可选）

如果需要环境变量，创建 `.env` 文件：

```bash
cd /opt/christmas-tree
cat > .env << EOF
NODE_ENV=production
EOF
```

### 4. 构建和启动容器

```bash
cd /opt/christmas-tree

# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 5. 配置现有 nginx（重要）

由于你的服务器已有 nginx，需要将应用集成到现有配置中。

#### 方案 A：使用子路径（推荐）

编辑你的 nginx 配置文件（通常在 `/etc/nginx/sites-available/default` 或 `/etc/nginx/nginx.conf`）：

```nginx
# 前端应用代理
upstream christmas_tree_frontend {
    server localhost:8080;
}

# 后端 API 代理
upstream christmas_tree_backend {
    server localhost:3001;
}

server {
    listen 80;
    server_name your-domain.com;

    # 其他现有配置...

    # 添加圣诞树应用配置
    location /christmas-tree/ {
        proxy_pass http://christmas_tree_frontend/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 重写路径（如果需要）
        rewrite ^/christmas-tree/(.*)$ /$1 break;
    }

    # 后端 API
    location /api/photos/ {
        proxy_pass http://christmas_tree_backend/api/photos/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 文件上传大小限制
        client_max_body_size 10M;
    }
}
```

#### 方案 B：使用独立域名/子域名

```nginx
server {
    listen 80;
    server_name christmas.your-domain.com;  # 使用子域名

    # 前端应用
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 10M;
    }
}
```

#### 应用配置并重启 nginx

```bash
# 测试配置
sudo nginx -t

# 重启 nginx
sudo systemctl restart nginx
# 或
sudo service nginx restart
```

### 6. 修改前端 API 地址（如果需要）

如果使用子路径或不同域名，需要修改前端代码中的 API 地址：

编辑 `src/components/PhotoManager.tsx`，将 API 地址改为相对路径或完整 URL：

```typescript
// 如果使用子路径
const API_BASE = '/api';

// 如果使用独立域名
const API_BASE = 'http://christmas.your-domain.com/api';
```

### 7. 验证部署

```bash
# 检查容器状态
docker-compose ps

# 检查端口
netstat -tlnp | grep -E '8080|3001'

# 测试前端
curl http://localhost:8080

# 测试后端 API
curl http://localhost:3001/api/photos
```

### 8. 持久化数据

照片数据存储在 `./public/photos` 目录，已通过 volume 挂载，数据会持久化。

如果需要备份：

```bash
# 备份照片目录
tar -czf photos-backup-$(date +%Y%m%d).tar.gz /opt/christmas-tree/public/photos
```

## 🔧 常用操作

### 查看日志

```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f frontend
docker-compose logs -f backend
```

### 重启服务

```bash
# 重启所有服务
docker-compose restart

# 重启特定服务
docker-compose restart frontend
docker-compose restart backend
```

### 更新应用

```bash
cd /opt/christmas-tree

# 拉取最新代码
git pull

# 重新构建
docker-compose build

# 重启服务
docker-compose up -d
```

### 停止服务

```bash
docker-compose down
```

### 清理（谨慎使用）

```bash
# 停止并删除容器
docker-compose down

# 删除镜像
docker-compose down --rmi all

# 删除 volume（会删除照片数据！）
docker-compose down -v
```

## 🔒 安全建议

1. **使用 HTTPS（必需）**：配置 SSL 证书
   - ⚠️ **重要**：浏览器安全策略要求摄像头访问必须通过 HTTPS（除了 localhost）
   - 如果使用 HTTP 访问，摄像头功能将无法使用
   - **没有域名和证书？** 查看 [HTTPS_SOLUTION_NO_DOMAIN.md](./HTTPS_SOLUTION_NO_DOMAIN.md) 获取最简单的解决方案（推荐 Cloudflare Tunnel）
   - 如果有域名，推荐使用 Let's Encrypt 免费 SSL 证书
2. **防火墙**：只开放必要端口（80, 443）
3. **限制上传**：nginx 已配置 `client_max_body_size 10M`
4. **定期备份**：备份 `public/photos` 目录
5. **监控日志**：定期检查容器日志

## 🐛 故障排除

### 容器无法启动

```bash
# 查看详细日志
docker-compose logs

# 检查端口占用
netstat -tlnp | grep -E '8080|3001'

# 检查磁盘空间
df -h
```

### 照片无法上传

1. 检查后端容器是否运行：`docker-compose ps`
2. 检查后端日志：`docker-compose logs backend`
3. 检查目录权限：`ls -la public/photos`
4. 检查 nginx 配置中的 `client_max_body_size`

### 前端无法访问

1. 检查前端容器：`docker-compose ps frontend`
2. 检查 nginx 代理配置
3. 检查防火墙设置

### API 请求失败

1. 检查后端容器状态
2. 检查 nginx 代理配置
3. 检查 CORS 设置（如果需要）
4. 查看浏览器控制台错误

### 摄像头无法访问

**这是最常见的问题！**

1. **检查是否使用 HTTPS**：
   - 浏览器控制台查看是否有 "getUserMedia() requires a secure context" 错误
   - 确保使用 `https://` 访问，而不是 `http://`
   - 只有 `localhost` 或 `127.0.0.1` 可以使用 HTTP

2. **检查 SSL 证书**：
   ```bash
   # 测试 SSL 证书
   openssl s_client -connect your-domain.com:443
   ```

3. **检查浏览器权限**：
   - 确保浏览器允许摄像头权限
   - 检查浏览器地址栏的权限图标

4. **没有域名和证书的解决方案**：
   - 📖 **详细指南**：查看 [HTTPS_SOLUTION_NO_DOMAIN.md](./HTTPS_SOLUTION_NO_DOMAIN.md)
   - 🚀 **快速设置**：运行 `sudo ./setup-https-tunnel.sh`（推荐 Cloudflare Tunnel）
   - 或者使用 `ngrok` 等工具创建 HTTPS 隧道：
     ```bash
     ngrok http 8080
     ```

## 📝 端口说明

- **8080**: 前端静态文件服务（容器内部 80）
- **3001**: 后端 API 服务器

这些端口只在服务器内部使用，通过 nginx 对外提供服务。

## 🔄 更新流程

```bash
# 1. 备份数据
tar -czf backup-$(date +%Y%m%d).tar.gz public/photos

# 2. 拉取代码
git pull

# 3. 重新构建
docker-compose build --no-cache

# 4. 重启服务
docker-compose up -d

# 5. 检查状态
docker-compose ps
docker-compose logs -f
```

## 📞 支持

如遇问题，请检查：
1. Docker 和 Docker Compose 版本
2. 服务器资源（CPU、内存、磁盘）
3. 网络连接
4. 日志文件

