.PHONY: install dev build lint format fix clean help

help:
	@echo "Available commands:"
	@echo "  make install  - Install dependencies"
	@echo "  make dev      - Start development server"
	@echo "  make build    - Build for production"
	@echo "  make lint     - Run lint checks"
	@echo "  make fix      - Fix linting and formatting issues automatically"
	@echo "  make format   - Format code with Prettier"

install:
	npm install

dev:
	npm run dev

build:
	npm run build

lint:
	npm run lint

fix:
	npm run lint -- --fix
	npm run format

format:
	npm run format

clean:
	rm -rf dist node_modules
