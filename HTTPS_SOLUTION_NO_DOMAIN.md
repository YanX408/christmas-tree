# 无域名无证书的 HTTPS 解决方案

由于浏览器安全策略，**必须使用 HTTPS 才能调用摄像头**（除了 localhost）。如果你没有域名和证书，可以使用以下最简单的方案。

## 🎯 方案对比

| 方案 | 难度 | 费用 | 推荐度 |
|------|------|------|--------|
| **Cloudflare Tunnel** | ⭐ 简单 | 免费 | ⭐⭐⭐⭐⭐ 最推荐 |
| **ngrok** | ⭐ 简单 | 免费（有限制） | ⭐⭐⭐⭐ |
| **自签名证书** | ⭐⭐ 中等 | 免费 | ⭐⭐ 不推荐 |

---

## 🚀 方案一：Cloudflare Tunnel（最推荐）

**优点**：
- ✅ 完全免费
- ✅ 不需要域名
- ✅ 不需要证书
- ✅ 自动提供 HTTPS
- ✅ 设置简单（5分钟搞定）
- ✅ 稳定可靠

### 步骤 1：安装 cloudflared

在服务器上执行：

```bash
# 下载 cloudflared（Linux 64位）
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /usr/local/bin/cloudflared

# 或者使用包管理器（如果可用）
# Ubuntu/Debian:
# wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
# sudo dpkg -i cloudflared-linux-amd64.deb

# 添加执行权限
chmod +x /usr/local/bin/cloudflared

# 验证安装
cloudflared --version
```

### 步骤 2：创建隧道

```bash
# 登录 Cloudflare（会打开浏览器，如果没有账号需要先注册，免费）
cloudflared tunnel login

# 创建隧道（名称可以自定义）
cloudflared tunnel create christmas-tree

# 这会生成一个隧道 ID，记下来（例如：xxxx-xxxx-xxxx-xxxx）
```

### 步骤 3：配置隧道

创建配置文件：

```bash
# 创建配置目录
mkdir -p ~/.cloudflared

# 创建配置文件
cat > ~/.cloudflared/config.yml << EOF
tunnel: <你的隧道ID>  # 替换为步骤2中生成的隧道ID
credentials-file: /root/.cloudflared/<隧道ID>.json

ingress:
  # 前端应用（通过 nginx 代理）
  - hostname: <随机域名>.trycloudflare.com  # 可以留空，会自动分配
    service: http://localhost:8080
  # 后端 API（如果需要）
  - service: http://localhost:3001
  # 默认规则（必须放在最后）
  - service: http_status:404
EOF
```

**或者更简单的方式**（让 Cloudflare 自动分配域名）：

```bash
cat > ~/.cloudflared/config.yml << EOF
tunnel: <你的隧道ID>
credentials-file: /root/.cloudflared/<隧道ID>.json

ingress:
  - service: http://localhost:8080
  - service: http_status:404
EOF
```

### 步骤 4：运行隧道

```bash
# 前台运行（测试用）
cloudflared tunnel run <你的隧道ID>

# 后台运行（生产环境）
cloudflared tunnel run --loglevel info <你的隧道ID> &
```

### 步骤 5：设置为系统服务（推荐）

创建 systemd 服务文件：

```bash
sudo cat > /etc/systemd/system/cloudflared.service << EOF
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/cloudflared tunnel run --loglevel info <你的隧道ID>
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

# 替换 <你的隧道ID> 为实际的隧道ID
# 然后启动服务
sudo systemctl daemon-reload
sudo systemctl enable cloudflared
sudo systemctl start cloudflared

# 查看状态
sudo systemctl status cloudflared

# 查看日志
sudo journalctl -u cloudflared -f
```

### 步骤 6：获取访问地址

运行后，Cloudflare 会显示一个类似这样的地址：
```
https://xxxx-xxxx-xxxx.trycloudflare.com
```

**这就是你的 HTTPS 地址！** 直接访问即可，浏览器会自动信任证书。

### 注意事项

1. **免费版限制**：
   - 每次重启隧道，域名可能会变化（除非使用固定域名）
   - 连接数有限制，但一般够用

2. **固定域名**（可选）：
   - 如果你有 Cloudflare 账号，可以绑定固定域名
   - 但即使没有，每次重启后使用新域名也可以

