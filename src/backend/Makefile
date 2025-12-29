.PHONY: lint format check deploy logs

# 检查代码风格（不修改文件）
lint:
	ruff check .

# 自动修复代码风格并格式化
format:
	ruff check --fix .
	ruff format .

# 运行所有检查（包括 Django 检查）
check: lint
	python manage.py check

# 一键部署（请在服务器上运行此命令）
deploy:
	@chmod +x deploy.sh
	@./deploy.sh

# 查看生产环境日志
logs:
	docker compose logs -f
