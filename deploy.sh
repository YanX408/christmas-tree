#!/bin/bash

# 圣诞树应用 Docker 部署脚本
# 使用方法: ./deploy.sh

set -e

echo "🎄 开始部署圣诞树应用..."

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

# 检查 Docker Compose 是否安装
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

# 创建必要的目录
echo "📁 创建必要的目录..."
mkdir -p public/photos
chmod 755 public/photos

# 构建镜像
echo "🔨 构建 Docker 镜像..."
docker-compose build

# 停止旧容器（如果存在）
echo "🛑 停止旧容器..."
docker-compose down 2>/dev/null || true

# 启动服务
echo "🚀 启动服务..."
docker-compose up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 检查服务状态
echo "📊 检查服务状态..."
docker-compose ps

# 检查端口
echo "🔍 检查端口占用..."
if netstat -tlnp 2>/dev/null | grep -q ":8080"; then
    echo "✅ 前端服务运行在端口 8080"
else
    echo "⚠️  前端服务可能未正常启动，请检查日志: docker-compose logs frontend"
fi

if netstat -tlnp 2>/dev/null | grep -q ":3001"; then
    echo "✅ 后端服务运行在端口 3001"
else
    echo "⚠️  后端服务可能未正常启动，请检查日志: docker-compose logs backend"
fi

echo ""
echo "✨ 部署完成！"
echo ""
echo "📝 下一步："
echo "1. 配置你的 nginx 代理（参考 nginx-proxy.conf.example）"
echo "2. 重启 nginx: sudo systemctl restart nginx"
echo "3. 访问应用测试功能"
echo ""
echo "📋 常用命令："
echo "  查看日志: docker-compose logs -f"
echo "  重启服务: docker-compose restart"
echo "  停止服务: docker-compose down"
echo ""