---

## 🚀 方案二：ngrok（备选方案）

**优点**：
- ✅ 设置简单
- ✅ 免费版可用

**缺点**：
- ⚠️ 免费版每次启动域名会变化
- ⚠️ 免费版有连接数限制

### 步骤 1：注册并安装 ngrok

```bash
# 1. 访问 https://ngrok.com 注册账号（免费）
# 2. 获取 authtoken（在 dashboard 中）

# 3. 下载 ngrok
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar -xzf ngrok-v3-stable-linux-amd64.tgz
sudo mv ngrok /usr/local/bin/

# 4. 配置 authtoken
ngrok config add-authtoken <你的authtoken>
```

### 步骤 2：启动隧道

```bash
# 启动 HTTP 隧道（指向你的 nginx 或应用）
ngrok http 8080

# 或者指定域名（需要付费版）
# ngrok http 8080 --domain=your-domain.ngrok.io
```

### 步骤 3：获取 HTTPS 地址

ngrok 会显示类似这样的地址：
```
Forwarding  https://xxxx-xxxx-xxxx.ngrok-free.app -> http://localhost:8080
```

**这就是你的 HTTPS 地址！**

### 设置为系统服务

```bash
sudo cat > /etc/systemd/system/ngrok.service << EOF
[Unit]
Description=ngrok tunnel
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/ngrok http 8080 --log=stdout
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable ngrok
sudo systemctl start ngrok
```

---

## 🔧 方案三：自签名证书（不推荐，但可用）

**缺点**：
- ⚠️ 用户访问时需要手动信任证书
- ⚠️ 体验不好
- ⚠️ 移动端可能无法使用

### 步骤 1：生成自签名证书

```bash
# 创建证书目录
mkdir -p /opt/christmas-tree/ssl
cd /opt/christmas-tree/ssl

# 生成私钥和证书（有效期1年）
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout server.key \
  -out server.crt \
  -subj "/C=CN/ST=State/L=City/O=Organization/CN=your-server-ip"

# 设置权限
chmod 600 server.key
chmod 644 server.crt
```

### 步骤 2：修改 nginx 配置

编辑你的 nginx 配置文件，添加 HTTPS：

```nginx
server {
    listen 80;
    server_name your-server-ip;  # 或使用服务器IP
    
    # 重定向 HTTP 到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-server-ip;  # 或使用服务器IP
    
    # SSL 证书配置
    ssl_certificate /opt/christmas-tree/ssl/server.crt;
    ssl_certificate_key /opt/christmas-tree/ssl/server.key;
    
    # SSL 优化
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # 前端应用代理
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

### 步骤 3：重启 nginx

```bash
sudo nginx -t
sudo systemctl restart nginx
```

### 步骤 4：访问

使用 `https://your-server-ip` 访问，浏览器会提示证书不安全，需要：
1. 点击"高级"
2. 点击"继续访问"（或类似选项）

---

## 📝 推荐方案总结

**强烈推荐使用 Cloudflare Tunnel**，因为：
1. ✅ 完全免费
2. ✅ 不需要域名
3. ✅ 不需要证书
4. ✅ 自动 HTTPS
5. ✅ 设置简单
6. ✅ 稳定可靠

**快速开始（Cloudflare Tunnel）**：

```bash
# 1. 安装
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# 2. 登录并创建隧道
cloudflared tunnel login
cloudflared tunnel create christmas-tree

# 3. 运行（会显示 HTTPS 地址）
cloudflared tunnel run <隧道ID>
```

**就这么简单！** 🎉

---

## 🐛 故障排除

### Cloudflare Tunnel 无法连接

1. 检查防火墙是否开放端口
2. 检查本地服务是否运行：`curl http://localhost:8080`
3. 查看日志：`sudo journalctl -u cloudflared -f`

### ngrok 连接失败

1. 检查 authtoken 是否正确配置
2. 检查本地服务是否运行
3. 查看 ngrok 日志

### 自签名证书浏览器不信任

这是正常的，需要用户手动信任。如果不想每次提示，建议使用 Cloudflare Tunnel 或 ngrok。

---

## 📞 需要帮助？

如果遇到问题，请检查：
1. 本地服务是否正常运行（`curl http://localhost:8080`）
2. 防火墙设置
3. 隧道服务的日志

