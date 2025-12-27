.PHONY: lint format check

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
