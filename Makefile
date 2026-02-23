.PHONY: dev backend frontend install lint fmt clean

# 一键启动：后端 + 前端同时跑
dev:
	@echo "Starting HikariWave..."
	@trap 'kill 0' EXIT; \
		$(MAKE) backend & \
		$(MAKE) frontend & \
		wait

# 单独启动后端
backend:
	uv run uvicorn backend.app.main:app --reload --port 8000

# 单独启动前端
frontend:
	cd desktop && bun run dev

# 安装所有依赖
install:
	uv sync
	cd desktop && bun install

# Lint 检查
lint:
	uv run ruff check .
	cd desktop && bun run lint

# 格式化
fmt:
	uv run ruff format .
	uv run ruff check . --fix

# 构建前端
build:
	cd desktop && bun run build

# 清理
clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	rm -f *.db
	rm -rf desktop/dist
