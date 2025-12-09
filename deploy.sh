#!/bin/bash
set -e

APP_DIR="/opt/christmas-tree"
cd "$APP_DIR"

# 如有 git 可启用：git pull --rebase

# 构建并启动
docker-compose build
docker-compose up -d

# 验证
docker-compose ps