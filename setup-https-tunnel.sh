#!/bin/bash

# Cloudflare Tunnel 快速设置脚本
# 用于在没有域名和证书的情况下启用 HTTPS，以便调用摄像头

set -e

echo "🚀 Cloudflare Tunnel 快速设置"
echo "================================"
echo ""

# 检查是否以 root 运行
if [ "$EUID" -ne 0 ]; then 
    echo "❌ 请使用 root 权限运行此脚本: sudo $0"
    exit 1
fi

# 检查 cloudflared 是否已安装
if ! command -v cloudflared &> /dev/null; then
    echo "📥 正在下载 cloudflared..."
    
    # 检测系统架构
    ARCH=$(uname -m)
    if [ "$ARCH" = "x86_64" ]; then
        ARCH="amd64"
    elif [ "$ARCH" = "aarch64" ]; then
        ARCH="arm64"
    else
        echo "❌ 不支持的架构: $ARCH"
        exit 1
    fi
    
    # 下载最新版本
    DOWNLOAD_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}"
    wget -q "$DOWNLOAD_URL" -O /usr/local/bin/cloudflared
    chmod +x /usr/local/bin/cloudflared
    
    echo "✅ cloudflared 安装完成"
else
    echo "✅ cloudflared 已安装: $(cloudflared --version)"
fi

echo ""
echo "📋 接下来的步骤："
echo ""
echo "1. 登录 Cloudflare（会打开浏览器）"
echo "   如果没有账号，请先访问 https://dash.cloudflare.com/sign-up 注册（免费）"
echo ""
read -p "按 Enter 继续登录..."

# 登录
cloudflared tunnel login

echo ""
echo "2. 创建隧道..."
TUNNEL_NAME="christmas-tree-$(date +%s)"
TUNNEL_OUTPUT=$(cloudflared tunnel create "$TUNNEL_NAME" 2>&1)
TUNNEL_ID=$(echo "$TUNNEL_OUTPUT" | grep -oP '(?<=Created tunnel )[a-f0-9-]+' || echo "")

if [ -z "$TUNNEL_ID" ]; then
    echo "❌ 无法获取隧道 ID，请手动运行: cloudflared tunnel create christmas-tree"
    exit 1
fi

echo "✅ 隧道创建成功: $TUNNEL_ID"

# 创建配置目录
mkdir -p /root/.cloudflared

# 创建配置文件
cat > /root/.cloudflared/config.yml << EOF
tunnel: $TUNNEL_ID
credentials-file: /root/.cloudflared/$TUNNEL_ID.json

ingress:
  # 前端应用
  - service: http://localhost:8080
  # 默认规则（必须放在最后）
  - service: http_status:404
EOF

echo "✅ 配置文件已创建: /root/.cloudflared/config.yml"

# 创建 systemd 服务
cat > /etc/systemd/system/cloudflared.service << EOF
[Unit]
Description=Cloudflare Tunnel for Christmas Tree App
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/cloudflared tunnel run --loglevel info $TUNNEL_ID
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo "✅ Systemd 服务文件已创建"

# 启动服务
systemctl daemon-reload
systemctl enable cloudflared
systemctl start cloudflared

echo ""
echo "⏳ 等待隧道启动..."
sleep 3

# 检查服务状态
if systemctl is-active --quiet cloudflared; then
    echo "✅ Cloudflare Tunnel 服务已启动"
else
    echo "⚠️  服务可能未正常启动，请检查日志: journalctl -u cloudflared -f"
fi

echo ""
echo "📝 获取访问地址："
echo "   运行以下命令查看 HTTPS 地址："
echo "   journalctl -u cloudflared -n 50 | grep -i 'trycloudflare'"
echo ""
echo "   或者查看实时日志："
echo "   journalctl -u cloudflared -f"
echo ""
echo "✨ 设置完成！"
echo ""
echo "📋 常用命令："
echo "   查看状态: systemctl status cloudflared"
echo "   查看日志: journalctl -u cloudflared -f"
echo "   重启服务: systemctl restart cloudflared"
echo "   停止服务: systemctl stop cloudflared"
echo ""

