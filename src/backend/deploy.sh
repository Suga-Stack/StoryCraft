#!/bin/bash

# 停止脚本执行如果任何命令返回错误
set -e

echo "开始部署流程..."

# 确保在正确的目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"
echo "已切换到目录: $SCRIPT_DIR"

# 拉取最新代码
echo "正在拉取最新代码..."
git pull origin backend

# 重启 Docker 容器
echo "正在重启 Docker 容器..."
docker compose -f docker-compose.yml up -d --build

echo "部署完成！"
